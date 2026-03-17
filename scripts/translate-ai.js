import fs from 'fs/promises';
import OpenAI from 'openai';
import { loadSiteConfig } from './lib/config.js';

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1000;
const CRITICAL_FAILURE_THRESHOLD = 0.5;
const MIN_ATTEMPTS_FOR_ABORT = 5;
const TRANSLATION_MAX_TOKENS = 1000;
const TRANSLATION_TEMPERATURE = 0.3;

function createOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not set in .env file');
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function translateArticle(article, targetLang) {
  const langName = targetLang === 'zh' ? 'Chinese (Simplified)' : 'Japanese';

  const hasSuggested = article.suggestedTitle || article.suggestedSummary;
  const fields = hasSuggested
    ? `Title: ${article.title}
Summary: ${article.summary || article.title}
EditorialTitle: ${article.suggestedTitle || article.title}
EditorialSummary: ${article.suggestedSummary || article.summary || ''}`
    : `Title: ${article.title}
Summary: ${article.summary || article.title}`;

  const outputSpec = hasSuggested
    ? `{ "title": "translated title", "summary": "translated summary", "suggestedTitle": "translated editorial title", "suggestedSummary": "translated editorial summary" }`
    : `{ "title": "translated title", "summary": "translated summary" }`;

  const prompt = `Translate this news article to ${langName}. Maintain technical accuracy. Keep the editorial tone for editorial fields.

${fields}

Output JSON:
${outputSpec}`;

  try {
    const openai = createOpenAIClient();
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: TRANSLATION_TEMPERATURE,
      max_tokens: TRANSLATION_MAX_TOKENS
    });

    const content = response.choices[0].message.content;
    let translated;

    try {
      translated = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse translation JSON response:', content);
      throw new Error(`JSON parse error: ${parseError.message}`);
    }

    const result = {
      ...article,
      title: translated.title,
      summary: translated.summary
    };
    if (translated.suggestedTitle) result.suggestedTitle = translated.suggestedTitle;
    if (translated.suggestedSummary) result.suggestedSummary = translated.suggestedSummary;
    return result;

  } catch (error) {
    console.error(`Translation failed for article ${article.id} to ${targetLang}:`, error.message);

    try {
      await fs.mkdir('logs', { recursive: true });
      await fs.appendFile(
        'logs/translation-failures.log',
        `${new Date().toISOString()} | ${targetLang} | ${article.id} | ${error.message}\n`
      );
    } catch (logError) {
      console.error('Warning: Failed to write failure log:', logError.message);
    }

    return null;
  }
}

export async function translateBatch(articles, targetLang) {
  console.log(`Translating ${articles.length} articles to ${targetLang}...`);

  const results = [];
  let totalProcessed = 0;
  let totalFailed = 0;

  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(article => translateArticle(article, targetLang))
    );

    const successes = batchResults.filter(r => r !== null);
    const failures = batchResults.length - successes.length;

    results.push(...successes);
    totalProcessed += batchResults.length;
    totalFailed += failures;

    const failureRate = totalFailed / totalProcessed;
    if (failureRate > CRITICAL_FAILURE_THRESHOLD && totalProcessed >= MIN_ATTEMPTS_FOR_ABORT) {
      console.error(`CRITICAL: Translation failure rate ${(failureRate * 100).toFixed(1)}% exceeds 50% threshold`);
      throw new Error(`Translation failure rate too high: ${totalFailed}/${totalProcessed} failed`);
    }

    if (i + BATCH_SIZE < articles.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  console.log(`Successfully translated ${results.length}/${articles.length} articles`);
  if (totalFailed > 0) {
    console.warn(`Warning: ${totalFailed} translations failed (${(totalFailed / totalProcessed * 100).toFixed(1)}%)`);
  }

  return results;
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  await import('dotenv/config');

  console.log('Loading filtered articles...');
  const filtered = JSON.parse(
    await fs.readFile('content/filtered-articles.json', 'utf-8')
  );

  const allArticles = [...filtered.featured, ...filtered.quickNews];
  const today = process.env.DIGEST_DATE || new Date().toISOString().split('T')[0];

  const config = loadSiteConfig();
  const totalSources = (config.sources.rss || []).length
    + (config.sources.hackernews?.enabled ? 1 : 0)
    + (config.sources.huggingface?.enabled ? 1 : 0);

  // English version (no translation needed)
  const enContent = {
    date: today,
    lang: 'en',
    featured: filtered.featured,
    quickNews: filtered.quickNews,
    metadata: {
      totalArticles: totalSources,
      estimatedReadTime: '5 min',
      generatedAt: new Date().toISOString()
    }
  };

  await fs.mkdir('content/en', { recursive: true });
  await fs.writeFile(`content/en/${today}.json`, JSON.stringify(enContent, null, 2));
  console.log(`✓ Saved English version: content/en/${today}.json`);

  // Chinese translation
  console.log('\nTranslating to Chinese...');
  const zhFeatured = await translateBatch(filtered.featured, 'zh');
  const zhQuickNews = await translateBatch(filtered.quickNews, 'zh');

  const zhContent = {
    date: today,
    lang: 'zh',
    featured: zhFeatured,
    quickNews: zhQuickNews,
    metadata: {
      totalArticles: totalSources,
      estimatedReadTime: '5 分钟',
      generatedAt: new Date().toISOString()
    }
  };

  await fs.mkdir('content/zh', { recursive: true });
  await fs.writeFile(`content/zh/${today}.json`, JSON.stringify(zhContent, null, 2));
  console.log(`✓ Saved Chinese version: content/zh/${today}.json`);

  // Japanese translation
  console.log('\nTranslating to Japanese...');
  const jaFeatured = await translateBatch(filtered.featured, 'ja');
  const jaQuickNews = await translateBatch(filtered.quickNews, 'ja');

  const jaContent = {
    date: today,
    lang: 'ja',
    featured: jaFeatured,
    quickNews: jaQuickNews,
    metadata: {
      totalArticles: totalSources,
      estimatedReadTime: '5 分',
      generatedAt: new Date().toISOString()
    }
  };

  await fs.mkdir('content/ja', { recursive: true });
  await fs.writeFile(`content/ja/${today}.json`, JSON.stringify(jaContent, null, 2));
  console.log(`✓ Saved Japanese version: content/ja/${today}.json`);

  console.log('\n✓ Translation complete!');
  console.log(`\nGenerated content for ${today}:`);
  console.log(`  - content/en/${today}.json`);
  console.log(`  - content/zh/${today}.json`);
  console.log(`  - content/ja/${today}.json`);
}
