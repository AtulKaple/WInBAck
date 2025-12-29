import fs from 'fs/promises';
import path from 'path';
import { decrypt, encrypt, hashChain } from './crypto';

export type AuditMeta = {
  action: string;
  actorUserId?: string;
  actorRole?: string;
  resourceType: string;
  resourceId: string;
};

export const AUDIT_PATH = path.join(__dirname, '..', 'data', 'auditChain.json');

export async function secureWrite(opts: { filePath: string; record: any; auditMeta: AuditMeta }) {
  const { filePath, record, auditMeta } = opts;
  const encrypted = encrypt(JSON.stringify(record));
  const entry = {
    id: record.id || `${Date.now()}`,
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
    tag: encrypted.tag,
    createdAt: new Date().toISOString(),
    meta: auditMeta,
  };

  const existing = await readRawArray(filePath);
  existing.push(entry);
  await writeRawArray(filePath, existing);

  await appendAudit({ ciphertext: encrypted.ciphertext, meta: auditMeta, ts: entry.createdAt });
}

export async function secureReadAll<T = any>(filePath: string): Promise<T[]> {
  const entries = await readRawArray(filePath);
  return entries.map((e) => JSON.parse(decrypt({ ciphertext: e.ciphertext, iv: e.iv, tag: e.tag })) as T);
}

export async function secureRead<T = any>(filePath: string, predicate?: (item: T) => boolean): Promise<T[]> {
  const all = await secureReadAll<T>(filePath);
  if (!predicate) return all;
  return all.filter(predicate);
}

export async function verifyLedger(): Promise<boolean> {
  const ledger = await readRawArray(AUDIT_PATH);
  let prev = '';
  for (const item of ledger) {
    const expected = hashChain(prev, item.ciphertext, item.ts, item.action, item.resourceId);
    if (expected !== item.hash) return false;
    prev = item.hash;
  }
  return true;
}

async function appendAudit(params: { ciphertext: string; meta: AuditMeta; ts: string }) {
  const ledger = await readRawArray(AUDIT_PATH);
  const prevHash = ledger.length ? ledger[ledger.length - 1].hash : '';
  const hash = hashChain(prevHash, params.ciphertext, params.ts, params.meta.action, params.meta.resourceId);
  ledger.push({
    ts: params.ts,
    action: params.meta.action,
    actorUserId: params.meta.actorUserId,
    actorRole: params.meta.actorRole,
    resourceType: params.meta.resourceType,
    resourceId: params.meta.resourceId,
    hash,
    prevHash,
    ciphertext: params.ciphertext,
  });
  await writeRawArray(AUDIT_PATH, ledger);
}

async function readRawArray(filePath: string): Promise<any[]> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    if (!raw.trim()) return [];
    return JSON.parse(raw);
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, '[]', 'utf8');
    return [];
  }
}

async function writeRawArray(filePath: string, data: any[]): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}
