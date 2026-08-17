# Surface Portability

A micro frontend app is given a **surface** — the rectangular area the Web Host allocates to it. That area is usually **not** the browser window: the app may be one panel among several in a [multi-panel layout](../web-host/multi-panel-layout.md), and the same app may be rendered by either [render engine](../web-host/render-engines.md) at different sizes on the same screen.

Sizing a layout to the window is therefore wrong in both engines. The surface contract gives you a portable alternative in CSS and in JavaScript.

> **Status:** contract 1, shipped. Tailwind `surface-*` variants, host-mediated scrolling, and deep hit testing are **not yet shipped**; this page documents only what exists today.

## The CSS contract

### Container queries

The host names the app's box `wippy-surface`, so it can be queried like any CSS container:

```css
@container wippy-surface (min-width: 640px) {
  .sidebar { display: block; }
}
```

Use this instead of `@media (min-width: 640px)` for anything that responds to the space the app occupies. Native container units resolve against the same box:

```css
.hero { inline-size: 50cqw; }
```

### Surface variables

Four custom properties carry the geometry as plain pixel lengths:

| Property | Meaning |
|----------|---------|
| `--wippy-surface-width` | full surface width |
| `--wippy-surface-width-unit` | 1% of the surface width |
| `--wippy-surface-height` | full surface height (container sizing only) |
| `--wippy-surface-height-unit` | 1% of the surface height (container sizing only) |

They are the portable replacement for `vw` / `vh`:

```css
/* was: inline-size: 50vw */
.panel { inline-size: calc(var(--wippy-surface-width-unit) * 50); }
```

The values inherit, so any element in the app can read them. They report the query box's **content box**, which is the same box `100cqw` resolves against.

Applications must **not** declare or assign these four names. A descendant declaration shadows the inherited value and silently unpins the app from the surface.

## Container sizing and content sizing

| | Inline axis | Block axis |
|---|---|---|
| **Container sizing** — the host imposes both dimensions | available | available |
| **Content sizing** — the app's content decides the height | available | **not available** |

In content sizing the height properties are deliberately invalid, so `var(--wippy-surface-height, 400px)` falls back rather than reporting a number, and `@container wippy-surface (min-height: …)` never matches.

`cqh` behaves worse than "unavailable": container units fall back to the **small viewport** when no container supplies the axis they need, so `cqh` silently produces a plausible number unrelated to the surface. Prefer `var(--wippy-surface-height, <fallback>)`, which is root-pinned and visibly falls back. The same trap appears inside an app that declares `container-type: inline-size` on an intermediate element and then uses `cqh` below it.

## Declaring requirements

Optional, in the app's `package.json`:

```json
{
  "wippy": {
    "path": "index.html",
    "surface": {
      "contract": 1,
      "requirements": ["block-size"]
    }
  }
}
```

Accepted tokens are `block-size` and `surface-scroll`, both of which require container sizing and are rejected when the instance is content-sized. `registered-hit-testing`, `native-document-hit-testing` and `owner-visibility` are reserved vocabulary and are rejected as unimplemented rather than silently ignored.

Validation runs before startup, so an unsatisfiable declaration fails visibly instead of rendering an app whose block-axis queries never match. An app without a `surface` block still renders and still receives the query box and variables; it simply advertises no portability.

`surface-scroll` is accepted and reported by `supports()`, but this release ships **no** host-mediated scroll API — declaring it asserts an intent, it does not unlock a method.

## Reading the surface from JavaScript

See [Proxy API → Surface](./proxy-api.md#surface) for the full signature.

```js
const { width, widthUnit, height, sizing } = host.surface.snapshot

if (host.surface.supports('block-size')) {
  // safe to rely on the block axis
}

const off = host.surface.onChange((s) => reposition(s.width, s.height))
// call off() on teardown
```

The snapshot is read back out of the same computed custom properties the CSS resolves, so it cannot drift from what `@container` and `cqw` see.

Prefer CSS for layout. Reach for the JavaScript API where CSS cannot go: canvas sizing, virtualization maths, resource selection, and styles generated at runtime.

### `engine: 'host'`

`host.surface.engine` reports `iframe`, `fragment`, or `host`. The last is not a page engine — it means the code is running where no surface was allocated:

- a web component mounted directly into the host document rather than into a page;
- the standalone dev proxy, with no Web Host at all.

There, the snapshot reports `width: 0`, `height: null`, `sizing: 'content'`, and `supports()` is `false` for everything. That is deliberate: substituting the browser window would be the false equivalence the contract exists to avoid. A directly-mounted component should measure its own root instead.

## What the contract does not cover

Container queries replace media queries in **CSS**. These mechanisms live outside CSS and keep following the browser window:

| Mechanism | Why | What to do |
|---|---|---|
| `<picture>` / `<source media>` | HTML resource selection; no container-query form | Drive from `host.surface.onChange`, or move art direction to a CSS `background-image` under `@container` |
| `srcset` + `sizes` | resolve against the viewport | Derive `sizes` from the surface, or set the source from JS |
| `matchMedia()` | asks the window by definition | Use `host.surface.onChange` for geometry; keep `matchMedia` for preferences |

## Overlays

The surface contract does **not** capture `position: fixed`. `container-type` establishes an independent formatting context without layout containment, so a query container computes `contain: none` and anchors nothing. PrimeVue overlays and hand-rolled fixed overlays both keep working, unchanged.

Engine behavior is a separate matter: in the Web Fragment engine `position: fixed` resolves against the **host window** rather than the app's panel. See [Render Engines](../web-host/render-engines.md) and pin the app with `wippy.renderEngine: "iframe"` if exact viewport anchoring matters.

## Limitations

- **Body box.** In the iframe engine the host zeroes `margin`, `padding` and `border` on the app's `body` so the allocated surface is well defined. Put page padding on your own root element. The fragment engine does not do this, so an app relying on body padding renders slightly differently between engines. There is no build-time diagnostic for this yet.
- **`body > *` selectors.** The host wraps body content in the surface box, so direct-child selectors rooted at `body` no longer match app elements — and `body`/`html` are **ancestors** of the query box, so a `@container` rule targeting them never applies.
- **No block axis in content sizing.**
- **Not an isolation boundary.** The contract governs layout. It does not give a fragment an independent document, viewport, selection, top layer, or origin.

## Migration

[Surface Migration](./surface-migration.md) has recipe-by-recipe conversions for existing apps, each labelled automatic, conditional, manual, or not convertible.
