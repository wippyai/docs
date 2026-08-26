---
title: "The design layer"
description: "Theme, shared design layer, module-local — where a piece of frontend belongs when several modules need the same idea but the theme has no seat for it."
---

# The design layer

A Wippy frontend is many independently published modules rendering into one
application. Two homes for styling are obvious: the **theme**, which every
surface consumes, and the **module**, which owns itself. The gap between them is
not obvious, and it is where duplication accumulates: an idea that several
modules genuinely share, which the theme has no component for.

This page names the three layers and gives a test for deciding between them.

## The three layers

| Layer | Owns | Delivered by |
|---|---|---|
| **Theme** | Values, and the painting of components the theme ships | `@wippy-fe/theme` + the app's facade |
| **Shared design layer** | Vocabulary several modules share that the theme has no component for | A published package, materialized into each consumer |
| **Module** | What is genuinely specific to one surface | The module's own `ui/src` |

### Theme

The theme owns every **value** — colour, radius, spacing, elevation, focus ring
— as `--p-*` tokens, and it owns the appearance of every component it ships.
If PrimeVue has a `Button`, the way buttons look is a theme concern, and a
module that wants a different button is asking the wrong question.

Severity lives here too. `success` / `danger` / `warn` / `info` are theme
semantics with published ramps; a module must never re-derive them.

### Shared design layer

Some ideas recur across modules and have no component in the theme. A content
card. A surface header row. What a surface shows when it has nothing. The two
sizes a tag comes in. These are real, shared, and homeless — so they get a
layer of their own: a **published package**, consumed the same way in every
module.

It must be a published package rather than a path alias, because consumers live
in different repositories. A path alias only works inside one repo, which is
exactly the constraint that makes this a distribution problem and not a
refactor.

### Module

Everything else. A layout only this surface has, a rule that exists because of
one component's markup, a deliberate divergence from the shared vocabulary.

## Deciding where a rule belongs

Ask in this order. The first "yes" wins.

1. **Is it a value?** A colour, a radius, a spacing step, a severity, an
   elevation. → **Theme.** Add or read a `--p-*` token. Never a literal.
2. **Does the theme ship a component for this?** A button, a dialog, a select,
   a tag. → **Theme.** Style it through the theme or the facade. A class that
   restyles a themed component is a theme override wearing a class name, and it
   will drift from every other module that does the same.
3. **Do two or more modules need this same concept, with no themed component
   behind it?** → **Shared design layer.**
4. Otherwise → **Module.**

Question 2 is the one that catches people. It is worth answering honestly per
class: *is this a concept the theme has no seat for, or is it the theme's
component with my paint on it?*

## What goes wrong without this layer

The layer is not bookkeeping. Kickside ran without one, and three things
followed — each of which had to be undone rather than simply tidied:

- **Duplication became the norm.** 15.4% of all module CSS was exact-clone
  duplication across modules, and most copies had drifted apart. One selector
  had nineteen definitions in seventeen distinct bodies.
- **A second component library appeared.** Nine modules opted out of the
  theme's `Button` and hand-rolled their own on native `<button>`, while seven
  used the themed component. Neither dialect was wrong locally; there was
  simply no shared place to put a button, so half the app invented one. The two
  agreed on font-size and line-height and nothing else.
- **Severity was reimplemented as decoration.** Sixteen classes across four
  naming schemes carried `success`/`danger`/`warn` colour under module-local
  names. The same class name meant three different colours in three modules,
  so publishing any one definition would have silently repainted the others.

The correction in each case was the same: severity is the theme's, the button
is the theme's, and what survived — card, header, empty state, tag scales,
derived tokens — is the genuinely shared vocabulary that belongs in the middle
layer.

## Rules for the shared layer

**Adopting means importing *and deleting* the local rule.** A CSS `@import`
must precede every other rule in a sheet, so the shared sheet always lands
first and the module's own copy wins at equal specificity. A module that
imports the package and keeps its copy has changed nothing.

**Keep deliberate divergence as an override after the import — the delta only.**
Never restate the whole body. A module that needs a two-line clamp where the
shared rule truncates to one writes those two properties and nothing else, with
a comment saying why.

**Never fold two intents into one name.** If the same class name means
different things in two modules, that is two concepts wearing one name. Split
the name; do not pick a winner and repaint the loser.

**Normalising is a visual change.** Consolidating drifted copies moves pixels.
Diff every body, pick the canon, record why, and look at the result — unit
tests cannot see it.

## The cascade facts you need

Two ordering rules decide whether your rule applies at all.

**Inside a module sheet, `@import` comes first.** That is a CSS requirement, not
a convention. The shared vocabulary is therefore always earliest, and anything
the module declares afterwards beats it at equal specificity — which is what
makes "import and delete" load-bearing rather than tidy.

**The theme's stylesheet is appended to the shadow root after the module's.**
The module's CSS is injected when the component connects; the theme's PrimeVue
sheet arrives afterwards and is appended as a `<style>`. Both are `<style>`
elements, so document order decides and the theme is second. A module rule that
must beat a themed component class needs *more specificity*, not a later
position in the file. (`adoptedStyleSheets` carries the facade's custom CSS,
not the theme — reaching for an adopted sheet does not win this.)

## Distribution

The shared layer is a package, so it needs a way to reach a module in another
repository. Wippy modules do this by publishing the package as an **artifact**
inside the module that owns it, and materializing it into each consumer at
build time. See [Dependency Management](../guides/dependency-management.md) for
how a module declares and resolves what it consumes.

The test that the layer actually works is not that the monorepo builds. It is
that a module in a **different repository**, with no path access to the
producer, consumes the vocabulary and builds.

## Related

- [Theming](./micro-frontends/theming.md) — the token catalogue and how the
  theme reaches both host and children
- [Compliance checklist](./micro-frontends/compliance-checklist.md) — the
  per-module rules a frontend is checked against
- [Dependency Management](../guides/dependency-management.md) — declaring and
  resolving what a module consumes
