<script>
  import '../app.css';
  import config from '$lib/site-config.js';
  import { browser } from '$app/environment';
  import { setContext } from 'svelte';

  let { children } = $props();

  const langNames = { en: 'EN', zh: '中文', ja: '日本語' };
  const supportedLangs = Object.keys(langNames);

  function detectLang() {
    if (!browser) return 'en';
    const saved = localStorage.getItem('lang');
    if (saved && supportedLangs.includes(saved)) return saved;
    const nav = navigator.language?.toLowerCase() || '';
    if (nav.startsWith('zh')) return 'zh';
    if (nav.startsWith('ja')) return 'ja';
    return 'en';
  }

  let currentLang = $state(detectLang());

  function switchLang(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
  }

  let themeMode = $state(browser ? (localStorage.getItem('theme') || 'system') : 'system');

  $effect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
  });

  function cycleTheme() {
    const order = ['system', 'light', 'dark'];
    const idx = order.indexOf(themeMode);
    themeMode = order[(idx + 1) % 3];
    localStorage.setItem('theme', themeMode);
  }

  const themeIcons = { system: '◐', light: '☀', dark: '☾' };

  const siteNames = config.site.title;
  const siteKeywords = config.site.keywords;
  const ogLocales = { en: 'en_US', zh: 'zh_CN', ja: 'ja_JP' };
  const rssUrls = { en: '/rss.xml', zh: '/rss-zh.xml', ja: '/rss-ja.xml' };

  setContext('app', {
    get currentLang() { return currentLang; },
    switchLang,
  });
</script>

<svelte:head>
  <meta name="keywords" content={siteKeywords[currentLang]} />
  <meta property="og:site_name" content={siteNames[currentLang]} />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content={ogLocales[currentLang]} />
  <meta name="twitter:card" content="summary" />
  <link rel="alternate" type="application/rss+xml" title="{siteNames[currentLang]} RSS" href={rssUrls[currentLang]} />
</svelte:head>

<div class="min-h-screen bg-cyber-bg text-cyber-text grid-bg transition-colors duration-300">
  <header class="sticky top-0 z-30 bg-cyber-bg/90 backdrop-blur-md border-b border-cyber-border transition-colors duration-300">
    <div class="max-w-3xl mx-auto px-5 py-3">
      <div class="flex items-center justify-between">
        <a href="/" class="flex items-center gap-3 no-underline">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-cyan opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-cyber-cyan"></span>
          </span>
          <span class="font-display text-xs font-bold tracking-[0.25em] text-cyber-cyan glow-cyan uppercase">
            {siteNames[currentLang]}
          </span>
        </a>

        <div class="flex items-center gap-2">
          <a
            href="/about"
            class="px-2.5 py-1 text-[10px] font-bold tracking-wider cursor-pointer transition-all duration-200 border border-cyber-border rounded text-cyber-text-muted hover:text-cyber-cyan hover:border-cyber-cyan/30 no-underline"
          >?</a>

          <button
            onclick={cycleTheme}
            class="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold tracking-wider cursor-pointer transition-all duration-200 border border-cyber-border rounded text-cyber-text-muted hover:text-cyber-cyan hover:border-cyber-cyan/30"
            aria-label="Toggle theme"
          >
            <span class="text-sm leading-none">{themeIcons[themeMode]}</span>
          </button>

          <nav class="flex gap-px border border-cyber-border rounded" aria-label="Language">
            {#each Object.entries(langNames) as [code, name]}
              <button
                onclick={() => switchLang(code)}
                class="px-3 py-1 text-[10px] font-bold tracking-wider cursor-pointer transition-all duration-200 {currentLang === code
                  ? 'bg-cyber-cyan/15 text-cyber-cyan border-cyber-cyan/30'
                  : 'text-cyber-text-muted hover:text-cyber-cyan hover:bg-cyber-cyan/5'}"
                aria-current={currentLang === code ? 'true' : undefined}
              >
                {name}
              </button>
            {/each}
          </nav>
        </div>
      </div>
    </div>
  </header>

  {@render children()}
</div>
