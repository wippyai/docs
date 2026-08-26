---
title: "Frontend Contract: Start Here"
description: "The entry point for portable Wippy pages, web components, builds, routing, and theme integration."
---

# Frontend Contract: Start Here

Wippy frontend modules are portable by default. A module must continue to work when it is imported into another Wippy project whose facade supplies a different compliant PrimeVue theme and no project-private CSS.

## Choose the correct path

1. Use a `view.page` for an application rendered by the configured page engine: a legacy `about:srcdoc` iframe or a Web Fragment.
2. Use a `view.component` for a custom element rendered in the host document, normally with a shadow root.
3. If the UI renders a button, input, form field, menu, overlay, or another PrimeVue-like control, use PrimeVue unless it cannot provide the required semantics and affordance.
4. A content-only component, such as a Chart.js visualization with no controls, may omit PrimeVue and Tailwind.
5. If a custom control is necessary, follow the [Portable UI Contract](./portable-ui-contract.md) and [Custom Composites](./micro-frontends/custom-composites.md).

PrimeVue is the shared component vocabulary. The Wippy Tailwind preset is a supported build-time vocabulary. Only utilities documented as runtime-backed remain responsive to facade theme changes after compilation.

## Ownership map

```text
module source
  -> build command
  -> emitted artifact
  -> registry owner
  -> served URL
  -> Web Host
  -> page surface (srcdoc iframe or Web Fragment) or component shadow root
  -> AppConfig / router / theme delivery
```

Do not infer one stage from another. Before debugging a missing asset, identify the source package, build target, emitted file, registry entry, filesystem mount, and served URL.

## Contract pages

- [Platform Topology](./platform-topology.md): runtime boundaries, routing, CSS delivery, overlays, and ownership.
- [Portable UI Contract](./portable-ui-contract.md): normative component and styling rules.
- [Theme Authoring](./micro-frontends/theming.md): what belongs in facade `custom_css`, PrimeVue theme CSS, or a module.
- [Tailwind Contract](./micro-frontends/tailwind-contract.md): runtime-backed utilities versus compiled constants.
- [Token Catalogue](./micro-frontends/token-catalogue.md): generated token reference and provenance.
- [The Design Layer](./design-layer.md): where something belongs when several of your own modules need it and the theme has no component for it.
- [Page Recipe](./micro-frontends/micro-frontend-app.md) and [Web Component Recipe](./micro-frontends/web-component.md).
- [Build and Dependency Contract](./micro-frontends/build-system.md).
- [Configuration and Casing](./micro-frontends/configuration-casing.md).
- [Compliance Rule Index](./micro-frontends/compliance-checklist.md).

## Non-negotiable checks

- Never invent a PrimeVue prop, component API, CSS variable, or Tailwind semantic utility. Verify it in the selected package source and generated catalogue.
- Never construct a `--p-*` token name by analogy.
- Never require an arbitrary facade class from a portable module.
- Never infer host route context from browser location. Pages receive host context through AppConfig and use `@wippy-fe/router`.
- Rebuild the exact owning package into the served output before browser verification.
- Verify the browser console after navigation and material interaction.

Project-bound modules are outside the portable contract. They are documented only on the [Unsupported Project-Bound Modules](./micro-frontends/unsupported-project-bound.md) page; standard compliance returns `UNSUPPORTED` and standard CI fails.
