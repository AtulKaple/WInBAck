import crypto from 'crypto';

const DEFAULT_VERSION = process.env.DEID_PSEUDONYM_VERSION || 'v1';

export function pseudonymize(userId: string): { pseudonym: string; version: string } {
  const secret = process.env.DEID_PSEUDONYM_SECRET;
  if (!secret) throw new Error('DEID_PSEUDONYM_SECRET is required for pseudonymization');
  const h = crypto.createHmac('sha256', secret);
  h.update(userId);
  const digest = h.digest('hex').slice(0, 16);
  return { pseudonym: digest, version: DEFAULT_VERSION };
}
