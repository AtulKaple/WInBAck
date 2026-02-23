import mongoose, {
  ClientSession,
  Types,
} from "mongoose";
import { DiaryModel } from "./models/diary.model";
import { DiaryAudit } from "./models/diaryAudit.model";
import { generateHash } from "./hash.util";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export interface CreateDiaryPayload {
  effectiveDate: string;
  type: "symptom" | "mood" | "note";
  symptom?: string;
  severity?: number;
  mood?: number;
  tags?: string[];
  note?: string;
  source?: "web" | "mobile";
}

export interface ListQuery {
  from?: string;
  to?: string;
  type?: "symptom" | "mood" | "note";
  limit?: string;
}

/* -------------------------------------------------------------------------- */
/*                              HELPER: TRANSACTION                           */
/* -------------------------------------------------------------------------- */

async function withTransaction<T>(
  fn: (session: ClientSession) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/* -------------------------------------------------------------------------- */
/*                                CREATE ENTRY                                */
/* -------------------------------------------------------------------------- */

export async function createEntry(userId: string, payload: CreateDiaryPayload, req: any) {
  const userAgent = req.headers["user-agent"] || "";

  const isMobile = /mobile|android|iphone|ipad/i.test(userAgent);

  const detectedSource = isMobile ? "mobile" : "web";
  return withTransaction(async (session) => {
    const baseData: any = {
      userId,
      effectiveDate: payload.effectiveDate,
      type: payload.type,
      tags: payload.tags ?? [],
      source: detectedSource ?? "web",
    };

    if (payload.type === "mood") {
      baseData.mood = payload.mood ?? null;
      baseData.note = payload.note ?? null;
      baseData.symptom = null;
      baseData.severity = null;
    }

    if (payload.type === "symptom") {
      baseData.symptom = payload.symptom ?? null;
      baseData.severity = payload.severity ?? null;
      baseData.note = payload.note ?? null;
      baseData.mood = null;
    }

    if (payload.type === "note") {
      baseData.note = payload.note ?? null;
      baseData.mood = null;
      baseData.symptom = null;
      baseData.severity = null;
    }

    const [entry] = await DiaryModel.create([baseData], { session });

    await appendAudit(entry._id, userId, "DIARY_CREATE", session);

    return entry;
  });
}


/* -------------------------------------------------------------------------- */
/*                                LIST ENTRIES                                */
/* -------------------------------------------------------------------------- */

export async function listEntries(
  userId: string,
  query: ListQuery
) {
  const filter: any = {
    userId,
    status: "active",
  };

  if (query.from && query.to) {
    filter.effectiveDate = {
      $gte: query.from,
      $lte: query.to,
    };
  }

  if (query.type) {
    filter.type = query.type;
  }

  const limit = query.limit ? parseInt(query.limit, 10) : 50;

  return DiaryModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

/* -------------------------------------------------------------------------- */
/*                                UPDATE ENTRY                                */
/* -------------------------------------------------------------------------- */

export async function updateEntry(
  userId: string,
  entryId: Types.ObjectId,
  payload: Partial<CreateDiaryPayload>
) {
  return withTransaction(async (session) => {
    const entry = await DiaryModel.findOne({
      _id: entryId,
      userId,
      status: "active",
    }).session(session);

    if (!entry) {
      throw new Error("Entry not found");
    }

    Object.assign(entry, payload, { updated: true });

    await entry.save({ session });

    await appendAudit(
      entry._id,
      userId,
      "DIARY_UPDATE",
      session
    );

    return entry;
  });
}

/* -------------------------------------------------------------------------- */
/*                                SOFT DELETE                                 */
/* -------------------------------------------------------------------------- */

export async function deleteEntry(
  userId: string,
  entryId: Types.ObjectId
): Promise<boolean> {
  return withTransaction(async (session) => {
    const entry = await DiaryModel.findOne({
      _id: entryId,
      userId,
      status: "active",
    }).session(session);

    if (!entry) {
      throw new Error("Entry not found");
    }

    entry.status = "deleted";
    entry.deletedAt = new Date();

    await entry.save({ session });

    await appendAudit(
      entry._id,
      userId,
      "DIARY_DELETE",
      session
    );

    return true;
  });
}

/* -------------------------------------------------------------------------- */
/*                                AUDIT CHAIN                                 */
/* -------------------------------------------------------------------------- */

export async function appendAudit(
  entryId: Types.ObjectId,
  userId: string,
  eventType: any,
  session: ClientSession
): Promise<void> {
  const lastAudit = await DiaryAudit.findOne({ userId })
    .sort({ timestamp: -1 })
    .session(session);

  const prevHash = lastAudit?.hash ?? null;

  const hashPayload = `${prevHash ?? ""}${entryId.toString()}${userId.toString()}${eventType}${Date.now()}`;

  const hash = generateHash(hashPayload);

  await DiaryAudit.create(
    [
      {
        entryId,
        userId,
        eventType,
        prevHash,
        hash,
      },
    ],
    { session }
  );
}
