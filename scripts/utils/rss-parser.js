import Parser from 'rss-parser';
import { createHash } from 'crypto';

const parser = new Parser();
const ONE_DAY_SECONDS = 86400;
const HN_HITS_PER_PAGE = 30;
const MAX_SUMMARY_CHARS = 500;

export async function parseRSS(xml, sourceName) {
  try {
    const feed = await parser.parseString(xml);
    if (!feed.items || !Array.isArray(feed.items)) return [];

    return feed.items.map(item => {
      const url = typeof item.link === 'string' ? item.link : item.link?.href || null;
      const publishedAt = item.pubDate ? new Date(item.pubDate) : null;
      return {
        id: url ? generateId(url, publishedAt || new Date()) : null,
        source: sourceName,
        title: item.title || 'Untitled',
        url,
        summary: truncate(item.contentSnippet || item.summary || item.description || '', MAX_SUMMARY_CHARS),
        publishedAt
      };
    });
  } catch (error) {
    throw new Error(`Failed to parse RSS feed for ${sourceName}: ${error.message}`);
  }
}

export async function fetchHackerNews(query = 'AI') {
  try {
    const oneDayAgo = Math.floor(Date.now() / 1000) - ONE_DAY_SECONDS;
    const response = await fetch(
      `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&numericFilters=created_at_i>${oneDayAgo}&hitsPerPage=${HN_HITS_PER_PAGE}`,
      { headers: { 'User-Agent': 'Digest-Factory/1.0' } }
    );

    if (!response.ok) throw new Error(`HN API returned ${response.status}`);
    const data = await response.json();
    if (!data.hits || !Array.isArray(data.hits)) return [];

    return data.hits
      .filter(hit => hit.url)
      .map(hit => ({
        id: `hn-${hit.objectID}`,
        source: 'Hacker News',
        title: hit.title,
        url: hit.url,
        summary: `HN Score: ${hit.points || 0}`,
        publishedAt: new Date(hit.created_at),
        points: hit.points || 0,
        comments: hit.num_comments || 0
      }));
  } catch (error) {
    console.error('Failed to fetch Hacker News:', error.message);
    return [];
  }
}

export async function fetchHuggingFacePapers() {
  try {
    const response = await fetch('https://huggingface.co/api/daily_papers', {
      headers: { 'User-Agent': 'Digest-Factory/1.0' }
    });
    if (!response.ok) throw new Error(`HuggingFace API returned ${response.status}`);
    const papers = await response.json();
    if (!Array.isArray(papers)) return [];

    return papers.map(paper => ({
      id: `hf-${paper.paper?.id || paper.id || ''}`,
      source: 'HuggingFace Papers',
      title: paper.title || 'Untitled',
      url: paper.paper_page || paper.arxiv_id || null,
      summary: paper.summary || '',
      publishedAt: paper.publishedAt ? new Date(paper.publishedAt) : null,
      upvotes: paper.paper?.upvotes || 0
    }));
  } catch (error) {
    console.error('Failed to fetch HuggingFace papers:', error.message);
    return [];
  }
}

function truncate(text, max) {
  if (!text || text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

export function generateId(url, date) {
  const input = `${url}|${date.toISOString()}`;
  return createHash('sha256').update(input).digest('hex');
}
