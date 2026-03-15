<script>
  import config from '$lib/site-config.js';

  /** @type {{ lang?: 'en' | 'zh' | 'ja' }} */
  let { lang = 'en' } = $props();

  const labels = {
    subscribe: config.labels.subscribe,
    placeholder: config.labels.emailPlaceholder,
  };

  const tagMap = { en: 'lang:en', zh: 'lang:zh', ja: 'lang:ja' };
  const username = config.newsletter?.username || 'newsletter';
</script>

<form
  action="https://buttondown.com/api/emails/embed-subscribe/{username}"
  method="post"
  target="_blank"
  class="flex items-center justify-center gap-2 max-w-sm mx-auto"
>
  <input
    type="email"
    name="email"
    placeholder={labels.placeholder[lang]}
    required
    class="flex-1 min-w-0 text-xs px-3 py-1.5 bg-cyber-surface border border-cyber-border rounded-sm text-cyber-text placeholder:text-cyber-text-muted/40 focus:border-cyber-cyan/50 focus:outline-none transition-colors duration-200 font-mono"
  />
  <input type="hidden" value="1" name="embed" />
  <input type="hidden" name="tag" value={tagMap[lang]} />
  <button
    type="submit"
    class="text-[10px] font-display font-bold tracking-[0.2em] px-4 py-1.5 border border-cyber-cyan/40 rounded-sm text-cyber-cyan bg-cyber-cyan/10 hover:bg-cyber-cyan/20 transition-colors duration-200 uppercase shrink-0"
  >{labels.subscribe[lang]}</button>
</form>
