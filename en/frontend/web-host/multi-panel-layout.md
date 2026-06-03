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
| Headless background service component | No | Yes (`services`) |
| Per-panel URL-aware routing | Main panel only | Every `kind: page` panel |
| Cross-panel message bus | No | Yes (`broadcast`/`send`/`on`) |

## Minimum Version Requirements

| Component | Minimum version |
|-----------|----------------|
| Wippy Web Host | `1.0.38` |
| wippy-framework facade | `1.0.38` |
| `@wippy-fe/proxy` | `0.0.38` |
| `@wippy-fe/webcomponent-core` / `@wippy-fe/webcomponent-vue` | `0.0.38` |
| `@wippy-fe/layout` / `@wippy-fe/vue-host` | `0.0.38` |

Pin to an exact CDN tag — at least `https://web-host.wippy.ai/webcomponents-1.0.38` — until the Draft 1 label is removed.

## Enabling Managed Layout

Enable the managed entry in your facade configuration and provide a `hostConfig.layout` declaration:

```yaml
hostConfig:
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

When the managed entry is selected, the facade serves `managed-layout.js` instead of `module.js`. `fe_mode` is a current facade requirement parameter (default `compat`, opt-in `managed`); it is set on the `wippy.facade` requirement, not carried inside the `AppConfig` payload. There is no `AppConfig.feature` field — the managed layout is conveyed to the child entirely through `AppConfig.hostConfig.layout`. Consumer code using the proxy API is identical in both modes.

## The `HostLayoutDeclaration`

The entire layout is described by a single `HostLayoutDeclaration` object nested under `hostConfig.layout` in your facade configuration. The host validates it before mounting — any `LayoutValidationError` surfaces in the browser console with `{ kind, message, panelId? }`.

| Field | Type | Description |
|-------|------|-------------|
| `layouts` | `Record<string, PanelTree> & { default: PanelTree }` | Breakpoint-keyed panel trees. The `default` key is required. |
| `breakpoints?` | `Record<string, number>` | Pixel widths that activate non-default layout keys. |
| `panels` | `Record<string, HostPanelDef>` | Named panel content definitions. |
| `floating?` | `Record<string, HostFloatingDef>` | Boot-time floating overlay panels. |
| `modals?` | `Record<string, HostModalDef>` | Boot-time modal definitions. |
| `services?` | `Record<string, HostServiceDef>` | Headless coordinator components. |
| `dragEnabled?` | boolean | Allow user-driven splitter drag. Default `true`. |

## Panel Kinds

Each entry in `panels`, `floating`, `modals`, and `services` is a tagged union on `kind`:

| Kind | Description | Required fields |
|------|-------------|-----------------|
| `page` | A Wippy page module mounted in a srcdoc iframe | `id` (page registry id) |
| `artifact` | A Wippy artifact mounted in a srcdoc iframe | `id` (artifact UUID) |
| `component` | A web component mounted directly in host DOM | `tagName` |
| `builtin` | A framework-owned host component (see below) | `id` |

Exactly one panel in the layout tree must carry `main: true`. That panel owns the host's public URL via the mountRoute system. All other panels route independently inside their iframes.

### Built-in Panel IDs

`kind: builtin` accepts the following `id` values. The `@HOST/` prefix is reserved for framework-owned panels:

| ID | What it renders |
|----|-----------------|
| `@HOST/nav-sidebar` | Standard Wippy nav sidebar (sessions, pages, settings) |
| `@HOST/chat-wrapper` | Standard Wippy chat panel for the active session |
| `@HOST/artifact-viewer` | Generic artifact viewer (pair with route `/:uuid`) |
| `@HOST/session-selector` | Session list and picker |

An unknown `@HOST/<id>` causes a `LayoutValidationError` at declaration-load rather than silently rendering an empty slot.

## Breakpoint-Keyed Layouts

The `layouts` field maps breakpoint keys to panel trees. `default` is always used unless a narrower breakpoint matches. Breakpoint pixel widths are defined under `breakpoints`:

```yaml
hostConfig:
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

When the breakpoint changes, the active layout switches synchronously and panels with the same `id` in both layouts are teleported (not remounted) — iframe `contentWindow`, Vue state, and scroll position are preserved across the transition.

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

## Headless Services

Services are coordinator components mounted in a hidden div. They have no visible slot but receive the full proxy API. Use them for cross-cutting logic (translating bus events to panel updates, managing WebSocket subscriptions) so display panels stay focused on rendering:

```yaml
services:
  coordinator:
    kind: component
    tagName: my-coordinator
```

A service component receives the panel-scoped host wrapper and can subscribe to bus channels immediately in `onMount`:

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
import type { ProxyApiInstance } from '@wippy-fe/proxy'
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
| `.closeModal(id)` | Close an open modal |
| `.broadcast(channel, payload)` | Publish to all panels |
| `.send(target, channel, payload)` | Publish to one panel |
| `.on(channel, handler)` | Subscribe to a bus channel |

## Vue Composables — `@wippy-fe/vue-host`

These composables wrap the proxy layout API in reactive Vue 3 refs and clean up automatically on unmount:

| Composable | Returns |
|------------|---------|
| `useWippyLayout()` | Full layout state and mutation methods |
| `useWippyPanel()` | Current panel's live state |
| `useWippyBreakpoint()` | Active breakpoint name as a reactive ref |
| `useWippyMainRoute()` | Reactive ref to the main panel's current route |

All composables return `null`-safe values — they work correctly in standalone playgrounds and unit tests where no managed-layout host is present.

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
const router = createAppRouter({ routes: [...] })
host.on('@history', ({ path }) => {
  router.push(path).catch(() => {})
})
```

Keep coordinators thin. Keep panels owning their own UI.

## Known Limitations

As of Draft 1, the following are not yet implemented:

- **`openModal` / `addPanel` / `setLayout` over the proxy** — not shipped. Modals can be approximated by swapping a panel's content to a route whose component renders a modal-style view.
- **Panel drag-to-rearrange UI** — the data model and `movePanel()` API work; user-facing drag is not yet implemented.
- **Tab primitive** — not yet implemented.
- **Grid-tile container** — tracked for a follow-up.
- **Runtime mutation persistence** — mutations are not persisted across reloads. Persist manually if needed:
  ```typescript
  host.on('@layout-change', () =>
    host.state.set('layout', host.layout.snapshot)
  )
  ```
- **`nav-sidebar` header slot extension points** — logo, app-name, and toggle button positions are fixed in this draft.

## See Also

- [Facade Entry Point](./entry-point.md) — how the facade loads the JS-module entry and delivers config
- [Bootstrap Sequence](./bootstrap.md) — how the host dispatches to the managed-layout entry at boot
- [Packages](./packages.md) — `@wippy-fe/layout`, `@wippy-fe/vue-host`, `@wippy-fe/webcomponent-core`, `@wippy-fe/webcomponent-vue`
