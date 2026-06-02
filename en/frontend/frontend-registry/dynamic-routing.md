# Dynamic Routing

The Web Host's router is not statically configured. At startup it fetches the current set of page mount routes from the backend and adds them to the Vue Router instance. This means a new `view.page` entry with a `mountRoute` claim takes effect without any change to the Web Host bundle itself.

![Mount route sync](../diagrams/mountroute-sync.svg)

## Mount Route Sync at Startup

When the Web Host application initialises, before it renders any navigation, it calls:

```
GET /api/v2/views/pages/routes
```

The response is a list of objects, one per `view.page` entry that has a `mountRoute` field. For each entry in the list, the host calls `router.addRoute()` to register a Vue Router route that maps the declared path to the page's iframe loader component.

```typescript
// Simplified from the Web Host bootstrap
const routes = await api.get('/api/v2/views/pages/routes')
for (const route of routes) {
  router.addRoute({
    path: route.mountRoute,
    component: PageFrameLoader,
    props: { pageId: route.name },
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

`mountRoute` uses Vue Router 4 path syntax. The wildcard segment `:part(.*)*` lets the child application manage its own sub-routes (e.g. `/home/settings`, `/home/profile/edit`) while the host owns the `/home` prefix.

Two entries must not claim overlapping routes. If they do, the first one registered wins and the second's mount route is silently ignored.

## The URL Sync Loop

Once a page is loaded in its iframe, the child application navigates internally using its own router. Those internal navigations need to be reflected in the host's URL bar so that the browser's back button, bookmarks, and copy-URL all work correctly. This is done through a PostMessage pair.

![Frontend Registry](../diagrams/frontend-registry.svg)

### Child → Host: `CmdRouteChanged`

When the child application's router commits a navigation (e.g. the user moves from `/home/settings` to `/home/profile`), the child posts a message to its parent window:

```typescript
// Posted by the child application on internal route change
window.parent.postMessage({
  type: 'CmdRouteChanged',
  path: '/home/profile',   // full path including the mount prefix
}, '*')
```

The host's message handler intercepts this, calls `router.replace(path)` to update the URL bar without triggering a full navigation, and then posts back:

### Host → Child: `UrlWasUpdatedInParent`

After the host updates its URL bar, it notifies the child so the child can confirm or reconcile:

```typescript
// Posted by the host back to the child iframe after URL bar update
iframeWindow.postMessage({
  type: 'UrlWasUpdatedInParent',
  path: '/home/profile',
}, '*')
```

The child listens for this message via the `@history` event channel and treats it as confirmation that the host's URL is now consistent with the child's internal state.

The round-trip keeps the host URL bar, the child router, and the browser history entry in sync without the host needing to know anything about the child's internal routing structure.

## `classifyLink`

When a page has `preventLinkClicks: true` in its proxy injections (see [view.page](./view-page.md)), the host intercepts `<a>` clicks inside the iframe before the browser handles them. Each intercepted link is passed to `classifyLink`, which decides how to handle it:

| Classification | Condition | Action |
|---|---|---|
| `spa` | Target path matches a known `mountRoute` | Host performs a Vue Router SPA navigation, loads the target page's iframe |
| `reload` | Target path is within the current page's iframe but not a known mount route | Host reloads the current iframe to the new path |
| `external` | Target is a different origin, or starts with `http://`/`https://` | Host opens the URL in a new tab |

`classifyLink` consults the same routes list fetched at startup. A link to `/demo/step-2` is classified as `spa` because `/demo/:part(.*)*` is a registered mount route — the host navigates to the `iframe-demo` page rather than doing a full page reload.

This means a child application does not need to know about other pages in the system. It can render ordinary `<a href="/demo/step-2">` links and the host's link classifier handles the navigation correctly.
