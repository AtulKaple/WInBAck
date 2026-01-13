import { Router } from "express";
import { fetchPMCSummaries, mapToNewsItems, searchPMC } from "../services/news";
const router = Router();

router.get('/biomedical', async (req, res) => {
  try {
    const query = (req.query.q as string) || 'mental health';

    const search = await searchPMC(query);

    const ids =
      search?.esearchresult?.idlist && Array.isArray(search.esearchresult.idlist)
        ? search.esearchresult.idlist
        : [];

    if (ids.length === 0) {
      return res.json([]);
    }

    const summaries = await fetchPMCSummaries(ids);
    const news = mapToNewsItems(summaries);

    return res.json(news);
  } catch (err) {
    console.error('PMC biomedical feed error', err);
    return res.status(500).json({ error: 'Failed to fetch biomedical news' });
  }
});


export default router;