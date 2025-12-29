import { Request, Response } from 'express';
import {
  runDeidPipeline,
  latestDeidStatus,
  deidDatasetSummary,
  deidDatasetAggregate,
} from './deid.service';
import { runResponseSchema } from './deid.validators';

const MIN_COHORT = 5;

export async function handleRun(req: Request, res: Response) {
  const summary = await runDeidPipeline();
  const parsed = runResponseSchema.safeParse(summary);
  if (!parsed.success) return res.status(500).json({ error: 'Invalid run summary' });
  return res.json({ data: parsed.data });
}

export async function handleStatus(_req: Request, res: Response) {
  const status = await latestDeidStatus();
  return res.json({ data: status });
}

export async function handleDatasetSummary(_req: Request, res: Response) {
  const summary = await deidDatasetSummary();
  if (summary.cohortSize < MIN_COHORT) return res.status(403).json({ error: 'SMALL_COHORT' });
  return res.json({ data: summary });
}

export async function handleDatasetAggregate(_req: Request, res: Response) {
  const agg = await deidDatasetAggregate();
  if (agg.cohortSize < MIN_COHORT) return res.status(403).json({ error: 'SMALL_COHORT' });
  return res.json({ data: agg });
}
