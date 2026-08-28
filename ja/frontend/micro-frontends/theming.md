---
title: "Theme authoring"
description: "facade が PrimeVue theme を author し、module が portable であり続ける仕組み。"
---

# Theme authoring

**分類: theme ownership と runtime contract reference。** mode switching block は 1 つの public API flow を示し、running Host を前提とします。単体で facade を設定したり module を build したりしません。

facade が PrimeVue theme を author し、module は独立した design system を定義せずそれを利用します。

Wippy は現在 PrimeVue を `theme: 'none'` で動かします。component appearance は Wippy の Tailwind-authored PrimeVue CSS、public runtime variable、facade customization が供給します。

## Style の配置先

| スタイリング対象 | 管理元 |
|---|---|
| product 全体で共有する PrimeVue component appearance | `custom_css` と public theme variable 内の Facade PrimeVue theme |
| Host shell chrome のみ | `.wippy-host-app` に scope した Facade CSS |
| host/child root 向け共有 `.p-*` rule | global facade `custom_css`。host scope 不要 |
| page-only theme override | supported frontend casing を使う page configuration |
| domain layout または新規 structure | module CSS または Tailwind |
| 必要な non-PrimeVue custom part | public token/documented invariant utility を再利用する module CSS |
| 複数の自作 module が使う同じ non-PrimeVue part | shared package — [Design Layer](../design-layer.md)参照 |
| 1 facade の任意 class への期待 | portable ではなく FE-STYLE-001 で禁止 |

global `.p-drawer-content` rule は host/child の全 Drawer 向けなら有効な theme implementation です。`.wippy-host-app .p-drawer-content` は host 固有の場合だけ適切です。

重複 module CSS を facade に移しても dependency は消えません。selector が shared PrimeVue theme vocabulary に属さないなら private facade contract を作ります。自作 module 間の共有 vocabulary は published package に置きます。

## Semantic equality

semantically equivalent な control は同等に見えるべきです。PrimeVue component を直接使います。本当に custom control が必要なら PrimeVue visual sibling を特定し、color、border、focus、state と theme-variable に分類された geometry に同じ public runtime property を使います。

custom part が所有できるのは sibling にない新規 structure だけです。documented theme padding、dimension、typography、radius、shadow、focus、motion contract を再利用します。generated component CSS から copy した literal は将来の theme change を継承しません。

## Runtime property と invariant property

- `theme-variable`: documented public runtime variable で解決する。
- `platform-invariant`: shared compiled Tailwind value が全 compliant theme で意図的に固定される。

理論的 flexibility のためだけに runtime token を追加しません。real runtime gap、exact supported path、real consumer、mutation evidence が文書化された場合だけ採用します。

## CSS transport は permission ではない

page style transport は engine に従います。iframe は proxy injection、Web Fragment は gateway platform CSS と reflected head の page override、web component は shadow root 内へ delivery できます。これは CSS が効く場所の説明であり、任意 facade selector への依存を許可するものではありません。

## Runtime mode switching

public theme-mode contract は AppConfig + `@wippy-fe/proxy` です。

```typescript
import { host, on } from '@wippy-fe/proxy'

async function setThemeMode(mode: 'auto' | 'light' | 'dark') {
  if (host.getThemeMode() === mode) return

  await new Promise<void>((resolve, reject) => {
    let settled = false
    let stop = () => {}
    const finish = (error?: unknown) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      stop()
      if (error) reject(error)
      else resolve()
    }
    const timeout = window.setTimeout(
      () => finish(new Error(`Timed out waiting for theme mode: ${mode}`)),
      5_000,
    )

    stop = on('@theme', (appliedMode) => {
      if (appliedMode !== mode) return
      finish()
    })

    try {
      host.setThemeMode(mode)
    } catch (error) {
      finish(error)
    }
  })
}

await setThemeMode('dark')
```

使用できるのは `auto`、`light`、`dark` だけです。application と recursive child への propagation は host、persistence は facade/embedder が所有します。`w-theme-dark` / `w-theme-light` の直接編集、internal theme helper、AppConfig global の書込、host message の直接送信は contract を迂回し non-compliant です。visual evidence は public API が propagated mode を報告した後だけ有効です。

[Tailwind Contract](./tailwind-contract.md)、[Token Catalogue](./token-catalogue.md)、[Portable UI Contract](../portable-ui-contract.md)も参照してください。
