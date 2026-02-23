import { Request, Response } from "express";
import * as DiaryService from "./diary.service";

/* -------------------------------------------------------------------------- */
/*                                   CREATE                                   */
/* -------------------------------------------------------------------------- */

export async function create(req: Request, res: Response) {
  try {
    const userId = (req as any).authContext?.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const entry = await DiaryService.createEntry(userId, req.body,req);

    return res.status(201).json({
      success: true,
      data: entry,
    });
  } catch (err) {
    console.error("Create Diary Error:", err);

    return res.status(400).json({
      success: false,
      message: err instanceof Error ? err.message : "Failed to create entry",
    });
  }
}

/* -------------------------------------------------------------------------- */
/*                                     LIST                                   */
/* -------------------------------------------------------------------------- */

export async function list(req: Request, res: Response) {
  try {
    const userId = (req as any).authContext?.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const entries = await DiaryService.listEntries(userId, req.query);

    return res.status(200).json({
      success: true,
      count: entries.length,
      data: entries,
    });
  } catch (err) {
    console.error("List Diary Error:", err);

    return res.status(400).json({
      success: false,
      message: err instanceof Error ? err.message : "Failed to fetch entries",
    });
  }
}

/* -------------------------------------------------------------------------- */
/*                                    UPDATE                                  */
/* -------------------------------------------------------------------------- */

export async function update(req: Request, res: Response) {
  try {
    const userId = (req as any).authContext?.userId;
    const entryId = (req.params.id as any);

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!entryId) {
      return res.status(400).json({ message: "Entry ID is required" });
    }

    const updatedEntry = await DiaryService.updateEntry(
      userId,
      entryId,
      req.body,
    );

    if (!updatedEntry) {
      return res.status(404).json({
        success: false,
        message: "Entry not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: updatedEntry,
    });
  } catch (err) {
    console.error("Update Diary Error:", err);

    return res.status(400).json({
      success: false,
      message: err instanceof Error ? err.message : "Failed to update entry",
    });
  }
}

/* -------------------------------------------------------------------------- */
/*                                    DELETE                                  */
/* -------------------------------------------------------------------------- */

export async function remove(req: Request, res: Response) {
  try {
    const userId = (req as any).authContext?.userId;
    const entryId = (req.params.id as any);

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!entryId) {
      return res.status(400).json({ message: "Entry ID is required" });
    }

    const deleted = await DiaryService.deleteEntry(userId, entryId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Entry not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Deleted successfully",
    });
  } catch (err) {
    console.error("Delete Diary Error:", err);

    return res.status(400).json({
      success: false,
      message: err instanceof Error ? err.message : "Failed to delete entry",
    });
  }
}
