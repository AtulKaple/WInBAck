import { logActivity } from "../../activityLogs/utils/activityLogger";
import Disease from "../models/Disease";

export const createDisease = async (req, res) => {
  const disease = await Disease.create({
    name: req.body.name,
    createdBy: req.authContext.userId,
  });

  await logActivity({
    req,
    actorUserId: req.authContext.userId,
    action: "CREATE",
    resource: "Disease",
    resourceId: disease._id.toString(),
    description: `Disease created: ${disease.name}`,
    targetName: disease.name,
    success: true,
  });

  res.status(201).json(disease);
};

export const getDiseases = async (req, res) => {
  const diseases = await Disease.find({
    createdBy: req.authContext.userId,
  });

  res.json(diseases);
};
