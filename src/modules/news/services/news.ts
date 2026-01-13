// services/pmcSearch.ts
export async function searchPMC(query: string) {
  const url = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi');

  url.searchParams.set('db', 'pmc'); // or 'pubmed'
  url.searchParams.set('term', query);
  url.searchParams.set('retmode', 'json');
  url.searchParams.set('retmax', '10');
  url.searchParams.set('sort', 'pub_date');

  const res = await fetch(url.toString());
  return res.json();
}


export async function fetchPMCSummaries(ids: string[]) {
  const url = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi');

  url.searchParams.set('db', 'pmc');
  url.searchParams.set('id', ids.join(','));
  url.searchParams.set('retmode', 'json');

  const res = await fetch(url.toString());
  return res.json();
}


export function mapToNewsItems(summary: any) {
  if (!summary?.result || !Array.isArray(summary.result.uids)) {
    return [];
  }

  return summary.result.uids
    .map((uid: string) => summary.result[uid])
    .filter(Boolean)
    .map((item: any) => ({
      id: item.uid,
      title: item.title,
      journal: item.fulljournalname,
      publishedAt: item.pubdate,
      link: `https://pmc.ncbi.nlm.nih.gov/articles/${item.uid}/`
    }));
}
