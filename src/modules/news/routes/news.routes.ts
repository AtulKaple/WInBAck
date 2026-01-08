import { Router } from "express";
import { fetchPMCSummaries, mapToNewsItems, searchPMC } from "../services/news";
const router = Router();

router.get('/biomedical', async (req, res) => {
  const query = req.query.q ?? 'mental health';

  const search = await searchPMC(query as string);
  const ids = search.esearchresult.idlist;

  if (!ids.length) {
    return res.json([]);
  }

  const summaries = await fetchPMCSummaries(ids);
  const news = mapToNewsItems(summaries);

  res.json(news);
});

export default router;