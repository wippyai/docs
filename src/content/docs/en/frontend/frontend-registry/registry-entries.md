---
title: "Registry Entries"
---

# Registry Entries

A registry entry is how the Wippy backend declares a frontend artifact — either a micro frontend app or a reusable web component — so the Web Host can discover and serve it. This document explains the contract between a module's `_index.yaml`, its `package.json` `wippy` block, and the `wippy-meta.json` file that connects them.

For the `wippy/views` module setup that processes these entries at runtime, see [Views](../../framework/views.md).

## What a Registry Entry Is

Every frontend artifact is declared as a `registry.entry` in the module's `_index.yaml`. The `kind: registry.entry` marker tells the Wippy registry that this entry carries metadata consumed by other modules rather than defining a Lua component directly.

> **Common trap:** `view.page` and `view.component` are **not** `kind` values. Always write `kind: registry.entry` and put the frontend artifact type in `meta.type`. `kind: view.page` and `kind: view.component` are invalid shapes.

Minimal correct shape:

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
```

```yaml
version: "1.0"
namespace: app.views

entries:
  - name: main
    kind: registry.entry
    meta:
      type: view.page
      name: main
      title: Admin Panel
      icon: tabler:layout-dashboard
      order: 0
      announced: true
      secure: false
      url: /app
      base_path: app/main
      entry_point: app.html
      mountRoute: /home/:part(.*)*
```

The `meta` block is what `wippy/views` reads. The `meta.type` field discriminates between the two supported artifact kinds.

## The `meta.type` Discriminator

| Value | Meaning |
|---|---|
| `view.page` | A micro frontend app (full SPA), rendered in an iframe inside the Web Host |
| `view.component` | A Web Component (custom element) that can be embedded anywhere in a page |

Every other field in `meta` is interpreted in the context of this type. Fields that apply to one type and not the other are described in the per-type reference pages ([view.page](./view-page.md), [view.component](./view-component.md)).

## The `specification` Marker

Every frontend package that participates in the registry declares `"specification": "wippy-component-1.0"` at the top level of its `package.json`. This string is the handshake that tells Wippy (and tooling) that this package follows the wippy-component contract — it has a `wippy` block with a known shape, and it was built with `@wippy-fe/vite-plugin`.

```json
{
  "name": "@wippy/app-main",
  "version": "1.0.0",
  "specification": "wippy-component-1.0",
  "wippy": { ... }
}
```

The presence of `specification` does not change runtime behavior, but `wippy/views` uses it when validating entries loaded from the registry.

## The `wippy-meta.json` Contract

`@wippy-fe/vite-plugin` emits a `wippy-meta.json` file alongside the built bundle. This file is the canonical source of truth for the artifact's runtime metadata: its props schema, events schema, title, icon, and proxy injection settings.

Short answer for agents and tooling:

- **Who emits it:** `wippyPagePlugin()` for `view.page` apps and `wippyComponentPlugin()` for `view.component` web components.
- **Who authors it:** nobody hand-authors `wippy-meta.json`; the vite plugin generates it from `package.json`.
- **Who consumes it:** `wippy/views` reads it from the served bundle root when building page/component descriptors and API responses.
- **What YAML does:** `_index.yaml` remains authoritative for deployment policy and any field it explicitly overrides.

When `wippy/views` loads a `registry.entry`, it reads `wippy-meta.json` from the artifact's served bundle root. For pages, that root is the page `url + base_path`; for web components, the current entries serve the component directly from `url`. YAML always wins: `_index.yaml` takes precedence for every field it declares. `wippy-meta.json` provides the defaults that `wippy/views` reads when no YAML override is present for a given field. Deployment-policy fields — `announced`, `secure`, `url`, `mountRoute`, and `base_path` — must be set in `_index.yaml` because they express operator decisions rather than component authorship; there is no `package.json`/`wippy-meta.json` authoring surface for them. (`base_path` is honored for both pages and components; the current app-template component entries simply omit it.)

By contrast, `entry_point` is FE-authored *and* YAML-overridable. It is baked into `wippy-meta.json` from the package's `wippy` block — `wippy.path` for pages (which `@wippy-fe/vite-plugin` **requires**; omitting it makes the plugin throw `wippy.path is required for a page package`) or `wippy.tagName`/`browser` for components. The `meta.entry_point` field in `_index.yaml` is an optional per-deployment override on top of that authored default; it is not a YAML-only field.

This split means a component author writes display metadata once in `package.json`'s `wippy` block, and the vite plugin bakes it into `wippy-meta.json` at build time as author defaults. The operator who deploys the component sets routing and access policy in YAML, and can override any display-level field there too.

## Common Fields

These fields appear in the `meta` block for both `view.page` and `view.component` entries.

| Field | Type | Default | Description |
|---|---|---|---|
| `type` | string | — | `view.page` or `view.component` (required) |
| `name` | string | entry name | Identifier used in API responses |
| `title` | string | — | Human-readable display name |
| `icon` | string | — | Iconify reference, e.g. `tabler:layout-dashboard` |
| `announced` | boolean | — | Controls visibility in listing APIs; semantics differ by type (see below) |
| `secure` | boolean | `false` | Requires authentication to access |
| `url` | string | — | Base URL prefix for static file serving (CDN origin or local mount path) |
| `entry_point` | string | `index.html` / `index.js` | Entry file name within the static directory |

### `announced` Semantics by Type

The `announced` flag has different consequences depending on `meta.type`:

- **`view.page`**: controls whether the page appears in the navigation sidebar (`GET /api/public/pages/list`). Setting `announced: false` hides the page from navigation but the page still loads if accessed directly. This is a legitimate pattern for embedded or auxiliary pages.

- **`view.component`**: gates inclusion in `GET /api/public/components/list`. If `announced: false`, the component is excluded from that endpoint entirely, which means the Web Host never injects its script tag and `customElements.get(tagName)` stays undefined. For components that need autoload, `announced: true` is required — see [view.component](./view-component.md) for details.

## How Serving Fields Combine

For micro frontend apps, the three fields compose to produce the HTML URL the Web Host loads:

```
<url>/<base_path>/<entry_point>
```

For example, with `url: /app`, `base_path: app/main`, `entry_point: app.html`, the host fetches `/app/app/main/app.html`.

The separation between `base_path` and `entry_point` is intentional. The Web Host injects `<url>/<base_path>/` as an HTML `<base>` tag into the loaded page, which governs how the browser resolves all relative URLs inside that page. The entry file may sit in a subdirectory of the base — what matters is that the base points to the common root from which all resources can be reached relatively.

For example, if a bundle has this layout:

```
static/
  shared/
    vendor.js
  app/
    index.html    ← entry_point: app/index.html
    app.js
```

and `index.html` references `../shared/vendor.js`, then `base_path` must point to `static/` (the directory containing both `app/` and `shared/`), not to `app/`. Setting `base_path: app` would make `../shared/vendor.js` resolve outside the served directory and 404.

In the common case where all assets sit alongside the entry file, `base_path` and the directory containing `entry_point` are the same level, so the distinction is invisible. It only matters when a bundle shares resources across sibling directories.

For web components, the host composes the served URL the same way:

```
<url>/<base_path>/<entry_point>
```

The current app-template component entries omit `base_path`, but it is supported and composes the same way (`<url>/<base_path>/<entry_point>`) — so in those entries the URL collapses to `<url>/<entry_point>`. The difference from pages is that a component is injected as a `<script type="module">` rather than getting its own injected HTML `<base>` tag.
