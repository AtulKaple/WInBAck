export const addHours = (date: Date, hours: number) => {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
};

export const endOfDay = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

type Frequency =
  | {
      type: "daily";
      times: string[]; // HH:mm
    }
  | {
      type: "weekly";
      times: string[]; // HH:mm
      daysOfWeek: number[]; // 0–6
    }
  | {
      type: "hourly";
      times?: string[]; // HH:mm
      intervalHours: number;
    };

function buildHourlyAnchor(startDate: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(startDate);
  d.setHours(h, m, 0, 0); // 👈 seconds ZEROED
  return d;
}

export const computeNextDoseTimes = (med: {
  startDate: Date;
  endDate?: Date;
  frequency: Frequency;
}): Date[] => {
  const doses: Date[] = [];
  const now = new Date();

  const endDate = med.endDate ?? new Date("2100-01-01");

  // start from later of now or startDate
  let cursor = new Date(Math.max(med.startDate.getTime(), now.getTime()));

  // safety guard (prevents infinite loops)
  let iterations = 0;
  const MAX_ITERATIONS = 1000;

  while (
    doses.length < 10 &&
    cursor <= endDate &&
    iterations < MAX_ITERATIONS
  ) {
    iterations++;

    /** ---------------- DAILY ---------------- */
    if (med.frequency.type === "daily") {
      for (const time of med.frequency.times) {
        const [h, m] = time.split(":").map(Number);
        const d = new Date(cursor);
        d.setHours(h, m, 0, 0);

        if (d >= now && d <= endDate) {
          doses.push(d);
        }
      }

      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
    } else if (med.frequency.type === "weekly") {

    /** ---------------- WEEKLY ---------------- */
      if (med.frequency.daysOfWeek.includes(cursor.getDay())) {
        for (const time of med.frequency.times) {
          const [h, m] = time.split(":").map(Number);
          const d = new Date(cursor);
          d.setHours(h, m, 0, 0);

          if (d >= now && d <= endDate) {
            doses.push(d);
          }
        }
      }

      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
    } else if (med.frequency.type === "hourly") {

    /** ---------------- HOURLY ---------------- */
      const interval = (med.frequency.intervalHours ?? 1) * 60 * 60 * 1000;
      const time = med.frequency.times?.[0];

      if (!time) return [];

      // ✅ anchor is FIXED
      let cursor = buildHourlyAnchor(med.startDate, time);

      // move cursor forward until >= now
      while (cursor < now) {
        cursor = new Date(cursor.getTime() + interval);
      }

      // generate next 10
      while (doses.length < 10 && cursor <= endDate) {
        doses.push(new Date(cursor));
        cursor = new Date(cursor.getTime() + interval);
      }

      return doses;
    }
  }

  return doses.sort((a, b) => a.getTime() - b.getTime()).slice(0, 10);
};
