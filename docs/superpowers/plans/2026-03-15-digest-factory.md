# digest-factory Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a reusable digest site template where one `site.yaml` config file produces a complete daily digest site with pipeline + frontend.

**Architecture:** Copy and generalize the `news/` pipeline scripts and SvelteKit frontend. All hardcoded values (sources, titles, labels, theme colors, URLs, editorial prompts) are extracted into `site.yaml`. Scripts read config via a shared `lib/config.js`. Frontend reads config at build time via a vite plugin that injects `site.yaml` as a virtual module.

**Tech Stack:** Node.js 20+, SvelteKit 2 + Svelte 5, Tailwind CSS v4, OpenAI API, Buttondown API, GitHub Actions, Cloudflare Pages

**Source repo:** `/Users/wenping.wang/Documents/git/digest-factory`
**Reference repo:** `/Users/wenping.wang/Documents/git/AI/news` (read-only, do NOT modify)

---

## File Structure

```
digest-factory/
├── site.yaml                        # THE config file — identity, sources, theme, sponsor
├── package.json                     # Root deps: js-yaml, dotenv, openai, rss-parser, node-fetch
├── .env.example                     # OPENAI_API_KEY, BUTTONDOWN_API_KEY
├── scripts/
│   ├── lib/
│   │   └── config.js                # loadSiteConfig() — shared YAML loader
│   ├── utils/
│   │   ├── rss-parser.js            # RSS/Atom/API fetchers (from news/)
│   │   └── similarity.js            # Related article detection (from news/)
│   ├── collect-rss.js               # Reads sources from config
│   ├── filter-ai.js                 # Reads editorial prompt + counts from config
│   ├── translate-ai.js              # Reads site title from config
│   └── send-newsletter.js           # Reads newsletter username + site URL from config
├── config/
│   └── prompts/
│       └── editorial.md             # Editorial prompt template (user edits per site)
├── frontend/
│   ├── package.json                 # SvelteKit deps
│   ├── svelte.config.js             # adapter-static
│   ├── vite.config.js               # tailwindcss + sveltekit + site-config plugin
│   ├── jsconfig.json
│   ├── src/
│   │   ├── app.html                 # Shell with FOUC prevention
│   │   ├── app.css                  # Cyberpunk theme using CSS vars from config
│   │   ├── lib/
│   │   │   ├── site-config.js       # Re-exports virtual:site-config for components
│   │   │   ├── rss.js               # RSS feed generation
│   │   │   └── components/
│   │   │       └── SubscribeForm.svelte
│   │   └── routes/
│   │       ├── +layout.svelte       # Header, theme, language switching
│   │       ├── +layout.js           # Prerender config
│   │       ├── [[date]]/
│   │       │   ├── +page.svelte     # Main digest page
│   │       │   └── +page.server.js  # Load content JSON
│   │       ├── about/
│   │       │   └── +page.svelte     # About page (generated from config)
│   │       ├── rss.xml/+server.js
│   │       ├── rss-zh.xml/+server.js
│   │       ├── rss-ja.xml/+server.js
│   │       └── sitemap.xml/+server.js
│   └── static/                      # Favicon etc.
├── content/                         # Generated at runtime (gitignored except dated JSONs)
├── .github/
│   └── workflows/
│       └── daily.yml                # Cron + manual trigger
├── .gitignore
└── README.md
```

---

## Chunk 1: Project Scaffold + Config System

### Task 1: Initialize project and site.yaml

**Files:**
- Create: `site.yaml`
- Create: `package.json`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Create site.yaml with AI topic as default**

Use the AI Daily Digest as the default config so we can validate against the existing site. The user will later swap this for Golang etc.

```yaml
# site.yaml — Edit this file to create your digest site
# ── Identity ──
site:
  id: ai
  url: https://news.ai.thewang.net
  title:
    en: 'AI Daily Digest'
    zh: 'AI 日知录'
    ja: 'AI 日知録'
  subtitle:
    en: 'AI engineering news, daily.'
    zh: '每天五分钟，跟上 AI 工程动态'
    ja: 'AIエンジニアリングの最新動向を毎日'
  description:
    en: 'Daily curated AI engineering news from 23 sources. Covering OpenAI, Anthropic, Google AI, Hacker News, and more.'
    zh: 'AI 工程技术日报 — 每天从 23 个数据源精选 AI 工程动态，覆盖 OpenAI、Anthropic、Google AI、Hacker News 等。'
    ja: 'AIエンジニアリングの厳選日刊ダイジェスト。OpenAI、Anthropic、Google AI、Hacker Newsなど23ソースから毎日配信。'
  keywords:
    en: 'AI news, artificial intelligence, machine learning, AI engineering, daily digest'
    zh: 'AI新闻, 人工智能, 机器学习, AI工程, 每日简报'
    ja: 'AIニュース, 人工知能, 機械学習, AIエンジニアリング, デイリーダイジェスト'
  hashtag:
    en: '#AIDailyDigest'
    zh: '#AI日知录'
    ja: '#AI日知録'

# ── Theme ──
theme:
  accent: '#00e5ff'

# ── Data Sources ──
sources:
  rss:
    - { url: 'https://openai.com/blog/rss.xml', name: 'OpenAI', weight: 10 }
    - { url: 'https://raw.githubusercontent.com/taobojlen/anthropic-rss-feed/main/anthropic_news_rss.xml', name: 'Anthropic', weight: 10 }
    - { url: 'https://research.google/blog/rss', name: 'Google AI', weight: 10 }
    - { url: 'https://deepmind.google/blog/rss.xml', name: 'DeepMind', weight: 10 }
    - { url: 'https://blog.google/innovation-and-ai/technology/ai/rss/', name: 'Google Blog AI', weight: 9 }
    - { url: 'https://engineering.fb.com/category/ai-research/feed/', name: 'Meta AI', weight: 9 }
    - { url: 'https://blogs.nvidia.com/feed/', name: 'NVIDIA', weight: 9 }
    - { url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed/', name: 'MIT Tech Review', weight: 8 }
    - { url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', name: 'The Verge', weight: 7 }
    - { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', name: 'TechCrunch', weight: 7 }
    - { url: 'https://arstechnica.com/ai/feed/', name: 'Ars Technica', weight: 7 }
    - { url: 'https://www.wired.com/feed/tag/ai/latest/rss', name: 'Wired', weight: 6 }
    - { url: 'https://www.404media.co/feed/', name: '404 Media', weight: 6 }
    - { url: 'https://news.google.com/rss/topics/CAAqKAgKIiJDQkFTRXdvTkwyY3ZNVEZqWlhKamVIQm9jaElDWlc0b0FBUAE?hl=en-US&gl=US&ceid=US:en', name: 'Google News AI', weight: 7 }
    - { url: 'https://news.google.com/rss/topics/CAAqKAgKIiJDQkFTRXdvTkwyY3ZNVEZqWlhKamVIQm9jaElDZW1nb0FBUAE?hl=zh-CN&gl=CN&ceid=CN:zh-Hans', name: 'Google News AI (CN)', weight: 7 }
    - { url: 'https://news.google.com/rss/topics/CAAqKAgKIiJDQkFTRXdvTkwyY3ZNVEZqWlhKamVIQm9jaElDYW1Fb0FBUAE?hl=ja&gl=JP&ceid=JP:ja', name: 'Google News AI (JP)', weight: 7 }
    - { url: 'https://importai.substack.com/feed', name: 'Import AI', weight: 6 }
    - { url: 'https://latent.space/feed', name: 'Latent Space', weight: 6 }
    - { url: 'https://www.interconnects.ai/feed', name: 'Interconnects', weight: 6 }
    - { url: 'https://www.oneusefulthing.org/feed', name: 'One Useful Thing', weight: 5 }
    - { url: 'https://www.aisnakeoil.com/feed', name: 'AI Snake Oil', weight: 5 }
    - { url: 'https://bensbites.substack.com/feed', name: "Ben's Bites", weight: 5 }
    - { url: 'https://simonwillison.net/atom/everything/', name: 'Simon Willison', weight: 5 }

  hackernews:
    enabled: true
    query: 'AI'
    weight: 8

  huggingface:
    enabled: true
    weight: 7

# ── Editorial ──
editorial:
  prompt: config/prompts/editorial.md
  min_articles: 3
  featured_count: [2, 3]
  quicknews_count: [4, 6]

# ── Labels ──
labels:
  featured: { en: 'FEATURED', zh: '深度解读', ja: '特集' }
  signal: { en: 'SIGNAL', zh: '信号', ja: 'シグナル' }
  archive: { en: 'ARCHIVE', zh: '往期', ja: 'アーカイブ' }
  backToday: { en: 'BACK TO TODAY', zh: '返回今日', ja: '今日に戻る' }
  empty: { en: 'NO SIGNAL TODAY.', zh: '// 今日无信号', ja: '// 本日シグナルなし' }
  sources: { en: 'sources scanned', zh: '条资讯已扫描', ja: '件スキャン済み' }
  fromSources: { en: 'SRC', zh: '来源', ja: 'SRC' }
  subscribe: { en: 'SUBSCRIBE', zh: '订阅', ja: '購読' }
  emailPlaceholder: { en: 'you@example.com', zh: '你的邮箱', ja: 'メールアドレス' }
  stayUpdated: { en: 'STAY UPDATED', zh: '保持关注', ja: '最新情報を受け取る' }
  stayUpdatedDesc: { en: 'Daily AI engineering digest, straight to your inbox.', zh: '每日 AI 工程简报，直达邮箱。', ja: 'AIエンジニアリングの日刊ダイジェストをメールでお届け。' }

# ── Sponsor (optional) ──
sponsor: null

# ── Newsletter (optional) ──
newsletter:
  provider: buttondown
  username: thewang

# ── About Page ──
about:
  title: { en: 'HOW IT WORKS', zh: '运作方式', ja: '仕組み' }
  overview:
    en: 'This is a fully automated engineering news briefing. Every day, the system collects articles from multiple sources, scores and filters them through a multi-stage pipeline, and generates a curated digest in three languages.'
    zh: '这是一份全自动的工程技术日报。系统每天从多个数据源采集文章，经过多阶段的评分、筛选和编辑流水线，生成中英日三语的精选简报。'
    ja: '完全自動化されたエンジニアリングニュースブリーフィングです。毎日複数のデータソースから記事を収集し、多段階のスコアリング・フィルタリングパイプラインを通じて、3言語のキュレーションダイジェストを生成します。'
  policyAudience:
    en: 'Target audience: engineers and developers.'
    zh: '目标读者：工程师和开发者。'
    ja: '対象読者：エンジニアおよび開発者。'
  disclaimer:
    en: 'Headlines and analysis paragraphs are generated by AI and may contain inaccuracies. All original reporting belongs to their respective sources.'
    zh: '标题和分析段落由 AI 生成，可能存在不准确之处。所有原始报道版权归各自来源所有。'
    ja: '見出しと分析パラグラフはAIにより生成されており、不正確な場合があります。すべてのオリジナル記事は各ソースに帰属します。'

# ── Schedule ──
schedule:
  cron: '0 7 * * *'
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "digest-factory",
  "version": "0.1.0",
  "type": "module",
  "license": "MIT",
  "engines": { "node": ">=20.0.0" },
  "scripts": {
    "collect": "node scripts/collect-rss.js",
    "filter": "node scripts/filter-ai.js",
    "translate": "node scripts/translate-ai.js",
    "generate-daily": "npm run collect && npm run filter && npm run translate",
    "newsletter": "node scripts/send-newsletter.js",
    "clean": "rm -f content/raw-articles.json content/scored-articles.json content/filtered-articles.json",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "dotenv": "^17.3.1",
    "js-yaml": "^4.1.0",
    "node-fetch": "^3.3.2",
    "openai": "^6.27.0",
    "rss-parser": "^3.13.0"
  },
  "devDependencies": {
    "vitest": "^4.0.18"
  }
}
```

- [ ] **Step 3: Create .env.example and .gitignore**

`.env.example`:
```
OPENAI_API_KEY=sk_your_openai_api_key_here
# OPENAI_MODEL=gpt-4o
# BUTTONDOWN_API_KEY=your_key_here
```

`.gitignore`:
```
node_modules/
.env
content/raw-articles.json
content/scored-articles.json
content/filtered-articles.json
frontend/build/
frontend/.svelte-kit/
frontend/node_modules/
```

- [ ] **Step 4: Commit**

```bash
git add site.yaml package.json .env.example .gitignore
git commit -m "feat: project scaffold with site.yaml config"
```

---

### Task 2: Config loader and pipeline utils

**Files:**
- Create: `scripts/lib/config.js`
- Create: `scripts/utils/rss-parser.js` (copy from news/, replace HN query hardcode)
- Create: `scripts/utils/similarity.js` (copy from news/ as-is)

- [ ] **Step 1: Create scripts/lib/config.js**

```javascript
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function loadSiteConfig() {
  const configPath = path.resolve(__dirname, '../../site.yaml');
  return yaml.load(fs.readFileSync(configPath, 'utf-8'));
}
```

- [ ] **Step 2: Copy and adapt scripts/utils/rss-parser.js**

Copy from `news/scripts/utils/rss-parser.js`. Change the `fetchHackerNews` function to accept a `query` parameter instead of hardcoding `'AI'`:

```javascript
// Before (news/):
const query = 'AI';
// After (template):
export async function fetchHackerNews(query, recentHours = 24) {
```

- [ ] **Step 3: Copy scripts/utils/similarity.js**

Copy as-is from `news/scripts/utils/similarity.js`. No changes needed — it's already topic-agnostic.

- [ ] **Step 4: Commit**

```bash
git add scripts/
git commit -m "feat: config loader and pipeline utilities"
```

---

### Task 3: collect-rss.js (config-driven)

**Files:**
- Create: `scripts/collect-rss.js`

- [ ] **Step 1: Copy from news/ and replace hardcoded sources with config reads**

Key changes vs `news/scripts/collect-rss.js`:

```javascript
import { loadSiteConfig } from './lib/config.js';

const config = loadSiteConfig();

// Sources from config instead of ../config/sources.json
const rssSources = config.sources.rss.map(s => ({
  type: 'rss', name: s.name, url: s.url, weight: s.weight
}));

// HN from config
if (config.sources.hackernews?.enabled) {
  // call fetchHackerNews(config.sources.hackernews.query)
  // with weight: config.sources.hackernews.weight
}

// HuggingFace from config
if (config.sources.huggingface?.enabled) {
  // call fetchHuggingFacePapers()
  // with weight: config.sources.huggingface.weight
}
```

Remove the `config/sources.json` file — sources now live in `site.yaml`.

- [ ] **Step 2: Test locally**

```bash
cp /Users/wenping.wang/Documents/git/AI/news/.env .env
npm install && npm run collect
# Verify content/raw-articles.json is created
```

- [ ] **Step 3: Commit**

```bash
git add scripts/collect-rss.js
git commit -m "feat: config-driven RSS collection"
```

---

### Task 4: filter-ai.js (config-driven)

**Files:**
- Create: `scripts/filter-ai.js`
- Create: `config/prompts/editorial.md`

- [ ] **Step 1: Copy editorial prompt from news/**

Copy `news/config/prompts/filter-selection.md` → `config/prompts/editorial.md`. This is the template — users edit it per site.

- [ ] **Step 2: Copy and adapt filter-ai.js**

Key changes vs `news/scripts/filter-ai.js`:

```javascript
import { loadSiteConfig } from './lib/config.js';

const config = loadSiteConfig();

// Read editorial prompt path from config
const promptPath = path.resolve(__dirname, '..', config.editorial.prompt);
const promptTemplate = fs.readFileSync(promptPath, 'utf-8');

// Use counts from config
const FEATURED_COUNT = config.editorial.featured_count[1]; // max
const QUICK_NEWS_COUNT = config.editorial.quicknews_count[1]; // max

// Source weights from config
const sourceWeights = {};
for (const s of config.sources.rss) {
  sourceWeights[s.name] = s.weight;
}
if (config.sources.hackernews?.enabled) {
  sourceWeights['Hacker News'] = config.sources.hackernews.weight;
}
if (config.sources.huggingface?.enabled) {
  sourceWeights['HuggingFace Papers'] = config.sources.huggingface.weight;
}
```

- [ ] **Step 3: Test locally**

```bash
npm run collect && npm run filter
# Verify content/filtered-articles.json has featured + quickNews
```

- [ ] **Step 4: Commit**

```bash
git add scripts/filter-ai.js config/
git commit -m "feat: config-driven AI editorial filtering"
```

---

### Task 5: translate-ai.js (config-driven)

**Files:**
- Create: `scripts/translate-ai.js`

- [ ] **Step 1: Copy and adapt translate-ai.js**

Key changes vs `news/scripts/translate-ai.js`:

```javascript
import { loadSiteConfig } from './lib/config.js';
const config = loadSiteConfig();
// No hardcoded site title — read from config.site.title
```

The translation logic itself is topic-agnostic (translates whatever text it's given), so minimal changes needed.

- [ ] **Step 2: Test locally**

```bash
npm run generate-daily
# Verify content/en/*.json, content/zh/*.json, content/ja/*.json exist
```

- [ ] **Step 3: Commit**

```bash
git add scripts/translate-ai.js
git commit -m "feat: config-driven translation pipeline"
```

---

### Task 6: send-newsletter.js (config-driven)

**Files:**
- Create: `scripts/send-newsletter.js`

- [ ] **Step 1: Copy and adapt send-newsletter.js**

Key changes vs `news/scripts/send-newsletter.js`:

```javascript
import { loadSiteConfig } from './lib/config.js';
const config = loadSiteConfig();

const SITE_URL = config.site.url;
// Buttondown embed URL from config
const BUTTONDOWN_USERNAME = config.newsletter?.username;

// LANG_CONFIG reads from site.yaml labels
const LANG_CONFIG = {
  en: { title: config.site.title.en, featured: config.labels.featured.en, signal: config.labels.signal.en, cta: 'READ FULL DIGEST' },
  zh: { title: config.site.title.zh, featured: config.labels.featured.zh, signal: config.labels.signal.zh, cta: '阅读完整日报' },
  ja: { title: config.site.title.ja, featured: config.labels.featured.ja, signal: config.labels.signal.ja, cta: '全文を読む' },
};
```

- [ ] **Step 2: Commit**

```bash
git add scripts/send-newsletter.js
git commit -m "feat: config-driven newsletter sending"
```

---

## Chunk 2: Frontend (Config-Driven)

### Task 7: SvelteKit scaffold + vite config plugin

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/svelte.config.js`
- Create: `frontend/vite.config.js` (with site-config virtual module)
- Create: `frontend/jsconfig.json`
- Create: `frontend/src/app.html`
- Create: `frontend/src/lib/site-config.js`

- [ ] **Step 1: Create frontend/package.json**

Copy from `news/frontend/package.json`. Same deps: `@sveltejs/adapter-static`, `@sveltejs/kit`, `svelte`, `tailwindcss`, `@tailwindcss/vite`.

- [ ] **Step 2: Create vite.config.js with site-config plugin**

This is the key piece — a vite plugin that reads `../site.yaml` and exposes it as `virtual:site-config`:

```javascript
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const siteConfigPlugin = {
  name: 'site-config',
  resolveId(id) {
    if (id === 'virtual:site-config') return '\0virtual:site-config';
  },
  load(id) {
    if (id === '\0virtual:site-config') {
      const configPath = path.resolve(process.cwd(), '../site.yaml');
      const config = yaml.load(fs.readFileSync(configPath, 'utf-8'));
      return `export default ${JSON.stringify(config)};`;
    }
  },
};

export default {
  plugins: [tailwindcss(), siteConfigPlugin, sveltekit()],
};
```

- [ ] **Step 3: Create frontend/src/lib/site-config.js**

```javascript
import config from 'virtual:site-config';
export default config;
```

- [ ] **Step 4: Create svelte.config.js, jsconfig.json, app.html**

Copy from `news/frontend/` as-is. `app.html` is topic-agnostic (fonts + FOUC prevention).

- [ ] **Step 5: Install deps and verify build starts**

```bash
cd frontend && npm install && npx svelte-kit sync
```

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/svelte.config.js frontend/vite.config.js frontend/jsconfig.json frontend/src/app.html frontend/src/lib/site-config.js
git commit -m "feat: SvelteKit scaffold with site-config vite plugin"
```

---

### Task 8: Theme system (config-driven accent color)

**Files:**
- Create: `frontend/src/app.css`

- [ ] **Step 1: Copy app.css from news/ and make accent configurable**

The cyberpunk base (grid, glow, animations, scanlines) stays identical. The `--color-cyber-cyan` (primary accent) will be overridden at build time via a CSS custom property set from `site.yaml`.

In `app.css`, keep the full theme but add at the top:

```css
:root {
  --site-accent: var(--color-cyber-cyan);
}
```

Components that use `text-cyber-cyan`, `border-cyber-cyan` etc. will continue working as-is. To make the accent dynamic per-site, the vite plugin injects a `<style>` tag that overrides `--color-cyber-cyan` with `theme.accent` from site.yaml.

Approach: In `app.html`, add an inline style block generated from config:

```html
<style>
  :root { --color-cyber-cyan: %site.accent%; }
  [data-theme="light"] { --color-cyber-cyan: %site.accent.light%; }
</style>
```

The vite plugin handles the substitution. This way all `cyber-cyan` references automatically use the site's accent color. No changes needed in component files.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app.css
git commit -m "feat: cyberpunk theme with configurable accent color"
```

---

### Task 9: Layout (config-driven header)

**Files:**
- Create: `frontend/src/routes/+layout.svelte`
- Create: `frontend/src/routes/+layout.js`

- [ ] **Step 1: Copy +layout.svelte from news/ and replace hardcodes with config**

Replace all hardcoded values:

```javascript
import config from '$lib/site-config.js';

// Before: const siteNames = { en: 'AI DAILY DIGEST', ... };
// After:
const siteNames = config.site.title;

// Before: const siteKeywords = { en: 'AI news, ...', ... };
// After:
const siteKeywords = config.site.keywords;

// Site URL
const SITE_URL = config.site.url;
```

Everything else (theme cycling, language detection, header structure) stays the same.

- [ ] **Step 2: Copy +layout.js as-is**

```javascript
export const prerender = true;
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/+layout.svelte frontend/src/routes/+layout.js
git commit -m "feat: config-driven layout with site title and keywords"
```

---

### Task 10: Main page (config-driven)

**Files:**
- Create: `frontend/src/routes/[[date]]/+page.svelte`
- Create: `frontend/src/routes/[[date]]/+page.server.js`

- [ ] **Step 1: Copy +page.server.js from news/ as-is**

The server loader reads `content/{lang}/*.json` — this is already topic-agnostic. Only change: sponsor data reads from `site.yaml` instead of `config/sponsor.json`.

```javascript
import config from 'virtual:site-config';
// sponsor = config.sponsor (null if not set)
```

- [ ] **Step 2: Copy +page.svelte and replace hardcodes**

```javascript
import config from '$lib/site-config.js';

// Replace hardcoded labels
const labels = config.labels;

// Replace hardcoded meta
const SITE_URL = config.site.url;
const siteTitle = config.site.title;
const siteDesc = config.site.description;
const hashtag = config.site.hashtag;
```

All the template markup (featured cards, quick news list, archive, subscribe section) stays identical — it already uses `labels[currentLang]` pattern.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/\[\[date\]\]/
git commit -m "feat: config-driven main page"
```

---

### Task 11: SubscribeForm + About page (config-driven)

**Files:**
- Create: `frontend/src/lib/components/SubscribeForm.svelte`
- Create: `frontend/src/routes/about/+page.svelte`

- [ ] **Step 1: Copy and adapt SubscribeForm.svelte**

```javascript
import config from '$lib/site-config.js';

// Buttondown endpoint uses config username
const formAction = `https://buttondown.com/api/emails/embed-subscribe/${config.newsletter?.username || 'newsletter'}`;

// Labels from config
const labels = {
  subscribe: config.labels.subscribe,
  placeholder: config.labels.emailPlaceholder,
};
```

- [ ] **Step 2: Copy and adapt about/+page.svelte**

This is the biggest change. The `news/` about page has ~400 lines of hardcoded translations for pipeline steps, source categories, editorial policy, featured mechanisms.

For the template, the about page should be **generated from config**:

- `config.about.title`, `config.about.overview` — from site.yaml
- Source categories — generated from `config.sources.rss[]` (group by weight range or a `category` field)
- Pipeline description — keep a generic version (collect → score → AI select → translate) since the pipeline is the same for all sites
- Editorial policy — read from the editorial prompt file or a dedicated `config.about.policy` section
- Disclaimer — from `config.about.disclaimer`

Simplify: the about page in the template is shorter and more generic than the news/ version. Users who want a richer about page can customize the component.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/components/SubscribeForm.svelte frontend/src/routes/about/
git commit -m "feat: config-driven subscribe form and about page"
```

---

### Task 12: RSS feeds + sitemap

**Files:**
- Create: `frontend/src/lib/rss.js`
- Create: `frontend/src/routes/rss.xml/+server.js`
- Create: `frontend/src/routes/rss-zh.xml/+server.js`
- Create: `frontend/src/routes/rss-ja.xml/+server.js`
- Create: `frontend/src/routes/sitemap.xml/+server.js`

- [ ] **Step 1: Copy and adapt rss.js**

```javascript
import config from 'virtual:site-config';

const SITE_URL = config.site.url;
// LANG_CONFIG generated from config.site.title + config.labels
```

- [ ] **Step 2: Copy RSS route handlers and sitemap as-is**

These are thin wrappers that call `rss.js` — topic-agnostic.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/rss.js frontend/src/routes/rss*.xml/ frontend/src/routes/sitemap.xml/
git commit -m "feat: config-driven RSS feeds and sitemap"
```

---

## Chunk 3: CI/CD + Validation

### Task 13: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/daily.yml`

- [ ] **Step 1: Copy and adapt daily.yml from news/**

Same structure. Changes:
- Workflow name: `Daily Digest` (generic)
- Uses root `package.json` scripts
- Secrets: `OPENAI_API_KEY`, `BUTTONDOWN_API_KEY`

- [ ] **Step 2: Commit**

```bash
git add .github/
git commit -m "feat: daily pipeline GitHub Actions workflow"
```

---

### Task 14: End-to-end validation

- [ ] **Step 1: Run full pipeline**

```bash
cd /Users/wenping.wang/Documents/git/digest-factory
cp /Users/wenping.wang/Documents/git/AI/news/.env .env
npm install
npm run generate-daily
```

Verify: `content/en/*.json`, `content/zh/*.json`, `content/ja/*.json` created with correct structure.

- [ ] **Step 2: Build and preview frontend**

```bash
cd frontend && npm install && npm run build && npm run preview
```

Verify: site renders at localhost, theme uses accent color, labels match config, sponsor slot hidden (null), subscribe form works.

- [ ] **Step 3: Test config swap**

Change `site.yaml`:
- `site.title.en` → `'Go Daily Digest'`
- `theme.accent` → `'#00ADD8'`

Rebuild frontend and verify title and accent color changed.

- [ ] **Step 4: Push to remote**

```bash
git push -u origin main
```

---

### Task 15: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README with quick start**

```markdown
# digest-factory

Config-driven daily digest site generator. One `site.yaml` → complete news digest with pipeline + frontend.

## Quick Start

1. Use this template on GitHub
2. Edit `site.yaml` — your domain, sources, theme, labels
3. Write `config/prompts/editorial.md` — your editorial policy
4. Add `OPENAI_API_KEY` to repo secrets
5. Push — GitHub Actions runs daily, Cloudflare Pages deploys

## Local Development

    cp .env.example .env   # add your OPENAI_API_KEY
    npm install
    npm run generate-daily # run pipeline
    cd frontend && npm install && npm run dev

## Configuration

All configuration lives in `site.yaml`. See comments in the file for documentation.
```

- [ ] **Step 2: Commit and push**

```bash
git add README.md
git commit -m "docs: README with quick start guide"
git push
```
