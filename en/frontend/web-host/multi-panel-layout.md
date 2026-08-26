---
title: "Multi-Panel Layout"
description: "The managed-layout mode replaces the standard Wippy chrome with a fully declarative panel tree. Instead of the fixed chat-and-sidebar shell, you…"
---

# Multi-Panel Layout

> **Status: Draft 1 (preview) — early access, not for production.** The managed-layout API is shipped but not yet battle-tested on a production consumer. Field names, defaults, and validation rules may still change between minor releases. Pin to an exact CDN version until this label is removed. **For nearly all applications the standard `compat` mode is the recommended production mode** — reach for managed layout only when you genuinely need to compose the chrome itself.

The managed-layout mode replaces the standard Wippy chrome with a fully declarative panel tree. Instead of the fixed chat-and-sidebar shell, you describe a tree of named panels in your backend YAML. The Web Host assembles the layout at boot, validates it, and maintains it reactively at runtime. Panels can be resized, collapsed, swapped, added, and removed without a page reload.

## When to Use Managed Layout

The standard `compat` mode (the default) gives you the fixed Wippy product: nav sidebar, chat panel, page area, and a right artifact panel. It is the current, most-used production mode and is sufficient for nearly all applications.

Opt in to `fe_mode = managed` (early access) only when you need to compose the chrome itself:

| Need | Compat | Managed |
|------|--------|---------|
| Standard Wippy chat + nav | Yes | Replaceable |
| Multiple page slots side by side | No | Yes |
| Custom sidebar or coordinator component | Limited | Yes — any panel kind |
| Responsive layouts per breakpoint | No | Yes |
| Floating overlay panels | No | Yes |
| Headless coordinator component | No | Yes (`coordinators`) |
| Per-panel URL-aware routing | Main panel only | Every `kind: page` panel |
| Cross-panel message bus | No | Yes (`broadcast`/`send`/`on`) |

## Compatibility

Managed layout spans the Web Host, facade, and several `@wippy-fe/*` packages. Use one compatible package family for the exact target Web Host release and verify its served import map; do not mix package versions from unrelated releases.

### Release map

| Release | Managed-layout additions |
|---|---|
| Web Host `1.0.50`, Wippy FE `0.0.50` | Typed compat intents, `@HOST/compat-coordinator`, browser URL and Back/Forward synchronization, built-in panel tabs, anchored floating panels, and `useSwapBuffer()`. |
| Web Host `1.0.51`, Wippy FE `0.0.51` | Reactive and race-safe `<wippy-chat>` session/token control, opt-in themed splitter handles, split-axis-only size constraints, drawer geometry/stacking fixes, and the packaged proxy source map. |
| Web Host `1.0.52`, Wippy FE `0.0.52` | Typed retained-WC visibility and `useHostVisibilityRefresh()`, immediate page readiness instead of waiting for the 14-second fallback, stale renderer-key rejection, in-place component prop updates, and the isolated splitter layer with `--wippy-layout-splitter-z-index`. |

The 14-second page reveal is a Web Host `1.0.52` fallback, not a 1.0.51
feature or an application loading delay. Split-axis sizing and reactive chat
landed in 1.0.51; retained visibility, keyed readiness, and splitter layering
landed in 1.0.52.

Retained direct-web-component visibility requires Web Host `1.0.52` and
`@wippy-fe/webcomponent-core`, `@wippy-fe/webcomponent-vue`, and
`@wippy-fe/shared` `0.0.52`. Earlier managed-layout releases do not provide the
typed `data-wippy-visible` contract or `useHostVisibilityRefresh()`.

### Retained web-component activity

Managed layouts keep panels mounted across buffer swaps, breakpoint changes,
and drawer close/open cycles. The host sets
`data-wippy-visible="true" | "false"` before connecting a direct custom element
and updates it in place when logical ownership changes. This is not CSS,
viewport, or document visibility, and it never implies a remount.

Vue components read the state with `useHostVisibility()` or combine ordinary
initial loading with reveal refreshes through `useHostVisibilityRefresh(task)`.
The latter runs after mount and then only on exact `false -> true`. Do not use
the proxy `@visibility` topic in a direct WC; it is the iframe/Web Fragment
message channel.

Pin to an exact CDN tag — at least `https://web-host.wippy.ai/webcomponents-1.0.52` — until the Draft 1 label is removed.

## Enabling Managed Layout

Enable the managed entry in your facade configuration and provide a backend `host_config.layout` declaration:

```yaml
host_config:
  layout:
    layouts:
      default:
        direction: horizontal
        children:
          - panel: nav
            size: 240px
          - panel: main
            size: 1fr
            main: true
    panels:
      nav:  { kind: builtin, id: '@HOST/nav-sidebar' }
      main: { kind: page,    id: home }
```

When the managed entry is selected, the facade serves `managed-layout.js` instead of `module.js`. `fe_mode` is a current facade requirement parameter (default `compat`, opt-in `managed`); it is set on the `wippy.facade` requirement, not carried inside the `AppConfig` payload. There is no `AppConfig.feature` field — the managed layout is conveyed to the child entirely through `AppConfig.hostConfig.layout`. The proxy API *surface* is identical in both modes, but some commands only take effect in one mode — see [What works in which mode](#what-works-in-which-mode).

## The `HostLayoutDeclaration`

The entire layout is described by a single `HostLayoutDeclaration` object nested under backend `host_config.layout` in your facade configuration and projected to frontend `AppConfig.hostConfig.layout`. The host validates it before mounting — any `LayoutValidationError` surfaces in the browser console with `{ kind, message, panelId? }`.

| Field | Type | Description |
|-------|------|-------------|
| `layouts` | `Record<string, PanelTree> & { default: PanelTree }` | Breakpoint-keyed panel trees. The `default` key is required. |
| `breakpoints?` | `Record<string, number>` | Pixel widths that activate non-default layout keys. |
| `panels` | `Record<string, HostPanelDef>` | Named panel content definitions. |
| `floating?` | `Record<string, HostFloatingDef>` | Boot-time floating overlay panels. |
| `modals?` | `Record<string, HostModalDef>` | Boot-time modal definitions. |
| `coordinators?` | `Record<string, HostCoordinatorDef>` | Headless coordinator components. |
| `services?` | `Record<string, HostCoordinatorDef>` | Deprecated alias for `coordinators`; new declarations must use `coordinators`. |
| `dragEnabled?` | boolean | Allow user-driven splitter drag. Default `true`. |

## Panel Kinds

Each entry in `panels`, `floating`, `modals`, and `coordinators` is a tagged union on `kind`:

| Kind | Description | Required fields |
|------|-------------|-----------------|
| `page` | A Wippy page module mounted in a srcdoc iframe | `id` (page registry id) |
| `artifact` | A Wippy artifact mounted in a srcdoc iframe | `id` (artifact UUID) |
| `component` | A web component mounted directly in host DOM | `tagName` |
| `builtin` | A framework-owned host component (see below) | `id` |

Exactly one panel in the layout tree must carry `main: true`. Browser URL ownership still requires route synchronization through `@HOST/compat-coordinator` or equivalent consumer coordination. All other panels route independently inside their iframes.

### Built-in Panel IDs

`kind: builtin` accepts the following `id` values. The `@HOST/` prefix is reserved for framework-owned panels:

| ID | What it renders |
|----|-----------------|
| `@HOST/nav-sidebar` | Standard Wippy nav sidebar (sessions, pages, settings) |
| `@HOST/chat-wrapper` | Standard Wippy chat panel for the active session |
| `@HOST/artifact-viewer` | Generic artifact viewer (pair with route `/:uuid`) |
| `@HOST/session-selector` | Session list and picker |
| `@HOST/compat-coordinator` | Headless compat-intent and main-route coordinator; declare under `coordinators` |
| `@HOST/panel-tab` | Edge tab for revealing a collapsed panel; declare under `floating` |

An unknown `@HOST/<id>` causes a `LayoutValidationError` at declaration-load rather than silently rendering an empty slot.

## Breakpoint-Keyed Layouts

The `layouts` field maps breakpoint keys to panel trees. `default` is always used unless a narrower breakpoint matches. Breakpoint pixel widths are defined under `breakpoints`:

```yaml
host_config:
  layout:
    breakpoints:
      sm: 768
    layouts:
      default:
        direction: horizontal
        children:
          - panel: side
            size: 300px
          - panel: main
            size: 1fr
            main: true
      sm:
        direction: vertical
        children:
          - panel: main
            size: 1fr
            main: true
          - panel: side
            display: drawer-left
            drawerSize: { width: 320px }
    panels:
      side: { kind: page, id: app-sidebar, route: / }
      main: { kind: page, id: app-home,    route: / }
```

When the breakpoint changes, panels with the same `id` keep one stable content host that visually tracks the active slot without reparenting. Iframe `contentWindow`, web-component state, Vue state, and scroll position survive the transition; reparenting via Teleport is intentionally avoided because removing and reinserting an iframe reloads it.

### Drawer-Mode Panels

A panel slot can declare `display: 'drawer-left' | 'drawer-right' | 'drawer-bottom'` to render as a slide-in overlay instead of an inline flex item. Drawer panels:

- Do not participate in their parent container's track sizing (`size` is ignored)
- Render as absolutely-positioned overlays anchored to the named edge
- Have an open/close state toggled via `host.layout.openDrawer(id)` / `closeDrawer(id)` / `toggleDrawer(id)`
- Show a backdrop when open; clicking the backdrop closes all open drawers

`main: true` slots cannot be drawer-mode — host validation throws. The `drawerSize.width` field controls the width for left/right drawers; `drawerSize.height` for bottom drawers. Default is `320px`.

## Floating Panels

Floating panels are free-positioned overlays declared under `floating`. They do not participate in the flex layout tree and can be added or removed at runtime:

```yaml
floating:
  flap:
    kind: component
    tagName: my-right-flap
    position: { x: 0, y: 200 }
    size: { width: 48, height: 80 }
```

Runtime management:
```typescript
// Add a floating panel
host.layout.addFloating('inspector', {
  kind: 'component',
  tagName: 'my-inspector',
  position: { x: 100, y: 100 },
  size: { width: 400, height: 300 },
})

// Remove it
host.layout.removeFloating('inspector')
```

## Headless Coordinators

Coordinators are components mounted in a hidden host. They have no visible slot but receive the panel-scoped host API. Use them for cross-cutting logic so display panels stay focused on rendering. The older `services` field remains a deprecated compatibility alias.

```yaml
coordinators:
  coordinator:
    kind: component
    tagName: my-coordinator
```

A coordinator component receives the panel-scoped host wrapper and can subscribe to bus channels immediately in `onMount`:

```typescript
import { WippyElement } from '@wippy-fe/webcomponent-core'

class MyCoordinator extends WippyElement {
  protected onMount() {
    this.host?.layout.on('open-chat', ({ payload }) => {
      this.host?.layout.updatePanel('right', { route: `/open-chat/${payload.token}` })
      this.host?.layout.expandPanel('right')
    })
  }
  protected onUnmount() {}
  static get wippyConfig() { return { propsSchema: { properties: {} } } }
}
customElements.define('my-coordinator', MyCoordinator)
```

### Shipped compat coordinator

Managed layout contains only declared surfaces. Calls such as
`host.openArtifact()`, `host.startChat()`, `host.openSession()`, and
`host.navigate()` therefore publish typed intents on the reserved
`@HOST/intent` channel. Declare the shipped coordinator to act on them and to
bind the browser URL to the main panel:

```yaml
coordinators:
  compat:
    kind: builtin
    id: '@HOST/compat-coordinator'
    props:
      artifactPanel: right
      chatPanel: chat
      modalId: artifact-modal
      routeSync: true
      wsActions: true
```

Keep `routeSync: true` when using the standard navigation contract. Without a
coordinator or equivalent consumer logic, deep links, Back/Forward, and
`@HOST/nav-sidebar` navigation have no panel route to drive. Intents raised
during child boot are held in a bounded queue until the first coordinator
subscribes.

`@HOST/` is reserved in both directions: ordinary panels cannot publish system
traffic, and only entries under `coordinators` receive it through supported
host APIs. This boundary is enforced for iframe/Web Fragment panels. A direct
component mounted in the host realm shares the host DOM and is not a security
sandbox. At boot the host prints a parity table when coordinator handling, a
modal target surface, main-panel URL binding, or a declared coordinator tag is
missing; a complete declaration produces no warning.

## The In-Tab Broadcast Bus

Panels communicate through a bus scoped to the current browser tab. The bus never crosses to other tabs — use a custom WebSocket topic if you need multi-tab sync.

| Method | Description |
|--------|-------------|
| `host.layout.broadcast(channel, payload)` | Publish to all panels; sender excluded |
| `host.layout.send(targetPanelId, channel, payload)` | Publish to one specific panel |
| `host.layout.on(channel, handler)` | Subscribe; returns `off()` unsubscribe function |

The `sourcePanelId` on received messages is set by the host from the publishing window and cannot be spoofed. Channel names are case-sensitive plain strings.

**Important:** Components that import `host` directly from `@wippy-fe/proxy` bypass panel scoping — bus calls go through but lose `sourcePanelId`. Always use the panel-scoped wrapper instead:

```typescript
// raw HTMLElement
import { getWippyHost } from '@wippy-fe/webcomponent-core'
const host = getWippyHost(this)

// WippyElement subclass — this.host is already panel-scoped
this.host?.layout.broadcast('open-chat', { token: 'abc' })

// Vue component
import { useHost } from '@wippy-fe/webcomponent-vue'
// ProxyApiInstance is an ambient global type (from @wippy-fe/types-global-proxy) — reference it without an import.
const host = useHost<ProxyApiInstance['host']>()
host?.layout.broadcast('open-chat', { token: 'abc' })
```

## Layout API Reference (`host.layout`)

| Method | Description |
|--------|-------------|
| `.snapshot` | Synchronous getter returning the full layout snapshot, or `null` outside managed-layout mode |
| `.resizePanel(id, size)` | Resize the named panel in the active breakpoint |
| `.collapsePanel(id)` | Collapse a panel declared `collapsible: true` |
| `.expandPanel(id)` | Expand a collapsed panel |
| `.openDrawer(id)` | Open a drawer-mode panel |
| `.closeDrawer(id)` | Close a drawer-mode panel |
| `.toggleDrawer(id)` | Toggle a drawer-mode panel |
| `.movePanel(id, target)` | Move panel to a new tree position |
| `.removePanel(id)` | Remove panel from all breakpoint layouts |
| `.updatePanel(id, def)` | Patch panel definition at runtime; `props` shallow-merges, top-level fields replace |
| `.addFloating(id, def)` | Add a floating panel |
| `.removeFloating(id)` | Remove a floating panel |
| `.openModal(id, def?)` | Open a declared modal by id, optionally overriding its definition. Runtime-only modals require `def`. Native `<dialog>.showModal()` is the default; pass `useNativeDialog: false` for the legacy div overlay. Re-opening an open id is a silent no-op. |
| `.closeModal(id)` | Close an open modal |
| `.broadcast(channel, payload)` | Publish to all panels |
| `.send(target, channel, payload)` | Publish to one panel |
| `.on(channel, handler)` | Subscribe to a bus channel |

`openModal()` documents host-internal layout infrastructure, not an application-component recipe. Shipped Vue product UI should use PrimeVue `Dialog` or the host confirmation API rather than cloning this native-dialog behavior with custom modal styling.

### `updatePanel` Merge Semantics

`host.layout.updatePanel(id, def)` patches an existing panel def — it does not replace it. The `props` object is **shallow-merged** into the panel's current props: supplied keys are added or overwritten, omitted keys are preserved. Every **other** top-level field of `def` (`route`, `kind`, `id`, `tagName`, `title`, `icon`, …) **replaces** the current value wholesale.

Given a panel whose current props are `{ artifactId: 'old', zoom: 2 }`:

```typescript
// props shallow-merges → { artifactId: 'abc', zoom: 2 }
host.layout.updatePanel('right', { props: { artifactId: 'abc' } })

// route replaces wholesale; props left untouched
host.layout.updatePanel('right', { route: '/x' })
```

Two caveats: the props merge is **shallow** — a nested object inside `props` is replaced entirely, not deep-merged — and a shallow merge cannot delete a prop key (you can only overwrite it).

## Vue Composables — `@wippy-fe/vue-host`

These composables wrap the proxy layout API in reactive Vue 3 refs. The underlying subscription is module-scoped and lives for the iframe's lifetime, so there is no per-component cleanup on unmount:

| Composable | Returns |
|------------|---------|
| `useWippyLayout()` | Full layout state and mutation methods |
| `useWippyPanel(panelId)` | Named panel's live state (`panelId` is required — `string`, `Ref<string>`, or getter) |
| `useWippyBreakpoint()` | Active breakpoint name as a reactive ref |
| `useWippyMainRoute()` | Reactive ref to the main panel's current route |

The composables never return `null` — they always hand back objects/refs whose inner `.value` degrades when no managed-layout host is present: `useWippyLayout().snapshot.value` is `null` (and `isManaged.value` is `false`, so mutations are silent no-ops), `useWippyBreakpoint().value` and `useWippyMainRoute().value` are empty strings, and `useWippyPanel(id).value` is `null` when the id is absent. Guard host presence with `layout.isManaged.value` (or `layout.snapshot.value !== null`) rather than a `=== null` check on the return value. This keeps the composables usable in standalone playgrounds and unit tests where no managed-layout host is present.

## Swap buffering without remounts

`useSwapBuffer()` from `@wippy-fe/layout` keeps the outgoing surface mounted
until incoming content reports readiness, with an explicit timeout ceiling.
Use immutable `slot.index` as the DOM key, pass both index and content key to
`markReady()` / `markFailed()` so stale async signals are rejected, and keep
errors scoped per buffer. Content identity belongs in `keyOf`; changing the DOM
key would reinsert an iframe and destroy the state buffering is meant to retain.

```typescript
const swap = useSwapBuffer<Surface>({
  keyOf: surface => surface.ownerId,
  buffers: 2,
  readyTimeoutMs: 8_000,
  loaderDelayMs: 250,
  loaderMinMs: 400,
})

const slot = swap.push(surface)
swap.markReady(slot.index, slot.key)
// or: swap.markFailed(slot.index, error, slot.key)
```

The values shown are the defaults. A readiness timeout reveals the content by
default rather than leaving stale content behind a loader. Bind loading UI to
`swap.showLoader`, not directly to readiness. A failed buffer remains isolated
from its sibling; after handling the error, call `clearError(index)` to retry.

### Web Host page readiness

Web Host uses the same keyed readiness discipline for managed page surfaces,
with a 14-second final reveal ceiling. Iframe and direct Web Component renderers
emit `load` / `error` through Vue event listeners and include the immutable
content key owned by that renderer. Painted content is therefore revealed
immediately; the ceiling is only a fallback for content that never reports.
A late event from an evicted renderer is rejected when its buffer index has
already been reused.

Do not use the 14-second host ceiling as an application loading delay, and do
not add a second timer around normal page readiness. A page that regularly
reaches the ceiling has a broken readiness or lifecycle path that should be
fixed at its owner.

### Stable component updates and panel sizing

For `kind: component`, changing panel `props` updates or removes attributes on
the existing custom element. The host replaces the element only when `tagName`
changes. This preserves element-owned state during `updatePanel()` calls and
breakpoint transitions.

`minSize` and `maxSize` constrain only the active split axis: width in a
horizontal tree and height in a vertical tree. They do not cap the cross axis,
so navigation, chat, and other full-height mounts can fill their track. Drawer
mounts follow the animated drawer geometry and are promoted above their anchor
and backdrop only while open, without remounting their content.

## Splitter and handle styling

The splitter hit area is wider than its visible line and lives in the package's
isolated layer stack. `--wippy-layout-splitter-z-index` defaults to `700`, below
drawers and modal backdrops. The circular handle is opt-in:

| Variable | Default | Purpose |
|---|---|---|
| `--wippy-layout-splitter-size` | `1px` | Visible splitter line thickness |
| `--wippy-layout-splitter-hit-size` | `10px` | Pointer hit area around the line; `24px` on coarse pointers |
| `--wippy-layout-splitter-z-index` | `700` | Splitter and handle layer |
| `--wippy-layout-splitter-handle-size` | `0` | Handle diameter; `0` disables it |
| `--wippy-layout-splitter-handle-bg` | `transparent` | Handle fill |
| `--wippy-layout-splitter-handle-border` | `0 solid transparent` | Border shorthand |
| `--wippy-layout-splitter-handle-shadow` | `none` | Handle shadow |
| `--wippy-layout-splitter-handle-icon-color` | `transparent` | Theme-aware SVG color via `currentColor` |

Set size, fill, border/shadow, and icon color together when opting in. The SVG
rotates 90 degrees for vertical splitters and remains hidden for locked splits.

## What works in which mode

The proxy API *surface* is identical in compat and managed mode — the same `@wippy-fe/proxy` imports resolve in both — but two parts of it are **mode-specific in effect**. This mismatch is the main thing to watch when moving an app onto managed layout (and a reason managed is still early access).

### `host.layout` takes effect only in managed mode

The host installs the layout receiver **only when a layout is declared** (the managed entry, gated on `hostConfig.layout`). In compat mode `host.layout` still exists, but `host.layout.snapshot` is `null` and every mutation and bus call (`resizePanel`, `updatePanel`, `movePanel`, `openModal`, `addFloating`, `broadcast`, `send`, `on`, …) is a **silent no-op** — the message is posted but nothing on the host is listening. Gate on the snapshot before mutating:

```typescript
if (host.layout.snapshot) {
  host.layout.updatePanel('right', { route: '/details' })   // managed only
}
// Vue: const { isManaged } = useWippyLayout(); if (isManaged.value) { … }
```

(Separately — a different axis — `addPanel` and `setLayout` are not exposed over the proxy *at all*, in either mode; see [Known Limitations](#known-limitations).)

### `host.*` commands that assume the compat shell

The managed shell renders **only your declared layout**. Starting with Web Host 1.0.50, commands that normally target compat chrome publish typed `@HOST/intent` messages instead of failing silently. Declare `@HOST/compat-coordinator` or implement an equivalent coordinator to map those intents to your panels:

| `host.*` command | Compat (default) | Managed |
|---|---|---|
| `setContext`, `toast`, `confirm`, `handleError`, `logout`, `bridge.*`, top-level `state` / `ws` / `on` | Works | Works directly; managed mounts the global toast and confirmation surfaces |
| `openArtifact(id, ...)` | Opens in the right panel or a modal | Publishes an intent; the compat coordinator targets `artifactPanel` or `modalId` |
| `startChat(token)` / `openSession(uuid)` | Opens and displays the session | Publishes an intent; the compat coordinator resolves start tokens and updates the declared `chatPanel` |
| `navigate(url)` | Pushes the compat root router | Publishes an intent; `routeSync` applies it to the main panel and keeps browser history aligned |
| `onRouteChanged(route, navId?)` | Drives the host browser URL | Updates panel route state; `routeSync` projects the main panel route to the browser URL |

If no coordinator is available yet, boot-time intents are held in a bounded queue for the first coordinator subscription. A declaration with no handler is reported by the boot parity table. Reserved intents are readable only by `coordinators` entries and cannot be forged by ordinary panels.

## State Management Approach

Three tiers, in order of preference:

**Route** — If the user could meaningfully bookmark or share the state, put it in the URL. Each `kind: page` panel runs its own router and reacts to `@history` events. This is decoupled, deep-linkable, and browser-history-aware.

**Layout snapshot** — If it affects layout shape (sizes, collapsed flags, component props), put it in the snapshot via `updatePanel` or `resizePanel`. Every subscribed panel sees every snapshot change, so keep payloads small.

**Panel-local** — Everything else (form drafts, modal state, transient UI) stays inside the panel's own Pinia stores or refs and never leaves the panel.

## Canonical Coordination Pattern

The recommended pattern for cross-panel interaction is: bus event → coordinator service → `updatePanel` → panel reacts via its own router.

```typescript
// In the coordinator service
this.host?.layout.on('open-chat', ({ payload }) => {
  this.host?.layout.updatePanel('right', { route: `/open-chat/${payload.token}` })
  this.host?.layout.expandPanel('right')
})

// In the right-panel app (a normal Vue page module)
const router = createAppRouter([...])
// createAppRouter already mirrors host history events into the router
// with an echo/current-route guard; add no manual routing subscription.
```

Keep coordinators thin. Keep panels owning their own UI.

## Known Limitations

As of Draft 1, the following are not yet implemented:

- **`addPanel` / `setLayout` over the proxy** — not shipped. These exist only on the internal `@wippy-fe/layout` `LayoutManager` and are not exposed across the iframe proxy boundary. (`openModal`, `closeModal`, and `movePanel` are shipped — see the Layout API Reference.)
- **Panel drag-to-rearrange UI** — the data model and `movePanel()` API work; user-facing drag is not yet implemented.
- **Tab primitive** — not yet implemented.
- **Grid-tile container** — tracked for a follow-up.
- **Runtime mutation persistence** — mutations are not persisted across reloads. Persist manually if needed:
  ```typescript
  on('@layout-change', () =>
    state.set('layout', host.layout.snapshot)
  )
  ```
- **`nav-sidebar` header slot extension points** — logo, app-name, and toggle button positions are fixed in this draft.

## See Also

- [Facade Entry Point](./entry-point.md) — how the facade loads the JS-module entry and delivers config
- [Bootstrap Sequence](./bootstrap.md) — how the host dispatches to the managed-layout entry at boot
- [Packages](./packages.md) — `@wippy-fe/layout`, `@wippy-fe/vue-host`, `@wippy-fe/webcomponent-core`, `@wippy-fe/webcomponent-vue`
