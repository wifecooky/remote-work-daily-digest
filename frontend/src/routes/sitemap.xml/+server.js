import fs from 'fs';
import path from 'path';
import config from 'virtual:site-config';

const CONTENT_DIR = path.resolve('../content');
const SITE_URL = config.site.url;

function getAvailableDates() {
  const enDir = path.join(CONTENT_DIR, 'en');
  try {
    return fs.readdirSync(enDir)
      .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .map(f => f.replace('.json', ''))
      .sort((a, b) => b.localeCompare(a));
  } catch {
    return [];
  }
}

export const prerender = true;

/** @type {import('./$types').RequestHandler} */
export function GET() {
  const dates = getAvailableDates();
  const today = new Date().toISOString().split('T')[0];

  const urls = [
    `  <url><loc>${SITE_URL}/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    `  <url><loc>${SITE_URL}/about</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>`,
    ...dates.map(d => `  <url><loc>${SITE_URL}/${d}</loc><lastmod>${d}</lastmod><priority>0.8</priority></url>`)
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' }
  });
}
