# Dynamic Routing

The Web Host's router is not statically configured. At startup it fetches the current set of page mount routes from the backend and adds them to the Vue Router instance. This means a new `view.page` entry with a `mountRoute` claim takes effect without any change to the Web Host bundle itself.

![Mount route sync](../diagrams/mountroute-sync.svg)

## Mount Route Sync at Startup

When the Web Host application initialises, before it renders any navigation, it calls:

```
GET /api/public/pages/routes
```

The response is an envelope `{ success, count, routes }`, where `routes` is a map of `mountRoute` pattern → page id (it includes hidden/unannounced pages that still claim a URL). For each entry, the host registers a Vue Router route that maps the declared path to the page loader component, adding it as a child of the `'app'` parent route.

```typescript
// Simplified from the Web Host bootstrap
const { routes } = await api.get('/api/public/pages/routes')
for (const [mountRoute, pageId] of Object.entries(routes)) {
  router.addRoute('app', {
    path: mountRoute,
    component: MountRoutePage,
    props: () => ({ pageId }),
  })
}
```

After this point, navigating to `/home/anything` causes the router to render the `main` page's iframe, and navigating to `/demo/anything` causes the router to render the `iframe-demo` page's iframe — without any hard-coded knowledge of those paths in the host bundle.

## Claiming a Path with `mountRoute`

A `view.page` entry claims a host router path by setting `mountRoute` in its `_index.yaml` `meta` block:

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
    mountRoute: /home/:part(.*)*
    ...
```

`mountRoute` accepts only the catch-all forms `/:part(.*)*` (root) or `/<literal-prefix>/:part(.*)*`, where the prefix is one or more lowercase-alphanumeric-plus-hyphen literal segments ending in the required `:part(.*)*` wildcard. Arbitrary Vue Router patterns — named params, custom regex, or different param names (e.g. `/home/:id`, `/users/:userId(\d+)`) — are rejected: the host raises a `syntax` mount-route conflict, the backend's `validate_mount_route_syntax` fails, and `GET /api/public/pages/routes` returns HTTP 500 (rendered as a fatal fullscreen error). The wildcard segment `:part(.*)*` lets the child application manage its own sub-routes (e.g. `/home/settings`, `/home/profile/edit`) while the host owns the `/home` prefix.

Two entries must not claim the same route. If two `view.page` entries claim the **same** `mountRoute`, the backend validator (`validate_mount_routes` in `page_registry.lua`) records a duplicate-route conflict in the same issues list as syntax errors, so `GET /api/public/pages/routes` returns HTTP 500 and the Web Host renders a fatal fullscreen `<wippy-error>` — exactly like a malformed `mountRoute`. It is **not** silently ignored.

The only first-wins behavior is Vue Router runtime priority between a root catch-all (`/:part(.*)*`) and a more-specific system route (`chat`, `c`, `web`, `page`, `keeper`, `login`, `logout`) or a longer literal-prefix mount — the more-specific route matches first. That is route-resolution precedence, not duplicate-route handling.

## The URL Sync Loop

Once a page is loaded in its iframe, the child application navigates internally using its own router. Those internal navigations need to be reflected in the host's URL bar so that the browser's back button, bookmarks, and copy-URL all work correctly. This is done through a PostMessage pair.

![Frontend Registry](../diagrams/frontend-registry.svg)

### Child → Host: `CmdRouteChanged`

When the child application's router commits a navigation (e.g. the user moves from `/home/settings` to `/home/profile`), the child posts a message to its parent window:

```typescript
// In the child application, on internal route change.
// App code must never post these messages directly — use the proxy API:
import { host } from '@wippy-fe/proxy'

host.onRouteChanged('/profile', navId)   // internal route only; the host prepends the mount prefix. navId is an optional number
```

Under the hood this serializes to the `@gen2-chat` wire envelope:

```typescript
window.parent.postMessage(JSON.stringify({
  type: '@gen2-chat',
  action: 'cmd-route-changed',
  internalRoute: '/profile',   // the child's internal route only — the host prepends the mount prefix
  navId,
}), '*')
```

The host's message handler intercepts this, calls `router.push(path)` to update the URL bar via an SPA route change (adding a browser-history entry) without triggering a full page reload, and then posts back:

### Host → Child: `UrlWasUpdatedInParent`

After the host updates its URL bar, it notifies the child so the child can confirm or reconcile:

```typescript
// Posted by the host back to the child iframe after URL bar update
iframeWindow.postMessage(JSON.stringify({
  type: '@gen2-chat',
  action: 'url-was-updated-in-parent',
  path: '/profile',   // the child's OWN internal route (the mount tail) — not the full host path
}), '*')
```

The host sends back the child's **internal** route (the sub-path after the mount prefix), not the full host path — so the round-trip is symmetric: the child posts `internalRoute: '/profile'`, the host sets its URL bar to `/home/profile`, and echoes `path: '/profile'` back, which the child's memory router pushes verbatim. The child listens via the `@history` event channel and treats it as confirmation that the host's URL is now consistent with its internal state.

The round-trip keeps the host URL bar, the child router, and the browser history entry in sync without the host needing to know anything about the child's internal routing structure.

## `classifyLink`

When a page has `preventLinkClicks: true` in its proxy injections (see [view.page](./view-page.md)), the host intercepts `<a>` clicks inside the iframe before the browser handles them. Each intercepted link is passed to `classifyLink`, which decides how to handle it:

| `LinkKind` | Condition | Action |
|---|---|---|
| `host-nav` | Top path segment matches a known `mountRoute` literal, a baked-in system route (`chat`, `c`, `web`, `page`, `keeper`, `login`, `logout`), or a root-mount catch-all | `preventDefault` + `host.navigate(normalizedPath)` |
| `child-nav` | The iframe's own router resolves the path to a real (non-catch-all) route, or nothing else has claimed it | The subapp's `RouterLink` decides in-app; the host does NOT `preventDefault` and does NOT reload the iframe |
| `external` | Different origin, or a non-`http` scheme (`javascript`/`mailto`/`tel`/`sms`/`ftp`/`file`/`data`/`blob`) | Browser default (e.g. opens in a new tab) |
| `ignore` | Empty `href` or a pure hash (`#…`) | `preventDefault` |

The classifier checks the iframe's own local router first, so a link the child can resolve itself stays in-app.

`classifyLink` consults the same routes list fetched at startup. A link to `/demo/step-2` is classified as `host-nav` because `/demo/:part(.*)*` is a registered mount route — the host navigates to the `iframe-demo` page rather than doing a full page reload.

This means a child application does not need to know about other pages in the system. It can render ordinary `<a href="/demo/step-2">` links and the host's link classifier handles the navigation correctly.
