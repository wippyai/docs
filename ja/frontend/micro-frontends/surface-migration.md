---
title: "Surface Migration"
description: "viewport-based responsive rule を Wippy surface contract へ変換する recipe。"
---

# Surface Migration

**分類: 部分的な migration recipe 集。** 各 before/after block は一つの pattern だけを変換します。stylesheet 全体へ decision tree を適用し、両 render engine と両 sizing mode で page を検証してください。

既存 Micro Frontend App を viewport-based responsiveness から [surface contract](./surface-portability.md) へ変換する recipe です。

| Label | 意味 |
|---|---|
| **automatic** | 機械的変換で意味が変わらない。 |
| **conditional** | 記載した前提条件を満たす場合だけ安全。必ず確認する。 |
| **manual** | 人の判断が必要で、正しい書換えは一つではない。 |
| **not convertible** | container-query 形式がない。`host.surface` を使うか、意図的に viewport behavior を維持する。 |

各 recipe は一つの technique だけを示します。Web Host repository には、それらを組み合わせた実行可能な page と test suite があります。

> Tailwind `surface-*` variant、build-time diagnostic、Host-mediated scrolling、hit testing など未提供機能に依存する recipe は **not yet shipped** と記し、現在存在するものだけを説明します。

---

## 判断ツリー: このルールは何に応答するか

変換前に intent を分類します。元の rule が surface-relative でなければ、機械的に正しい変換でも誤りです。

```text
Does the rule respond to how much room THIS PAGE has?
├── yes → convert to @container wippy-surface        (recipes 1-8)
├── no, it responds to one COMPONENT's width
│        → give that component its own container      (recipe 22)
├── no, it responds to a user/device PREFERENCE
│        → leave it as @media                         (recipe 13)
└── no, it deliberately tracks the BROWSER WINDOW
         (a true full-window overlay)
         → leave it, and document why
```

判断できなければ変更せず、後で見直します。未変換の media query は non-portable なだけですが、誤って変換すると黙って壊れます。

---

## 1. `max-width` → `inline-size <=` — **自動**

```css
/* before */ @media (max-width: 640px)                      { .nav { display: none } }
/* after  */ @container wippy-surface (max-width: 640px)    { .nav { display: none } }
```

## 2. `min-width` → `inline-size >=` — **自動**

```css
/* before */ @media (min-width: 640px)                      { .sidebar { display: block } }
/* after  */ @container wippy-surface (min-width: 640px)    { .sidebar { display: block } }
```

## 3. 幅の範囲 — **自動**

```css
/* before */ @media (min-width: 640px) and (max-width: 1024px) { … }
/* after  */ @container wippy-surface (640px <= width <= 1024px) { … }
```

surface contract が対象とする全 engine で range syntax を使えます。必要なら `and` 形式も使えます。

## 4. 複数の breakpoint と cascade order を維持 — **自動**

container query は specificity や順序を変えません。各 block を変換し、source order を維持します。

```css
@container wippy-surface (min-width: 480px)  { .grid { grid-template-columns: repeat(2, 1fr) } }
@container wippy-surface (min-width: 900px)  { .grid { grid-template-columns: repeat(4, 1fr) } }
```

## 5. 高さクエリ — **条件付き**（container sizing のみ）

```css
/* after */ @container wippy-surface (min-height: 500px) { .tall-only { display: block } }
```

前提: page が **container-sized** であること。content sizing では height は content 自身なので query は一致しません。黙って失敗せず明示的に拒否されるよう dependency を宣言します。

```json
{ "wippy": { "surface": { "contract": 1, "requirements": ["block-size"] } } }
```

## 6. アスペクト比クエリ — **条件付き**（container sizing のみ）

```css
/* before */ @media (min-aspect-ratio: 16/9)                     { … }
/* after  */ @container wippy-surface (min-aspect-ratio: 16/9)   { … }
```

recipe 5 と同じく、aspect ratio には両 axis が必要です。

## 7. 向きクエリ — **条件付き**（container sizing のみ）

`@container wippy-surface (orientation: landscape)` は panel 自身の形を表し、多くの場合これが意図です。本当に device orientation を指すなら media query のままにします（recipe 13）。

## 8. content sizing での高さ / アスペクト比 / 向き — **変換不可**

query できる block axis がありません。inline axis だけに依存する layout へ再構成し、`cqh` で偽装しないでください（recipe 22）。

app 自身で container sizing へ切り替えることはできません。sizing は package ではなく Web Host が描画する場所で決まります。block axis なしでは動作できないなら `requirements: ["block-size"]` を宣言し、content-sized placement を拒否させ、独自 route や layout panel など container-sized context に app を置きます。[Surface Portability](./surface-portability.md) の「Container sizing と content sizing」を参照してください。

## 9. 環境 media query 内のジオメトリ — **手動**

```css
/* before */
@media (prefers-color-scheme: dark) and (min-width: 640px) { .panel { … } }

/* after — split: the preference stays, the geometry moves */
@media (prefers-color-scheme: dark) {
  @container wippy-surface (min-width: 640px) { .panel { … } }
}
```

以前一つの prelude にあった条件を分けると nesting order により declaration の勝敗が変わるため、結果を再確認します。

## 10. カンマ区切りの OR 分岐 — **手動**

```css
/* before */ @media (max-width: 480px), (min-width: 1200px) { … }
```

comma は OR です。同一かつ隣接する二つの `@container` block に分ける場合だけ OR を維持できます。nest すると AND になり一致しません。declaration を sibling block に複製します。

```css
@container wippy-surface (max-width: 480px)  { … }
@container wippy-surface (min-width: 1200px) { … }
```

## 11. `not`、`only`、複雑な Boolean — **手動**

`only` は media-type artifact で container equivalent がないため削除します。`not` はどちらの syntax でも条件全体を反転しますが、`and` / `or` を混ぜると precedence が異なります。元の grouping を信用せず明示的に parenthesize してください。

## 12. ジオメトリと組み合わせた `screen` / `print` — **手動**

media **type** には container form がありません。type を media query として残し、その内側へ geometry を nest します（recipe 9）。特に print layout は通常 viewport/page-based のままにします。

## 13. ユーザー設定は media query のまま — **変換不可**（現状のままで正しい）

`prefers-color-scheme`、`prefers-contrast`、`prefers-reduced-motion`、`forced-colors`、`hover`、`pointer`、`any-pointer`。`@container` は size feature だけを扱うため、変換すると一致しません。

## 14. `em` breakpoint — **手動**

`@media (min-width: 40em)` の `em` は initial font size に対して解決されます。`@container wippy-surface (min-width: 40em)` では **container** の font size に対して解決されます。異なると breakpoint が黙って移動するため、`px` へ変換するか container の computed `font-size` を先に確認します。

## 15. `rem` breakpoint — **手動**

`@media` 内の `rem` は root-relative ではありません。media-query condition では `em` と `rem` の両方が author CSS と無関係な browser default の *initial* font size に対して解決され、`@container` では通常どおり実際の computed root/container font size に対して解決されます。

したがって runtime change がなくても root font size が browser default と違えば両者は異なります。一般的な `html { font-size: 62.5% }` reset だけで、変換後 breakpoint は 640px から 400px へ移動します。「root font size が変わらない」だけでは十分な前提ではありません。root の computed font size が browser default と等しいと証明できなければ recipe 14 と同様 `px` へ変換します。

## 16. viewport と content-box の scrollbar 境界 — **条件付き**

`100vw` は classic scrollbar gutter を含みます。**iframe engine** の surface width は app document 内 query box の **content box** なので含まず、document scrollbar がある page では変換後の値が scrollbar 幅だけ狭くなります。通常これは `100vw` の horizontal overflow bug を直す望ましい補正です。

**fragment engine** は content scrolling で狭くならない Host document wrapper を測定するため、その補正を行いません。同じ panel と content でも幅が scrollbar 分違います。条件は pixel-exact alignment だけでなく、どの engine で app が動くかです。

## 17. `html` / `body` を対象にするルール — **手動**

container query は自身の container を style できず、`html` / `body` を対象とする rule は両 engine で異なる理由により失敗します。

- **Iframe engine:** Host が body content を surface box で wrap し、`html` / `body` は query container の ancestor になるため到達できません。
- **Fragment engine:** query box は content より上ですが、reflected document が `wf-html` / `wf-body` に rename されるため literal `body` selector は失敗します。

どちらでも engine-safe な修正は同じです。

```css
/* ✗ silently never matches */
@container wippy-surface (min-width: 640px) { body { display: flex } }

/* ✓ move it to your own root inside the surface */
@container wippy-surface (min-width: 640px) { #app { display: flex } }
```

## 18. `<picture><source media>` と `<link media>` — **変換不可**

HTML-level resource selection に container-query form はありません。JS の `host.surface.onChange` で制御するか、contract が適用される CSS（`@container` rule 下の `background-image`）へ art direction を移します。

## 19. ジオメトリの `matchMedia()` → `host.surface` — **自動**

```js
// before
const mq = matchMedia('(min-width: 640px)')
mq.addEventListener('change', render)

// after
import { host } from '@wippy-fe/proxy'

const off = host.surface.onChange(s => render(s.width >= 640))
render(host.surface.snapshot.width >= 640)
// call off() on teardown
```

preference query には `matchMedia` を残します。誤りなのは geometry だけです。

## 20. ランタイム CSS、adopted stylesheet、CSS-in-JS — **手動**

`@container wippy-surface (...)` rule を出力し、CSS 自身に応答させる方法を優先します。JS で pixel を計算するなら `onChange` から再生成してください。`snapshot` から一度だけ読んだ値は固定され、次の resize で同期が外れます。予約された四つの `--wippy-surface-*` name を出力したり、`@property` / `CSS.registerProperty()` で登録してはいけません。登録すると Host の「block axis unavailable」signal が無効になり、content-sized app が自身を container-sized と誤報告します。descendant declaration は継承値を shadow して page を surface から切り離します。

## 21. サードパーティ製バンドル CSS — **手動**

通常は編集できません。優先順に、library を `host.surface` から与える breakpoint/width を受け入れるよう設定する、独自 container で wrap して変換する、page を iframe engine（`wippy.renderEngine: "iframe"`）に固定して window-based behavior を受け入れる、のいずれかを選びます。自動検出する build-time scan は **not yet shipped** です。

## 22. ネストしたコンテナと `cq*` fallback の落とし穴 — **手動**

container unit は必要な axis を持つ最も近い container に対して解決されます。

```css
.card { container-type: inline-size; }   /* has NO block axis */
.card .thing { block-size: 25cqh; }      /* ✗ silently uses the small viewport */
```

block-axis container が見つからなくても `cqh` / `cqb` は error にならず、small viewport に fallback してもっともらしい誤った値を描画します。surface の block axis が必要なら `var(--wippy-surface-height, <fallback>)` を使います。root-pinned なので近い container に遮られず、unavailable のとき明示的に fallback します。

component query は追加的です。nested container の内側でも `wippy-surface` は page area を指し続けます。

---

## ビューポート単位

| 以前 | 使用するもの | 注記 |
|---|---|---|
| `100vw` | `var(--wippy-surface-width)` | content box。recipe 16 参照 |
| `1vw` / `37vw` | `calc(var(--wippy-surface-width-unit) * 37)` または `37cqw` | unit は 1% |
| `100vh` | `var(--wippy-surface-height)` | container sizing のみ |
| `1vh` / `37vh` | `calc(var(--wippy-surface-height-unit) * 37)` | container sizing のみ |
| `vmin` | `min(var(--wippy-surface-width), var(--wippy-surface-height))` | container sizing のみ。両 axis が必要 |
| `vmax` | `max(var(--wippy-surface-width), var(--wippy-surface-height))` | container sizing のみ |
| `vi` / `vb` | `cqi` / `cqb`、または physical variable | logical。surface variable は physical |
| `sv*` / `lv*` / `dv*` | `var(--wippy-surface-*)` | **別の equivalent はない。** panel にはない browser-chrome state を表し、surface size は一つだけ |

`sv*` / `lv*` は実在する CSS unit であり、「surface」を意味しません。

### 計算

```css
/* before */ block-size: calc(100vh - 4rem);
/* after  */ block-size: calc(var(--wippy-surface-height, 400px) - 4rem);
```

fallback は意図的に固定で明らかに誤った値です。`100vh` ではありません。後述の「欠落した契約を fallback で隠さない」を参照してください。特に block axis の height は契約がない場合だけでなく**すべての** content-sized placement で invalid なので、`100vh` fallback は app が初めて埋め込まれたときに window height を黙って描画します。

`min()` / `max()` / `clamp()` は内部の unit だけを置換します。

### `100%` が surface value より適切な場合

element が **parent** を満たすなら `100%` または `w-full` を使います。特に ancestor が狭く、それを越えて page area が必要な場合だけ `--wippy-surface-width` を使います。parent-relative であるべきものを root-pin すると、ある nesting depth だけで正しく、別の depth では壊れます。

### 欠落した契約を fallback で隠さない

```css
/* ✗ */ inline-size: var(--wippy-surface-width, 100vw);
```

これは契約がない場合に window-width を描画し、契約が防ぐべき bug を不可視にします。明示的に失敗させるか、`400px` のように明らかに誤りと分かる固定 fallback を選びます。

---

## オーバーレイ

surface contract は `position: fixed` を捕捉しません。`container-type` は layout containment なしに independent formatting context を確立するため query container は `contain: none` と compute され、何も anchor しません。Chromium、Firefox、WebKit で検証済みです。PrimeVue overlay と自作 fixed overlay は変更なしで動くため、**positioning の migration は不要**です。

ただし sizing は変更が必要です。surface を覆う overlay は `inset: 0` を使います。browser window を測り multi-panel Host で overshoot する `100vw` / `100vh` や、content sizing で unavailable な `var(--wippy-surface-height)` は使いません。両 engine で動作する必要があるなら app 独自の `position: relative` root 内で `position: absolute` と組み合わせます。`position: fixed` が正しいのは iframe engine だけです。

注意が必要なのは契約ではなく engine です。Web Fragment engine の `position: fixed` は panel ではなく **Host window** に対して解決されます。[Render Engines](../web-host/render-engines.md) を参照し、必要なら `wippy.renderEngine: "iframe"` で固定します。

Host-mediated overlay placement と `host.surface` scroll helper は **not yet shipped** です。

---

## チェックリスト

1. 各 rule を分類する（page / component / preference / deliberate window）。
2. page-intent geometry を `@container wippy-surface` へ変換する。
3. viewport unit を surface variable へ置換する。
4. `html` / `body` を対象にした rule を独自 root element へ移す。
5. `em` breakpoint を再確認する。
6. block axis に依存するなら `requirements` を宣言する。
7. page を両 engine と両 sizing（container/content）で実行する。app は routed ではなく embedded の場合 content-sized になる。現在値は `host.surface.snapshot.sizing` で確認し、block-axis behavior は `host.surface.supports('block-size')` で gate する。
