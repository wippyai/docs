---
title: "Frontend Compliance and Publication Gates"
description: "Normative frontend compliance rules, checker ownership, publication gates, and deterministic visual evidence requirements."
---

# Frontend Compliance and Publication Gates

This page owns the deterministic checker and publication requirements below.
The [Portable UI Contract](../portable-ui-contract.md) owns the underlying
portability and UI rule statements, while the linked guides provide detailed
implementation guidance. The index maps each rule to its source and required
checker result.

| Rule | Detailed guidance | Deterministic result |
|---|---|---|
| FE-PORT-001 | [Portable UI Contract](../portable-ui-contract.md) | Reject private portability assumptions |
| FE-UI-001 | [Portable UI Contract](../portable-ui-contract.md) | Reject raw or hand-rolled standard controls |
| FE-UI-002 | [Portable UI Contract](../portable-ui-contract.md) | Require affordance analysis |
| FE-UI-003 | [Portable UI Contract](../portable-ui-contract.md) | Require sibling contract and alternate-theme evidence |
| FE-UI-004 | [Portable UI Contract](../portable-ui-contract.md) | Require PrimeVue setup when controls exist |
| FE-UI-005 | [Portable UI Contract](../portable-ui-contract.md) | Reject invented props and APIs |
| FE-TW-001 | [Tailwind Contract](./tailwind-contract.md) | Resolve selected Wippy preset |
| FE-TW-002 | [Tailwind Contract](./tailwind-contract.md) | Reject compile-time values documented as runtime |
| FE-TW-003 | [Tailwind Contract](./tailwind-contract.md) | Reject fixed sibling values without invariant classification |
| FE-TW-004 | [Tailwind Contract](./tailwind-contract.md) | Reject protected mapping overrides |
| FE-TOKEN-001 | [Token Catalogue](./token-catalogue.md) | Reject undeclared `--p-*` references |
| FE-TOKEN-002 | [Token Catalogue](./token-catalogue.md) | Reject inferred or invented token names |
| FE-STYLE-001 | [Theme Authoring](./theming.md) | Reject private facade classes and module-local `.p-*` theming |
| FE-A11Y-001 | [Portable UI Contract](../portable-ui-contract.md) | Reject invalid or inaccessible custom controls |

## Required checker groups

- Token CSS parsed with PostCSS; generated token snapshot compared byte-for-byte.
- Actual Tailwind configuration resolved and representative utilities compiled.
- Emitted declarations classified as runtime variable, compiled constant, arbitrary literal, or internal/transient.
- Raw controls, missing PrimeVue setup, protected mapping overrides, undeclared tokens, private facade dependencies, and contract hash drift rejected.
- Import-map externals compared with the complete pinned snapshot.
- Build output checked against the configured registry and served asset.
- Theme switching uses `host.setThemeMode()` and verifies propagated AppConfig
  state; direct theme-class manipulation and internal proxy wires are rejected.
- Generated catalogues checked for provenance, version tuple, and source hashes.
- Copyable examples parsed, built where applicable, and checked for nested interactive content.
- Project-bound mode returns exactly `UNSUPPORTED`, and standard CI fails.

Promptmap may generate leads. It is not evidence for token existence, utility resolution, reachability, or deletion.

## Generated publication gates

The generated token and Tailwind sections may not contain a pending marker at publication. Every new runtime token needs a real Wippy CSS consumer, a computed-style mutation test, and a documented portable-consumer purpose.

Publication keeps runtime evidence outside the repository. Set:

- `WIPPY_THEME_ROOT` to the selected `@wippy-fe/theme` package.
- `WIPPY_FE_EVIDENCE_ROOT` to the release evidence directory containing
  `runtime-acceptance-evidence.json`, `visual-evidence-index.json`, their
  relative scenario manifests, and screenshots.
- `WIPPY_FE_RUNTIME_EVIDENCE_SHA256` to the lowercase SHA-256 of the exact
  `runtime-acceptance-evidence.json` bytes.

`FRONTEND_DOCS_PUBLICATION=1 node scripts/check-frontend-docs.mjs` invokes the
selected theme's canonical acceptance checker with that evidence path and hash,
then validates and recomputes the visual evidence. Normal documentation
freshness checks do not require local release evidence.

## Deterministic visual verification

Every component affected by an appearance change has a scenario manifest and
immutable before/after/diff evidence. The baseline and candidate use the same
browser build, device-pixel ratio, fonts, fixture data, theme, viewport, reduced
motion setting, and settling rule. Capture all applicable states, including
light and dark themes, interaction states, overlays, disabled/error states, and
the desktop layouts the product supports. Do not invent a narrow/mobile
requirement for a desktop-only product.

Each scenario captures the component crop and surrounding application context.
It also captures the full page when an overlay, overflow, or page layout can be
affected. A component index declares the complete applicable matrix and points
to one immutable manifest per scenario:

```json
{
  "schemaVersion": "1.0.0",
  "componentId": "module.component",
  "applicability": {
    "themes": ["light", "dark"],
    "viewports": [{ "id": "desktop", "width": 1440, "height": 900 }],
    "states": ["default"],
    "overlay": false
  },
  "finalBuild": {
    "candidateCommit": "generated-candidate-commit",
    "candidateBuildHash": "sha256:generated-candidate-build-hash",
    "recapturedAfterBuild": true
  },
  "scenarios": [
    {
      "scenarioId": "module.component.light.default",
      "theme": "light",
      "viewport": "desktop",
      "state": "default",
      "manifest": "scenarios/module.component.light.default.json"
    },
    {
      "scenarioId": "module.component.dark.default",
      "theme": "dark",
      "viewport": "desktop",
      "state": "default",
      "manifest": "scenarios/module.component.dark.default.json"
    }
  ]
}
```

The checker expands the applicability cross-product and fails if any declared
theme, viewport, or state has no unique scenario. When `overlay` is true, every
scenario also requires the `full-page` capture scope. The final build commit and
hash must match every scenario's candidate and
`recapturedAfterBuild` must be true.

Each scenario manifest records hashes rather than trusting filenames:

```json
{
  "schemaVersion": "1.0.0",
  "scenarioId": "module.component.light.default",
  "componentId": "module.component",
  "state": {
    "theme": "light",
    "viewport": { "width": 1440, "height": 900 },
    "interaction": "default"
  },
  "runtime": {
    "browserVersion": "pinned-browser-version",
    "devicePixelRatio": 1,
    "fontsHash": "sha256:generated-font-set-hash",
    "fixtureHash": "sha256:generated-fixture-hash"
  },
  "baseline": {
    "commit": "generated-baseline-commit",
    "buildHash": "sha256:generated-baseline-build-hash"
  },
  "candidate": {
    "commit": "generated-candidate-commit",
    "buildHash": "sha256:generated-candidate-build-hash",
    "recapturedAfterBuild": true
  },
  "requiredScopes": ["component", "context"],
  "captures": [
    {
      "scope": "component",
      "before": {
        "artifactId": "component-before",
        "path": "screenshots/component-before.png",
        "sha256": "sha256:generated-before-hash"
      },
      "after": {
        "artifactId": "component-after",
        "path": "screenshots/component-after.png",
        "sha256": "sha256:generated-after-hash"
      },
      "diff": {
        "artifactId": "component-diff",
        "path": "screenshots/component-diff.png",
        "sha256": "sha256:generated-diff-hash"
      }
    },
    {
      "scope": "context",
      "before": {
        "artifactId": "context-before",
        "path": "screenshots/context-before.png",
        "sha256": "sha256:generated-before-hash"
      },
      "after": {
        "artifactId": "context-after",
        "path": "screenshots/context-after.png",
        "sha256": "sha256:generated-after-hash"
      },
      "diff": {
        "artifactId": "context-diff",
        "path": "screenshots/context-diff.png",
        "sha256": "sha256:generated-diff-hash"
      }
    }
  ],
  "diff": {
    "changedPixels": 0,
    "totalPixels": 1296000,
    "changedRatio": 0,
    "pixelDeltaThreshold": 8,
    "changedRatioThreshold": 0.001,
    "disposition": "within-threshold",
    "result": "passed",
    "waiver": null
  },
  "console": { "unexpectedErrors": [] },
  "fixtureCleanup": { "temporaryArtifactsRemaining": [], "verified": true }
}
```

The values above show the required shape, not valid evidence. Publication fails
when a changed component or required state has no scenario, a required capture
scope is absent, a referenced image or hash is missing, builds are stale,
unexpected console errors remain, temporary fixture code remains, or the diff
exceeds tolerance without a reviewed design waiver. A waiver records the exact
changed pixels, design reason, reviewer, and affected scenario; it cannot waive
missing captures, console errors, or fixture cleanup.
