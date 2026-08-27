---
title: "Dynamic Routing"
description: "How the Web Host registers backend mount routes, synchronizes child navigation, and classifies links at runtime."
---

# Dynamic Routing

The Web Host combines statically defined system routes with page mount routes
fetched from the backend at startup. A new `view.page` entry with a `mountRoute`
claim therefore takes effect without a Web Host bundle change.

![Mount route sync](../diagrams/mountroute-sync.svg)

## Mount Route Sync at Startup

When the Web Host application initialises, before it renders any navigation, it calls:

```
GET /api/public/pages/routes
```

The response is an envelope `{ success, count, routes }`, where `routes` is a map of mount-route pattern → page id (it includes hidden/unannounced pages that still claim a URL). For each entry, the host registers a Vue Router route that maps the declared path to the page loader component, adding it as a child of the `'app'` parent route.

```typescript
// Simplified from the Web Host bootstrap
const { data } = await api.get('/api/public/pages/routes')
for (const [mountRoute, pageId] of Object.entries(data.routes)) {
  router.addRoute('app', {
    path: mountRoute,
    component: MountRoutePage,
    props: () => ({ pageId }),
  })
}
```

After this point, navigating to `/home/anything` causes the router to render the `main` page through its selected engine, and navigating to `/demo/anything` does the same for the `iframe-demo` page — without any hard-coded knowledge of those paths in the host bundle.

## Claiming a Path with `mountRoute`

A `view.page` entry claims a host router path by setting `mountRoute` in its `_index.yaml` `meta` block:

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
    mountRoute: /home/:part(.*)*
```

The current registry schema reads the authored field as `mountRoute`, stores it
in the registry's internal `mount_route` field, and emits `mountRoute` in API
output. Use the lower-camel-case spelling shown above.

`mountRoute` accepts only the catch-all forms `/:part(.*)*` (root) or `/<literal-prefix>/:part(.*)*`, where the prefix is one or more lowercase-alphanumeric-plus-hyphen literal segments ending in the required `:part(.*)*` wildcard. Arbitrary Vue Router patterns — named params, custom regex, or different param names (e.g. `/home/:id`, `/users/:userId(\d+)`) — are rejected. For backend `view.page` entries, `validate_mount_route_syntax` makes `GET /api/public/pages/routes` return HTTP 500, so Host startup stops before those entries reach its router. After a successful response and configuration merge, the Host separately validates the resulting route set, including syntax and conflicts with system routes. The wildcard segment `:part(.*)*` lets the child application manage its own sub-routes (e.g. `/settings`, `/profile/edit`) while the host owns the `/home` prefix.

Two entries must not claim the same route. If two `view.page` entries claim the
**same** `mountRoute`, the backend validator (`validate_mount_routes` in
`page_registry.lua`) records a duplicate-route conflict in the same issues list
as syntax errors. `GET /api/public/pages/routes` then returns HTTP 500, Host
startup stops, and the error is relayed through the Host error handler. The
duplicate is **not** silently ignored.

Vue Router route-resolution precedence still applies between a root catch-all (`/:part(.*)*`) and a more-specific system route (`chat`, `c`, `web`, `page`, `keeper`, `login`, `logout`) or a longer literal-prefix mount: the more-specific route matches. That priority is not duplicate-route handling.

## The URL Sync Loop

Once a page is loaded in its runtime context, the child application navigates
internally with its own router. The host reflects those navigations in its URL
bar so the browser's back button, bookmarks, and copied URLs work correctly.
The proxy bridge synchronizes the two routers for both page engines.

![Frontend Registry](../diagrams/frontend-registry.svg)

### Child → Host: `CmdRouteChanged`

When the child application's router commits a navigation (e.g. the user moves
from `/settings` to `/profile` under the `/home` mount), it reports the internal route through
the proxy bridge. The iframe adapter posts to `window.parent`; the Fragment
adapter routes the same protocol to its captured host window:

```typescript
// In the child application, on internal route change.
// App code must never post these messages directly — use the proxy API:
import { host } from '@wippy-fe/proxy'

host.onRouteChanged('/profile', navId)   // internal route only; the host prepends the mount prefix. navId is an optional number
```

The proxy serializes this over an internal wire envelope. That protocol is not an application API: do not copy it or call `window.parent.postMessage` directly.

The host's message handler intercepts this, calls `router.push(path)` to update the URL bar via an SPA route change (adding a browser-history entry) without triggering a full page reload, and then posts back:

### Host → Child: `UrlWasUpdatedInParent`

After the host updates its URL bar, the proxy emits `@history` to the child. `@wippy-fe/router` consumes that event and reconciles the memory router.

The host sends back the child's **internal** route (the sub-path after the mount prefix), not the full host path — so the round-trip is symmetric: the child posts `internalRoute: '/profile'`, the host sets its URL bar to `/home/profile`, and echoes `path: '/profile'` back, which the child's memory router pushes verbatim. The child listens via the `@history` event channel and treats it as confirmation that the host's URL is now consistent with its internal state.

The round-trip keeps the host URL bar, the child router, and the browser history entry in sync without the host needing to know anything about the child's internal routing structure.

## `classifyLink`

In the iframe engine, `preventLinkClicks: true` installs a document-level hook that intercepts raw `<a>` clicks before the browser handles them (see [view.page](./view-page.md)). The Web Fragment adapter in Web Host 1.0.56 does not install this raw-click hook. For portable Vue navigation, use `AutoRouterLink` from `@wippy-fe/router`; it calls the same `classifyLink` API in either engine.

The classifier returns one of four results:

| `LinkKind` | Condition | Action |
|---|---|---|
| `host-nav` | Top path segment matches a known `mountRoute` literal, a baked-in system route (`chat`, `c`, `web`, `page`, `keeper`, `login`, `logout`), or a root-mount catch-all | `preventDefault` + `host.navigate(normalizedPath)` |
| `child-nav` | The child router resolves the path to a real (non-catch-all) route, or nothing else has claimed it | The subapp's router decides in-app; the host does NOT `preventDefault` or reload the page context |
| `external` | Different origin, or a non-`http` scheme (`javascript`/`mailto`/`tel`/`sms`/`ftp`/`file`/`data`/`blob`) | Browser default (e.g. opens in a new tab) |
| `ignore` | Empty `href` or a pure hash (`#…`) | `preventDefault` |

The classifier checks the page's local router first, so a link the child can resolve itself stays in-app.

`classifyLink` consults the same routes list fetched at startup. A link to `/demo/step-2` is classified as `host-nav` because `/demo/:part(.*)*` is a registered mount route — the host navigates to the `iframe-demo` page rather than doing a full page reload.

This means a child application does not need to know about other pages in the
system. In an iframe with `preventLinkClicks: true`, an ordinary
`<a href="/demo/step-2">` is intercepted and classified. Use `AutoRouterLink`
when the same navigation must work in both page engines.
