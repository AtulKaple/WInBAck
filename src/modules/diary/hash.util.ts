import crypto from 'crypto';

export function generateHash(data: crypto.BinaryLike) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

