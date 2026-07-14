---
title: "Theming Reference"
description: "The host (wippy/facade) provides the theme. Both micro frontend apps and web components consume it. The variable catalog below is the shared vocabulary…"
---

# Theming Reference

The host (wippy/facade) provides the theme. Both micro frontend apps and web components consume it. The variable catalog below is the shared vocabulary — delivery specifics are in [Theming: Micro Frontend Apps](./micro-frontend-app-theming.md) and [Theming: Web Components](./web-component-theming.md).

YAML always wins. CSS custom properties (`*_css_variables`) set by the facade/host cascade to child iframes and inherit into shadow DOM. Facade selector rules (`*_custom_css`) do not *cascade* across the shadow boundary, but the Web Host **injects** them into `view.component` shadow roots as of Web Host 1.0.43 (opt-out via the component's `customCss` flag). See the [CSS Delivery Matrix](../web-host/css-injection.md#css-delivery-matrix).

---

## Reference — CSS variables

All variables are defined in `theme-config.css` and set on `:root`. At runtime, the host injects the real theme — these serve as the dev-time fallback and contract.

### Primary palette (11 vars)

Base: `--p-primary` (default: `rgb(0, 95, 178)`)

| Variable | Value |
|---|---|
| `--p-primary-50` | `color-mix(in srgb, var(--p-primary) 5%, white)` |
| `--p-primary-100` | `color-mix(in srgb, var(--p-primary) 10%, white)` |
| `--p-primary-200` | `color-mix(in srgb, var(--p-primary) 20%, white)` |
| `--p-primary-300` | `color-mix(in srgb, var(--p-primary) 30%, white)` |
| `--p-primary-400` | `color-mix(in srgb, var(--p-primary) 40%, white)` |
| `--p-primary-500` | `var(--p-primary)` (base) |
| `--p-primary-600` | `color-mix(in srgb, var(--p-primary) 80%, black)` |
| `--p-primary-700` | `color-mix(in srgb, var(--p-primary) 70%, black)` |
| `--p-primary-800` | `color-mix(in srgb, var(--p-primary) 60%, black)` |
| `--p-primary-900` | `color-mix(in srgb, var(--p-primary) 50%, black)` |
| `--p-primary-950` | `color-mix(in srgb, var(--p-primary) 40%, black)` |

### Secondary palette (11 vars)

Base: `--p-secondary` (default: `#6f7385`)

Same 50–950 structure as primary, derived via `color-mix` on `--p-secondary`, but with its own percentage ladder — steps 300/400/700/800/950 use different mix percentages than primary, so do not assume primary's exact step values when overriding the secondary base.

### Surface palette (13 vars)

**Fixed light-to-dark scale** — 0 is always lightest, 950 always darkest. The scale does NOT flip with dark mode. The light scale is the neutral Tailwind gray (no warm cast); the dark scale is a separate warm-toned ramp, so most levels differ between modes — only `0` and `50` are shared. Dark levels 600–950 carry the warmest undertones.

| Variable | Light value | Dark value |
|---|---|---|
| `--p-surface-0` | `#ffffff` | `#fff` |
| `--p-surface-50` | `#fafafa` | `#fafafa` |
| `--p-surface-100` | `#f5f5f5` | `#f4f4f5` |
| `--p-surface-200` | `#e5e5e5` | `#e4e4e7` |
| `--p-surface-300` | `#d4d4d4` | `#d4d4d8` |
| `--p-surface-400` | `#a3a3a3` | `#a1a1aa` |
| `--p-surface-500` | `#737373` | `#71717a` |
| `--p-surface-600` | `#525252` | `#545250` (warm) |
| `--p-surface-700` | `#404040` | `#403e3c` (warm) |
| `--p-surface-800` | `#262626` | `#2b2927` (warm) |
| `--p-surface-850` | `color-mix(in srgb, var(--p-surface-800) 50%, var(--p-surface-900))` | `color-mix(in srgb, var(--p-surface-800) 50%, var(--p-surface-900))` |
| `--p-surface-900` | `#171717` | `#1c1a19` (warm) |
| `--p-surface-950` | `#0a0a0a` | `#0f0e0d` (warm) |

### Danger / Warn / Success / Info / Help / Accent palettes

Each has a base var and an 11-step scale (50–950) derived via `color-mix`, same pattern as primary.

| Family | Base variable | Default color | Purpose |
|--------|--------------|---------------|---------|
| `danger` | `--p-danger` | `rgb(239, 68, 68)` (red-500) | Errors, destructive actions |
| `success` | `--p-success` | `rgb(34, 197, 94)` (green-500) | Success states, confirmations |
| `warn` | `--p-warn` | `rgb(249, 115, 22)` (orange-500) | Warnings, caution |
| `info` | `--p-info` | `rgb(14, 165, 233)` (sky-500) | Informational messages |
| `help` | `--p-help` | `rgb(168, 85, 247)` (purple-500) | Help, hints |
| `accent` | `--p-accent` | `rgb(20, 184, 166)` (teal-500) | Highlights, special callouts |

Override the base var to retheme the full scale — the 50–950 range auto-derives via `color-mix`. No dark-mode override block is needed.

### The token grammar (predictable naming)

The `--p-*` set follows one small, exceptionless grammar, so a human — or an AI agent generating styles — can *predict* a token name instead of looking it up. Two layers with a hard contract:

- **Numeric scale** — `--p-<family>-{50..950}` and `--p-surface-{0..950}`: the fixed-hue anchor, **never theme-switchable** (identical in light and dark). Use it only when you explicitly do *not* want the value to flip.
- **Semantic aliases** — `--p-<family>-color` / `-contrast-color` / `-hover-color` / `-active-color`: the theme-switchable layer. `-color` always ships with its `-contrast-color` (the color to place on top of it) plus hover/active states, so no `dark:` pairing is needed.

Those four aliases exist for **all eight** families (`primary`, `secondary`, `danger`, `success`, `warn`, `info`, `help`, `accent`) — zero per-family exceptions. Typography follows the same shape (`--p-font-<role>-<prop>`, below). The generated `tokens.json` manifest shipped in `@wippy-fe/theme` (name, layer, light/dark value, flip flag) is the machine-readable ground truth an agent can load.

### Semantic variables (mode-aware)

These **flip with dark mode** — use these for theme-dependent styling. Do not use numbered surface vars (`--p-surface-N`) for semantic colors.

| Variable | Light | Dark |
|---|---|---|
| `--p-primary-color` | `primary-500` | `primary-400` |
| `--p-primary-contrast-color` | `surface-0` | `surface-900` |
| `--p-primary-hover-color` | `primary-600` | `primary-300` |
| `--p-primary-active-color` | `primary-700` | `primary-200` |
| `--p-text-color` | `surface-700` | `surface-0` |
| `--p-text-hover-color` | `surface-800` | `surface-0` |
| `--p-text-muted-color` | `surface-500` | `surface-400` |
| `--p-text-hover-muted-color` | `surface-600` | `surface-300` |
| `--p-content-background` | `surface-0` | `surface-900` |
| `--p-content-border-color` | `surface-200` | `surface-700` |
| `--p-content-hover-background` | `surface-100` | `surface-800` |
| `--p-content-hover-color` | `surface-800` | `surface-0` |
| `--p-highlight-background` | `primary-50` | `primary-400 @ 16%` |
| `--p-highlight-color` | `primary-700` | `white @ 87%` |
| `--p-highlight-focus-background` | `primary-100` | `primary-400 @ 24%` |
| `--p-highlight-focus-color` | `primary-800` | `white @ 87%` |
| `--p-content-border-radius` | `6px` | `6px` |

### Family aliases (all families)

The four `--p-primary-*` alias rows above exist identically for every family, remapped the same way per mode:

| Alias | Light | Dark |
|---|---|---|
| `--p-<family>-color` | `<family>-500` | `<family>-400` |
| `--p-<family>-contrast-color` | `surface-0` | `surface-900` |
| `--p-<family>-hover-color` | `<family>-600` | `<family>-300` |
| `--p-<family>-active-color` | `<family>-700` | `<family>-200` |

`var(--p-success-color)` + `var(--p-success-contrast-color)` is a mode-correct fill/on-color pair; `--p-success-500` is the fixed anchor that never flips.

### Typography tokens

`--p-font-<role>-<prop>` — roles `heading` / `body` / `mono`, props `family`, `scale` (size multiplier), `line-height`, `letter-spacing`, `stretch`, `variation-settings`. Mode-independent; defaults are visually inert. They steer rendered-content typography (markdown headings/body, code blocks), not host chrome.

| Token | Default | Effect |
|---|---|---|
| `--p-font-heading-family` | `--v-font-family-head, Arial` | Heading font |
| `--p-font-heading-scale` | `1` | Multiplies heading sizes |
| `--p-font-body-scale` | `1` | Multiplies body sizes |
| `--p-font-<role>-line-height` | `1.5` | Per-role line-height |
| `--p-font-<role>-letter-spacing` | `normal` | Per-role tracking |
| `--p-font-<role>-stretch` | `normal` | Variable-font width |
| `--p-font-<role>-variation-settings` | `normal` | Variable-font axes |
| `--p-font-mono-family` | `ui-monospace` | Code / markdown mono |

Which font *files* load (families, weights, `size-adjust`, ascent/descent overrides) is declared via the facade `fonts` theming param and compiled to distributed CSS by the host.

---

## Reference — Dark mode

Variables switch at `@media (prefers-color-scheme: dark)`. Key changes:

- `--p-primary` base shifts from `rgb(0, 95, 178)` to `rgb(0, 125, 178)` (brighter)
- `--p-primary-color` shifts from `primary-500` to `primary-400`
- `--p-content-background` shifts from `surface-0` to `surface-900`
- `--p-text-color` shifts from `surface-700` to `surface-0`
- Surface levels diverge between modes — light uses neutral gray, dark uses a separate warm ramp (only `0` and `50` are shared); levels 600–950 carry the warmest undertones

**Universal rule:** every level of custom CSS must produce a sensible result in both light and dark modes.

```css
.my-thing {
  background: var(--p-content-background);
  color: var(--p-text-color);
}
/* Only needed when you genuinely require mode-specific raw values: */
.my-thing { background: #ffffff; color: #111111; }
@media (prefers-color-scheme: dark) {
  .my-thing { background: #18181b; color: #e5e5e5; }
}
```

In `cssVariables` YAML, use `@light` / `@dark` keys:

```yaml
cssVariables:
  "--p-primary": "#005fb2"
  "@light":
    "--p-content-background": "#fafafa"
  "@dark":
    "--p-content-background": "#1c1a19"
```

---

## Reference — Tailwind severity utility classes

Provided by `tailwindcss-primeui` plugin (included in the shared Tailwind preset). Work with `bg-`, `text-`, `border-`, `outline-`, `ring-` prefixes.

**Rule: always use semantic severity classes over raw Tailwind color names when the color conveys meaning.** Never `text-red-500` for danger, `bg-green-100` for success, etc.

| Class suffix | Maps to |
|---|---|
| `primary` | `--p-primary-color` |
| `primary-{0,50,100,...,950}` | Full primary shade range |
| `surface-{0,50,100,...,950}` | Full surface shade range |
| `danger-{50..950}` | `--p-danger` scale |
| `success-{50..950}` | `--p-success` scale |
| `warn-{50..950}` | `--p-warn` scale |
| `info-{50..950}` | `--p-info` scale |
| `help-{50..950}` | `--p-help` scale |
| `accent-{50..950}` | `--p-accent` scale |
| `secondary-{50..950}` | `--p-secondary` scale |

Semantic color utilities:

| Class | Maps to |
|---|---|
| `.text-color` | `--p-text-color` |
| `.text-muted-color` | `--p-text-muted-color` |
| `.bg-highlight` | Highlighted state (selected items, active rows) |
| `.border-surface` | `--p-content-border-color` |
| `.rounded-border` | `--p-content-border-radius` |

Animation utilities: `.animate-fadein`, `.animate-fadeout`, `.animate-slidedown`, `.animate-slideup`, `.animate-scalein`, `.animate-fadeinleft`, `.animate-fadeinright`, `.animate-fadeinup`, `.animate-fadeindown`, `.animate-duration-{ms}`, `.animate-delay-{ms}`, `.animate-ease-*`.

---

## Reference — Host UI customization (`--wippy-host-*` + BEM classes)

Override host chrome through `AppConfig.theming.host.cssVariables` / `customCSS`. Shared brand theme belongs in `AppConfig.theming.global`; child-only overrides belong in `AppConfig.theming.children` and are projected into each child iframe as `config.theming.global`.

Always scope class-based overrides to `.wippy-host-app` to prevent leaking into child iframes.

### Layout & sidebar

| Variable | Default | Description |
|---|---|---|
| `--wippy-host-sidebar-width-open` | `16rem` | Sidebar width when expanded |
| `--wippy-host-sidebar-width-closed` | `3.5rem` | Sidebar width when collapsed |

**BEM classes** (scope with `.wippy-host-app`):

| Class | Element |
|---|---|
| `.layout` | Root layout wrapper |
| `.layout__sidebar` | Sidebar container |
| `.layout__sidebar-header` | Sidebar header (logo + toggle) |
| `.layout__sidebar-nav` | Navigation list area |
| `.layout__main` | Main content area (right of sidebar) |

### Splitter gutter

| Variable | Default | Description |
|---|---|---|
| `--wippy-host-splitter-width` | `1px` | Visible line width |
| `--wippy-host-splitter-hit-area` | `10px` | Draggable hit area width (transparent) |
| `--wippy-host-splitter-color` | `var(--p-surface-200)` (light) / `var(--p-surface-600)` (dark) | Line color |

### Chat messages

| Variable | Default | Description |
|---|---|---|
| `--wippy-host-message-radius` | `1rem` | Message bubble border radius |
| `--wippy-host-message-padding-x` | `1rem` | Message horizontal padding |
| `--wippy-host-message-padding-y` | `0.5rem` | Message vertical padding |
| `--wippy-host-message-user-bg` | `var(--p-primary-50)` | User message background |
| `--wippy-host-message-agent-bg` | `var(--p-yellow-50)` (light) / `var(--p-surface-800)` (dark) | Agent message background — note `--p-yellow-50` is undefined in `theme-config.css`, so set this var (e.g. to `var(--p-warn-50)`) for a valid light background |
| `--wippy-host-tool-bg` | `var(--p-help-50)` | Tool call background |
| `--wippy-host-tool-border` | `var(--p-help-300)` | Tool call left border |
| `--wippy-host-avatar-size` | `2rem` | Message avatar diameter |

**BEM classes** (scope with `.wippy-host-app`):

| Class | Element |
|---|---|
| `.chat-message` | Message row container |
| `.chat-message--user` | User message modifier |
| `.chat-message--agent-message` | Agent message modifier |
| `.chat-message--tool` | Tool call message modifier |
| `.chat-message--error` | Error message modifier |
| `.chat-message__avatar` | Avatar wrapper |
| `.chat-message__avatar-icon` | Avatar icon circle |
| `.chat-message__content` | Message bubble |
| `.chat-message__body` | Message text content |
| `.chat-message__footer` | Timestamp row |
| `.chat-message__tool-name` | Tool name label |
| `.chat-message__tool-icon` | Tool icon |
| `.chat-message__agent-content` | Agent name system line |
| `.chat-message__model-content` | Model name system line |
| `.chat-message__files` | Attached files row |
| `.chat-tool-group` | Inline tool call badge group |
| `.chat-tool-group__badge` | Individual tool badge |
| `.chat-tool-group__badge--success` | Completed tool badge |
| `.chat-tool-group__badge--error` | Failed tool badge |
| `.chat-tool-group__badge--processing` | In-progress tool badge |
| `.chat-tool-group__icon` | Badge icon |

### Chat input

**BEM classes** (scope with `.wippy-host-app`):

| Class | Element |
|---|---|
| `.chat-input` | Input bar container |
| `.chat-input__group` | Input field + buttons wrapper |
| `.chat-input__textarea` | Message textarea |
| `.chat-input__attach-button` | Attachment button |
| `.chat-input__send-button` | Send button |
| `.chat-input__stop-button` | Stop generation button |
| `.chat-input__upload-list` | Upload queue list |
| `.chat-input__prompts` | Suggested prompts area |

### Chat container

**BEM classes** (scope with `.wippy-host-app`):

| Class | Element |
|---|---|
| `.chat-container` | Outer chat wrapper |
| `.chat-container--selected` | Has active session |
| `.chat-container--non-selected` | No session selected |
| `.chat-container__empty-state` | Empty state wrapper |
| `.chat-container__empty-state-icon` | Empty state icon |
| `.chat-container__empty-state-title` | Empty state heading |
| `.chat-container__empty-state-description` | Empty state text |
| `.chat-container__drop-zone` | File drag-and-drop overlay |
| `.chat-container__drop-zone-icon` | Drop zone icon |

### Session selector

**BEM classes** (scope with `.wippy-host-app`):

| Class | Element |
|---|---|
| `.session-selector` | Selector wrapper |
| `.session-selector__dropdown` | Dropdown component |
| `.session-selector__option` | Session option row |
| `.session-selector__active-dot` | Active session indicator |

### Root

| Class | Element |
|---|---|
| `.wippy-host-app` | Application root element — scope all host-only CSS overrides to this |

---

## Anti-patterns (REJECT list)

These apply to both micro frontend apps and web components.

### Color / semantic vars

- Hardcoded hex/rgb for semantic colors: `color: #ef4444`, `background: rgb(34, 197, 94)`. Always use `var(--p-danger-*)` / `var(--p-success-*)` / `var(--p-warn-*)` / etc.
- Raw Tailwind color classes for semantic meaning: `text-red-500`, `bg-green-100`, `border-yellow-300`. Use severity classes: `text-danger-500`, `bg-success-100`, `border-warn-300`.
- Numbered `--p-surface-N` for theme-dependent semantic colors (e.g. `color: var(--p-surface-700)` for "muted text"). Use semantic aliases: `var(--p-text-color)`, `var(--p-text-muted-color)`, `var(--p-content-background)`, `var(--p-content-border-color)`.
- Component-level custom color palettes (`--my-app-red`, `--feature-blue`) declared without a documented design reason.
- Using severity tokens in decorative contexts (`--p-danger-500` for "red chart category") — that implies meaning the element doesn't have.

### Placement / scope

- `:root { --p-* }` overrides inside a child app's `src/styles.css`. Put `--p-*` overrides in facade theming (`theming.global` / `theming.children`) or per-page `configOverrides.customization.cssVariables`.
- Raw `.p-button { … }` / `.p-dialog { … }` selectors inside a child app's `src/styles.css`. Put PrimeVue selector overrides in facade theming or per-page `configOverrides.customization.customCSS`.
- App-side `<style>` blocks defining `@media (prefers-color-scheme: dark)` rules that retune host vars.
- Theme-related CSS in `src/styles.css` — if it's a host-styled component, it belongs in the facade.

### Components / API

- Reimplementing a PrimeVue component from scratch (custom Toast, Dialog, Accordion, Select). Use the PrimeVue component + `customCSS` overrides.
- `useToast()` / `useConfirm()` from PrimeVue in micro frontend app code. Use `host.toast(...)` / `host.confirm(...)`.
- Components that redeclare `--p-*` vars they should inherit (`:host { --p-primary-500: #abc }`).
- `<Button icon="pi pi-plus">` — use `<Icon>` from `@iconify/vue` instead of the `pi-*` icon font.

### Build / config

- Importing `primevue/config` directly to install the PrimeVue plugin. Use `@wippy-fe/theme/primevue-plugin`.
- Adding `primeVueCssUrl` to a WC's `hostCssKeys` when the WC doesn't render PrimeVue components.
- Setting `proxy.injections.tailwindConfig: true` in a Vite-built app (legacy runtime-Tailwind path).
- Externalizing `@wippy-fe/theme` in a WC's Vite config — theme assets must be bundled into the WC.

---

## Related docs

- [micro-frontend-app-theming.md](./micro-frontend-app-theming.md) — how micro frontend apps receive and configure theme injection
- [web-component-theming.md](./web-component-theming.md) — how web components receive the theme through shadow DOM
- [micro-frontend-app.md](./micro-frontend-app.md) — building Wippy micro frontend apps
- [web-component.md](./web-component.md) — building Wippy web components
- [host-less-mode.md](./host-less-mode.md) — dev overlay and CSS injection in host-less mode
- [compliance-checklist.md](./compliance-checklist.md) — full REJECT/WARN rules for theming
