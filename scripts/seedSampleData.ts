import path from 'path';
import fs from 'fs/promises';
import { secureWrite } from '../src/security/secureWrite';

if (!process.env.APP_MASTER_KEY) {
  console.error('APP_MASTER_KEY is required to seed sample data');
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, '..', 'src', 'data');
const CONSENTS_PATH = path.join(DATA_DIR, 'consents.json');
const RESPONSES_PATH = path.join(DATA_DIR, 'responses.json');
const DIARY_PATH = path.join(DATA_DIR, 'diary.json');

async function resetFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(CONSENTS_PATH, '[]', 'utf8');
  await fs.writeFile(RESPONSES_PATH, '[]', 'utf8');
  await fs.writeFile(DIARY_PATH, '[]', 'utf8');
}

async function seedConsents() {
  const scopesAll = ['assessments', 'diary', 'research'];
  const payloads = [
    { id: 'c-p1', patient: 'Patient/p1', status: 'active', scope: scopesAll, performer: 'p1' },
    { id: 'c-p2', patient: 'Patient/p2', status: 'active', scope: scopesAll, performer: 'p2' },
    { id: 'c-p3', patient: 'Patient/p3', status: 'active', scope: scopesAll, performer: 'p3' },
    { id: 'c-p4', patient: 'Patient/p4', status: 'active', scope: ['research'], performer: 'p4' },
    { id: 'c-p5', patient: 'Patient/p5', status: 'active', scope: ['research'], performer: 'p5' },
  ];
  for (const c of payloads) {
    await secureWrite({
      filePath: CONSENTS_PATH,
      record: {
        resourceType: 'Consent',
        ...c,
        provision: {},
        dateTime: new Date().toISOString(),
      },
      auditMeta: { action: 'consent.write', actorUserId: c.performer, actorRole: 'patient', resourceType: 'Consent', resourceId: c.id },
    });
  }
}

async function seedResponses() {
  const now = Date.now();
  const entries = [
    { userId: 'p1', questionnaireId: 'phq-9', score: 6, interpretation: 'Mild' },
    { userId: 'p1', questionnaireId: 'gad-7', score: 4, interpretation: 'Minimal' },
    { userId: 'p2', questionnaireId: 'phq-9', score: 9, interpretation: 'Mild' },
    { userId: 'p3', questionnaireId: 'gad-7', score: 7, interpretation: 'Moderate' },
    { userId: 'p4', questionnaireId: 'phq-9', score: 12, interpretation: 'Moderate' },
    { userId: 'p5', questionnaireId: 'gad-7', score: 5, interpretation: 'Mild' },
  ];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    await secureWrite({
      filePath: RESPONSES_PATH,
      record: {
        id: `resp-${i + 1}`,
        userId: e.userId,
        questionnaireId: e.questionnaireId,
        submittedAt: new Date(now - i * 86_400_000).toISOString(),
        computed: { score: e.score, interpretation: e.interpretation, breakdown: [] },
      },
      auditMeta: { action: 'assessment.submit', actorUserId: e.userId, actorRole: 'patient', resourceType: 'QuestionnaireResponse', resourceId: `resp-${i + 1}` },
    });
  }
}

async function seedDiary() {
  const now = Date.now();
  const entries = Array.from({ length: 8 }).map((_, idx) => ({
    userId: 'p1',
    date: new Date(now - idx * 86_400_000).toISOString().slice(0, 10),
    mood: 4 + (idx % 4),
    symptomScore: 2 + (idx % 3),
    notes: `Note ${idx + 1}`,
  }));
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    await secureWrite({
      filePath: DIARY_PATH,
      record: {
        kind: 'entry',
        id: `diary-${i + 1}`,
        userId: e.userId,
        date: e.date,
        mood: e.mood,
        symptomScore: e.symptomScore,
        notes: e.notes,
        createdAt: new Date(now - i * 86_400_000).toISOString(),
        resourceType: 'Observation',
        status: 'final',
        category: 'patient-reported',
        code: { text: 'Daily Symptom Log' },
        subject: { reference: `Patient/${e.userId}` },
        effectiveDateTime: e.date,
      },
      auditMeta: { action: 'DIARY_CREATE', actorUserId: e.userId, actorRole: 'patient', resourceType: 'Observation', resourceId: `diary-${i + 1}` },
    });
  }
}

async function main() {
  await resetFiles();
  await seedConsents();
  await seedResponses();
  await seedDiary();
  console.log('Seeded sample consents, responses, and diary entries.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
