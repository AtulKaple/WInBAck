import { NextFunction, Request, Response } from 'express';

const REDACT_KEYS = ['answers', 'item', 'text', 'response', 'questionnaireResponse', 'diary', 'notes', 'freeText'];

function redact(value: any): any {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    const copy: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (REDACT_KEYS.includes(k)) {
        copy[k] = '[REDACTED]';
      } else {
        copy[k] = redact(v);
      }
    }
    return copy;
  }
  return value;
}

export const safeLogger = {
  info(event: string, meta: Record<string, any> = {}) {
    const payload = redact(meta);
    // eslint-disable-next-line no-console
    console.info(event, payload);
  },
};

export const preventBodyLogging = (_req: Request, _res: Response, next: NextFunction) => {
  Object.defineProperty(_req, 'body', {
    configurable: true,
    enumerable: false,
    writable: false,
    value: _req.body,
  });
  (_req as any).bodyForLogs = '[REDACTED]';
  next();
};
