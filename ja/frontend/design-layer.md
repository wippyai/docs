---
title: "デザインレイヤー"
description: "frontend の style と component を theme、shared design package、個別 module のどこに配置するか。"
---

# デザインレイヤー

このページは design ownership の判断ガイドです。CSS と component の snippet は、既存の Wippy frontend package と build を前提にした部分的な pattern です。

Wippy frontend では、独立して公開された多数の module を 1 つの application に含められます。**theme** はすべての surface に届き、各 **module** は自身の local presentation を所有します。**shared design layer** は、theme が提供しない概念を複数の module が共有する、より限定的な場合を扱います。

## 各レイヤー

| レイヤー | 到達範囲 | 所有するもの |
|---|---|---|
| **Theme** | 所有していない module を含む、*すべて*の surface | PrimeVue component、shared semantic token、documented class |
| **Shared design layer** | opt in した module のみ | theme component に裏付けられていない、module 間で共有する vocabulary |
| **Module** | 自身 | 1 つの surface に固有のもの |

### Theme は universal であり、それが制約になる

theme は**自分が所有していない** markup にも style を適用します。あなたの application を一度も見たことのない作者が作った third-party plugin を含め、どの module も同じ host に render され、同じ theme で描画されます。これにより theme は universal layer になりますが、制約も双方向に働きます。

**application 固有のものを theme に置いてはいけません。** 求めていないすべての module にも強制されるためです。

**module は application 固有の何かが theme にあることへ依存してはいけません。** 契約は *PrimeVue component + shared Wippy semantic token + documented class* であり、application が追加したものは含みません。PrimeVue 自身の preset も契約ではありません。Wippy は PrimeVue を `theme: 'none'` で動かすため、依存すべきなのは Wippy semantic token です。

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

これは「shared vocabulary を facade に置いてよいか」という質問への答えでもあります。所有していない任意の markup に本当に届く必要がある場合だけ許されます。*自分たちの* module 群だけを対象にするなら theme ではなく、その下のレイヤーに属します。

### Backbone と component が opt out できる条件

Host が提供する PrimeVue と Tailwind は、あらゆる component に推奨される backbone です。component は opt out **できます**が、一般的な UI を少しでも render した時点で選択肢は狭まり、この段階は一方向にしか進みません。

| コンポーネントの性質 | 読み込むもの |
|---|---|
| presentation-neutral — canvas、SVG、control・token・utility・scrolling のない chart | 何もなし: `hostCssKeys: []` |
| semantic token または dark mode を使う | `themeConfigUrl` |
| scroll する可能性がある | `iframeCssUrl` |
| markdown を render する | `markdownCssUrl` |
| 通常の layout や spacing に Tailwind utility を選ぶ | `primeVueCssUrl`（Host はこの asset に Tailwind を bundle する） |
| PrimeVue が component を提供するもの — button、input、form、table、dialog、menu、tag、tooltip、その他 feedback control — を render する | `primeVueCssUrl` **と** `PrimeVuePlugin` |

canvas 上の chart は正当な opt-out の典型です。classic UI を持たないため backbone は不要です。同じ chart に toolbar を追加すれば、もう presentation-neutral ではありません。button は PrimeVue button であり、統合全体が必要になります。

結合関係に注意してください。**Tailwind utility は `primeVueCssUrl` と一緒に配信されます。** Tailwind 専用の Host CSS key はないため、実際には Tailwind を選んだ component は PrimeVue asset も読み込みます。通常の layout と spacing には、component を明快に保てるなら utility を優先してください。ただし utility が最適な表現でなければ、portable な module-owned CSS も有効です。（`preflightCssUrl` は key union に含まれません。shadow root 内で Tailwind preflight が本当に必要なら imperative に読み込みますが、必要になることはまれです。）

このページにとっての実務上の帰結は、**module が必要とするものの大半は backbone にすでに存在する**ということです。shared design layer はその上の狭い帯であり、PrimeVue と Tailwind がすでに扱うものを作り直す場所ではありません。仕組みは [CSS Injection](./web-host/css-injection.md)を参照してください。

### Shared design layer

application 固有の match summary、surface header row、empty state、project 固有の tag sizing vocabulary など、既知の複数 module で繰り返し使われる一方、theme に application-level contract がない概念があります。これらは shared design layer に属します。

これは**公開 package**として配布し、build 時に各 consumer へ materialize します。consumer が別々の repository にあるため、path alias ではなく package でなければなりません。producer への path access を持たない別 repository の module も vocabulary を取得して build できる必要があります。

producer module は package を **build-time artifact** として宣言し、各 consumer は自身の tree に materialize します。宣言、`node-package` format、runtime が調整する範囲、build 側で必要な glue は [Build-time Artifact](../guides/artifacts.md)を参照してください。

### Module

それ以外のすべてと、shared vocabulary から意図的に逸脱するものすべてです。

## 配置先の判断

順に問い、最初の yes を採用します。

1. **値か？** 色、radius、spacing、elevation、severity。
   → **Theme。** semantic token を読みます。literal は使いません。
2. **theme がすでに component を提供しているか？** Button、Dialog、Select、Tag。
   → **Theme。** その component を使います。調整するときは component *上*に class を置き、作り直しません。
3. **theme component に裏付けられていない同じ概念を、自分たちの 2 つ以上の module が必要とするか？**
   → **Shared design layer。**
4. それ以外 → **Module。**

## 例

例では application 固有の class と stylesheet 名に `kx-` prefix を使います。配置ルールはどの Wippy application にも適用できます。

### Theme component を作り直さない

PrimeVue は `Button` を提供します。それを native `<button>` 上の `.kx-btn` に置き換えると、interaction と外観が themed component からずれ得る 2 つ目の実装を作ることになります。

**悪い例:** native `button` 要素に `.kx-btn .kx-btn-primary` を付ける — theme がすでに提供する component の二重実装です。

**良い例:** themed component を使い、調整が必要な場合はその上に class を付けます。

```vue
<Button label="Save" class="kx-save" />
```

themed component が合わないことは、作り直してよい理由にはなりません。component に class を付け、その class を style します。調整が app-wide なら facade、local なら module に置きます。

### Severity は theme の所有物

severity、つまり `success`、`danger`、`warn`、`info` は公開済み ramp を持つ theme semantics です。module-local name で再定義すると、module 間でずれ得る競合定義を作ります。

```css
/* BAD — severity re-derived under a module-local name */
.tone-gn { color: #16a34a; }

/* GOOD — severity from the theme */
.status-dot.success { background: var(--p-success-500); }
```

*tone* を shared layer に置くことはできますが、**decorative category colour** としてだけです。severity として使ってはいけません。「失敗した」という意味になり得るなら、それは severity であり theme の所有物です。

### Theme が扱わない shared vocabulary

```css
/* GOOD — this application-specific card contract and empty-state vocabulary
   recur across modules. PrimeVue's generic Card does not define these domain
   semantics, so the shared layer owns them. */
@import "@kickside/ui-kit/kx-card.css";
@import "@kickside/ui-kit/kx-state.css";
```

### 採用とは import と削除の両方

CSS の `@import` は sheet 内のほかのすべての rule より前になければなりません。そのため shared sheet は必ず**先頭**に置かれ、module が後から宣言する同じ specificity の rule が勝ちます。package を import しつつ local copy を残した module は、実質的に何も変更していません。

```css
/* BAD — the import is inert; the local copy still wins */
@import "@kickside/ui-kit/kx-card.css";
.kx-card { border-radius: 14px; border: 1px solid var(--p-content-border-color); }

/* GOOD — import, delete the local copy, keep only a documented delta */
@import "@kickside/ui-kit/kx-card.css";
/* This surface's cards are inline in a dense list, so they lose the lift. */
.kx-card:hover { transform: none; }
```

**差分だけ**を残し、body 全体を再記述しないでください。また 1 つの名前に 2 つの意図をまとめないでください。2 つの module で class 名の意味が違うなら、同じ名前をまとった 2 つの概念です。名前を分け、一方を選んでもう一方を塗り替えないでください。

### Theme に対する specificity

module の CSS は最初に shadow root へ注入され、その後に theme の PrimeVue sheet が追加されます。どちらも `<style>` 要素なので、**document order により 2 番目の theme が勝ちます**。themed component class に勝つ必要がある module rule には、file 内の後ろの行ではなく、より高い *specificity* が必要です。（`adoptedStyleSheets` が持つのは facade の custom CSS であり theme ではないため、adopted sheet を使っても解決しません。）

これは、themed element *上*に自分の class が置かれる pass-through class で特に目立ちます。

```css
/* BAD — this class is applied to PrimeVue's own footer element, so at equal
   specificity the theme wins and the padding never applies. */
.kx-modal-foot { padding: 14px 18px; }

/* GOOD — scoped under the dialog root, so it out-specifies the theme */
.kx-modal > .kx-modal-foot { padding: 14px 18px; }
```

## Shared layer に含められるもの

複数 module が本当に共有し、theme が所有しないすべてのもの、つまり CSS vocabulary、derived token、internal component、helper、test harness を含められます。

**semantic chunk を使います。** 各 unit は consumer が理解できる 1 つの名前付き概念、たとえば `kx-card`、`kx-state`、`kx-tag` にします。consumer が必要なものだけを取れるよう、より細粒度の package を優先してください。明確な名前の unit を複数含む 1 package も機能しますが、目指す形ではありません。

**具体的な名前を使います。** `common`、`shared`、`misc`、`utils` のような catch-all unit を避けてください。内容を表さない名前の unit は無関係な概念を集め、このレイヤーが解消するはずの重複を再現します。

## 正規化は視覚的な変更

ずれた copy を統合すると rendering が変わる可能性があります。すべての定義を比較し、canonical version を選び、その理由を記録し、意図的な divergence は documented override として維持し、結果を視覚的に確認してください。unit test は layout を確認できません。

## 関連項目

- [Theming](./micro-frontends/theming.md) — token catalogue と、theme が host と child の両方へ届く仕組み
- [Compliance checklist](./micro-frontends/compliance-checklist.md) — frontend が検査される module 単位の rule
- [Build-time Artifact](../guides/artifacts.md) — package の宣言と consumer への materialize
- [Dependency Management](../guides/dependency-management.md) — module が利用するものの宣言と解決
