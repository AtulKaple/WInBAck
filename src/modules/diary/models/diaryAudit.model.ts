import mongoose from 'mongoose';

const DiaryAuditSchema = new mongoose.Schema({
  entryId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },

  userId: {
    type: String,
    required: true,
    index: true,
  },

  eventType: {
    type: String,
    enum: ['DIARY_CREATE', 'DIARY_UPDATE', 'DIARY_DELETE', 'DIARY_READ'],
    required: true,
  },

  hash: {
    type: String,
    required: true,
  },

  prevHash: {
    type: String,
    default: null,
  },

  timestamp: {
    type: Date,
    default: Date.now,
  },
});

export const DiaryAudit = mongoose.model('DiaryAudit', DiaryAuditSchema);
