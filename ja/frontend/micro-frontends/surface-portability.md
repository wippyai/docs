---
title: "Surface Portability"
description: "container query、surface variable、host.surface を使い、browser viewport から独立して view.page application を size 調整する方法。"
---

# サーフェスポータビリティ :id=surface-portability

**分類: focused example を含む rendering contract reference。** CSS、JavaScript、package metadata block は個別の契約 rule を示すもので、完全な application fixture ではありません。

Micro Frontend App は Web Host が割り当てる長方形領域、**surface** を受け取ります。通常、この領域は browser window ではありません。[multi-panel layout](../web-host/multi-panel-layout.md) の一つの panel である場合があり、同じ app が同じ画面上で異なる size のどちらの [render engine](../web-host/render-engines.md) によっても描画される可能性があります。

したがって、layout を window に合わせて size 調整するのはどちらの engine でも誤りです。surface contract は CSS と JavaScript の両方に portable な代替手段を提供します。

> **Status:** contract 1、shipped。Tailwind `surface-*` variant、Host mediated scrolling、deep hit testing は**未提供**です。このページは現在存在する機能だけを記述します。

## CSS contract

### Container query

Host は app の box を `wippy-surface` と名付けるため、通常の CSS container と同様に query できます。

```css
@container wippy-surface (min-width: 640px) {
  .sidebar { display: block; }
}
```

app が占有する空間に応答するものには、`@media (min-width: 640px)` の代わりにこれを使います。native container unit も同じ box に対して解決されます。

```css
.hero { inline-size: 50cqw; }
```

### Surface variable

四つの custom property が geometry を単純な pixel length として伝えます。

| プロパティ | 意味 |
|----------|------|
| `--wippy-surface-width` | surface 全体の width |
| `--wippy-surface-width-unit` | surface width の 1% |
| `--wippy-surface-height` | surface 全体の height（container sizing のみ） |
| `--wippy-surface-height-unit` | surface height の 1%（container sizing のみ） |

これらは `vw` / `vh` の portable な代替です。

```css
/* was: inline-size: 50vw */
.panel { inline-size: calc(var(--wippy-surface-width-unit) * 50); }
```

値は継承されるため、app 内の任意の element が読めます。query box の **content box** を報告し、これは `100cqw` が解決される box と同じです。

application はこの四つの名前を宣言または代入してはいけません。descendant declaration は継承値を shadow し、app を surface から黙って切り離します。

また、これらを**登録してはいけません**。`@property` や `CSS.registerProperty()` で記述しないでください。Host は guaranteed-invalid value を代入して block axis を unavailable と示し、property が未登録の場合だけ empty string に compute されます。`initial-value` を与えると代わりにその値へ compute されるため、content-sized app が自身を container-sized と報告し、error なしで `supports('block-size')` が `true` を返し始めます。

これらの値を `100cqw` と pixel 単位で比較する際の注意は二つあります。**first frame は広くなる場合があります**。boot value は app document が存在する前に Host 側 `<iframe>` element から seed されるため、content が scrollbar を生じさせるか分かりません。その値は document の CSS に埋め込まれ、最初の layout で使われて一 frame 後に補正されます。また値は **1/64 px 単位に量子化**されるため、tolerance を使って比較してください。

## Container sizing と content sizing

| | インライン軸 | ブロック軸 |
|---|---|---|
| **Container sizing** — Host が両方の dimension を指定 | available | available |
| **Content sizing** — app content が height を決定 | available | **not available** |

content sizing では height property が意図的に invalid です。そのため `var(--wippy-surface-height, 400px)` は数値を返さず fallback し、`@container wippy-surface (min-height: …)` は一致しません。

**app author は sizing を選べず**、`package.json` の設定でも変更できません。Web Host が app を描画する場所によって決まります。

| 描画方法 | サイジング |
|---|---|
| routed page、layout panel、right panel、registry tab | **container** |
| embedded artifact、inline artifact block、navbar widget | **content** |

したがって同じ package でも、独自 route では container-sized、埋込時は content-sized です。block axis が必要な app は、それがなくても動作できるようにするか、下記の requirement を宣言して壊れた状態で描画される代わりに拒否させます。現在の mode は `host.surface.snapshot.sizing` で読み、behavior は `host.surface.supports('block-size')` で gate してください。仮定してはいけません。

`cqh` は「unavailable」より危険です。必要な axis を提供する container がない場合、container unit は **small viewport** に fallback するため、surface と無関係なもっともらしい値を黙って生成します。root-pinned で明示的に fallback する `var(--wippy-surface-height, <fallback>)` を推奨します。同じ罠は、app が intermediate element に `container-type: inline-size` を宣言し、その下で `cqh` を使う場合にもあります。

## Requirement の宣言

app の `package.json` で任意指定します。

```json
{
  "wippy": {
    "path": "index.html",
    "surface": {
      "contract": 1,
      "requirements": ["block-size"]
    }
  }
}
```

受け入れる token は `block-size` と `surface-scroll` です。どちらも container sizing を必要とし、instance が content-sized なら拒否されます。`registered-hit-testing`、`native-document-hit-testing`、`owner-visibility` は予約語であり、黙って無視されず未実装として拒否されます。

validation は startup 前に実行されるため、満たせない declaration は block-axis query が一致しない app を描画せず、明示的に失敗します。`surface` block のない app も描画され、query box と variable を受け取りますが、portability は宣言しません。

`surface-scroll` は受け入れられ `supports()` が報告しますが、この release に Host mediated scroll API は**ありません**。宣言は intent を表すだけで、method を有効化しません。

## JavaScript から surface を読む

完全な signature は [Proxy API → Surface](./proxy-api.md#surface) を参照してください。

```js
const { width, widthUnit, height, sizing } = host.surface.snapshot

if (host.surface.supports('block-size')) {
  // safe to rely on the block axis
}

const off = host.surface.onChange((s) => reposition(s.width, s.height))
// call off() on teardown
```

snapshot は CSS が解決するのと同じ computed custom property から読み戻されるため、`@container` や `cqw` が参照する値とずれません。

layout には CSS を優先してください。JavaScript API は canvas sizing、virtualization calculation、resource selection、runtime-generated style など CSS では扱えない用途に使います。

### `engine: 'host'`

`host.surface.engine` は `iframe`、`fragment`、`host` を報告します。最後の値は page engine ではなく、surface が割り当てられていない場所で code が動作していることを意味します。

- page 内ではなく Host document に直接 mount された Web Component
- Web Host が存在しない standalone dev proxy

そこでは snapshot が `width: 0`、`height: null`、`sizing: 'content'` を報告し、すべての `supports()` が `false` です。browser window を代用すると、まさにこの契約が避けるべき誤った同一視になるため、これは意図的です。直接 mount された component は自身の root を測定してください。

## 契約の対象外

container query が media query を置き換えるのは **CSS** の中だけです。次の mechanism は CSS の外にあり、browser window に従い続けます。

| メカニズム | 理由 | 対応 |
|---|---|---|
| `<picture>` / `<source media>` | HTML resource selection であり container-query 形式がない | `host.surface.onChange` で制御するか、`@container` 下の CSS `background-image` に art direction を移す |
| `srcset` + `sizes` | viewport に対して解決される | surface から `sizes` を導出するか JS で source を設定 |
| `matchMedia()` | 定義上 window に問い合わせる | geometry には `host.surface.onChange`、preference には引き続き `matchMedia` を使う |

## Overlay

surface contract は `position: fixed` を捕捉しません。`container-type` は layout containment なしに independent formatting context を確立するため、query container は `contain: none` と compute され、何も anchor しません。PrimeVue overlay と自作 fixed overlay はどちらも変更せず動作します。

engine behavior は別問題です。Web Fragment engine では `position: fixed` が app panel ではなく **Host window** に対して解決されます。[Render Engines](../web-host/render-engines.md) を参照し、正確な viewport anchoring が重要なら app を `wippy.renderEngine: "iframe"` で固定してください。

overlay の size と anchoring も別問題です。surface だけを覆う backdrop/drawer では viewport unit をやめ `inset: 0` を使いますが、app に必要な portability に合う positioning scheme と組み合わせます。

```css
/* Portable across BOTH engines: resolves against the app's own root rather
   than against whatever `fixed` happens to be relative to.
   `min-block-size: 100%` is load-bearing — see below. */
.app-root { position: relative; min-block-size: 100%; }
.backdrop { position: absolute; inset: 0; }
```

containing block は surface ではなく **app root** なので、その root が surface を覆う場合だけ overlay も覆います。content sizing では content 自体が height なので自動です。container sizing では Host が query box に height を与えても app root は継承しないため、`min-block-size: 100%` がない backdrop は surface の手前で止まります。`absolute` は content と共に scroll し、`fixed` は固定されるという behavior の違いもあります。

`min-block-size: 100%` は surface 内の**最外層** element に置きます。percentage height には上位まで definite height の連続した chain が必要です。auto-height の `#app` 内に nested した component root に適用すると zero に解決され、同じ gap が再発します。no-`min` case を control として Chromium、Firefox、WebKit で検証されています。

```css
/* Iframe engine only. `fixed` resolves against the child viewport, which IS
   the surface there — but against the HOST WINDOW in the fragment engine,
   where this covers the whole application instead of the panel. */
.backdrop { position: fixed; inset: 0; }
```

これに `var(--wippy-surface-height)` を使わないでください。content sizing では unavailable なので、backdrop が collapse します。

## App root element（`#app`） :id=the-app-root-element-app

**Web Fragment engine では root element が `id="app"` でなければなりません。** `#root`、`#main`、`<main>` ではなく、id は literal に一致します。

engine は page height chain をこの selector に bind し、そこを通じて content height を測定します。reflected document は `html` / `body` ではなく `wf-html` / `wf-body` を公開するため、iframe のように document root から chain を構築できません。

**誤っている場合の症状:** root が `#root` などである content-sized fragment page は **height zero** で描画され、blank panel になります。app code 自身には error が出ず、Host が requirement を示す error を log します。iframe engine は `CmdBodySize` から height を取得するため影響を受けず、同じ package が iframe では正しく見えて fragment では空白になることがあります。

```html
<!-- correct -->
<body><div id="app"></div></body>
```

```js
createApp(App).mount('#app')
```

**`#root` に height を与えて zero-height fragment を直そうとしないでください。** 別名の root に `height: 100%`、`min-height: 100dvh`、`100vh` を加えても engine は測定しません。viewport unit は割り当てられた surface ではなく browser window を表します。element を `app` に rename してください。

## 制限事項

- **Body box。** iframe engine は app の `body` の `margin`、`padding`、`border` を zero にして surface を明確にします。page padding は独自 root element に置きます。fragment engine はこれを行わないため、body padding に依存する app は engine 間でわずかに異なります。まだ build-time diagnostic はありません。
- **`body > *` selector と `html` / `body` を対象にする rule。** **iframe** engine では Host が body content を surface box で wrap するため、`body` を root とする direct-child selector は app element に一致せず、`body` / `html` は query box の ancestor になります。これらを対象にした `@container` rule は適用されません。**fragment** engine では query box が reflected tree の上にある逆の topology ですが、reflected document は `wf-html` / `wf-body` に rename されるため literal `body` selector はやはり失敗します。両 engine で正しい surface 内の独自 root element に rule を置いてください。
- **top-level managed panel を含め、`<w-iframe>` / `<w-artifact>` で描画するものには surface がありません。** これらの element は常に surface bootstrap を無効にして child document を構築し、何も測定しないため、`host.surface` は `width: 0`、`sizing: 'content'` を報告します。ただし `engine: 'host'` ではなく `engine: 'iframe'` です。そのように埋め込まれる可能性がある component は `engine` ではなく `snapshot.width` を確認します。nested embed では想定どおりですが、full-size top-level slot でも `{ kind: 'component', tagName: 'w-artifact' }` と宣言した managed layout panel は契約を受けません。必要な content には `kind: 'page'` を使います。
- **content sizing では block axis がありません。**
- **Fragment root selector。** fragment app は `#app` に mount する必要があります。height-chain requirement と zero-height symptom は [App root element（`#app`）](#the-app-root-element-app) を参照してください。
- **deprecated `/page/:id` route には surface がありません。** 何も測定しない bare iframe で描画されるため、完全に opt out します。query box、wrapper、app DOM への変更はありません。surface を得るには `/c/:id` を使います。nested embed と同様 `engine: 'iframe'` を報告するため、engine name ではなく `snapshot.width` を確認します。
- **二つの engine は scrollbar 分だけ異なる場合があります。** iframe engine は app document 内の query box から inline axis を測るため document scrollbar が幅を狭めます。fragment engine は Host document wrapper を測り、reflected content の scrolling では狭まりません。同じ panel と scrolling content でも fragment engine の報告値が少し広くなります。
- **isolation boundary ではありません。** 契約は layout を管理します。fragment に独立した document、viewport、selection、top layer、origin を与えません。

## 移行

[Surface Migration](./surface-migration.md) には既存 app の recipe 別変換があり、それぞれ automatic、conditional、manual、not convertible と分類されています。
