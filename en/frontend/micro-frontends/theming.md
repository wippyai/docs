---
title: "Theme Authoring"
description: "How the facade authors a PrimeVue theme and how modules remain portable."
---

# Theme Authoring

The facade authors a PrimeVue theme. Modules consume that theme; they do not create parallel mini design systems.

Wippy currently runs PrimeVue with `theme: 'none'`. Component appearance is supplied by Wippy’s Tailwind-authored PrimeVue CSS, public runtime variables, and facade customization.

## Where styling belongs

| Styling concern | Owner |
|---|---|
| PrimeVue component appearance shared across the product | Facade PrimeVue theme in `custom_css` and public theme variables |
| Host shell chrome only | Facade CSS scoped to `.wippy-host-app` |
| A shared `.p-*` rule intended for host and child roots | Global facade `custom_css`; no host scope required |
| Page-only theme override | Page configuration using supported frontend casing |
| Domain layout or novel structure | Module CSS or Tailwind |
| A necessary non-PrimeVue custom part | Module CSS, reusing public tokens and documented invariant utilities |
| An arbitrary class expected from one facade | Not portable; prohibited by FE-STYLE-001 |

A global `.p-drawer-content` rule is valid theme implementation when it is intended for every Drawer in host and child roots. `.wippy-host-app .p-drawer-content` is appropriate only when the rule is host-specific.

Moving duplicated module CSS into facade CSS does not eliminate the dependency. If the selector is not part of the shared PrimeVue theme vocabulary, it creates a private facade contract.

## Semantic equality

Semantically equivalent controls should look equivalent. Prefer PrimeVue components directly. When a genuinely custom control is needed, identify its PrimeVue visual sibling and use the same public runtime properties for color, border, focus, state, and any geometry classified theme-variable.

The custom part may own only the novel structure that the sibling does not provide. Reuse documented theme padding, dimensions, typography, radius, shadow, focus, and motion contracts wherever they exist. Do not copy a current literal from generated component CSS and call it inheritance.

## Runtime versus invariant properties

Each shared appearance property has one policy:

- `theme-variable`: it must resolve through a documented public runtime variable.
- `platform-invariant`: the shared compiled Tailwind value is deliberately stable across every compliant theme.

Do not add runtime tokens for theoretical flexibility. Add or adopt a token only after the effective-contract ledger proves a real runtime gap, an exact supported path, a real consumer, and mutation evidence.

## CSS transport is not permission

Pages receive styles in an iframe. Web components may receive styles inside a shadow root. This explains where CSS can take effect; it does not authorize a module to depend on arbitrary facade selectors.

## Runtime mode switching

The public theme-mode contract is AppConfig plus `@wippy-fe/proxy`:

```typescript
import { host, on } from '@wippy-fe/proxy'

async function setThemeMode(mode: 'auto' | 'light' | 'dark') {
  await new Promise<void>((resolve, reject) => {
    const stop = on('@theme', (appliedMode) => {
      if (appliedMode !== mode) return
      stop()
      const currentMode = host.getThemeMode()
      if (currentMode !== mode) {
        reject(new Error(`Theme propagation mismatch: ${currentMode}`))
        return
      }
      resolve()
    })
    host.setThemeMode(mode)
  })
}

await setThemeMode('dark')
```

Use only `auto`, `light`, or `dark`. The host owns application and recursive
child propagation; the facade/embedder owns persistence. Directly editing
`w-theme-dark` / `w-theme-light`, calling internal theme helpers, writing
AppConfig globals, or posting host messages bypasses that contract and is
non-compliant. Visual evidence is valid only after the public API reports the
propagated mode.

See [Tailwind Contract](./tailwind-contract.md), [Token Catalogue](./token-catalogue.md), and [Portable UI Contract](../portable-ui-contract.md).
