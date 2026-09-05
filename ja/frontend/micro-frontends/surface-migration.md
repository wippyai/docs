# サーフェス移行

既存のマイクロフロントエンドアプリを、ビューポートベースのレスポンシブから[サーフェス契約](./surface-portability.md)へ変換するためのレシピ集です。

各レシピにはラベルが付いています。

| ラベル | 意味 |
| --- | --- |
| **automatic** | 機械的。変換後のルールは同じ意味になります。 |
| **conditional** | 明示された前提条件が成り立つ場合にのみ安全です。確認してください。 |
| **manual** | 人間の判断が必要です。唯一の正しい書き換えは存在しません。 |
| **not convertible** | コンテナクエリの形が存在しません。`host.surface` を使うか、ビューポートの挙動を意図的に残してください。 |

以下の各レシピは、それ単体での手法です。Web ホストのリポジトリには、これらすべてを組み合わせた実行可能なページがあり、テストスイートで実行されるため、レシピが誤った手順へ腐ることはありません。

> 未出荷の作業に依存するレシピ — Tailwind の `surface-*` バリアント、ビルド時の診断、ホスト仲介のスクロール、ヒットテスト — には **not yet shipped** と印を付け、現時点で存在するものだけを記述しています。

---

## 判断ツリー: このルールは何についてのものか？

何かを変換する前に、意図を分類してください。悪い移行のほとんどは、変換すべきでなかったルールを正しく変換したものです。

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

判断がつかない場合は、そのままにして後で見直してください。変換されていないメディアクエリは単に可搬でないだけですが、誤って変換されたものは静かに壊れます。

---

## 1. `max-width` → `inline-size <=` — **automatic**

```css
/* 変更前 */ @media (max-width: 640px)                      { .nav { display: none } }
/* 変更後 */ @container wippy-surface (max-width: 640px)    { .nav { display: none } }
```

## 2. `min-width` → `inline-size >=` — **automatic**

```css
/* 変更前 */ @media (min-width: 640px)                      { .sidebar { display: block } }
/* 変更後 */ @container wippy-surface (min-width: 640px)    { .sidebar { display: block } }
```

## 3. 上下限のある幅の範囲 — **automatic**

```css
/* 変更前 */ @media (min-width: 640px) and (max-width: 1024px) { … }
/* 変更後 */ @container wippy-surface (640px <= width <= 1024px) { … }
```

範囲構文は、サーフェス契約が対象とするすべてのエンジンでサポートされています。好みであれば `and` の形も動作します。

## 4. 複数のブレークポイント、カスケード順の保持 — **automatic**

コンテナクエリは詳細度も順序も変えません。各ブロックを変換し、ソース上の順序を保ってください。

```css
@container wippy-surface (min-width: 480px)  { .grid { grid-template-columns: repeat(2, 1fr) } }
@container wippy-surface (min-width: 900px)  { .grid { grid-template-columns: repeat(4, 1fr) } }
```

## 5. 高さのクエリ — **conditional**（コンテナサイジングのみ）

```css
/* 変更後 */ @container wippy-surface (min-height: 500px) { .tall-only { display: block } }
```

前提条件: ページが**コンテナサイジング**であること。コンテンツサイジングではページの高さは自身のコンテンツによって決まるため、高さのクエリは決してマッチしません。静かに失敗するのではなく大きく失敗するよう、依存関係を宣言してください。

```json
{ "wippy": { "surface": { "contract": 1, "requirements": ["block-size"] } } }
```

## 6. アスペクト比のクエリ — **conditional**（コンテナサイジングのみ）

```css
/* 変更前 */ @media (min-aspect-ratio: 16/9)                     { … }
/* 変更後 */ @container wippy-surface (min-aspect-ratio: 16/9)   { … }
```

レシピ5と同じ前提条件です。アスペクト比は両軸を必要とします。

## 7. 向きのクエリ — **conditional**（コンテナサイジングのみ）

`@container wippy-surface (orientation: landscape)` は*自分のパネル*の形を表し、たいていはそれが意図したものです。本当にデバイスを意図していたのなら、それはメディアクエリです — そのまま残してください（レシピ13）。

## 8. コンテンツサイジングでの高さ／アスペクト比／向き — **not convertible**

クエリできるブロック軸が存在しません。レイアウトがインライン軸に依存するよう再構成してください。`cqh` で偽装してはいけません — レシピ22を参照。

アプリを自分でコンテナサイジングへ切り替えることはできません。サイジングは、Web ホストがアプリをどこでレンダリングするかによって決まり、アプリのパッケージ内の何かで決まるものではありません。ブロック軸なしでレイアウトが本当に成立しないなら、`requirements: ["block-size"]` を宣言し、誤った描画ではなくコンテンツサイジングでの配置がきっぱり拒否されるようにしたうえで、コンテナサイジングのコンテキスト（専用のルート、またはレイアウトパネル）でアプリをレンダリングさせてください。[サーフェスの可搬性](./surface-portability.md) の「コンテナサイジングとコンテンツサイジング」を参照してください。

## 9. 環境メディアクエリの中に入れ子になったジオメトリ — **manual**

```css
/* 変更前 */
@media (prefers-color-scheme: dark) and (min-width: 640px) { .panel { … } }

/* 変更後 — 分割する: プリファレンスは残し、ジオメトリを移す */
@media (prefers-color-scheme: dark) {
  @container wippy-surface (min-width: 640px) { .panel { … } }
}
```

manual である理由は、以前は1つのプレリュードで結合していた2つの条件を入れ子にすると、どの宣言が勝つかが変わりうるためです。結果を再確認してください。

## 10. カンマによる OR 分岐 — **manual**

```css
/* 変更前 */ @media (max-width: 480px), (min-width: 1200px) { … }
```

カンマは OR です。2つの `@container` ブロックへ分割して OR が保たれるのは、**2つのブロックが他の点で同一かつ隣接している場合のみ**です。うっかり入れ子にすると OR が AND になり、何にもマッチしなくなります。宣言を2つの兄弟ブロックへ複製してください。

```css
@container wippy-surface (max-width: 480px)  { … }
@container wippy-surface (min-width: 1200px) { … }
```

## 11. `not`、`only`、複雑なブール式 — **manual**

`only` はメディアタイプに由来する遺物であり、コンテナに等価物はありません — 削除してください。`not` はどちらの構文でも条件全体を反転させますが、`and`/`or` を混ぜた途端に優先順位が異なります。元のグループ化を信頼せず、明示的に括弧を付けてください。

## 12. ジオメトリと組み合わせた `screen` / `print` — **manual**

メディア*タイプ*にはコンテナの形がありません。タイプはメディアクエリとして残し、その内側にジオメトリを入れ子にしてください（レシピ9と同様）。特に印刷レイアウトは、通常は完全にビューポート／ページベースのままにすべきです。

## 13. プリファレンスはメディアクエリのまま — **not convertible**（そしてそのままが正しい）

`prefers-color-scheme`、`prefers-contrast`、`prefers-reduced-motion`、`forced-colors`、`hover`、`pointer`、`any-pointer`。`@container` はサイズ特性のみをサポートします。これらを変換すると、決してマッチしないルールができあがります。

## 14. `em` のブレークポイント — **manual**

`@media (min-width: 40em)` は `em` を初期フォントサイズに対して解決します。`@container wippy-surface (min-width: 40em)` は**コンテナの**フォントサイズに対して解決します。両者が異なれば、ブレークポイントが静かに移動します。`px` へ変換するか、まずコンテナの計算済み `font-size` を確認してください。

## 15. `rem` のブレークポイント — **manual**

`@media` の内側では、`rem` はルート相対では**ありません**。メディアクエリの条件は `em` も `rem` も*初期*フォントサイズ — 作者の CSS に依存しないブラウザーのデフォルト — に対して解決しますが、`@container` は通常どおり、実際の計算済みルート／コンテナのフォントサイズに対して解決します。

つまり、ルートのフォントサイズがブラウザーのデフォルトと異なった瞬間から両者は一致しておらず、実行時に何かが変わるわけではありません。よくある `html { font-size: 62.5% }` のリセットだけで、変換後のブレークポイントは 640px から 400px へ動きます。

したがって「ルートのフォントサイズを変えるものは何もない」は十分な前提条件では**ありません**。ルートの計算済みフォントサイズがブラウザーのデフォルトと等しいと証明できない限り、`em`（レシピ14）とまったく同じく `px` へ変換してください。

## 16. ビューポートとコンテンツボックスのスクロールバー境界 — **conditional**

`100vw` は従来のスクロールバーの溝を含みます。**iframe エンジン**では、サーフェス幅はアプリのドキュメント内にあるクエリボックスの**コンテンツボックス**なので、これを含みません。ドキュメントにスクロールバーのあるページでは、変換後の値はスクロールバーの幅だけ狭くなり、たいていはそれが望んでいた補正です（`100vw` による横方向のはみ出しは古典的なバグです）。

**フラグメントエンジン**は、コンテンツのスクロールによって狭まらないホストドキュメント側のラッパーを測るため、その補正は適用されません。同じパネル、同じスクロールするコンテンツで、幅がスクロールバーの分だけ異なります。したがってこのレシピの条件は、単に位置がピクセル単位で一致するかどうかではなく、*アプリがどちらのエンジンで動くか*です。

## 17. `html` / `body` を対象にしたルール — **manual**

コンテナクエリは自身のコンテナにスタイルを当てることはなく、`html` や `body` を狙ったルールは両方のエンジンで失敗します — 理由は異なります。

- **iframe エンジン:** ホストが body のコンテンツをサーフェスボックスで包むため、`html` と `body` はクエリコンテナの*祖先*です。`@container` のルールは祖先に届きません。
- **フラグメントエンジン:** トポロジーは逆で、クエリボックスはコンテンツの*上*にあるホストドキュメントのラッパーです。それでも文字どおりの `body` セレクターは失敗します。反映されたドキュメントは `wf-html` / `wf-body` へ名前が変わっているためです。

いずれにせよ修正は同じで、エンジンに依存しません。

```css
/* ✗ 静かに決してマッチしない */
@container wippy-surface (min-width: 640px) { body { display: flex } }

/* ✓ サーフェス内にある自分のルートへ移す */
@container wippy-surface (min-width: 640px) { #app { display: flex } }
```

## 18. `<picture><source media>` と `<link media>` — **not convertible**

HTML レベルのリソース選択にはコンテナクエリの形がありません。`host.surface.onChange` を使って JS から駆動するか、契約が適用される CSS へアートディレクションを移してください（`@container` ルール配下の `background-image`）。

## 19. ジオメトリの `matchMedia()` → `host.surface` — **automatic**

```js
// 変更前
const mq = matchMedia('(min-width: 640px)')
mq.addEventListener('change', render)

// 変更後
const off = host.surface.onChange(s => render(s.width >= 640))
render(host.surface.snapshot.width >= 640)
// 破棄時に off() を呼ぶ
```

プリファレンスのクエリには `matchMedia` を使い続けてください — 誤っているのはジオメトリだけです。

## 20. ランタイム CSS、adopted stylesheet、CSS-in-JS — **manual**

`@container wippy-surface (...)` のルールを出力し、CSS に応答させるほうを優先してください。JS でピクセルを計算する場合は `onChange` から再生成してください — `snapshot` から一度読んだ値は固定されており、次のリサイズで同期がずれます。予約されている4つの `--wippy-surface-*` 名を自分で出力してはいけません。また、それらを `@property` / `CSS.registerProperty()` で登録してもいけません — 登録するとホストの「ブロック軸が利用不可」というシグナルが無効になり、コンテンツサイジングのアプリが静かに自分をコンテナサイジングだと報告してしまいます。子孫での宣言は継承された値を覆い隠し、ページをサーフェスから外してしまいます。

## 21. サードパーティの同梱 CSS — **manual**

通常は編集できません。優先順位の高い順に、`host.surface` から渡すブレークポイント／幅を受け付けるようライブラリを設定する、自前のコンテナで包んで変換する、あるいはページを iframe エンジンにピン留め（`wippy.renderEngine: "iframe"`）してウィンドウベースの挙動を受け入れる、です。これらを自動的に見つけるビルド時のスキャンは **not yet shipped** です。

## 22. 入れ子のコンテナと `cq*` のフォールバックの罠 — **manual**

コンテナ単位は、必要な軸を持つ*最も近い*コンテナに対して解決されます。帰結は2つあります。

```css
.card { container-type: inline-size; }   /* ブロック軸を持たない */
.card .thing { block-size: 25cqh; }      /* ✗ 静かに small viewport を使う */
```

`cqh`/`cqb` は、ブロック軸を持つコンテナが見つからなくてもエラーになりません — small viewport にフォールバックし、もっともらしい誤った数値を描画します。サーフェスのブロック軸が欲しいときは `var(--wippy-surface-height, <fallback>)` を使ってください。これはルートにピン留めされているため、より近いコンテナが横取りできず、利用できないときは目に見えてフォールバックします。

コンポーネントのクエリは追加的なものであって置き換えではありません。入れ子のコンテナの内側からでも、`wippy-surface` は依然としてページの領域を指します。

---

## ビューポート単位

| 以前 | 使うもの | 備考 |
| --- | --- | --- |
| `100vw` | `var(--wippy-surface-width)` | コンテンツボックス。レシピ16を参照 |
| `1vw` / `37vw` | `calc(var(--wippy-surface-width-unit) * 37)` または `37cqw` | 単位は1% |
| `100vh` | `var(--wippy-surface-height)` | コンテナサイジングのみ |
| `1vh` / `37vh` | `calc(var(--wippy-surface-height-unit) * 37)` | コンテナサイジングのみ |
| `vmin` | `min(var(--wippy-surface-width), var(--wippy-surface-height))` | コンテナサイジングのみ — 両軸が必要 |
| `vmax` | `max(var(--wippy-surface-width), var(--wippy-surface-height))` | コンテナサイジングのみ |
| `vi` / `vb` | `cqi` / `cqb`、または物理変数 | 論理軸。サーフェスの変数は物理軸です |
| `sv*` / `lv*` / `dv*` | `var(--wippy-surface-*)` | **個別の等価物はありません。** これらはパネルが持たないブラウザークロームの状態を表します。サーフェスのサイズは1つです |

`sv*`/`lv*` は実在の CSS 単位です — 「サーフェス」を意味するものでは**ありません**。

### 計算

```css
/* 変更前 */ block-size: calc(100vh - 4rem);
/* 変更後 */ block-size: calc(var(--wippy-surface-height, 400px) - 4rem);
```

フォールバックは `100vh` ではなく、意図的に固定された明らかに誤った値にしています — 下の「フォールバックの陰に契約の欠如を隠さない」を参照してください。これはインライン軸よりもブロック軸で重要です。高さは契約が存在しない場合だけでなく**すべての**コンテンツサイジングの配置で無効になるため、`100vh` のフォールバックはアプリが最初に埋め込まれた時点で静かにウィンドウの高さを描画してしまいます。

`min()`/`max()`/`clamp()` はそのまま変換できます。内側の単位を置き換えてください。

### `100%` のほうがサーフェスの値より適しているとき

要素が**親**を埋めるべきなら、`100%` または `w-full` を使ってください。`--wippy-surface-width` に手を伸ばすのは、*ページ*の領域そのものが必要なとき — 通常は祖先が狭く、そこから抜け出したいとき — に限ります。親相対であるべきものをルートにピン留めすると、ある入れ子の深さでは正しく、別の深さでは誤ったレイアウトになります。

### フォールバックの陰に契約の欠如を隠さない

```css
/* ✗ */ inline-size: var(--wippy-surface-width, 100vw);
```

これは契約が存在しないときにウィンドウ幅で描画します — 契約が防ぐために存在するまさにそのバグを、見えなくしたものです。目に見えて失敗させるか、明らかに誤った固定のフォールバック（`400px`）を選んで気付けるようにしてください。

---

## オーバーレイ

サーフェス契約は `position: fixed` を**捕捉しません** — `container-type` はレイアウトの封じ込めなしに独立したフォーマットコンテキストを確立するため、クエリコンテナは `contain: none` と計算され、何もアンカーしません。これは Chromium、Firefox、WebKit で検証済みです。PrimeVue のオーバーレイも手書きの fixed オーバーレイも動き続けるため、**位置指定に移行は不要です**。

移行が必要なのは*サイズ指定*のほうです。サーフェスを覆うことを意図したオーバーレイは `inset: 0` を使うべきです — `100vw`/`100vh` はブラウザーウィンドウを測るためマルチパネルのホストでは過大になり、`var(--wippy-surface-height)` はコンテンツサイジングでは利用できません。両方のエンジンで動作させる必要があるなら、アプリ自身の `position: relative` なルートの内側で `inset: 0` と `position: absolute` を組み合わせてください。`position: fixed` が正しいのは iframe エンジンだけで、理由はすぐ下のとおりです。

注意が必要なのは契約ではなくエンジンです。Web Fragment エンジンでは `position: fixed` が自分のパネルではなく**ホストウィンドウ**に対して解決されます。[レンダリングエンジン](../web-host/render-engines.md) を参照し、それが問題になるなら `wippy.renderEngine: "iframe"` でアプリをピン留めしてください。

ホストが仲介するオーバーレイの配置と `host.surface` のスクロールヘルパーは **not yet shipped** です。

---

## チェックリスト

1. 各ルールを分類する（ページ／コンポーネント／プリファレンス／意図的なウィンドウ）。
2. ページ意図のジオメトリを `@container wippy-surface` へ変換する。
3. ビューポート単位をサーフェスの変数へ置き換える。
4. `html`/`body` を対象にしていたルールを、自分のルート要素へ移す。
5. `em` のブレークポイントを再確認する。
6. ブロック軸に依存する場合は `requirements` を宣言する。
7. **両方のエンジンで、かつ両方のサイジングで**ページを実行する — この移行が実際に切り替えるのはコンテナとコンテンツであり、アプリはルーティングではなく埋め込まれるときは常にコンテンツサイジングになります。どちらにいるかは `host.surface.snapshot.sizing` で確認し、ブロック軸の挙動は `host.surface.supports('block-size')` でゲートしてください。
