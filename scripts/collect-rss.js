import fs from 'fs/promises';
import { loadSiteConfig } from './lib/config.js';
import { parseRSS, fetchHackerNews, fetchHuggingFacePapers } from './utils/rss-parser.js';

const MS_PER_HOUR = 1000 * 60 * 60;
const RECENT_HOURS = 24;

async function fetchRSSWithRetry(source, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(source.url, {
        headers: { 'User-Agent': 'Digest-Factory/1.0' },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        const err = new Error(`HTTP ${response.status}`);
        err.status = response.status;
        throw err;
      }

      const xml = await response.text();
      return await parseRSS(xml, source.name);

    } catch (error) {
      console.error(`[${source.name}] Attempt ${i + 1}/${maxRetries} failed:`, error.message);

      const isRetryable = error.code === 'ETIMEDOUT' ||
                          error.code === 'ECONNRESET' ||
                          error.code === 'ENOTFOUND' ||
                          (error.status >= 500 && error.status < 600);

      const isLastAttempt = i === maxRetries - 1;

      if (isLastAttempt || !isRetryable) {
        await logFailure(source, error);
        return [];
      }

      await sleep(Math.pow(2, i) * 1000);
    }
  }
  return [];
}

export async function collectAllSources() {
  const config = loadSiteConfig();
  const rssSources = config.sources.rss || [];
  const hnConfig = config.sources.hackernews;
  const hfConfig = config.sources.huggingface;

  const totalCount = rssSources.length + (hnConfig?.enabled ? 1 : 0) + (hfConfig?.enabled ? 1 : 0);
  console.log(`Starting collection from ${totalCount} sources...`);

  const promises = rssSources.map(source => fetchRSSWithRetry(source));

  if (hnConfig?.enabled) {
    promises.push(fetchHackerNews(hnConfig.query || 'AI'));
  }
  if (hfConfig?.enabled) {
    promises.push(fetchHuggingFacePapers());
  }

  const results = await Promise.all(promises);
  const allArticles = results.flat();

  console.log(`Collected ${allArticles.length} articles from ${totalCount} sources`);

  const validArticles = allArticles.filter(article => article.url);
  console.log(`Filtered to ${validArticles.length} articles with valid URLs`);

  const now = new Date();
  const recent = validArticles.filter(article => {
    const hoursSince = (now - new Date(article.publishedAt)) / MS_PER_HOUR;
    return hoursSince <= RECENT_HOURS;
  });

  console.log(`Filtered to ${recent.length} articles from last 24 hours`);

  const deduplicated = deduplicateArticles(recent);
  console.log(`Deduplicated to ${deduplicated.length} unique articles`);

  return deduplicated;
}

export function deduplicateArticles(articles) {
  const seen = new Set();
  return articles.filter(article => {
    if (seen.has(article.url)) return false;
    seen.add(article.url);
    return true;
  });
}

async function logFailure(source, error) {
  try {
    await fs.mkdir('logs', { recursive: true });
    const logEntry = `${new Date().toISOString()} | ${source.name} | ${error.message}\n`;
    await fs.appendFile('logs/rss-failures.log', logEntry);
  } catch (err) {
    // Silently fail on logging errors
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const articles = await collectAllSources();

  await fs.mkdir('content', { recursive: true });
  await fs.writeFile(
    'content/raw-articles.json',
    JSON.stringify(articles, null, 2)
  );

  console.log('✓ Saved to content/raw-articles.json');
}
