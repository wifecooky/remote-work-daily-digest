# Digest Site Template — Design Spec

## Problem

AI Daily Digest (`news/`) is a working product but everything is hardcoded to the AI topic. We want to batch-produce vertical tech digest sites (Golang, Rust, K8s, etc.) with minimal effort — ideally one config file per site.

Each site runs on its own domain, has its own brand/theme, and can carry its own sponsor. The pipeline logic (collect → score → AI select → translate) and frontend design are shared via a reusable template.

## Constraints

- Do NOT modify the existing `news/` (AI Daily Digest) code
- New sites are independent clones, not subpaths of a platform
- Adding a new site = copy template, edit `site.yaml`, write editorial prompt, deploy
- Each site: independent repo/directory, independent Cloudflare Pages deployment
- Cost per site: ~$3/month (GPT-4o API)

## Architecture

Development happens in `AI/news/template/`. When stable, this will be extracted to an independent GitHub repo template (`digest-factory`). Users create new sites via "Use this template" on GitHub.

### Current development location

```
AI/
├── news/                    # AI Daily Digest (untouched)
└── template/                # Reusable template (→ future independent repo)
    ├── site.yaml            # Site configuration (the one file to edit)
    ├── scripts/
    │   ├── lib/
    │   │   └── config.js    # Loads site.yaml
    │   ├── collect-rss.js   # Reads sources from site.yaml
    │   ├── filter-ai.js     # Reads editorial prompt path from site.yaml
    │   ├── translate-ai.js  # Reads site title/labels from site.yaml
    │   └── send-newsletter.js
    ├── config/
    │   └── prompts/
    │       └── editorial.md # Editorial prompt template
    ├── frontend/
    │   ├── src/
    │   │   ├── lib/
    │   │   │   ├── site-config.js   # Loads site.yaml at build time
    │   │   │   └── components/
    │   │   │       └── SubscribeForm.svelte
    │   │   └── routes/
    │   │       ├── [[date]]/+page.svelte
    │   │       ├── about/+page.svelte
    │   │       └── +layout.svelte
    │   ├── static/
    │   └── tailwind.config.js  # Reads theme from site.yaml
    ├── content/             # Generated at runtime
    └── .github/
        └── workflows/
            └── daily.yml
```

### Future: independent repo template

```
digest-factory/        # GitHub template repo
├── site.yaml                # Edit this
├── scripts/
├── config/prompts/
├── frontend/
└── .github/workflows/
```

New site = GitHub "Use this template" → edit site.yaml → add secrets → deploy.

## site.yaml Schema

```yaml
# ── Identity ──
site:
  id: golang                 # Used in content paths, logs
  url: https://golang.thewang.net
  title:
    en: 'Go Daily Digest'
    zh: 'Go 日知录'
    ja: 'Go 日知録'
  subtitle:
    en: 'Go engineering news, daily.'
    zh: '每天五分钟，跟上 Go 生态动态'
    ja: 'Goエンジニアリングの最新動向を毎日'
  description:
    en: 'Daily curated Go engineering news...'
    zh: '...'
    ja: '...'

# ── Theme ──
theme:
  accent: '#00ADD8'           # Primary accent (Go blue)
  # Derived from accent: surface, border, heading tints
  # Override individual colors if needed:
  # magenta: '#...'
  # green: '#...'
  # amber: '#...'

# ── Data Sources ──
sources:
  rss:
    - url: https://go.dev/blog/feed.atom
      name: Go Blog
      weight: 10
    - url: https://golangweekly.com/rss
      name: Golang Weekly
      weight: 8
    - url: https://changelog.com/gotime/feed
      name: Go Time Podcast
      weight: 6

  hackernews:
    enabled: true
    query: 'golang OR "go language" OR "go 1."'
    weight: 8

  huggingface:
    enabled: false

# ── Editorial ──
editorial:
  prompt: config/prompts/editorial.md
  min_articles: 3             # Skip day if fewer candidates
  featured_count: [2, 3]      # Min, max featured stories
  quicknews_count: [4, 6]     # Min, max quick news

# ── Labels (override defaults) ──
labels:
  featured: { en: 'FEATURED', zh: '深度解读', ja: '特集' }
  signal: { en: 'SIGNAL', zh: '信号', ja: 'シグナル' }
  archive: { en: 'ARCHIVE', zh: '往期', ja: 'アーカイブ' }
  subscribe: { en: 'SUBSCRIBE', zh: '订阅', ja: '購読' }
  # ... all UI labels with sensible defaults

# ── Sponsor (optional) ──
sponsor: null
# sponsor:
#   label: SPONSORED
#   name: GoLand
#   title: { en: 'The Go IDE by JetBrains', zh: '...', ja: '...' }
#   description: { en: '...', zh: '...', ja: '...' }
#   url: https://jetbrains.com/go

# ── Newsletter (optional) ──
newsletter:
  provider: buttondown
  username: golang-thewang
  # API key via BUTTONDOWN_API_KEY env var

# ── Schedule ──
schedule:
  cron: '0 7 * * *'          # UTC
  timezone: Asia/Tokyo
```

## Pipeline Changes (vs. news/)

All scripts read `site.yaml` instead of hardcoded values.

### collect-rss.js

Current (news/): Sources array hardcoded in file.

Template: Read `sources.rss[]` from site.yaml. HN query from `sources.hackernews.query`. HuggingFace toggle from `sources.huggingface.enabled`.

```javascript
import { loadSiteConfig } from './lib/config.js';
const config = loadSiteConfig();
// config.sources.rss → [{url, name, weight}, ...]
// config.sources.hackernews → {enabled, query, weight}
```

### filter-ai.js

Current: Reads `config/prompts/filter-selection.md`.

Template: Reads prompt path from `config.editorial.prompt`. Passes `config.editorial.featured_count` and `config.editorial.quicknews_count` to the AI.

### translate-ai.js

Current: Site title hardcoded.

Template: Reads `config.site.title` for email subject lines and content headers.

### send-newsletter.js

Current: Buttondown username hardcoded as `thewang`.

Template: Reads `config.newsletter.username`.

### Shared utility: lib/config.js

```javascript
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export function loadSiteConfig() {
  const configPath = path.resolve(process.cwd(), 'site.yaml');
  return yaml.load(fs.readFileSync(configPath, 'utf-8'));
}
```

## Frontend Changes (vs. news/)

### Build-time config injection

`frontend/src/lib/site-config.js` loads `site.yaml` at build time via SvelteKit's `$env` or a vite plugin, making all config available to components.

### Theme from config

`tailwind.config.js` reads `theme.accent` from site.yaml and derives the cyberpunk color palette:

```javascript
const config = loadSiteConfig();
const accent = config.theme.accent;
// Derive: cyber-cyan → accent, tint surface/border/heading from it
```

The base cyberpunk aesthetic (dark mode, glow effects, monospace display font) stays the same across all sites. Only the accent color and derived tints change per topic.

### Labels from config

All hardcoded label objects in `+page.svelte` and `about/+page.svelte` are replaced with reads from site config:

```javascript
const labels = config.labels;
// labels.featured[currentLang], labels.signal[currentLang], etc.
```

### About page

Current: All pipeline/source/policy content hardcoded in the component.

Template: About page reads from site.yaml:
- `site.description` for overview text
- `sources.rss[]` for data sources listing
- Editorial policy text from a separate config section or the editorial prompt itself

### Sponsor slot

Already exists in `+page.svelte`. Template reads `config.sponsor` — if null, the slot is hidden.

## New Site Workflow

```
1. GitHub → "Use this template" from digest-site-template
2. Edit site.yaml — domain, title, sources, theme accent
3. Write config/prompts/editorial.md — in-scope/out-of-scope for the topic
4. Add OPENAI_API_KEY secret to repo
5. Push → GitHub Actions runs daily → Cloudflare Pages deploys
```

Time to create a new site: < 1 hour (mostly writing the editorial prompt and researching RSS sources).

## What's NOT in Scope

- No shared database or multi-tenant backend
- No admin dashboard for managing sites
- No auto-discovery of RSS sources
- No cross-site content sharing
- No modifications to `news/` (AI Daily Digest)

## Success Criteria

1. `template/` runs independently — `npm run pipeline` produces a digest from site.yaml sources
2. Changing `site.yaml` accent color changes the entire site theme
3. A new site (e.g., Golang) can be created in under 1 hour
4. Each site deploys independently on its own domain
5. Sponsor slot renders correctly when configured, hidden when null
