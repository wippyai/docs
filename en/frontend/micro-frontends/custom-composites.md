---
title: "Custom Composites"
description: "Contract-first exceptions for controls whose required affordance cannot be provided by PrimeVue."
---

# Custom Composites

Custom controls are exceptions, not an alternative component library.

## Admission test

A custom control is accepted only when:

1. PrimeVue cannot provide or compose the intended semantics, interaction, and affordance.
2. The exception records rejected PrimeVue compositions.
3. It names an exact generated PrimeVue sibling contract and contract hash.
4. Every property that sibling contract classifies `shared-runtime` has an exact source mapping.
5. A fixed utility is accepted only when the sibling contract classifies that exact property `platform-invariant`.
6. Novel geometry and behavior are isolated and documented.
7. Accessibility and visual evidence pass.

Data-shape equivalence is not affordance equivalence. A multi-option `SelectButton` may represent three values but does not look or behave like a sliding three-position toggle. Conversely, do not invent a `positions` prop for `ToggleSwitch`. Build a reviewed custom sibling only when the affordance requirement is real.

## Module contract

Store a reviewed exception in module-root `wippy-fe.contract.json`:

```json
{
  "schemaVersion": "generated-by-selected-contract-tool",
  "exceptions": [
    {
      "id": "module.control.example",
      "source": "src/components/ExampleControl.vue",
      "sourceSha256": "generated-from-source",
      "semanticRole": "documented-role",
      "requiredAffordance": "documented-affordance",
      "rejectedPrimeVueCompositions": [
        {
          "components": ["SelectButton"],
          "reason": "The reviewed sliding affordance cannot be preserved."
        }
      ],
      "visualSibling": {
        "component": "ToggleSwitch",
        "contractId": "primevue.toggleswitch.portable-appearance",
        "contractHash": "generated-from-selected-theme-contract"
      },
      "sharedAppearanceMappings": [
        {
          "contractProperty": "root.width",
          "part": "root",
          "selector": ".example-control",
          "source": {
            "kind": "css-variable",
            "name": "--p-toggleswitch-width"
          }
        }
      ],
      "platformInvariantUtilities": [],
      "moduleLocalProperties": [],
      "accessibilityEvidence": {
        "manifest": ".local/evidence/accessibility-manifest.json",
        "scenarioId": "module.control.example.keyboard",
        "resultId": "module.control.example.keyboard.passed",
        "build": {
          "head": "generated-candidate-commit",
          "trackedFrontendDiffSha256": "generated-diff-hash"
        }
      },
      "visualEvidence": {
        "manifest": ".local/evidence/visual-manifest.json",
        "scenarioId": "module.control.example.light.default",
        "captureId": "module.control.example.light.default.component",
        "build": {
          "head": "generated-candidate-commit",
          "trackedFrontendDiffSha256": "generated-diff-hash"
        }
      }
    }
  ]
}
```

The values shown are schema placeholders, not valid evidence. The complete
mapping is generated from the selected sibling contract; the one-row excerpt is
not a valid exception by itself. Tooling generates the source and contract
hashes. A changed source hash or sibling-contract hash invalidates review.

This page defines the normative fields; it is not a JSON Schema and the
documentation checker only proves that this example retains the required
shape. A module compliance implementation must validate a real contract
against the selected theme manifest, verify the hashes and complete property
set, and check that every evidence reference resolves to the named passing
result or capture from the same candidate build. The public `@wippy-fe/*`
0.0.56 package family does not provide a module-compliance CLI. Accessibility
evidence binds the
component `sourceSha256`, hashed files, zero unexpected console errors, and a
passed result. Visual evidence binds canonical before/after/diff files, hashes,
recomputed metrics and disposition, and the matching candidate build. A
string, missing file, missing scenario/result/capture, stale build hash,
`pending`, or unreviewed result does not satisfy the evidence requirement.

`platformInvariantUtilities` and `moduleLocalProperties` may be empty. Never
invent `gap-2`, `w-10`, `rounded-md`, or another fixed utility merely to make a
contract field nonempty. In particular, a ToggleSwitch sibling cannot relabel
width, height, radius, focus geometry, or motion as invariant when its selected
sibling contract classifies those properties `shared-runtime`.

The sibling manifest classifies properties as:

- `shared-runtime`: every custom sibling maps and consumes the published token
  or runtime-backed semantic utility.
- `platform-invariant`: a fixed value is permitted only for this exact
  property.
- `implementation-private`: internal PrimeVue mechanics do not become
  requirements for a custom sibling.

If the required runtime semantic does not exist, fix the shared theme contract first. Never copy the current sibling dimensions or invent a token name.

`sharedAppearanceMappings` is exhaustive, not illustrative: it contains exactly
one mapping for every `shared-runtime` property in the selected sibling
contract, no additional property IDs, the contract part, a stable module
selector, and the exact published source kind and name. The selected compliance
implementation must use the selector, part, CSS property, and published source
to prove the mapping structurally with PostCSS; a token name in a comment or
unrelated selector does not count. A Tailwind-backed mapping also records unique, exact
`utilityClasses`; after normalization that set must equal the selected sibling
contract source set. `platformInvariantUtilities` contains
`{ "contractProperty": "...", "utility": "..." }` records whose utility equals
the selected sibling contract source. `moduleLocalProperties`, when nonempty,
contains structured property IDs and review reasons rather than a free-form CSS
bag.

No shared `@wippy-fe/ui` package is created for a single exception. Promotion becomes eligible only after a second independent consumer proves the same behavior and portability requirements.
