---
title: "Surface Migration"
description: "Recipes for converting viewport-based responsive rules to the Wippy surface contract."
---

# Surface Migration

**Classification: partial migration recipe collection.** Each before/after
block converts one isolated pattern. Apply the decision tree to the complete
stylesheet, then verify the page in both render engines and both sizing modes.

Recipes for converting an existing micro frontend app from viewport-based
responsiveness to the [surface contract](./surface-portability.md).

Every recipe is labelled:

| Label | Meaning |
| --- | --- |
| **automatic** | Mechanical. The converted rule means the same thing. |
| **conditional** | Safe only when a stated precondition holds. Check it. |
| **manual** | Needs a human decision; there is no single correct rewrite. |
| **not convertible** | No container-query form exists. Use `host.surface` or keep the viewport behavior deliberately. |

Each recipe below presents one technique in isolation. The Web Host repository
includes a runnable page that combines them and is covered by its test suite.

> Recipes that depend on unshipped work — Tailwind `surface-*` variants, build-time
> diagnostics, host-mediated scrolling, hit testing — are marked **not yet shipped**
> and describe only what exists today.

---

## Decision tree: what is this rule about?

Before converting anything, classify the intent. A mechanically correct
conversion is still wrong when the original rule was not surface-relative.

```text
Does the rule respond to how much room THIS PAGE has?
├── yes → convert to @container wippy-surface        (recipes 1-8)
├── no, it responds to one COMPONENT's width
│        → give that component its own container      (recipe 22)
├── no, it responds to a user/device PREFERENCE
│        → leave it as @media                         (recipe 13)
└── no, it deliberately tracks the BROWSER WINDOW
         (a true full-window overlay)
         → leave it, and document why
```

If you cannot tell, leave it and revisit. An unconverted media query is merely
non-portable; a wrongly-converted one is silently broken.

---

## 1. `max-width` → `inline-size <=` — **automatic**

```css
/* before */ @media (max-width: 640px)                      { .nav { display: none } }
/* after  */ @container wippy-surface (max-width: 640px)    { .nav { display: none } }
```

## 2. `min-width` → `inline-size >=` — **automatic**

```css
/* before */ @media (min-width: 640px)                      { .sidebar { display: block } }
/* after  */ @container wippy-surface (min-width: 640px)    { .sidebar { display: block } }
```

## 3. A bounded width range — **automatic**

```css
/* before */ @media (min-width: 640px) and (max-width: 1024px) { … }
/* after  */ @container wippy-surface (640px <= width <= 1024px) { … }
```

The range syntax is supported in all engines the surface contract targets. The
`and` form also works if you prefer it.

## 4. Multiple breakpoints, cascade order preserved — **automatic**

Container queries do not change specificity or ordering. Convert each block and
keep them in the same source order:

```css
@container wippy-surface (min-width: 480px)  { .grid { grid-template-columns: repeat(2, 1fr) } }
@container wippy-surface (min-width: 900px)  { .grid { grid-template-columns: repeat(4, 1fr) } }
```

## 5. Height queries — **conditional** (container sizing only)

```css
/* after */ @container wippy-surface (min-height: 500px) { .tall-only { display: block } }
```

Precondition: the page is **container-sized**. In content sizing the page's
height is its own content, so height queries never match. Declare the dependency
so it fails loudly rather than silently:

```json
{ "wippy": { "surface": { "contract": 1, "requirements": ["block-size"] } } }
```

## 6. Aspect-ratio queries — **conditional** (container sizing only)

```css
/* before */ @media (min-aspect-ratio: 16/9)                     { … }
/* after  */ @container wippy-surface (min-aspect-ratio: 16/9)   { … }
```

Same precondition as recipe 5: aspect ratio needs both axes.

## 7. Orientation queries — **conditional** (container sizing only)

`@container wippy-surface (orientation: landscape)` describes *your panel's*
shape, which is usually what you meant. If you genuinely meant the device,
that is a media query — keep it (recipe 13).

## 8. Height / aspect / orientation in content sizing — **not convertible**

There is no block axis to query. Restructure so the layout depends on the inline
axis. Do not fake it with `cqh` — see recipe 22.

You cannot switch the app to container sizing yourself: sizing is set by where
the Web Host renders the app, not by anything in its package. If the layout truly
cannot work without the block axis, declare `requirements: ["block-size"]` so a
content-sized placement is refused outright instead of rendering wrong, and get
the app rendered in a container-sized context (its own route or a layout panel).
See "Container sizing and content sizing" in
[Surface Portability](./surface-portability.md).

## 9. Geometry nested inside an environmental media query — **manual**

```css
/* before */
@media (prefers-color-scheme: dark) and (min-width: 640px) { .panel { … } }

/* after — split: the preference stays, the geometry moves */
@media (prefers-color-scheme: dark) {
  @container wippy-surface (min-width: 640px) { .panel { … } }
}
```

Manual because nesting order can change which declarations win when the two
conditions previously combined in one prelude. Re-check the result.

## 10. Comma-OR branches — **manual**

```css
/* before */ @media (max-width: 480px), (min-width: 1200px) { … }
```

A comma is OR. Splitting it into two `@container` blocks preserves OR **only if
the two blocks are otherwise identical and adjacent**; if you accidentally nest
them you have turned OR into AND, which matches nothing. Duplicate the
declarations into two sibling blocks:

```css
@container wippy-surface (max-width: 480px)  { … }
@container wippy-surface (min-width: 1200px) { … }
```

## 11. `not`, `only`, complex Boolean — **manual**

`only` is a media-type artifact and has no container equivalent — drop it.
`not` inverts the whole condition in both syntaxes, but precedence differs once
you mix `and`/`or`; parenthesise explicitly rather than trusting the original
grouping.

## 12. `screen` / `print` combined with geometry — **manual**

Media *types* have no container form. Keep the type as a media query and nest
the geometry inside it (as in recipe 9). Print layout in particular should
usually stay entirely viewport/page-based.

## 13. Preferences stay media queries — **not convertible** (and correct as-is)

`prefers-color-scheme`, `prefers-contrast`, `prefers-reduced-motion`,
`forced-colors`, `hover`, `pointer`, `any-pointer`. `@container` supports size
features only. Converting these produces a rule that never matches.

## 14. `em` breakpoints — **manual**

`@media (min-width: 40em)` resolves `em` against the initial font size.
`@container wippy-surface (min-width: 40em)` resolves it against the
**container's** font size. If those differ, your breakpoint moves silently.
Convert to `px`, or verify the container's computed `font-size` first.

## 15. `rem` breakpoints — **manual**

`rem` is **not** root-relative inside `@media`. Media-query conditions resolve
both `em` and `rem` against the *initial* font size — the browser default,
independent of any author CSS — while `@container` resolves them the ordinary
way, against the actual computed root/container font size.

So the two are already unequal the moment your root font size differs from the
browser default, with nothing changing at runtime. The common `html { font-size:
62.5% }` reset is enough to move a converted breakpoint from 640px to 400px.

"Nothing changes the root font size" is therefore **not** a sufficient
precondition. Convert to `px`, exactly as for `em` (recipe 14), unless the
root's computed font size provably equals the browser default.

## 16. Viewport vs content-box scrollbar boundary — **conditional**

`100vw` includes the classic scrollbar gutter. In the **iframe engine** the
surface width is the query box's **content box** inside the app's document, so
it does not: on a page with a document scrollbar the converted value is narrower
by the scrollbar width, which is usually the correction you wanted (`100vw`
causing horizontal overflow is a classic bug).

The **fragment engine** measures a host-document wrapper that the content's
scrolling does not narrow, so it does not apply that correction. Same panel,
same scrolling content, widths differing by a scrollbar. The condition on this
recipe is therefore *which engine the app runs in*, not merely whether the
alignment is pixel-exact.

## 17. Rules targeting `html` / `body` — **manual**

A container query never styles its own container, and a rule aimed at `html` or
`body` fails in both engines — for different reasons:

- **Iframe engine:** the host wraps your body content in the surface box, so
  `html` and `body` are *ancestors* of the query container. A `@container` rule
  cannot reach an ancestor.
- **Fragment engine:** the opposite topology — the query box is a host-document
  wrapper *above* your content — but a literal `body` selector still fails,
  because the reflected document is renamed to `wf-html` / `wf-body`.

Either way the fix is the same, and it is engine-safe:

```css
/* ✗ silently never matches */
@container wippy-surface (min-width: 640px) { body { display: flex } }

/* ✓ move it to your own root inside the surface */
@container wippy-surface (min-width: 640px) { #app { display: flex } }
```

## 18. `<picture><source media>` and `<link media>` — **not convertible**

HTML-level resource selection has no container-query form. Either drive it from
JS with `host.surface.onChange`, or move the art direction into CSS
(`background-image` under an `@container` rule) where the contract applies.

## 19. Geometry `matchMedia()` → `host.surface` — **automatic**

```js
// before
const mq = matchMedia('(min-width: 640px)')
mq.addEventListener('change', render)

// after
import { host } from '@wippy-fe/proxy'

const off = host.surface.onChange(s => render(s.width >= 640))
render(host.surface.snapshot.width >= 640)
// call off() on teardown
```

Keep `matchMedia` for preference queries — it is only geometry that is wrong.

## 20. Runtime CSS, adopted stylesheets, CSS-in-JS — **manual**

Prefer emitting `@container wippy-surface (...)` rules and letting CSS respond.
If you compute pixels in JS, regenerate from `onChange` — a value read once from
`snapshot` is frozen and desyncs on the next resize. Never emit the four
reserved `--wippy-surface-*` names yourself, and never register them with `@property` / `CSS.registerProperty()` — registration defeats the host's "block axis unavailable" signal, so a content-sized app silently reports itself as container-sized; a descendant declaration shadows the
inherited value and unpins your page from the surface.

## 21. Third-party bundled CSS — **manual**

You usually cannot edit it. In order of preference: configure the library to
accept a breakpoint/width you supply from `host.surface`; wrap it in your own
container and translate; or pin the page to the iframe engine
(`wippy.renderEngine: "iframe"`) and accept window-based behavior. Build-time
scanning to find these automatically is **not yet shipped**.

## 22. Nested containers and the `cq*` fallback trap — **manual**

Container units resolve against the *nearest* container that has the axis they
need. Two consequences:

```css
.card { container-type: inline-size; }   /* has NO block axis */
.card .thing { block-size: 25cqh; }      /* ✗ silently uses the small viewport */
```

`cqh`/`cqb` do not error when no block-axis container is found — they fall back
to the small viewport and render a plausible wrong number. Use
`var(--wippy-surface-height, <fallback>)` when you want the surface's block axis:
it is root-pinned, so a nearer container cannot intercept it, and it visibly
falls back when unavailable.

Component queries are additive, not a replacement: `wippy-surface` still refers
to the page's area from inside a nested container.

---

## Viewport units

| Was | Use | Notes |
| --- | --- | --- |
| `100vw` | `var(--wippy-surface-width)` | content box; see recipe 16 |
| `1vw` / `37vw` | `calc(var(--wippy-surface-width-unit) * 37)` or `37cqw` | unit is 1% |
| `100vh` | `var(--wippy-surface-height)` | container sizing only |
| `1vh` / `37vh` | `calc(var(--wippy-surface-height-unit) * 37)` | container sizing only |
| `vmin` | `min(var(--wippy-surface-width), var(--wippy-surface-height))` | container sizing only — needs both axes |
| `vmax` | `max(var(--wippy-surface-width), var(--wippy-surface-height))` | container sizing only |
| `vi` / `vb` | `cqi` / `cqb`, or the physical variables | logical; the surface variables are physical |
| `sv*` / `lv*` / `dv*` | `var(--wippy-surface-*)` | **no separate equivalents.** These describe browser-chrome states a panel does not have; the surface has one size |

`sv*`/`lv*` are real CSS units — they do **not** mean "surface".

### Calculations

```css
/* before */ block-size: calc(100vh - 4rem);
/* after  */ block-size: calc(var(--wippy-surface-height, 400px) - 4rem);
```

The fallback is deliberately fixed and obviously wrong rather than `100vh` — see "Do not hide a missing contract behind a fallback" below. That matters more on the block axis than the inline one: the height is invalid on **every** content-sized placement, not only where the contract is absent, so a `100vh` fallback silently renders window height the first time the app is embedded.

`min()`/`max()`/`clamp()` convert unchanged; substitute the units inside them.

### When `100%` is better than a surface value

If an element should fill its **parent**, use `100%` or `w-full`. Reach for
`--wippy-surface-width` only when you need the *page's* area specifically —
typically because an ancestor is narrower and you want to escape it. Root-pinning
something that should be parent-relative is how a layout ends up correct at one
nesting depth and wrong at another.

### Do not hide a missing contract behind a fallback

```css
/* ✗ */ inline-size: var(--wippy-surface-width, 100vw);
```

That renders window-width when the contract is absent — the exact bug the
contract exists to prevent, made invisible. Let it fail visibly, or pick a fixed
fallback that is obviously wrong (`400px`) so it is noticed.

---

## Overlays

The surface contract does **not** capture `position: fixed` — `container-type`
establishes an independent formatting context without layout containment, so a
query container computes `contain: none` and anchors nothing. This is verified
across Chromium, Firefox and WebKit. PrimeVue overlays and hand-rolled fixed
overlays both keep working, so **positioning needs no migration**.

Their *sizing* does. An overlay meant to cover the surface should use `inset: 0`
— not `100vw`/`100vh`, which measure the browser window and overshoot in a
multi-panel host, and not `var(--wippy-surface-height)`, which is unavailable in
content sizing. Pair `inset: 0` with `position: absolute` inside a
`position: relative` root of the app's own if it must work in both engines;
`position: fixed` is correct only in the iframe engine, for the reason directly
below.

What does need attention is the engine, not the contract: in the Web Fragment
engine `position: fixed` resolves against the **host window**, not your panel.
See [Render Engines](../web-host/render-engines.md) and pin the app with
`wippy.renderEngine: "iframe"` if that matters.

Host-mediated overlay placement and `host.surface` scroll helpers are
**not yet shipped**.

---

## Checklist

1. Classify each rule (page / component / preference / deliberate window).
2. Convert page-intent geometry to `@container wippy-surface`.
3. Replace viewport units with the surface variables.
4. Move any rule that targeted `html`/`body` onto your own root element.
5. Re-check `em` breakpoints.
6. Declare `requirements` if you depend on the block axis.
7. Run the page in both engines **and in both sizings** — container and content
   are what this migration actually turns on, and an app is content-sized
   whenever it is embedded rather than routed. Check which one you are in with
   `host.surface.snapshot.sizing`, and gate block-axis behavior on
   `host.surface.supports('block-size')`.
