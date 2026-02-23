import mongoose from 'mongoose';


const DiarySchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },

    effectiveDate: {
      type: String, // YYYY-MM-DD
      required: true,
    },

    type: {
      type: String,
      enum: ['symptom', 'mood', 'note'],
      required: true,
    },

    symptom: {
      type: String,
      trim: true,
    },

    severity: {
      type: Number,
      min: 0,
      max: 10,
    },

    mood: {
      type: Number,
      min: 0,
      max: 5,
    },

    tags: {
      type: [String],
      default: [],
      validate: [(arr: string | string[]) => arr.length <= 10, 'Max 10 tags allowed'],
    },

    note: {
      type: String,
      maxlength: 2000,
      trim: true,
    },

    source: {
      type: String,
      enum: ['web', 'mobile'],
      default: 'web',
    },

    status: {
      type: String,
      enum: ['active', 'deleted'],
      default: 'active',
    },

    deletedAt: {
      type: Date,
    },

    updated:{
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: true,
    },
  }
);

export const DiaryModel = mongoose.model('Diary', DiarySchema);
