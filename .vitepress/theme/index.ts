import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import './styles.css'

/** Locale codes a path can resolve to (mirrors languages.json). */
const LOCALE_CODES = ['en', 'ru', 'zh', 'ja', 'de', 'es', 'ko', 'pt']
const STORAGE_KEY = 'wippy-docs-locale'

/**
 * Persist the locale implied by a route so the landing page can honour a
 * previously chosen language instead of re-detecting from the browser.
 */
function persistLocale(routePath: string) {
  const segment = routePath.split('/')[1]
  if (segment && LOCALE_CODES.includes(segment)) {
    try {
      localStorage.setItem(STORAGE_KEY, segment)
    } catch {
      /* storage unavailable (private mode) — non-fatal */
    }
  }
}

export default {
  extends: DefaultTheme,
  enhanceApp({ router }) {
    if (typeof window === 'undefined') return
    persistLocale(router.route.path)
    router.onAfterRouteChanged = (to) => persistLocale(to)
  },
} satisfies Theme
