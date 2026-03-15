import fs from 'fs/promises';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import OpenAI from 'openai';
import { findRelatedArticles } from './utils/similarity.js';
import { loadSiteConfig } from './lib/config.js';

const config = loadSiteConfig();
const editorial = config.editorial || {};

const PROMPT_TEMPLATE = readFileSync(
  resolve(editorial.prompt || 'config/prompts/editorial.md'),
  'utf-8'
);

// Scoring constants
const MULTI_SOURCE_3_BONUS = 30;
const MULTI_SOURCE_2_BONUS = 20;
const MULTI_SOURCE_1_BONUS = 10;
const HN_POINTS_DIVISOR = 10;
const HN_POINTS_MAX = 15;
const HN_COMMENTS_DIVISOR = 20;
const HN_COMMENTS_MAX = 10;
const HF_UPVOTES_DIVISOR = 5;
const HF_UPVOTES_MAX = 15;
const DEFAULT_SOURCE_WEIGHT = 5;
const TIMELINESS_6_HOURS = 20;
const TIMELINESS_12_HOURS = 15;
const TIMELINESS_24_HOURS = 10;
const MS_PER_HOUR = 1000 * 60 * 60;

// Selection counts from config (with defaults)
const FEATURED_COUNT = Array.isArray(editorial.featured_count)
  ? editorial.featured_count[1]
  : editorial.featured_count || 3;
const QUICK_NEWS_COUNT = Array.isArray(editorial.quicknews_count)
  ? editorial.quicknews_count[1]
  : editorial.quicknews_count || 6;

// Build source weight lookup from site.yaml
function buildSourceWeights() {
  const weights = {};
  for (const src of config.sources.rss || []) {
    weights[src.name] = src.weight || DEFAULT_SOURCE_WEIGHT;
  }
  if (config.sources.hackernews?.enabled) {
    weights['Hacker News'] = config.sources.hackernews.weight || DEFAULT_SOURCE_WEIGHT;
  }
  if (config.sources.huggingface?.enabled) {
    weights['HuggingFace Papers'] = config.sources.huggingface.weight || DEFAULT_SOURCE_WEIGHT;
  }
  return weights;
}

const SOURCE_WEIGHTS = buildSourceWeights();

export function calculateScore(article, allArticles) {
  let score = 0;

  const relatedArticles = findRelatedArticles(article, allArticles);
  if (relatedArticles.length >= 3) score += MULTI_SOURCE_3_BONUS;
  else if (relatedArticles.length === 2) score += MULTI_SOURCE_2_BONUS;
  else if (relatedArticles.length === 1) score += MULTI_SOURCE_1_BONUS;

  if (article.source === 'Hacker News' && article.points) {
    score += Math.min(article.points / HN_POINTS_DIVISOR, HN_POINTS_MAX);
  }
  if (article.source === 'Hacker News' && article.comments) {
    score += Math.min(article.comments / HN_COMMENTS_DIVISOR, HN_COMMENTS_MAX);
  }
  if (article.source === 'HuggingFace Papers' && article.upvotes) {
    score += Math.min(article.upvotes / HF_UPVOTES_DIVISOR, HF_UPVOTES_MAX);
  }

  score += SOURCE_WEIGHTS[article.source] || DEFAULT_SOURCE_WEIGHT;

  const hoursSincePublished = (Date.now() - new Date(article.publishedAt)) / MS_PER_HOUR;
  if (hoursSincePublished <= 6) score += TIMELINESS_6_HOURS;
  else if (hoursSincePublished <= 12) score += TIMELINESS_12_HOURS;
  else if (hoursSincePublished <= 24) score += TIMELINESS_24_HOURS;

  return Math.round(score);
}

export function filterByPercentile(sortedArticles, percentile) {
  const cutoff = Math.max(1, Math.ceil(sortedArticles.length * percentile));
  return sortedArticles.slice(0, cutoff);
}

export async function getRecentTopics() {
  const topics = [];
  const today = new Date();

  for (let i = 1; i <= 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    try {
      const content = await fs.readFile(`content/en/${dateStr}.json`, 'utf-8');
      const data = JSON.parse(content);
      data.featured?.forEach(article => topics.push(article.title));
    } catch {
      continue;
    }
  }

  return topics;
}

function createOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not set in .env file');
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function formatOfficialSources(candidates) {
  return candidates
    .filter(a => a.source !== 'Hacker News')
    .map(a => `${candidates.indexOf(a) + 1}. ${a.title} — ${a.source}${a.summary ? ' | ' + a.summary.slice(0, 100) : ''}`)
    .join('\n');
}

function formatShowHN(candidates) {
  const items = candidates
    .filter(a => a.source === 'Hacker News' && /^(Show|Launch) HN/i.test(a.title))
    .map(a => `${candidates.indexOf(a) + 1}. ${a.title}${a.summary ? ' | ' + a.summary.slice(0, 100) : ''}`)
    .join('\n');
  return items || '(none)';
}

function formatOtherHN(candidates) {
  return candidates
    .filter(a => a.source === 'Hacker News' && !/^(Show|Launch) HN/i.test(a.title))
    .map(a => `${candidates.indexOf(a) + 1}. ${a.title}${a.summary ? ' | ' + a.summary.slice(0, 100) : ''}`)
    .join('\n');
}

export async function selectFeaturedStories(candidates, recentTopics) {
  const prompt = PROMPT_TEMPLATE
    .replace('{{FEATURED_COUNT}}', String(FEATURED_COUNT))
    .replace('{{QUICK_NEWS_COUNT}}', String(QUICK_NEWS_COUNT))
    .replace('{{CANDIDATES_COUNT}}', String(candidates.length))
    .replace('{{OFFICIAL_SOURCES}}', formatOfficialSources(candidates))
    .replace('{{SHOW_HN}}', formatShowHN(candidates))
    .replace('{{OTHER_HN}}', formatOtherHN(candidates))
    .replace('{{RECENT_TOPICS}}', recentTopics.slice(0, 10).join('; ') || 'none');

  try {
    const openai = createOpenAIClient();
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 4000
    });

    const content = response.choices[0].message.content;
    let result;

    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse OpenAI JSON response:', content);
      throw new Error(`JSON parse error: ${parseError.message}`);
    }

    const featured = result.featured
      .map(selection => {
        const nums = selection.candidateNumbers || [selection.candidateNumber];
        const primaryIdx = (Array.isArray(nums) ? nums[0] : nums) - 1;
        const article = candidates[primaryIdx];
        if (!article) return null;

        const relatedSources = (Array.isArray(nums) ? nums : [nums])
          .map(n => candidates[n - 1]?.source)
          .filter(Boolean);

        return {
          ...article,
          ...selection,
          relatedSources: [...new Set(relatedSources)],
          category: 'featured'
        };
      })
      .filter(Boolean);

    const featuredIds = new Set(featured.map(a => a.id));
    const quickNews = [];
    if (result.quickNewsNumbers?.length > 0) {
      for (const num of result.quickNewsNumbers) {
        const article = candidates[num - 1];
        if (!article || featuredIds.has(article.id)) continue;
        const isDuplicate = quickNews.some(s => findRelatedArticles(article, [s]).length > 0);
        if (isDuplicate) continue;
        quickNews.push({ ...article, category: 'quickNews' });
      }
    }

    return { featured, quickNews };

  } catch (error) {
    console.error('OpenAI API error:', error.message);
    return handleAIFailure({ type: 'selection', candidates, error: error.message });
  }
}

export function handleAIFailure(context) {
  console.error(`AI fallback triggered for: ${context.type}`);

  fs.appendFile(
    'logs/ai-failures.log',
    `${new Date().toISOString()} | ${context.type} | ${context.error || 'unknown error'}\n`
  ).catch(() => {});

  if (context.type === 'selection') {
    const featured = context.candidates
      .slice(0, FEATURED_COUNT)
      .map(a => ({
        ...a,
        reason: 'Fallback: algorithm score',
        suggestedTitle: a.title,
        suggestedSummary: a.summary,
        category: 'featured'
      }));

    const featuredIds = new Set(featured.map(a => a.id));
    const quickNews = [];
    for (const a of context.candidates) {
      if (featuredIds.has(a.id)) continue;
      const allSelected = [...featured, ...quickNews];
      const isDuplicate = allSelected.some(s => findRelatedArticles(a, [s]).length > 0);
      if (isDuplicate) continue;
      quickNews.push({ ...a, category: 'quickNews' });
      if (quickNews.length >= QUICK_NEWS_COUNT) break;
    }

    return { featured, quickNews };
  }

  throw new Error(`Unknown AI failure context: ${context.type}`);
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  await import('dotenv/config');

  console.log('Loading raw articles...');
  const rawArticles = JSON.parse(
    await fs.readFile('content/raw-articles.json', 'utf-8')
  );

  console.log(`Scoring ${rawArticles.length} articles...`);

  const scoredArticles = rawArticles.map(article => ({
    ...article,
    score: calculateScore(article, rawArticles),
    relatedCount: findRelatedArticles(article, rawArticles).length
  }));

  scoredArticles.sort((a, b) => b.score - a.score);

  console.log(`Score range: ${scoredArticles[0]?.score} - ${scoredArticles[scoredArticles.length - 1]?.score}`);

  console.log('Loading recent topics...');
  const recentTopics = await getRecentTopics();
  console.log(`Found ${recentTopics.length} recent topics from past 7 days`);

  const candidates = scoredArticles;

  console.log('Selecting featured stories with OpenAI...');
  const { featured, quickNews } = await selectFeaturedStories(candidates, recentTopics);

  console.log(`Selected ${featured.length} featured stories`);
  console.log(`Selected ${quickNews.length} quick news items`);

  const result = {
    featured,
    quickNews,
    metadata: {
      totalRawArticles: rawArticles.length,
      totalScored: scoredArticles.length,
      highPriorityCount: candidates.length,
      generatedAt: new Date().toISOString()
    }
  };

  await fs.writeFile(
    'content/filtered-articles.json',
    JSON.stringify(result, null, 2)
  );

  console.log('✓ Saved to content/filtered-articles.json');
}
