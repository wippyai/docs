---
title: "The design layer"
description: "Theme, shared design layer, module-local — what goes where when several modules need the same thing and the theme has no seat for it, with worked good and bad examples."
---

# The design layer

A Wippy frontend is many independently published modules rendering into one
application. Two homes are obvious: the **theme**, which every surface
consumes, and the **module**, which owns itself. The gap between them is not
obvious, and it is where duplication accumulates — an idea several modules
genuinely share that the theme has no component for.

This page names the three layers, gives a test for choosing between them, and
shows what each choice looks like when it goes right and wrong.

## The layers

| Layer | Reaches | Owns |
|---|---|---|
| **Theme** | *Every* surface, including modules you do not own | PrimeVue components, the shared semantic tokens, documented classes |
| **Shared design layer** | Only the modules that opt in | Vocabulary those modules share that has no themed component behind it |
| **Module** | Itself | What is genuinely specific to one surface |

### The theme is universal, and that is the constraint

The theme styles markup **you do not own**. Any module — including a
third-party plugin written by someone who has never seen your app — renders
into the same host and is painted by the same theme. That is what makes the
theme the universal layer, and it cuts both ways:

**Nothing app-specific may go into the theme**, because it would be imposed on
every module that never asked for it.

**A module may not depend on anything app-specific being in the theme.** The
contract is *PrimeVue components + the shared Wippy semantic tokens +
documented classes* — nothing an application added on top. Note that PrimeVue's
own presets are not the contract either: Wippy runs PrimeVue with
`theme: 'none'`, so it is the Wippy semantic tokens you rely on.

```css
/* GOOD — shared Wippy semantic tokens, present for every module */
.my-panel {
  color: var(--p-text-color);
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
}

/* BAD — an application-specific token. Your module now only works inside
   one app, and silently loses the declaration anywhere else: an undefined
   custom property makes the declaration invalid at computed-value time, so
   it drops and the element quietly inherits instead. */
.my-panel { background: var(--kx-surface-2); }
```

This is also the answer to *"can I put our shared vocabulary in the facade?"*
Only if it must genuinely reach arbitrary, unowned markup. If it is scoped to
*your* set of modules, it does not belong in the theme — it belongs in the
layer below.

### The backbone, and when a component may opt out

PrimeVue and Tailwind, as shipped by the host, are the recommended backbone for
any component. A component **may** opt out — but the opt-out narrows the moment
it renders anything conventional, and the ladder only goes one way:

| The component… | Then it must load |
|---|---|
| is presentation-neutral — canvas, SVG, a chart with no controls, no tokens, no utilities, no scrolling | nothing: `hostCssKeys: []` |
| consumes semantic tokens or dark mode | `themeConfigUrl` |
| can scroll | `iframeCssUrl` |
| renders markdown | `markdownCssUrl` |
| renders anything **Tailwind** can express | Tailwind — write utilities, not hand-rolled CSS |
| renders anything **PrimeVue** ships a component for — button, input, form, table, dialog, menu, tag, tooltip, any feedback control | `primeVueCssUrl` **and** `PrimeVuePlugin` |

A chart on a canvas is the archetypal legitimate opt-out: it has no classic UI,
so it needs none of the backbone. Give that same chart a toolbar and it is no
longer presentation-neutral — the button is a PrimeVue button, and the whole
integration comes with it.

Note the coupling: **Tailwind utilities are delivered with `primeVueCssUrl`.**
There is no separate Tailwind host CSS key, so in practice a component that
needs Tailwind is loading the PrimeVue asset too. (`preflightCssUrl` is not
part of the key union; if Tailwind preflight is genuinely required inside the
shadow root, load it imperatively — rarely needed.)

The practical consequence for this page: **most of what a module wants already
exists in the backbone.** The shared design layer is a narrow band above it, not
a place to re-do what PrimeVue and Tailwind already cover. See
[CSS Injection](./web-host/css-injection.md) for the mechanics.

### The shared design layer

Some ideas recur across a known set of modules and have no component in the
theme: a content card, a surface header row, what a surface shows when it has
nothing, the sizes a tag comes in. Real, shared, and homeless.

They ship as a **published package**, materialized into each consumer at build
time. It must be a package rather than a path alias, because consumers live in
different repositories — the falsifiable test for this layer is that a module
in a *different repo*, with no path access to the producer, consumes the
vocabulary and builds.

> **Documentation gap.** The producing module declares the package as an
> artifact and each consumer materializes it during its build. That mechanism —
> the artifact declaration, `wippy artifacts materialize`, and how a consumer
> wires the materialized path into its package resolution — is not documented
> yet. [Dependency Management](../guides/dependency-management.md) covers module
> dependencies and `workspace.replacements`, but not artifact materialization.
> Until that page exists, treat the distribution step as the one part of this
> layer you cannot follow from the docs alone.

### The module

Everything else, plus every deliberate divergence from the shared vocabulary.

## Deciding where something belongs

Ask in order. First yes wins.

1. **Is it a value?** Colour, radius, spacing, elevation, severity.
   → **Theme.** Read a semantic token. Never a literal.
2. **Does the theme already ship a component for this?** Button, Dialog,
   Select, Tag. → **Theme.** Use the component. Style it by putting a class
   *on* it — never rebuild it.
3. **Do two or more of your modules need this same concept, with no themed
   component behind it?** → **Shared design layer.**
4. Otherwise → **Module.**

Question 2 is the one that catches people, and it has a sharp rule behind it.

## Worked examples

The examples below are from Kickside, a Wippy application whose module CSS was
15.4% exact-clone duplication before it grew this layer.

### Never rebuild a themed component

PrimeVue ships `Button`. Nine Kickside modules opted out of it and hand-rolled
`.kx-btn` on a native `<button>`; seven other modules used the component. Both
dialects were locally reasonable — there was simply no shared place to put a
button, so half the app invented one. Measured against each other they agreed
on font-size and line-height and nothing else.

**Bad:** a native `button` element carrying `.kx-btn .kx-btn-primary` — a second
implementation of a component the theme already ships. (Written as a selector
here on purpose: the documentation gate rejects native product controls in
example code, which is this rule enforced one layer up.)

**Good:** the themed component, with a class on it when you need to adjust it.

```vue
<Button label="Save" class="kx-save" />
```

When the themed component does not fit, that is not a licence to rebuild it.
Put a class on the component and style that class — in the facade if the
adjustment is app-wide, in the module if it is local. Kickside's `knowledge`
module still carries `.kn-btn` / `.kn-primary` on native buttons; that is a
migration outstanding, not a pattern to copy.

### Severity is the theme's, not yours

Severity — `success`, `danger`, `warn`, `info` — is theme semantics with
published ramps. Kickside re-derived it **sixteen times across four naming
schemes** (`tone-gn`, `t-ok`, `kx-tone-success`, `tone-success`). The same
class name meant three different colours in three modules, so publishing any
one definition would have silently repainted the others.

```css
/* BAD — severity re-derived under a module-local name */
.tone-gn { color: #16a34a; }

/* GOOD — severity from the theme */
.status-dot.success { background: var(--p-success-500); }
```

A *tone* may still exist in the shared layer — but only as **decorative
category colour**, never as severity. If it can mean "this failed", it is
severity and it is the theme's.

### Shared vocabulary the theme has no seat for

```css
/* GOOD — PrimeVue ships no Card, no surface Header, no EmptyState.
   These recur across modules with nothing themed behind them, so they are
   exactly what the shared layer is for. */
@import "@kickside/ui-kit/kx-card.css";
@import "@kickside/ui-kit/kx-state.css";
```

### Adopting means import *and delete*

A CSS `@import` must precede every other rule in a sheet. The shared sheet
therefore always lands **first**, and anything the module declares afterwards
beats it at equal specificity. A module that imports the package and keeps its
own copy has changed nothing at all.

```css
/* BAD — the import is inert; the local copy still wins */
@import "@kickside/ui-kit/kx-card.css";
.kx-card { border-radius: 14px; border: 1px solid var(--p-content-border-color); }

/* GOOD — import, delete the local copy, keep only a documented delta */
@import "@kickside/ui-kit/kx-card.css";
/* This surface's cards are inline in a dense list, so they lose the lift. */
.kx-card:hover { transform: none; }
```

Keep the **delta only** — never restate the whole body. And never fold two
intents into one name: if a class name means different things in two modules,
that is two concepts wearing one name. Split the name; do not pick a winner and
repaint the loser.

### Specificity against the theme

The module's CSS is injected into the shadow root first; the theme's PrimeVue
sheet is appended afterwards. Both are `<style>` elements, so **document order
decides and the theme is second**. A module rule that must beat a themed
component class needs more *specificity* — not a later line in the file.
(`adoptedStyleSheets` carries the facade's custom CSS, not the theme, so
reaching for an adopted sheet does not win this either.)

This bites hardest with pass-through classes, where your class lands *on* a
themed element:

```css
/* BAD — this class is applied to PrimeVue's own footer element, so at equal
   specificity the theme wins and the padding never applies. */
.kx-modal-foot { padding: 14px 18px; }

/* GOOD — scoped under the dialog root, so it out-specifies the theme */
.kx-modal > .kx-modal-foot { padding: 14px 18px; }
```

## What the shared layer may contain

Everything a set of modules genuinely shares and the theme does not own: CSS
vocabulary, derived tokens, internal components, helpers, test harness. The
duplication is identical in kind — Kickside had nineteen copies of one test
bootstrap alongside its cloned CSS.

**Ship it in semantic chunks.** Each unit should be one named concept a
consumer can reason about — `kx-card`, `kx-state`, `kx-tag`. Prefer
finer-grained packages so a consumer takes only what it needs; a single package
shipping several clearly-named units is workable, but it is not the shape to
aim for.

**Never a catch-all.** No `common`, no `shared`, no `misc`, no `utils`. A unit
whose name does not say what is inside it will accumulate everything that had
nowhere else to go, and you will have rebuilt the problem this layer exists to
solve.

## Normalising is a visual change

Consolidating drifted copies moves pixels. Kickside had one selector with
**nineteen definitions in seventeen distinct bodies**. Diff every body, pick
the canon, record why you picked it, keep deliberate divergence as a documented
override — and look at the result. Unit tests cannot see layout.

## Related

- [Theming](./micro-frontends/theming.md) — the token catalogue, and how the
  theme reaches both host and children
- [Compliance checklist](./micro-frontends/compliance-checklist.md) — the
  per-module rules a frontend is checked against
- [Dependency Management](../guides/dependency-management.md) — declaring and
  resolving what a module consumes
