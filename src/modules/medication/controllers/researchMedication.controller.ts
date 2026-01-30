// controllers/researchMedication.controller.ts
import mongoose from "mongoose";
import Medication from "../models/Medication";
import MedicationDose from "../models/MedicationDose";

export const getMedicationAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, form, status, diseaseId } = req.query;

    const match: any = {};

    if (startDate || endDate) {
      match.startDate = {};
      if (startDate) match.startDate.$gte = new Date(startDate);
      if (endDate) match.startDate.$lte = new Date(endDate);
    }

    if (form) match.form = form;
    if (status) match.status = status;
    if (diseaseId) match.diseases = new mongoose.Types.ObjectId(diseaseId);

    /* ---------------------------------------------------- */
    /* 1. Medication usage by form                           */
    /* ---------------------------------------------------- */
    const medicationByForm = await Medication.aggregate([
      { $match: match },
      { $group: { _id: "$form", count: { $sum: 1 } } },
      { $project: { _id: 0, form: "$_id", count: 1 } },
    ]);

    /* ---------------------------------------------------- */
    /* 2. Medication usage by disease                        */
    /* ---------------------------------------------------- */
    const medicationByDisease = await Medication.aggregate([
      { $match: match },
      { $unwind: "$diseases" },
      { $group: { _id: "$diseases", count: { $sum: 1 } } },
      {
        $lookup: {
          from: "diseases",
          localField: "_id",
          foreignField: "_id",
          as: "disease",
        },
      },
      { $unwind: "$disease" },
      {
        $project: {
          _id: 0,
          disease: "$disease.name",
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]);

    /* ---------------------------------------------------- */
    /* 3. Adherence distribution (taken/missed/skipped)     */
    /* ---------------------------------------------------- */
    const adherenceDistribution = await MedicationDose.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, status: "$_id", count: 1 } },
    ]);

    /* ---------------------------------------------------- */
    /* 4. Adherence trend over time (monthly, stacked)      */
    /* ---------------------------------------------------- */
    const adherenceTrend = await MedicationDose.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$scheduledAt" },
            month: { $month: "$scheduledAt" },
            status: "$status",
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: { year: "$_id.year", month: "$_id.month" },
          taken: {
            $sum: { $cond: [{ $eq: ["$_id.status", "taken"] }, "$count", 0] },
          },
          missed: {
            $sum: { $cond: [{ $eq: ["$_id.status", "missed"] }, "$count", 0] },
          },
          skipped: {
            $sum: { $cond: [{ $eq: ["$_id.status", "skipped"] }, "$count", 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          month: {
            $concat: [
              { $toString: "$_id.year" },
              "-",
              {
                $cond: [
                  { $lt: ["$_id.month", 10] },
                  { $concat: ["0", { $toString: "$_id.month" }] },
                  { $toString: "$_id.month" },
                ],
              },
            ],
          },
          taken: 1,
          missed: 1,
          skipped: 1,
        },
      },
      { $sort: { month: 1 } },
    ]);

    /* ---------------------------------------------------- */
    /* 5. Status distribution (active/stopped)              */
    /* ---------------------------------------------------- */
    const statusDistribution = await Medication.aggregate([
      { $match: match },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $project: { _id: 0, status: "$_id", count: 1 } },
    ]);

    /* ---------------------------------------------------- */
    /* 6. Monthly starts vs stops                           */
    /* ---------------------------------------------------- */
    const startStopTrend = await Medication.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$startDate" },
            month: { $month: "$startDate" },
          },
          started: { $sum: 1 },
          stopped: {
            $sum: {
              $cond: [{ $eq: ["$status", "stopped"] }, 1, 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          month: {
            $concat: [
              { $toString: "$_id.year" },
              "-",
              {
                $cond: [
                  { $lt: ["$_id.month", 10] },
                  { $concat: ["0", { $toString: "$_id.month" }] },
                  { $toString: "$_id.month" },
                ],
              },
            ],
          },
          started: 1,
          stopped: 1,
        },
      },
      { $sort: { month: 1 } },
    ]);

    res.json({
      medicationByForm,
      medicationByDisease,
      adherenceDistribution,
      adherenceTrend,
      statusDistribution,
      startStopTrend,
    });
  } catch (err) {
    console.error("Research analytics error", err);
    res.status(500).json({ message: "Failed to load analytics" });
  }
};
