const MIN_WORD_LENGTH = 3;
const TITLE_SIMILARITY_THRESHOLD = 0.6;
const SHARED_KEYWORDS_THRESHOLD = 3;

export function calculateJaccardSimilarity(str1, str2) {
  const words1 = new Set(
    str1.toLowerCase().split(/\s+/).filter(w => w.length > MIN_WORD_LENGTH)
  );
  const words2 = new Set(
    str2.toLowerCase().split(/\s+/).filter(w => w.length > MIN_WORD_LENGTH)
  );

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

export function getSharedKeywords(article1, article2) {
  const extractKeywords = (text) => {
    const words = text.split(/\s+/);
    const keywords = new Set();
    words.forEach(word => {
      if (/^[A-Z]/.test(word)) keywords.add(word);
      const terms = word.match(/\b(GPT|AI|ML|LLM|API|GPU|TPU|AGI)\b/gi) || [];
      terms.forEach(term => keywords.add(term));
    });
    return keywords;
  };

  const text1 = (article1.title || '') + ' ' + (article1.summary || '');
  const text2 = (article2.title || '') + ' ' + (article2.summary || '');

  const keywords1 = extractKeywords(text1);
  const keywords2 = extractKeywords(text2);

  return [...keywords1].filter(k => keywords2.has(k));
}

export function findRelatedArticles(article, allArticles) {
  return allArticles.filter(other => {
    if (other.id === article.id) return false;
    if (article.source === other.source) return false;

    const titleSimilarity = calculateJaccardSimilarity(article.title || '', other.title || '');
    const sharedKeywords = getSharedKeywords(article, other);

    return titleSimilarity > TITLE_SIMILARITY_THRESHOLD || sharedKeywords.length >= SHARED_KEYWORDS_THRESHOLD;
  });
}
