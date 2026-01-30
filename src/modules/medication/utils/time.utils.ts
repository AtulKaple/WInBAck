export const addHours = (date: Date, hours: number) => {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
};

export const endOfDay = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export const computeNextDoseTimes = (
  med: {
    startDate: Date;
    frequency: {
      type: string;
      times?: string[];
      daysOfWeek?: number[];
      intervalHours?: number;
    };
  }
): Date[] => {
  const doses: Date[] = [];
  const now = new Date();

  let cursor = new Date(med.startDate);

  while (doses.length < 10) {
    if (med.frequency.type === "daily") {
      (med.frequency.times || []).forEach((time) => {
        const [h, m] = time.split(":").map(Number);
        const d = new Date(cursor);
        d.setHours(h, m, 0, 0);
        if (d >= now) doses.push(d);
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    if (med.frequency.type === "weekly") {
      if (med.frequency.daysOfWeek?.includes(cursor.getDay())) {
        (med.frequency.times || []).forEach((time) => {
          const [h, m] = time.split(":").map(Number);
          const d = new Date(cursor);
          d.setHours(h, m, 0, 0);
          if (d >= now) doses.push(d);
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    if (med.frequency.type === "hourly") {
      const d = new Date(cursor);
      if (d >= now) doses.push(d);
      cursor.setHours(cursor.getHours() + (med.frequency.intervalHours || 1));
    }
  }

  return doses;
};
