---
title: "Web Components (view.component)"
description: "A view.component entry describes a reusable custom element (web component) that the Web Host can discover, inject, and register automatically. Unlike a…"
---

# Web Components (view.component)

A `view.component` entry describes a reusable custom element (web component) that the Web Host can discover, inject, and register automatically. Unlike a page, a component has no iframe of its own — it is a custom HTML tag that can appear anywhere a page's or host's template places it.

For guidance on writing the component implementation, see [Web Component](../micro-frontends/web-component.md).

## Frontend Fields (package.json wippy block)

These fields are authored by the FE developer in the `wippy` block of `package.json`. The vite plugin bakes them into `wippy-meta.json` at build time, and `wippy/views` reads them from there as defaults.

> **All fields in this section can be overridden by the operator in `_index.yaml`. YAML always takes precedence.**

| Field | Type | Default | Description |
|---|---|---|---|
| `type` | string | — | Must be `"component"` or `"widget"`; `"widget"` is the template convention |
| `tagName` | string | — | Custom element name; must contain a hyphen per the HTML spec |
| `props` | object | — | JSON Schema describing the component's accepted attributes |
| `events` | object | — | JSON Schema describing the custom DOM events the component emits |

### `wippy.type` in `package.json`

Web component packages set `"type": "widget"` or `"type": "component"` (not `"page"`) inside their `wippy` block. The app-template currently uses `"widget"`, and the vite plugin accepts both component names for this runtime contract.

```json
{
  "specification": "wippy-component-1.0",
  "wippy": {
    "tagName": "example-reaction-bar",
    "type": "widget",
    "props": { ... },
    "events": { ... }
  }
}
```

At deploy time the operator's YAML `meta.tag_name` is authoritative and overrides the bundled value; `wippy.tagName` (baked into `wippy-meta.json` from `package.json`) is only the fallback `wippy/views` uses when the YAML entry omits `tag_name` (resolution order: YAML `meta.tag_name` → bundled `wippy.tagName`). Keep the two in sync to avoid surprises, but the YAML wins if they differ.

### Props Schema

The `wippy.props` key in `package.json` is a JSON Schema object describing the component's accepted attributes. The vite plugin includes it in `wippy-meta.json`, and the Web Host uses it when exposing component metadata to consumers such as the chat artifact renderer and the tag sanitizer (which needs to know which attributes are legitimate so it doesn't strip them).

```json
{
  "wippy": {
    "props": {
      "type": "object",
      "properties": {
        "reactions": {
          "type": "array",
          "items": { "type": "string" },
          "default": ["👍", "👎", "❤️", "🎉", "🤔"],
          "description": "Array of emoji reactions to display"
        },
        "allow-multiple": {
          "type": "boolean",
          "default": false,
          "description": "Whether multiple reactions can be active simultaneously"
        }
      }
    }
  }
}
```

Attribute names in `properties` use the HTML attribute convention (kebab-case). The schema's `default` values are also applied at runtime by the web-component prop parser when an attribute is absent.

### Events Schema

The `wippy.events` key mirrors the props shape but describes custom DOM events the component emits via `useEvents()`. Each key is an event name; the value is a JSON Schema for the event's detail payload.

```json
{
  "wippy": {
    "events": {
      "type": "object",
      "properties": {
        "reaction": {
          "type": "object",
          "properties": {
            "emoji": { "type": "string" },
            "count": { "type": "number" },
            "active": { "type": "boolean" }
          },
          "description": "Fired when a reaction is toggled"
        }
      }
    }
  }
}
```

The Web Host's chat message sanitizer allowlists component attributes from `props.properties` in `wippy-meta.json`. Event schemas document emitted custom events for tooling and consumers; they are not used to allow DOM event listener attributes through sanitized chat content.

## Operator Configuration (_index.yaml)

These fields are set by the operator in the `meta` block of the `_index.yaml` registry entry. Most represent pure deployment policy — routing, access control, and serving — that only makes sense at deploy time and has no `package.json` authoring surface (`announced`, `secure`, `url`, `auto_register`). Two fields, `tag_name` and `entry_point`, are different: they are **FE-authored** in `package.json` (baked into `wippy-meta.json`) and the YAML keys are only **optional per-deployment overrides** of those bundled values.

> **`announced`, `secure`, `url`, and `auto_register` are pure deployment policy and cannot be set in package.json — they are set by the operator for each environment. `tag_name` and `entry_point` are FE-authored defaults that the operator may override in YAML.**

| Field | Type | Default | Description |
|---|---|---|---|
| `tag_name` | string | `wippy.tagName` | FE-authored as `wippy.tagName` in `package.json` (required by the vite plugin); the YAML key overrides the bundled value. Custom element name; must contain a hyphen per the HTML spec |
| `announced` | boolean | `false` | Must be `true` for the component to appear in `/api/public/components/list`. Falls back to `meta.public` if that is set. |
| `auto_register` | boolean | `false` | `true` → Web Host autoloads and registers the component at startup |
| `secure` | boolean | `false` | Requires authentication |
| `url` | string | — | Static mount path for the component's built bundle |
| `base_path` | string | `""` | Optional subpath appended to `url` to form the project root; the resolved bundle URL composes as `<url>/<base_path>/<entry_point>`. Honored identically to pages, though current app-template component entries omit it |
| `entry_point` | string | `wippy.browser` → `index.js` | FE-authored as the top-level `browser` field in `package.json` (baked into `wippy-meta.json`); the YAML key overrides the bundled value, falling back to `index.js`. Entry module file; the host injects this as a `<script type="module">` |

A minimal entry looks like this:

```yaml
- name: reaction-bar
  kind: registry.entry
  meta:
    type: view.component
    name: reaction-bar
    tag_name: example-reaction-bar
    announced: true
    secure: false
    auto_register: true
    url: /app/wc/reaction-bar
    entry_point: index.js
```

## The Three Gates for Autoload

For the Web Host to autoload a component, all three conditions must hold simultaneously:

1. **`announced: true`** — `wippy/views` filters by this flag server-side in `list_components.lua`. There is no query parameter to bypass it. A component with `announced: false` never appears in `/api/public/components/list` regardless of any other setting.

2. **`auto_register: true`** — the host's `loadGlobalAutoloadWidgets` function queries the list endpoint with `?auto_register=true`. Components without this flag are excluded from that filtered response.

3. **The tag is not yet registered** — before injecting the script, the host checks `customElements.get(tagName)`. If the tag is already defined (e.g. from a previous navigation), the host skips the injection to avoid double-defining.

If any gate is missing the component is silently absent. To verify: `curl /api/public/components/list?auto_register=true` — your tag must appear in the response.

## The Autoload Sequence

When a page inside the Web Host finishes mounting, the host runs the following sequence:

1. `GET /api/public/components/list?auto_register=true` — fetches all announced, auto-registering components.

2. For each component whose `customElements.get(tagName)` is `undefined`, the host appends to `document.head`:

   ```html
   <script type="module" src="/app/wc/reaction-bar/index.js?declare-tag=example-reaction-bar"></script>
   ```

   The `?declare-tag=` query parameter is the channel that tells the entry chunk which custom element name to register under.

3. The entry chunk calls `define(import.meta.url, ElementClass)`. Component authors import `define` from `@wippy-fe/webcomponent-vue` (or `@wippy-fe/webcomponent-core`), which re-export the proxy's `define`; at runtime the import map resolves it to the single `@wippy-fe/proxy` instance. The `define` helper reads `new URL(import.meta.url).searchParams.get('declare-tag')` and calls `customElements.define(tagName, ElementClass)`.

4. Vue (or any framework) renders a `<example-reaction-bar>` element. The browser upgrades the element, `connectedCallback` fires, and `WippyVueElement` mounts its Vue app inside a shadow root.

## Why `auto_register: false` Is Useful

Setting `auto_register: false` excludes the component from the global autoload sweep. This is appropriate when:

- The component is large and should only load on pages that explicitly need it.
- The component is registered programmatically via `loadByTagName('example-heavy-chart')` (imported from `@wippy-fe/proxy`) at the call site.
- The component is an internal building block used only within another bundle, not as a standalone custom element.

```ts
import { loadByTagName } from '@wippy-fe/proxy'

await loadByTagName('example-heavy-chart')
```

Lazy registration lets the initial page load stay lightweight. The component still needs `announced: true` for `loadByTagName()` to resolve it through the API — the `GET /components/by-tag/{tag}` endpoint returns `404 "Component is not announced"` when the flag is `false`.
