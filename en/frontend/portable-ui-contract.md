---
title: "Portable UI Contract"
description: "Normative rules for PrimeVue, Tailwind, tokens, custom controls, accessibility, and portability."
---

# Portable UI Contract

The following IDs are the canonical owners of their rules.

## Portability

### FE-PORT-001: Portable is the default

A compliant module works with another compliant facade theme without module edits and without project-private facade classes.

### FE-STYLE-001: No private facade dependency

Portable modules cannot require arbitrary classes or selectors defined only by one facade. Shared PrimeVue `.p-*` theme rules are not private classes. Non-PrimeVue styling required by one module belongs in that module, but should be minimized by conforming to shared components and semantics.

## Components and affordance

### FE-UI-001: Use PrimeVue when it satisfies the control

If PrimeVue provides the required semantics, interaction, and intended affordance, the module must use it.

### FE-UI-002: Data shape is not affordance

The ability to represent the same values does not make two controls equivalent. A `SelectButton` is not automatically a substitute for a sliding three-position toggle when the intended affordance is visibly and behaviorally a toggle.

### FE-UI-003: Same semantics and affordance means same appearance

Equivalent controls must share sizes, spacing, colors, typography, borders, shadows, focus, hover, disabled, invalid, and motion behavior. A custom composite names its PrimeVue visual sibling and inherits every applicable shared runtime property.

### FE-UI-004: PrimeVue omission is narrow

PrimeVue may be omitted only when the module renders nothing that is physically or semantically PrimeVue-like. A chart-only component qualifies; a chart with a button or form field does not.

### FE-UI-005: Never invent component APIs

An undocumented prop or behavior is not a shortcut. PrimeVue `ToggleSwitch` does not become a three-position control by inventing a new positions prop. When no PrimeVue component or composition supplies the required affordance, use the reviewed custom-sibling process.

## Tailwind and tokens

### FE-TW-001: Wippy Tailwind is supported

The shared Wippy preset is a supported build-time contract. Modules may use its documented utilities and extend it for domain layout, application-specific breakpoints, decoration, and novel visualization.

### FE-TW-002: Compiled values are not runtime tokens

Utilities such as `px-3`, `rounded-md`, and `duration-200` normally compile to constants. They provide a consistent baseline but do not change when a facade swaps runtime theme variables.

### FE-TW-003: Shared sibling appearance tracks runtime semantics

When an appearance property must track a PrimeVue sibling across themes, use a documented runtime-backed semantic utility or a direct public token. A fixed utility is allowed only when the property is explicitly classified `platform-invariant`.

### FE-TW-004: Protected mappings keep their meaning

Modules may extend the preset but cannot redefine protected primary, surface, severity, text, content, highlight, or portable-control semantics incompatibly.

### FE-TOKEN-001: Every token must exist

Every `--p-*` reference must be present in the selected generated manifest.

### FE-TOKEN-002: Token names are not guessable APIs

Never construct a token by analogy. Search the [Token Catalogue](./micro-frontends/token-catalogue.md) or the selected package manifest.

## Accessibility

### FE-A11Y-001: Custom is not an accessibility waiver

A custom-control exception must preserve valid HTML, keyboard interaction, focus, accessible name, state, and disabled behavior. Interactive elements must not be nested.
