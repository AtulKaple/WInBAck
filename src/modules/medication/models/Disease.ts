import mongoose from "mongoose";

const DiseaseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    createdBy: { type: String, required: true }, // userId | "system"
  },
  { timestamps: true }
);

export default mongoose.model("Disease", DiseaseSchema);