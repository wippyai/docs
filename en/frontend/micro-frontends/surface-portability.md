---
title: "Surface Portability"
description: "Use container queries, surface variables, and host.surface to size view.page applications independently of the browser viewport."
---

# Surface Portability

**Classification: rendering contract reference with focused examples.** The
CSS, JavaScript, and package metadata blocks illustrate individual contract
rules; they are not a complete application fixture.

A micro frontend app receives a **surface**: the rectangular area the Web Host allocates to it. That area is usually **not** the browser window. The app may be one panel among several in a [multi-panel layout](../web-host/multi-panel-layout.md), and the same app may be rendered by either [render engine](../web-host/render-engines.md) at different sizes on the same screen.

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

They must also stay **unregistered**. Do not describe them with `@property` or `CSS.registerProperty()`. The host marks the block axis unavailable by assigning a guaranteed-invalid value, which computes to the empty string only while the property is unregistered. Give one an `initial-value` and it computes to that instead, so a content-sized app reports itself as container-sized and `supports('block-size')` starts returning `true` — with no error anywhere.

Two caveats before comparing these values to `100cqw` pixel-for-pixel. The **first frame can be wider**: the boot value is seeded from the host-side `<iframe>` element before the app's document exists, so it cannot know whether the content will raise a scrollbar. That value is baked into the document's CSS, so the first layout uses it and is corrected one frame later. And values are **quantized to 1/64 px**, so compare with a tolerance.

## Container sizing and content sizing

| | Inline axis | Block axis |
|---|---|---|
| **Container sizing** — the host imposes both dimensions | available | available |
| **Content sizing** — the app's content decides the height | available | **not available** |

In content sizing the height properties are deliberately invalid, so `var(--wippy-surface-height, 400px)` falls back rather than reporting a number, and `@container wippy-surface (min-height: …)` never matches.

**Which one an app gets is not the author's choice**, and nothing in `package.json` changes it. Sizing is set by *where the Web Host renders the app*:

| Rendered as | Sizing |
|---|---|
| a routed page, a layout panel, the right panel, a registry tab | **container** |
| an embedded artifact, an inline artifact block, a navbar widget | **content** |

So the same package is container-sized on its own route and content-sized when someone embeds it. An app that needs the block axis must therefore tolerate not having it, or declare the requirement (below) so it is refused rather than rendered broken. Read the current mode with `host.surface.snapshot.sizing`, and gate behavior on `host.surface.supports('block-size')` — never assume.

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

Sizing an overlay is a different question from anchoring it. For a backdrop or drawer that should cover exactly the surface, drop viewport units and use `inset: 0` — but pair it with the positioning scheme that matches how portable the app must be:

```css
/* Portable across BOTH engines: resolves against the app's own root rather
   than against whatever `fixed` happens to be relative to.
   `min-block-size: 100%` is load-bearing — see below. */
.app-root { position: relative; min-block-size: 100%; }
.backdrop { position: absolute; inset: 0; }
```

The containing block is the **app's root**, not the surface, so the overlay covers the surface only if that root does. In content sizing it does automatically (the content *is* the height). In container sizing the host imposes a height on the query box that the app's root does not inherit, so without `min-block-size: 100%` the backdrop stops short even though the `fixed` version would cover the surface. The two also differ in behavior: `absolute` scrolls with the content, while `fixed` stays pinned.

Put `min-block-size: 100%` on the **outermost** element inside the surface. A percentage height needs an unbroken chain of definite heights above it, so applying it to a component root nested inside an auto-height `#app` resolves to zero and reintroduces the same gap. Verified across Chromium, Firefox and WebKit, with the no-`min` case as a control.

```css
/* Iframe engine only. `fixed` resolves against the child viewport, which IS
   the surface there — but against the HOST WINDOW in the fragment engine,
   where this covers the whole application instead of the panel. */
.backdrop { position: fixed; inset: 0; }
```

Avoid `var(--wippy-surface-height)` for this: it is unavailable in content sizing, so a backdrop written that way collapses on content-sized pages.

## The app root element (`#app`)

**The Web Fragment engine requires your root element to be `id="app"`.** Not
`#root`, not `#main`, not `<main>` — the id is matched literally.

The engine binds the page height chain to that selector and measures your
content height through it. The reflected document exposes `wf-html`/`wf-body`
rather than `html`/`body`, so you cannot build the chain from the document root
the way you can inside an iframe.

**Symptom when it is wrong:** a content-sized fragment page whose root is
`#root` (or anything else) renders at **zero height** — blank panel, no error in
your own code. The host logs an error naming the requirement. The iframe engine
is unaffected, because it takes height from `CmdBodySize`, so the same package
may appear correct there and be blank as a fragment.

```html
<!-- correct -->
<body><div id="app"></div></body>
```

```js
createApp(App).mount('#app')
```

**Do not try to fix a zero-height fragment by giving `#root` a height.** Adding
`height: 100%`, `min-height: 100dvh` or `100vh` to a differently-named root does
not make the engine measure it. Viewport units describe the browser window, not
the allocated surface.
Rename the element to `app` instead.

## Limitations

- **Body box.** In the iframe engine the host zeroes `margin`, `padding` and `border` on the app's `body` so the allocated surface is well defined. Put page padding on your own root element. The fragment engine does not do this, so an app relying on body padding renders slightly differently between engines. There is no build-time diagnostic for this yet.
- **`body > *` selectors, and rules targeting `html`/`body`.** In the **iframe** engine the host wraps body content in the surface box, so direct-child selectors rooted at `body` no longer match app elements, and `body`/`html` become *ancestors* of the query box — a `@container` rule targeting them never applies. The **fragment** engine has the opposite topology (the query box sits above the reflected tree), but a literal `body` selector still fails there because the reflected document is renamed `wf-html`/`wf-body`. Put such rules on your own root element inside the surface; that is correct in both engines.
- **Anything rendered through `<w-iframe>` / `<w-artifact>` gets no surface — including a top-level managed panel.** These elements always build their child document with the surface bootstrap disabled and nothing measures them, so `host.surface` reports `width: 0` and `sizing: 'content'` — but with `engine: 'iframe'`, not `engine: 'host'`. Check `snapshot.width` rather than `engine` if your component can be embedded that way. That is expected for a *nested* embed; it is easy to miss for a managed layout panel declared as `{ kind: 'component', tagName: 'w-artifact' }`, which is a full-size top-level slot yet still gets no contract. Use `kind: 'page'` for content that needs one.
- **No block axis in content sizing.**
- **Fragment root selector.** Fragment apps must mount at `#app`; see [The app root element (`#app`)](#the-app-root-element-app) for the height-chain requirement and zero-height symptom.
- **The deprecated `/page/:id` route gets no surface.** It renders into a bare iframe that never measures anything, so it opts out completely — no query box, no wrapper, no change to the app's DOM. An app behaves there exactly as it did before this contract existed. Use `/c/:id` to get a surface. Like nested embeds, it still reports `engine: 'iframe'`, so test `snapshot.width` rather than the engine name.
- **The two engines can differ by a scrollbar.** The iframe engine measures the inline axis from the query box *inside* the app's document, so a document scrollbar narrows it. The fragment engine measures a host-document wrapper, which the reflected content's scrolling does not narrow. Same allocated panel and scrolling content: the fragment engine reports the slightly wider number.
- **Not an isolation boundary.** The contract governs layout. It does not give a fragment an independent document, viewport, selection, top layer, or origin.

## Migration

[Surface Migration](./surface-migration.md) has recipe-by-recipe conversions for existing apps, each labelled automatic, conditional, manual, or not convertible.
