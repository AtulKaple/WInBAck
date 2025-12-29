import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { secureReadAll, secureWrite } from './secureWrite';

beforeAll(() => {
  if (!process.env.APP_MASTER_KEY) {
    process.env.APP_MASTER_KEY = Buffer.alloc(32, 9).toString('base64');
  }
});

describe('secureWrite sample data load', () => {
  it('writes and reads back at least five records', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'securewrite-test-'));
    const filePath = path.join(dir, 'sample.json');
    for (let i = 0; i < 5; i++) {
      await secureWrite({
        filePath,
        record: { id: `rec-${i}`, userId: `u${i}`, value: i },
        auditMeta: { action: 'test.write', actorUserId: 'test', actorRole: 'admin', resourceType: 'Test', resourceId: `rec-${i}` },
      });
    }
    const records = await secureReadAll<{ id: string }>(filePath);
    expect(records.length).toBeGreaterThanOrEqual(5);
  });
});
