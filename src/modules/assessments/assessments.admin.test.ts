import fs from 'fs/promises';
import path from 'path';
import assessmentsRouter from './routes';
import { secureReadAll } from '../../security/secureWrite';

const QUESTIONNAIRES_PATH = path.join(__dirname, '..', '..', 'data', 'questionnaires.json');

beforeAll(() => {
  process.env.APP_MASTER_KEY = Buffer.alloc(32, 1).toString('base64');
});

beforeEach(async () => {
  await fs.writeFile(QUESTIONNAIRES_PATH, '[]', 'utf8');
});

const findHandler = (pathMatch: string, method: string) => {
  const layer: any = (assessmentsRouter as any).stack.find((l: any) => l.route && l.route.path === pathMatch && l.route.methods[method]);
  if (!layer) throw new Error(`Handler for ${method.toUpperCase()} ${pathMatch} not found`);
  const handles = layer.route.stack.map((s: any) => s.handle);
  return handles[handles.length - 1];
};

const mockRes = () => {
  const res: any = {};
  res.statusCode = 200;
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body: any) => {
    res.body = body;
    return res;
  };
  return res;
};

const adminReqBase: any = {
  authContext: { userId: 'admin-1', role: 'admin', source: 'stub' },
};

const validPhq9 = {
  id: 'phq9-test',
  title: 'Patient Health Questionnaire-9 (PHQ-9)',
  description: 'Depression screener',
  version: '1.0.0',
  updatedAt: '2025-12-28',
  questions: [
    {
      id: 'q1',
      text: 'Little interest or pleasure in doing things',
      type: 'mcq',
      options: [
        { id: '0', label: 'Not at all', value: 0 },
        { id: '1', label: 'Several days', value: 1 },
      ],
      required: true,
    },
  ],
  scoring: {
    method: 'sum',
    interpretation: [
      { min: 0, max: 4, label: 'None–Minimal' },
      { min: 5, max: 9, label: 'Mild' },
    ],
  },
};

describe('Admin assessment upload', () => {
  it('accepts valid questionnaire and stores it', async () => {
    const createHandler = findHandler('/', 'post');

    const res = mockRes();
    await createHandler({ ...adminReqBase, body: validPhq9 }, res, () => {});
    expect(res.statusCode).toBe(201);
    const contents = await fs.readFile(QUESTIONNAIRES_PATH, 'utf8');
    const ids = JSON.parse(contents || '[]').map((q: any) => q.id);
    expect(ids).toContain('phq9-test');
  });

  it('rejects malformed questionnaire (missing scoring)', async () => {
    const createHandler = findHandler('/', 'post');
    const bad = { ...validPhq9 } as any;
    delete bad.scoring;
    const res = mockRes();
    await createHandler({ ...adminReqBase, body: bad }, res, () => {});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('SCHEMA_VALIDATION_FAILED');
  });

  it('rejects duplicate id with 409', async () => {
    const createHandler = findHandler('/', 'post');
    await createHandler({ ...adminReqBase, body: validPhq9 }, mockRes(), () => {});
    const res = mockRes();
    await createHandler({ ...adminReqBase, body: validPhq9 }, res, () => {});
    expect(res.statusCode).toBe(409);
  });
});
