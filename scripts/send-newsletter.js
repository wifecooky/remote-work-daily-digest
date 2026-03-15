import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadSiteConfig } from './lib/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.resolve(__dirname, '../content');
const API_URL = 'https://api.buttondown.com/v1/emails';

const config = loadSiteConfig();
const SITE_URL = config.site.url;
const labels = config.labels || {};

const LANG_CONFIG = {
  en: { tag: 'lang:en', title: config.site.title.en, featured: labels.featured?.en || 'FEATURED', signal: labels.signal?.en || 'SIGNAL', cta: labels.cta?.en || 'READ FULL DIGEST' },
  zh: { tag: 'lang:zh', title: config.site.title.zh, featured: labels.featured?.zh || '深度解读', signal: labels.signal?.zh || '信号', cta: labels.cta?.zh || '阅读完整日报' },
  ja: { tag: 'lang:ja', title: config.site.title.ja, featured: labels.featured?.ja || '特集', signal: labels.signal?.ja || 'シグナル', cta: labels.cta?.ja || '全文を読む' },
};

function esc(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildEmailBody(data, date, langConfig) {
  const h = [];

  h.push(`<div style="text-align:center;padding:24px 0 16px;">`);
  h.push(`<div style="font-size:11px;letter-spacing:4px;color:#999;text-transform:uppercase;">${esc(langConfig.title)}</div>`);
  h.push(`<div style="font-size:28px;font-weight:900;color:#111;padding-top:8px;font-family:monospace;">${date}</div>`);
  h.push(`</div>`);
  h.push(`<hr style="border:none;border-top:1px solid #ddd;margin:0 0 20px;">`);

  if (data.featured?.length) {
    h.push(`<div style="font-size:10px;letter-spacing:3px;color:#d6336c;text-transform:uppercase;font-weight:700;margin-bottom:12px;">${esc(langConfig.featured)}</div>`);
    for (const a of data.featured) {
      const title = a.suggestedTitle || a.title;
      const summary = a.suggestedSummary || a.summary || '';
      const link = a.url
        ? `<a href="${esc(a.url)}" style="color:#0969da;text-decoration:none;font-weight:700;">${esc(title)}</a>`
        : `<strong>${esc(title)}</strong>`;
      const src = a.source ? ` <span style="color:#888;font-size:12px;">— ${esc(a.source)}</span>` : '';
      h.push(`<p style="margin:0 0 4px;font-size:15px;line-height:1.5;">${link}${src}</p>`);
      if (summary) h.push(`<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#555;">${esc(summary)}</p>`);
    }
  }

  if (data.featured?.length && data.quickNews?.length) {
    h.push(`<hr style="border:none;border-top:1px solid #ddd;margin:20px 0;">`);
  }

  if (data.quickNews?.length) {
    h.push(`<div style="font-size:10px;letter-spacing:3px;color:#1a7f37;text-transform:uppercase;font-weight:700;margin-bottom:12px;">${esc(langConfig.signal)}</div>`);
    h.push(`<ul style="padding-left:18px;margin:0;">`);
    for (const a of data.quickNews) {
      const link = a.url
        ? `<a href="${esc(a.url)}" style="color:#333;text-decoration:none;">${esc(a.title)}</a>`
        : esc(a.title);
      const src = a.source ? ` <span style="color:#888;font-size:11px;">[${esc(a.source)}]</span>` : '';
      h.push(`<li style="margin-bottom:6px;font-size:13px;line-height:1.5;">${link}${src}</li>`);
    }
    h.push(`</ul>`);
  }

  h.push(`<hr style="border:none;border-top:1px solid #ddd;margin:24px 0 16px;">`);
  h.push(`<div style="text-align:center;">`);
  h.push(`<a href="${SITE_URL}/${date}" style="display:inline-block;padding:10px 24px;border:1px solid #0969da;color:#0969da;text-decoration:none;font-size:11px;letter-spacing:2px;font-weight:700;font-family:monospace;">${esc(langConfig.cta)}</a>`);
  h.push(`</div>`);

  const domain = SITE_URL.replace(/^https?:\/\//, '');
  h.push(`<div style="text-align:center;padding-top:16px;font-size:10px;letter-spacing:1px;">`);
  h.push(`<a href="${SITE_URL}" style="color:#999;text-decoration:none;">${domain}</a>`);
  h.push(`</div>`);

  return h.join('\n');
}

// Currently sending English only (free plan doesn't support tag filtering).
// When upgraded to Basic, switch SEND_LANGS to Object.keys(LANG_CONFIG)
// and add filters to the POST body.
const SEND_LANGS = ['en'];

async function sendForLang(lang, langConfig, today, apiKey) {
  const filePath = path.join(CONTENT_DIR, lang, `${today}.json`);

  if (!fs.existsSync(filePath)) {
    console.log(`[newsletter:${lang}] No content for ${today}, skipping.`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const body = buildEmailBody(data, today, langConfig);
  const subject = `${langConfig.title} — ${today}`;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Buttondown-Live-Dangerously': 'true',
    },
    body: JSON.stringify({ subject, body, status: 'about_to_send' }),
  });

  if (res.ok) {
    console.log(`[newsletter:${lang}] Sent: ${subject}`);
  } else {
    const text = await res.text();
    console.error(`[newsletter:${lang}] Failed (${res.status}): ${text}`);
  }
}

async function main() {
  const apiKey = process.env.BUTTONDOWN_API_KEY;
  if (!apiKey) {
    console.log('[newsletter] BUTTONDOWN_API_KEY not set, skipping.');
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  for (const lang of SEND_LANGS) {
    const langConfig = LANG_CONFIG[lang];
    try {
      await sendForLang(lang, langConfig, today, apiKey);
    } catch (err) {
      console.error(`[newsletter:${lang}] Error: ${err.message}`);
    }
  }
}

main().catch(err => {
  console.error('[newsletter] Error:', err.message);
  process.exit(0);
});
