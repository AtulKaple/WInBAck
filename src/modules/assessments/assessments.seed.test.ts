import fs from 'fs/promises';
import path from 'path';
import './routes';

const QUESTIONNAIRES_PATH = path.join(__dirname, '..', '..', 'data', 'questionnaires.json');

beforeAll(() => {
  process.env.APP_MASTER_KEY = Buffer.alloc(32, 1).toString('base64');
});

beforeEach(async () => {
  await fs.writeFile(QUESTIONNAIRES_PATH, '[]', 'utf8');
});

describe('Assessment seeds', () => {
  it('seeds PHQ-9, GAD-7, and WHO-5 on startup', async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    const contents = await fs.readFile(QUESTIONNAIRES_PATH, 'utf8');
    const ids = JSON.parse(contents || '[]').map((q: any) => q.id);
    expect(ids).toEqual(expect.arrayContaining(['phq9', 'gad7', 'who5']));
    expect(ids.length).toBeGreaterThanOrEqual(3);
  });
});
