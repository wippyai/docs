---
title: "CSS injection"
description: "Web Host page engine と web-component shadow root にわたる CSS delivery reference。"
---

# CSS injection

このページは Host-delivered CSS の configuration reference です。JSON/TypeScript block は個別設定と component contract で、完全な frontend package ではありません。

iframe は parent CSS を継承しないため、Host が child `srcdoc` に style asset を注入し、`ProxyConfig` が layer を制御します。Web Fragment は別 path を使います。このページが `proxy.injections` CSS flag と runtime default の canonical reference です。developer-facing guide は [Theming](../micro-frontends/theming.md)を参照してください。

## CSS Delivery Matrix

facade は global、host、children の 3 scope を公開します。主なルールは、custom property は WC host に継承し、selector rule は iframe/shadow boundary を自然には越えないため runtime injection が必要ということです。WippyElement は forced-theme inner root を通して effective global と children/page の property 名を bridge するため、local theme default はそれらを reset できません。host-only 名は通常の継承に依存し、inner root の local theme CSS が再宣言すると shadow され得ます。Web Host 1.0.43 以降は composed global + children custom CSS が component shadow root にも届き、`customCss` で opt out できます。

| Facade knob | Host shell | `view.page` | `view.component` |
|---|---|---|---|
| `custom_css` | ✓ | ✓ | ✓（1.0.43+） |
| `css_variables` | ✓ | ✓ | ✓ inherited + bridged |
| `host_custom_css` | ✓ | ✗ | ✗ |
| `host_css_variables` | ✓ | ✗ | host-mounted WC のみ |
| `children_custom_css` | ✗ | ✓ | ✓（1.0.43+） |
| `children_css_variables` | ✗ | ✓ | page WC のみ |

child が受け取る custom CSS は global + children の合成です。WC の custom property は mount 元 `:root` から継承し、host-mounted は global + host、page 内は global + children です。injected selector CSS は常に global + children。全 surface 共通は global scope に置きます。

6 つの theming knob は `content_fs` から request-time 解決する `fs://<path>` を受け付けます（[Facade の non-Web-Host page での再利用](../../framework/facade.md)参照）。`file://` は loader-time inline で別契約です。`icon_sets` / `host_icon_sets` と non-theming JSON parameter は inline-only です。数件を超える override は `content_fs` 背後の個別 CSS/JSON file に置くと review と再利用が容易です。

## Iframe injection pipeline

logical cascade は themeConfig → primevue/tailwind → iframe → markdown → customVariables → customCss です。`cssVariables` と non-`@import` customCSS は `adoptedStyleSheets`、`@import` は ordinary head style に置かれます。configuration precedence は別で、facade theme → page `config_overrides` → runtime override が customVariables/customCss に入る**値**を決めます。

```
1. theme-config.css      — CSS custom properties (--p-primary-*, --p-surface-*, --p-secondary-*)
2. primevue.css          — PrimeVue component styles scoped via those variables
   tailwind.css          — Tailwind utility classes (same bundle as primevue.css)
3. iframe.css            — Default themed scrollbar styling (historical name; no iframe layout reset)
4. markdown.css          — .data-body rendering styles for Markdown content
5. cssVariables          — effective base + Auto/forced mode blocks from AppConfig.theming.global.cssVariables (adopted stylesheet)
6. customCSS             — Non-@import CSS in an adopted stylesheet; extracted @import rules use a head style
```

これは literal `<head>` order ではなく logical override order です。各 child iframe は platform bundle の自身の copy を受け取り、全 surface の complete style set は同一ではありません。

## `ProxyConfig.injections.css` Flag

nested flag は registry YAML と `package.json` の両方で lower camelCase。YAML は nested key 単位で優先します。

```yaml
meta:
  type: view.page
  # ...
  proxy:
    enabled: true
    injections:
      css:
        themeConfig: true
        primevue: true
        customCss: true
      tailwindConfig: false
```

```json
{
  "wippy": {
    "proxy": {
      "injections": {
        "css": {
          "themeConfig": true,
          "iframe": true,
          "primevue": true,
          "markdown": true,
          "customCss": true,
          "customVariables": true
        },
        "tailwindConfig": true,
        "resizeObserver": true,
        "preventLinkClicks": true,
        "iconifyIcons": true,
        "refreshWhenVisible": true,
        "historyPolyfill": true,
        "errorCapture": true
      }
    }
  }
}
```

### CSS flag

| Flag | Default | 内容 |
|---|---|---|
| `themeConfig` | `true` | semantic variable を持つ `theme-config.css` |
| `iframe` | `true` | themed scrollbar の `iframe.css`。layout reset ではない |
| `primevue` | `true` | `primevue.css` + Tailwind v3 utility |
| `markdown` | `true` | `.data-body` 用 `markdown.css` |
| `customCss` | `true` | child-projected global `customCSS` |
| `customVariables` | `true` | effective base/Auto/forced mode の variable map |

font 専用 flag はなく、Google Fonts は global customCSS の `@import` として `customCss` で届きます。

### Non-CSS injection flag

| Flag | Default | 動作 |
|---|---|---|
| `tailwindConfig` | `true` | CDN Tailwind runtime の `window.tailwind.config` |
| `resizeObserver` | `true` | child body size relay |
| `preventLinkClicks` | `true` | iframe 内 `<a>` を `host.classifyLink()` で分類 |
| `iconifyIcons` | `true` | offline 用 icon set 注入 |
| `refreshWhenVisible` | `true` | `@visibility` が true になったとき reload |
| `historyPolyfill` | `true` | 現在 no-op。srcdoc では history guard が常に memory routing を要求 |
| `errorCapture` | `true` | uncaught error/rejection を host へ転送 |

省略時は permissive default ですが、Vite app は依存する値を明示してください。

### Web Fragment delivery

Fragment は iframe switch を使いません。gateway が固定 CSS asset を追加し、adapter が handshake 後に effective variables/customCSS を ordinary `<style>` として reflected head に適用します。error capture も unconditional です。

### 不要な injection の無効化

PrimeVue を無効にできるのは canvas/SVG/chart-only など標準 product control がない間だけです。button/input/form/table/dialog/menu/tag/tooltip 等があれば有効にします。

```json
{
  "wippy": {
    "proxy": {
      "injections": {
        "css": {
          "primevue": false,
          "themeConfig": false
        }
      }
    }
  }
}
```

両方無効でも、個別に切らない限り customCSS、cssVariables、iframe.css は届きます。proxy/state/WebSocket は CSS flag の影響を受けません。

## Web Component: facade custom CSS + `hostCssKeys`

WC では configured variable + composed custom CSS と、static platform asset `hostCssKeys` の 2 channel を使います。`customCss: false` は selector layer だけを無効にし variable propagation は残ります。

```typescript
static get wippyConfig() {
  return {
    hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl'] as const,
  }
}
```

利用できる `hostCss` key は次のとおりです。

| Key | 内容 | bundle への影響 |
|---|---|---|
| `hostCss.themeConfigUrl` | CSS variable（`--p-primary-*`、light + dark） | 小 |
| `hostCss.primeVueCssUrl` | PrimeVue component + Tailwind utility | 大 |
| `hostCss.markdownCssUrl` | `.data-body` Markdown style | 小 |
| `hostCss.iframeCssUrl` | `--p-surface-*` を使う scrollbar style | 極小 |
| `hostCss.preflightCssUrl` | Tailwind/PrimeVue preflight reset | 小 |

preflight は shadow boundary を越えないため必要なら `loadCss()` で取得し、`injectInlineCss(shadow, css)` で挿入します。通常は declarative `hostCssKeys` を使い、`loadCss()` は integration escape hatch に限定します。mounted shadow tree を `shadowRoot.innerHTML` で書き換えないでください。

## `AppConfig.theming` projection

host は effective child theme を `AppConfig.theming.global` に投影し、selected engine が適用します。key は正確な CSS variable 名です。

```typescript
// In the facade configuration or SetConfig PostMessage payload.
theming: {
  global: {
    cssVariables: {
      '--p-primary': 'rgb(220, 38, 38)',
      '--p-surface-0': '#0f0f0f',
      '--p-content-border-radius': '2px',
    }
  }
}
```

iframe compiler は leading `--` を normalize し、base と `@light`/`@dark` を merge して Auto/forced block を生成します。

### Override mechanism: adopted stylesheet

iframe の `cssVariables` と non-import customCSS は document stylesheet より後に cascade する `adoptedStyleSheets` に置かれ、platform CSS に勝ちます。抽出した `@import` は ordinary head style でこの保証がありません。2 adopted layer 間では customCSS が variables より後で勝ちます。Fragment は ordinary `<style>` を使います。

### 3 つの theming scope

| Scope | 適用先 | 用途 |
|---|---|---|
| `global` | host と全 child | brand/shared |
| `host` | host のみ | sidebar/chat |
| `children` | child のみ | child override |

child には merged result が `config.theming.global` として届きます。

### Page 単位 override

registry `meta.config_overrides` または package `wippy.configOverrides` が `window.__WIPPY_CONFIG_OVERRIDES__` を設定します。

```typescript
window.__WIPPY_CONFIG_OVERRIDES__ = {
  customization: {
    cssVariables: {
      '--p-primary': '#ff6b00',
    },
    customCSS: '.my-page-header { border-radius: 12px; }',
  },
}
```

override は child inherited value を置換し、merged `theming.global` として nested `<w-iframe>`、`<w-artifact>`、`html.inject` subtree 全体へ再帰的に伝播します。

## `--wippy-host-*` Variable

host chrome だけを調整する variable です。`:root` scope の host customCSS/cssVariables で上書きします。

```typescript
theming: {
  host: {
    customCSS: `
    :root {
      --wippy-host-sidebar-width-open: 20rem;
      --wippy-host-splitter-color: transparent;
      --wippy-host-message-radius: 0.5rem;
      --wippy-host-message-user-bg: var(--p-info-100);
      --wippy-host-message-agent-bg: var(--p-warn-100);
    }
    /* Class selectors must be scoped to .wippy-host-app */
    .wippy-host-app .chat-message__footer { display: none; }
  `
  }
}
```

### Layout variable

| Variable | Default | 説明 |
|---|---|---|
| `--wippy-host-sidebar-width-open` | `16rem` | expanded sidebar width |
| `--wippy-host-sidebar-width-closed` | `3.5rem` | collapsed sidebar width |
| `--wippy-host-splitter-width` | `1px` | panel divider line width |
| `--wippy-host-splitter-hit-area` | `10px` | divider drag area |
| `--wippy-host-splitter-color` | `surface-200/600` | divider color |
| `--wippy-host-chat-bg` | `surface-50/700` | chat container background |
| `--wippy-host-chat-padding-x` | `10px` | message list horizontal padding |
| `--wippy-host-meta-bar-border-color` | `surface-200/600` | agent/model bar border |

### Message variable

| Variable | Default | 説明 |
|---|---|---|
| `--wippy-host-message-bg` | `surface-50/700` | default message background |
| `--wippy-host-message-border-color` | `surface-200/600` | bubble border |
| `--wippy-host-message-shadow` | `0 1px 2px 0 rgba(...)` | bubble shadow |
| `--wippy-host-message-font-size` | `0.875rem` | body text size |
| `--wippy-host-message-radius` | `1rem` | bubble corner |
| `--wippy-host-message-padding-x` | `1rem` | horizontal padding |
| `--wippy-host-message-padding-y` | `0.5rem` | vertical padding |
| `--wippy-host-message-gap` | `0.5rem` | avatar/bubble gap |
| `--wippy-host-message-spacing` | `1rem` | message vertical spacing |
| `--wippy-host-message-user-bg` | `primary-50` | user background |
| `--wippy-host-message-agent-bg` | `yellow-50/surface-800` | agent background |
| `--wippy-host-tool-bg` | `help-50` | tool call background |
| `--wippy-host-tool-border` | `help-300` | tool call left border |
| `--wippy-host-avatar-size` | `2rem` | avatar diameter |

### Input variable

| Variable | Default | 説明 |
|---|---|---|
| `--wippy-host-input-bg` | `surface-50/700` | input bar background |
| `--wippy-host-input-border-color` | `surface-200/600` | input bar top border |
| `--wippy-host-input-group-bg` | `surface-0/800` | input field background |
| `--wippy-host-input-group-border-color` | `surface-300/700` | input field border |
| `--wippy-host-input-group-radius` | `0.375rem` | input field corner |
| `--wippy-host-input-min-height` | `2.5rem` | textarea initial height |
| `--wippy-host-input-max-height` | `10rem` | textarea max height |

### Prompt variable

| Variable | Default | 説明 |
|---|---|---|
| `--wippy-host-prompt-bg` | `surface-100/800` | suggestion background |
| `--wippy-host-prompt-border-color` | `surface-300/600` | suggestion border |
| `--wippy-host-prompt-radius` | `0.5rem` | suggestion corner |

これらは host chrome だけに作用し、child page には影響しません。

## 関連項目

- [Theming](../micro-frontends/theming.md)
- [Proxy と分離](./proxy-isolation.md)
- [レンダリングエンジン](./render-engines.md)
