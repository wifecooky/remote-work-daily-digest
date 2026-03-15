# digest-factory

Config-driven digest site template. All site identity, sources, editorial rules, and visual theme are defined in `site.yaml`. The frontend (SvelteKit + Tailwind v4) reads theme tokens at build time via a Vite plugin — no CSS editing needed.

## Creating a New Site

1. Clone/fork this repo
2. Edit `site.yaml`:
   - `site` — name, URL, titles, descriptions
   - `sources` — RSS feeds, HN, HuggingFace
   - `theme` — style, fonts, color palette (see below)
   - `labels` — UI text in each language
3. Edit `config/prompts/editorial.md` — editorial voice and filtering rules
4. Edit `frontend/static/favicon.svg` — update the two color values (background fill + accent stroke/fill)
5. Verify: `cd frontend && npm run build`

## Theme Configuration

All theme values live under `theme:` in `site.yaml`.

### `style`

Controls visual effects. Two options:

| Value | Scanlines | Glow | Flicker | Gradient animation |
|-------|-----------|------|---------|--------------------|
| `cyber` | Yes | Yes | Yes | Yes (shifting) |
| `minimal` | No | No | No | No (static) |

### `fonts`

| Key | Purpose |
|-----|---------|
| `display` | Headings, hero text |
| `sans` | Body text |
| `mono` | Code, monospace elements |
| `google` | Google Fonts URL query params (without `?` or `&display=swap`) |

### `colors`

Two sub-keys: `dark` and `light`. Each has:

| Key | Usage |
|-----|-------|
| `bg` | Page background |
| `surface` | Card/panel background |
| `surface2` | Secondary surface |
| `border` | Border color |
| `borderGlow` | Glowing border (include alpha, e.g. `#00e5ff33`) |
| `text` | Body text |
| `textMuted` | Secondary/muted text |
| `accent` | Primary accent (links, highlights) |
| `secondary` | Secondary accent |
| `green` | Status/tag color |
| `amber` | Status/tag color |
| `heading` | Heading text |

## Example: Cyber Theme (default)

```yaml
theme:
  style: cyber
  fonts:
    display: "'Orbitron', 'JetBrains Mono', monospace"
    sans: "'JetBrains Mono', 'Noto Sans SC', 'Noto Sans JP', ui-monospace, monospace"
    mono: "'JetBrains Mono', ui-monospace, monospace"
    google: "family=Orbitron:wght@500;700;900&family=JetBrains+Mono:wght@400;500;700&family=Noto+Sans+SC:wght@400;500;700&family=Noto+Sans+JP:wght@400;500;700"
  colors:
    dark:
      bg: '#060a13'
      accent: '#00e5ff'
      secondary: '#ff2d7b'
      # ... (see site.yaml for full palette)
```

## Example: Minimal Theme

```yaml
theme:
  style: minimal
  fonts:
    display: "'Inter', system-ui, sans-serif"
    sans: "'Inter', 'Noto Sans SC', 'Noto Sans JP', system-ui, sans-serif"
    mono: "'JetBrains Mono', ui-monospace, monospace"
    google: "family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Noto+Sans+SC:wght@400;500;700&family=Noto+Sans+JP:wght@400;500;700"
  colors:
    dark:
      bg: '#0f1419'
      surface: '#1a1f26'
      surface2: '#242a33'
      border: '#2f3640'
      borderGlow: '#3b82f633'
      text: '#d1d5db'
      textMuted: '#6b7280'
      accent: '#3b82f6'
      secondary: '#8b5cf6'
      green: '#22c55e'
      amber: '#f59e0b'
      heading: '#f9fafb'
    light:
      bg: '#ffffff'
      surface: '#f9fafb'
      surface2: '#f3f4f6'
      border: '#e5e7eb'
      borderGlow: '#3b82f622'
      text: '#374151'
      textMuted: '#6b7280'
      accent: '#2563eb'
      secondary: '#7c3aed'
      green: '#16a34a'
      amber: '#d97706'
      heading: '#111827'
```

## Architecture

- `site.yaml` — single source of truth
- `frontend/vite.config.js` — `themePlugin()` reads `site.yaml`, replaces `__TOKEN__` placeholders at build time
- `frontend/src/app.css` — uses `__TOKEN__` placeholders (never edit color values here)
- `frontend/src/app.html` — `__GOOGLE_FONTS__` placeholder for font URL
- Svelte components reference CSS variables (`var(--color-cyber-*)`) — no changes needed
