import crypto from 'crypto';

const keyCache: { key?: Buffer } = {};
const DEV_FALLBACK_KEY = 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=';

function loadKey(): Buffer {
  if (keyCache.key) return keyCache.key;
  const raw = process.env.APP_MASTER_KEY || DEV_FALLBACK_KEY;

  let buf: Buffer;
  if (/^[0-9a-fA-F]+$/.test(raw) && raw.length === 64) {
    buf = Buffer.from(raw, 'hex');
  } else {
    const maybe = Buffer.from(raw, 'base64');
    if (maybe.length === 32) {
      buf = maybe;
    } else {
      throw new Error('APP_MASTER_KEY must be 32 bytes base64 or 64-char hex');
    }
  }
  keyCache.key = buf;
  if (!process.env.APP_MASTER_KEY) {
    // eslint-disable-next-line no-console
    console.warn('APP_MASTER_KEY missing; using development fallback key');
  }
  return buf;
}

export function encrypt(plaintext: string): { ciphertext: string; iv: string; tag: string } {
  const key = loadKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

export function decrypt(payload: { ciphertext: string; iv: string; tag: string }): string {
  const key = loadKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function hashChain(previous: string, ciphertext: string, ts: string, action: string, resourceId: string): string {
  const h = crypto.createHash('sha256');
  h.update(previous);
  h.update(ciphertext);
  h.update(ts);
  h.update(action);
  h.update(resourceId);
  return h.digest('hex');
}
