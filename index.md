---
layout: page
---

# Redirecting…

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vitepress'

// Must stay in sync with languages.json / .vitepress/config.mts / theme.
const LOCALE_CODES = ['en', 'ru', 'zh', 'ja', 'de', 'es', 'ko', 'pt']
const STORAGE_KEY = 'wippy-docs-locale'

/**
 * Pick a locale, in priority order:
 *   1. a previously chosen locale stored on the device
 *   2. the best match for the browser's language preferences (region-aware,
 *      so pt-BR -> pt, zh-CN -> zh, en-GB -> en, ...)
 *   3. English as the universal fallback
 */
function pickLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && LOCALE_CODES.includes(saved)) return saved
  } catch {
    /* storage unavailable — fall through to browser detection */
  }

  const preferences = (
    navigator.languages?.length ? navigator.languages : [navigator.language]
  )
    .filter(Boolean)
    .map((lang) => lang.toLowerCase())

  for (const lang of preferences) {
    if (LOCALE_CODES.includes(lang)) return lang
    const base = lang.split('-')[0]
    if (LOCALE_CODES.includes(base)) return base
  }
  return 'en'
}

const router = useRouter()

onMounted(() => {
  router.replace('/' + pickLocale() + '/')
})
</script>

<p style="min-height: 60vh; display: flex; align-items: center; justify-content: center; color: var(--vp-c-text-2);">
  Taking you to the documentation…
</p>
