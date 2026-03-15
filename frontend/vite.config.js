import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

function themePlugin() {
	const configPath = path.resolve(process.cwd(), '../site.yaml');
	const config = yaml.load(fs.readFileSync(configPath, 'utf-8'));
	const t = config.theme;
	const dark = t.colors.dark;
	const light = t.colors.light;
	const isCyber = t.style === 'cyber';

	function hexToRgb(hex) {
		const h = hex.replace('#', '');
		return {
			r: parseInt(h.substring(0, 2), 16),
			g: parseInt(h.substring(2, 4), 16),
			b: parseInt(h.substring(4, 6), 16)
		};
	}

	const accentRgb = hexToRgb(dark.accent);
	const rgb = `${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}`;
	const secondaryRgb = hexToRgb(dark.secondary);
	const srgb = `${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}`;
	const lightAccentRgb = hexToRgb(light.accent);
	const lrgb = `${lightAccentRgb.r}, ${lightAccentRgb.g}, ${lightAccentRgb.b}`;

	const map = {
		// Fonts
		FONT_DISPLAY: t.fonts.display,
		FONT_SANS: t.fonts.sans,
		FONT_MONO: t.fonts.mono,
		// Dark colors
		DARK_BG: dark.bg,
		DARK_SURFACE: dark.surface,
		DARK_SURFACE2: dark.surface2,
		DARK_BORDER: dark.border,
		DARK_BORDER_GLOW: dark.borderGlow,
		DARK_TEXT: dark.text,
		DARK_TEXT_MUTED: dark.textMuted,
		DARK_ACCENT: dark.accent,
		DARK_SECONDARY: dark.secondary,
		DARK_GREEN: dark.green,
		DARK_AMBER: dark.amber,
		DARK_HEADING: dark.heading,
		// Light colors
		LIGHT_BG: light.bg,
		LIGHT_SURFACE: light.surface,
		LIGHT_SURFACE2: light.surface2,
		LIGHT_BORDER: light.border,
		LIGHT_BORDER_GLOW: light.borderGlow,
		LIGHT_TEXT: light.text,
		LIGHT_TEXT_MUTED: light.textMuted,
		LIGHT_ACCENT: light.accent,
		LIGHT_SECONDARY: light.secondary,
		LIGHT_GREEN: light.green,
		LIGHT_AMBER: light.amber,
		LIGHT_HEADING: light.heading,
		// Effects
		GLOW_ACCENT: isCyber ? `0 0 7px rgba(${rgb}, 0.5), 0 0 20px rgba(${rgb}, 0.2)` : 'none',
		GLOW_SECONDARY: isCyber ? `0 0 7px rgba(${srgb}, 0.5), 0 0 20px rgba(${srgb}, 0.2)` : 'none',
		BORDER_GLOW: isCyber
			? `0 0 8px rgba(${rgb}, 0.15), inset 0 0 8px rgba(${rgb}, 0.05)`
			: `0 1px 3px rgba(0,0,0,0.12), 0 0 0 1px var(--color-cyber-border)`,
		SCANLINE_CONTENT: isCyber ? "''" : 'none',
		FLICKER_ANIM: isCyber ? 'flicker 5s ease-in-out infinite' : 'none',
		GRADIENT_BG: isCyber
			? 'linear-gradient(90deg, transparent, var(--color-cyber-cyan), var(--color-cyber-magenta), transparent)'
			: 'linear-gradient(90deg, transparent, var(--color-cyber-cyan), transparent)',
		GRADIENT_SIZE: isCyber ? '200% 100%' : '100% 100%',
		GRADIENT_ANIM: isCyber ? 'gradient-shift 4s ease-in-out infinite' : 'none',
		// Selection
		SELECTION_DARK_BG: `rgba(${rgb}, 0.3)`,
		SELECTION_LIGHT_BG: `rgba(${lrgb}, 0.25)`,
		// Scanline backgrounds
		SCANLINE_DARK_BG: `rgba(${rgb}, 0.015)`,
		SCANLINE_LIGHT_BG: `rgba(${lrgb}, 0.02)`,
		// Grid backgrounds
		GRID_DARK_BG: `rgba(${rgb}, 0.03)`,
		GRID_LIGHT_BG: `rgba(${lrgb}, 0.04)`,
	};

	return {
		name: 'digest-theme',
		enforce: 'pre',
		transform(code, id) {
			if (!id.endsWith('app.css')) return;
			return code.replace(/__(\w+)__/g, (m, key) => map[key] ?? m);
		},
		transformIndexHtml(html) {
			return html.replace('__GOOGLE_FONTS__', t.fonts.google);
		}
	};
}

function siteConfigPlugin() {
	const virtualId = 'virtual:site-config';
	const resolvedId = '\0' + virtualId;

	return {
		name: 'site-config',
		resolveId(id) {
			if (id === virtualId) return resolvedId;
		},
		load(id) {
			if (id === resolvedId) {
				const configPath = path.resolve(process.cwd(), '../site.yaml');
				const config = yaml.load(fs.readFileSync(configPath, 'utf-8'));
				return `export default ${JSON.stringify(config)};`;
			}
		}
	};
}

export default defineConfig({
	plugins: [themePlugin(), tailwindcss(), siteConfigPlugin(), sveltekit()]
});
