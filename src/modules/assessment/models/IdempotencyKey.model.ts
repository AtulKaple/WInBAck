import { Schema, model } from 'mongoose';

/// To Prevent duplicate submission

const IdempotencySchema = new Schema({
  key: { type: String, unique: true },
  consumedAt: Date,
});

IdempotencySchema.index({ consumedAt: 1 }, { expireAfterSeconds: 86400 });

export const IdempotencyKeyModel = model(
  'IdempotencyKey',
  IdempotencySchema
);
