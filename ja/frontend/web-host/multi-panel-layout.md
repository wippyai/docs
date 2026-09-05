---
title: "マルチパネルレイアウト"
description: "マネージドレイアウトモードは、標準の Wippy クロームを完全に宣言的なパネルツリーへ置き換えます。固定のチャットとサイドバーのシェルの代わりに…"
---

# マルチパネルレイアウト

> **ステータス: Draft 1（プレビュー）— 早期アクセス、本番向けではありません。** マネージドレイアウトの API は出荷済みですが、本番のコンシューマーで十分に実戦検証されていません。フィールド名、デフォルト値、検証ルールはマイナーリリース間で変わる可能性があります。このラベルが外れるまでは、CDN の正確なバージョンにピン留めしてください。**ほとんどすべてのアプリケーションでは、標準の `compat` モードが推奨される本番モードです** — クローム自体を組み立てる必要が本当にあるときだけ、マネージドレイアウトに手を伸ばしてください。

マネージドレイアウトモードは、標準の Wippy クロームを完全に宣言的なパネルツリーへ置き換えます。固定のチャットとサイドバーのシェルの代わりに、名前付きパネルのツリーをバックエンドの YAML で記述します。Web ホストは起動時にレイアウトを組み立て、検証し、実行時にリアクティブに維持します。パネルはページのリロードなしにリサイズ、折りたたみ、入れ替え、追加、削除ができます。

## マネージドレイアウトを使うとき

標準の `compat` モード（デフォルト）は、固定された Wippy プロダクト、すなわちナビサイドバー、チャットパネル、ページ領域、右のアーティファクトパネルを提供します。これは現行でもっとも使われている本番モードであり、ほとんどすべてのアプリケーションにとって十分です。

`fe_mode = managed`（早期アクセス）にオプトインするのは、クローム自体を組み立てる必要があるときだけにしてください。

| 必要なもの | Compat | Managed |
|------|--------|---------|
| 標準の Wippy チャット + ナビ | あり | 置き換え可能 |
| 複数のページスロットを横並びに | 不可 | 可能 |
| カスタムのサイドバーやコーディネーターコンポーネント | 限定的 | 可能 — 任意のパネル種別 |
| ブレークポイントごとのレスポンシブレイアウト | 不可 | 可能 |
| 浮動するオーバーレイパネル | 不可 | 可能 |
| ヘッドレスのコーディネーターコンポーネント | 不可 | 可能（`coordinators`） |
| パネルごとの URL 対応ルーティング | メインパネルのみ | すべての `kind: page` パネル |
| パネル間のメッセージバス | 不可 | 可能（`broadcast`/`send`/`on`） |

## 互換性

マネージドレイアウトは Web ホスト、ファサード、いくつかの `@wippy-fe/*` パッケージにまたがります。対象の Web ホストのリリースに正確に対応する、互換性のあるパッケージ群をひとそろい使い、その配信されるインポートマップを検証してください。無関係なリリースのパッケージバージョンを混ぜてはいけません。

### リリース対応表

| リリース | マネージドレイアウトの追加点 |
|---|---|
| Web ホスト `1.0.50`、Wippy FE `0.0.50` | 型付きの compat インテント、`@HOST/compat-coordinator`、ブラウザー URL と戻る／進むの同期、組み込みのパネルタブ、アンカー付きの浮動パネル、`useSwapBuffer()`。 |
| Web ホスト `1.0.51`、Wippy FE `0.0.51` | リアクティブかつ競合状態に安全な `<wippy-chat>` のセッション／トークン制御、オプトインのテーマ対応スプリッターハンドル、分割軸のみのサイズ制約、ドロワーのジオメトリ／重なりの修正、同梱されたプロキシのソースマップ。 |
| Web ホスト `1.0.52`、Wippy FE `0.0.52` | 型付きの保持 WC の可視性と `useHostVisibilityRefresh()`、14秒のフォールバックを待たない即時のページ準備完了、古いレンダラーキーの拒否、コンポーネント prop のインプレース更新、`--wippy-layout-splitter-z-index` を伴う分離されたスプリッターレイヤー。 |

14秒のページ表示は Web ホスト `1.0.52` のフォールバックであり、1.0.51 の機能でもアプリケーションの読み込み遅延でもありません。分割軸のサイズ指定とリアクティブなチャットは 1.0.51 で入りました。保持された可視性、キー付きの準備完了、スプリッターのレイヤー化は 1.0.52 で入りました。

保持された直接 Web コンポーネントの可視性には、Web ホスト `1.0.52` と、`@wippy-fe/webcomponent-core`、`@wippy-fe/webcomponent-vue`、`@wippy-fe/shared` の `0.0.52` が必要です。それ以前のマネージドレイアウトのリリースは、型付きの `data-wippy-visible` 契約も `useHostVisibilityRefresh()` も提供しません。

### 保持された Web コンポーネントのアクティビティ

マネージドレイアウトは、バッファーの入れ替え、ブレークポイントの変更、ドロワーの開閉サイクルをまたいでパネルをマウントしたまま保ちます。ホストは、直接のカスタム要素を接続する前に `data-wippy-visible="true" | "false"` を設定し、論理的な所有権が変わったときにその場で更新します。これは CSS、ビューポート、ドキュメントの可視性ではなく、再マウントを意味することもありません。

Vue コンポーネントは `useHostVisibility()` でこの状態を読むか、`useHostVisibilityRefresh(task)` によって通常の初期読み込みと再表示時のリフレッシュを組み合わせます。後者はマウント後に実行され、その後は厳密な `false -> true` のときにのみ実行されます。直接の WC でプロキシの `@visibility` トピックを使ってはいけません。それは iframe / Web Fragment のメッセージチャネルです。

Draft 1 のラベルが外れるまでは、CDN の正確なタグ — 少なくとも `https://web-host.wippy.ai/webcomponents-1.0.52` — にピン留めしてください。

## マネージドレイアウトの有効化

ファサードの設定でマネージドのエントリを有効にし、バックエンドの `host_config.layout` 宣言を用意します。

```yaml
host_config:
  layout:
    layouts:
      default:
        direction: horizontal
        children:
          - panel: nav
            size: 240px
          - panel: main
            size: 1fr
            main: true
    panels:
      nav:  { kind: builtin, id: '@HOST/nav-sidebar' }
      main: { kind: page,    id: home }
```

マネージドのエントリが選択されると、ファサードは `module.js` の代わりに `managed-layout.js` を配信します。`fe_mode` は現行のファサードの要件パラメーター（デフォルト `compat`、オプトインで `managed`）であり、`wippy.facade` の requirement に設定するもので、`AppConfig` のペイロードには含まれません。`AppConfig.feature` フィールドは存在しません — マネージドレイアウトは完全に `AppConfig.hostConfig.layout` を通じて子へ伝えられます。プロキシ API の*サーフェス*は両モードで同一ですが、一方のモードでしか効かないコマンドもあります — [どのモードで何が動くか](#what-works-in-which-mode) を参照してください。

## `HostLayoutDeclaration`

レイアウト全体は、ファサード設定のバックエンド `host_config.layout` の下に入れ子になった単一の `HostLayoutDeclaration` オブジェクトで記述され、フロントエンドの `AppConfig.hostConfig.layout` へ投影されます。ホストはマウント前にこれを検証します — `LayoutValidationError` はブラウザーのコンソールに `{ kind, message, panelId? }` として現れます。

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `layouts` | `Record<string, PanelTree> & { default: PanelTree }` | ブレークポイントをキーとしたパネルツリー。`default` キーは必須です。 |
| `breakpoints?` | `Record<string, number>` | default 以外のレイアウトキーを有効化するピクセル幅。 |
| `panels` | `Record<string, HostPanelDef>` | 名前付きのパネルコンテンツ定義。 |
| `floating?` | `Record<string, HostFloatingDef>` | 起動時の浮動オーバーレイパネル。 |
| `modals?` | `Record<string, HostModalDef>` | 起動時のモーダル定義。 |
| `coordinators?` | `Record<string, HostCoordinatorDef>` | ヘッドレスのコーディネーターコンポーネント。 |
| `services?` | `Record<string, HostCoordinatorDef>` | `coordinators` の非推奨エイリアス。新しい宣言では `coordinators` を使ってください。 |
| `dragEnabled?` | boolean | ユーザーによるスプリッターのドラッグを許可します。デフォルトは `true`。 |

## パネルの種別

`panels`、`floating`、`modals`、`coordinators` の各エントリは、`kind` によるタグ付きユニオンです。

| 種別 | 説明 | 必須フィールド |
|------|-------------|-----------------|
| `page` | srcdoc iframe にマウントされる Wippy のページモジュール | `id`（ページのレジストリ ID） |
| `artifact` | srcdoc iframe にマウントされる Wippy のアーティファクト | `id`（アーティファクトの UUID） |
| `component` | ホストの DOM へ直接マウントされる Web コンポーネント | `tagName` |
| `builtin` | フレームワークが所有するホストコンポーネント（下記参照） | `id` |

レイアウトツリー内で `main: true` を持つパネルはちょうど1つでなければなりません。ブラウザー URL の所有権には、`@HOST/compat-coordinator` または同等のコンシューマー側の調整によるルート同期が引き続き必要です。他のすべてのパネルは、自身の iframe 内で独立してルーティングします。

### 組み込みのパネル ID

`kind: builtin` は次の `id` 値を受け付けます。`@HOST/` プレフィックスはフレームワークが所有するパネル用に予約されています。

| ID | 描画されるもの |
|----|-----------------|
| `@HOST/nav-sidebar` | 標準の Wippy ナビサイドバー（セッション、ページ、設定） |
| `@HOST/chat-wrapper` | アクティブなセッション向けの標準 Wippy チャットパネル |
| `@HOST/artifact-viewer` | 汎用のアーティファクトビューアー（ルート `/:uuid` と組み合わせます） |
| `@HOST/session-selector` | セッションの一覧と選択 |
| `@HOST/compat-coordinator` | ヘッドレスの compat インテントおよびメインルートのコーディネーター。`coordinators` の下に宣言します |
| `@HOST/panel-tab` | 折りたたまれたパネルを開くための端のタブ。`floating` の下に宣言します |

未知の `@HOST/<id>` は、空のスロットを黙って描画するのではなく、宣言の読み込み時に `LayoutValidationError` を起こします。

## ブレークポイントをキーとしたレイアウト

`layouts` フィールドは、ブレークポイントのキーをパネルツリーへマッピングします。より狭いブレークポイントが一致しない限り、常に `default` が使われます。ブレークポイントのピクセル幅は `breakpoints` の下で定義します。

```yaml
host_config:
  layout:
    breakpoints:
      sm: 768
    layouts:
      default:
        direction: horizontal
        children:
          - panel: side
            size: 300px
          - panel: main
            size: 1fr
            main: true
      sm:
        direction: vertical
        children:
          - panel: main
            size: 1fr
            main: true
          - panel: side
            display: drawer-left
            drawerSize: { width: 320px }
    panels:
      side: { kind: page, id: app-sidebar, route: / }
      main: { kind: page, id: app-home,    route: / }
```

ブレークポイントが変わると、同じ `id` のパネルは、親を付け替えることなくアクティブなスロットを視覚的に追う、1つの安定したコンテンツホストを保ちます。iframe の `contentWindow`、Web コンポーネントの状態、Vue の状態、スクロール位置は遷移をまたいで保たれます。Teleport による親の付け替えは意図的に避けられています。iframe を取り除いて挿入し直すと再読み込みされてしまうためです。

### ドロワーモードのパネル

パネルのスロットは `display: 'drawer-left' | 'drawer-right' | 'drawer-bottom'` を宣言して、インラインの flex アイテムではなくスライドインのオーバーレイとして描画できます。ドロワーパネルは:

- 親コンテナのトラックのサイズ計算に参加しません（`size` は無視されます）
- 指定した端に固定された絶対配置のオーバーレイとして描画されます
- `host.layout.openDrawer(id)` / `closeDrawer(id)` / `toggleDrawer(id)` で切り替わる開閉状態を持ちます
- 開いているときは背景を表示し、背景をクリックすると開いているすべてのドロワーが閉じます

`main: true` のスロットはドロワーモードにできません — ホストの検証が例外を投げます。左右のドロワーの幅は `drawerSize.width` フィールドで、下のドロワーの高さは `drawerSize.height` で制御します。デフォルトは `320px` です。

## 浮動パネル

浮動パネルは `floating` の下に宣言される、自由に配置されるオーバーレイです。flex のレイアウトツリーには参加せず、実行時に追加・削除できます。

```yaml
floating:
  flap:
    kind: component
    tagName: my-right-flap
    position: { x: 0, y: 200 }
    size: { width: 48, height: 80 }
```

実行時の管理:
```typescript
// 浮動パネルを追加する
host.layout.addFloating('inspector', {
  kind: 'component',
  tagName: 'my-inspector',
  position: { x: 100, y: 100 },
  size: { width: 400, height: 300 },
})

// 削除する
host.layout.removeFloating('inspector')
```

## ヘッドレスのコーディネーター

コーディネーターは、隠されたホストへマウントされるコンポーネントです。目に見えるスロットは持ちませんが、パネルスコープのホスト API を受け取ります。横断的なロジックに使うことで、表示用のパネルは描画に集中できます。古い `services` フィールドは非推奨の互換エイリアスとして残っています。

```yaml
coordinators:
  coordinator:
    kind: component
    tagName: my-coordinator
```

コーディネーターのコンポーネントはパネルスコープのホストラッパーを受け取り、`onMount` の中で即座にバスのチャネルを購読できます。

```typescript
import { WippyElement } from '@wippy-fe/webcomponent-core'

class MyCoordinator extends WippyElement {
  protected onMount() {
    this.host?.layout.on('open-chat', ({ payload }) => {
      this.host?.layout.updatePanel('right', { route: `/open-chat/${payload.token}` })
      this.host?.layout.expandPanel('right')
    })
  }
  protected onUnmount() {}
  static get wippyConfig() { return { propsSchema: { properties: {} } } }
}
customElements.define('my-coordinator', MyCoordinator)
```

### 同梱の compat コーディネーター

マネージドレイアウトには、宣言されたサーフェスしか存在しません。したがって `host.openArtifact()`、`host.startChat()`、`host.openSession()`、`host.navigate()` といった呼び出しは、予約チャネル `@HOST/intent` に型付きのインテントを発行します。それらに対処し、ブラウザー URL をメインパネルへ束ねるために、同梱のコーディネーターを宣言してください。

```yaml
coordinators:
  compat:
    kind: builtin
    id: '@HOST/compat-coordinator'
    props:
      artifactPanel: right
      chatPanel: chat
      modalId: artifact-modal
      routeSync: true
      wsActions: true
```

標準のナビゲーション契約を使う場合は `routeSync: true` を維持してください。コーディネーターも同等のコンシューマー側ロジックもない場合、ディープリンク、戻る／進む、`@HOST/nav-sidebar` のナビゲーションには、駆動すべきパネルのルートがありません。子の起動中に発生したインテントは、最初のコーディネーターが購読するまで上限付きのキューに保持されます。

`@HOST/` は双方向に予約されています。通常のパネルはシステムのトラフィックを発行できず、それを受け取れるのはサポートされたホスト API を通じた `coordinators` 配下のエントリだけです。この境界は iframe / Web Fragment のパネルに対して強制されます。ホストのレルムへ直接マウントされたコンポーネントはホストの DOM を共有しており、セキュリティサンドボックスではありません。起動時、コーディネーターの処理、モーダルの対象サーフェス、メインパネルの URL バインド、宣言されたコーディネーターのタグのいずれかが欠けていると、ホストは対応表を出力します。完全な宣言であれば警告は出ません。

## タブ内のブロードキャストバス

パネルは、現在のブラウザータブにスコープされたバスを通じて通信します。バスが他のタブへ渡ることはありません — マルチタブ同期が必要なら、カスタムの WebSocket トピックを使ってください。

| メソッド | 説明 |
|--------|-------------|
| `host.layout.broadcast(channel, payload)` | すべてのパネルへ発行します。送信者は除外されます |
| `host.layout.send(targetPanelId, channel, payload)` | 特定の1つのパネルへ発行します |
| `host.layout.on(channel, handler)` | 購読します。購読解除の `off()` 関数を返します |

受信メッセージの `sourcePanelId` は、発行元のウィンドウからホストが設定するもので、偽装できません。チャネル名は大文字小文字を区別する素の文字列です。

**重要:** `@wippy-fe/proxy` から `host` を直接 import するコンポーネントは、パネルスコープを迂回します — バスの呼び出しは通りますが `sourcePanelId` を失います。代わりに常にパネルスコープのラッパーを使ってください。

```typescript
// 素の HTMLElement
import { getWippyHost } from '@wippy-fe/webcomponent-core'
const host = getWippyHost(this)

// WippyElement のサブクラス — this.host はすでにパネルスコープ
this.host?.layout.broadcast('open-chat', { token: 'abc' })

// Vue コンポーネント
import { useHost } from '@wippy-fe/webcomponent-vue'
// ProxyApiInstance はアンビエントのグローバル型（@wippy-fe/types-global-proxy 由来）— import せずに参照する。
const host = useHost<ProxyApiInstance['host']>()
host?.layout.broadcast('open-chat', { token: 'abc' })
```

## レイアウト API リファレンス (`host.layout`)

| メソッド | 説明 |
|--------|-------------|
| `.snapshot` | レイアウトのスナップショット全体を返す同期ゲッター。マネージドレイアウトモード外では `null` |
| `.resizePanel(id, size)` | アクティブなブレークポイントで、指定したパネルをリサイズします |
| `.collapsePanel(id)` | `collapsible: true` と宣言されたパネルを折りたたみます |
| `.expandPanel(id)` | 折りたたまれたパネルを展開します |
| `.openDrawer(id)` | ドロワーモードのパネルを開きます |
| `.closeDrawer(id)` | ドロワーモードのパネルを閉じます |
| `.toggleDrawer(id)` | ドロワーモードのパネルを切り替えます |
| `.movePanel(id, target)` | パネルをツリーの新しい位置へ移動します |
| `.removePanel(id)` | すべてのブレークポイントのレイアウトからパネルを削除します |
| `.updatePanel(id, def)` | 実行時にパネル定義へパッチを当てます。`props` は浅くマージされ、トップレベルのフィールドは置き換えられます |
| `.addFloating(id, def)` | 浮動パネルを追加します |
| `.removeFloating(id)` | 浮動パネルを削除します |
| `.openModal(id, def?)` | 宣言済みのモーダルを id で開きます。任意でその定義を上書きできます。実行時のみのモーダルには `def` が必要です。デフォルトはネイティブの `<dialog>.showModal()` で、レガシーな div のオーバーレイにするには `useNativeDialog: false` を渡します。すでに開いている id を再度開くのは黙って何もしません。 |
| `.closeModal(id)` | 開いているモーダルを閉じます |
| `.broadcast(channel, payload)` | すべてのパネルへ発行します |
| `.send(target, channel, payload)` | 1つのパネルへ発行します |
| `.on(channel, handler)` | バスのチャネルを購読します |

`openModal()` はホスト内部のレイアウト基盤を文書化したものであって、アプリケーションコンポーネントのレシピではありません。出荷される Vue のプロダクト UI は、このネイティブダイアログの挙動をカスタムのモーダルスタイルで複製するのではなく、PrimeVue の `Dialog` かホストの確認 API を使うべきです。

### `updatePanel` のマージのセマンティクス

`host.layout.updatePanel(id, def)` は既存のパネル定義へパッチを当てるもので、置き換えではありません。`props` オブジェクトはパネルの現在の props へ**浅くマージ**されます。与えたキーは追加または上書きされ、省略したキーは保持されます。`def` の**それ以外の**トップレベルのフィールド（`route`、`kind`、`id`、`tagName`、`title`、`icon` など）は、現在の値をまるごと**置き換えます**。

現在の props が `{ artifactId: 'old', zoom: 2 }` であるパネルの場合:

```typescript
// props は浅くマージされる → { artifactId: 'abc', zoom: 2 }
host.layout.updatePanel('right', { props: { artifactId: 'abc' } })

// route はまるごと置き換わる。props はそのまま
host.layout.updatePanel('right', { route: '/x' })
```

注意点が2つあります。props のマージは**浅い**ため、`props` の中の入れ子オブジェクトは深くマージされずまるごと置き換わります。また浅いマージでは prop のキーを削除できません（上書きしかできません）。

## Vue のコンポーザブル — `@wippy-fe/vue-host`

これらのコンポーザブルは、プロキシのレイアウト API を Vue 3 のリアクティブな ref で包みます。背後の購読はモジュールスコープで iframe の生存期間中続くため、アンマウント時のコンポーネントごとの後片付けはありません。

| コンポーザブル | 返すもの |
|------------|---------|
| `useWippyLayout()` | レイアウトの完全な状態とミューテーションのメソッド |
| `useWippyPanel(panelId)` | 指定パネルのライブ状態（`panelId` は必須で `string`、`Ref<string>`、または getter） |
| `useWippyBreakpoint()` | リアクティブな ref としてのアクティブなブレークポイント名 |
| `useWippyMainRoute()` | メインパネルの現在のルートへのリアクティブな ref |

これらのコンポーザブルは決して `null` を返しません — 常にオブジェクト／ref を返し、マネージドレイアウトのホストが存在しない場合はその内側の `.value` が縮退します。`useWippyLayout().snapshot.value` は `null`（かつ `isManaged.value` は `false` なので、ミューテーションは黙って何もしません）、`useWippyBreakpoint().value` と `useWippyMainRoute().value` は空文字列、id が存在しない場合の `useWippyPanel(id).value` は `null` です。ホストの有無は、戻り値に対する `=== null` の判定ではなく `layout.isManaged.value`（または `layout.snapshot.value !== null`）でガードしてください。これにより、マネージドレイアウトのホストがない単体のプレイグラウンドやユニットテストでもコンポーザブルを使えます。

## 再マウントなしのスワップバッファリング

`@wippy-fe/layout` の `useSwapBuffer()` は、入ってくるコンテンツが準備完了を報告するまで、出ていくサーフェスをマウントしたまま保ちます。明示的なタイムアウトの上限付きです。DOM のキーには不変の `slot.index` を使い、古い非同期シグナルが拒否されるよう `markReady()` / `markFailed()` にはインデックスとコンテンツキーの両方を渡し、エラーはバッファーごとにスコープしてください。コンテンツの同一性は `keyOf` に属します。DOM のキーを変えると iframe が挿入し直され、バッファリングが保とうとしている状態が破壊されます。

```typescript
const swap = useSwapBuffer<Surface>({
  keyOf: surface => surface.ownerId,
  buffers: 2,
  readyTimeoutMs: 8_000,
  loaderDelayMs: 250,
  loaderMinMs: 400,
})

const slot = swap.push(surface)
swap.markReady(slot.index, slot.key)
// または: swap.markFailed(slot.index, error, slot.key)
```

示されている値はデフォルトです。準備完了のタイムアウトは、古いコンテンツをローダーの裏に残すのではなく、デフォルトでコンテンツを表示します。読み込み中の UI は、準備完了に直接ではなく `swap.showLoader` にバインドしてください。失敗したバッファーは兄弟から分離されたままです。エラーを処理したら、再試行のために `clearError(index)` を呼んでください。

### Web ホストのページ準備完了

Web ホストは、マネージドのページサーフェスに対して同じキー付きの準備完了の規律を、14秒の最終表示の上限とともに用います。iframe と直接 Web コンポーネントのレンダラーは、Vue のイベントリスナーを通じて `load` / `error` を送出し、そのレンダラーが所有する不変のコンテンツキーを含めます。したがって描画されたコンテンツは即座に表示され、上限は報告を行わないコンテンツのためのフォールバックにすぎません。追い出されたレンダラーからの遅れて届くイベントは、そのバッファーインデックスがすでに再利用されている場合に拒否されます。

14秒のホスト側の上限をアプリケーションの読み込み遅延として使わないでください。また通常のページの準備完了の周りに2つ目のタイマーを追加しないでください。日常的に上限へ達するページは、準備完了かライフサイクルの経路が壊れており、その所有者のところで直すべきです。

### 安定したコンポーネントの更新とパネルのサイズ指定

`kind: component` では、パネルの `props` を変更すると既存のカスタム要素の属性が更新または削除されます。ホストが要素を差し替えるのは `tagName` が変わったときだけです。これにより、`updatePanel()` の呼び出し中やブレークポイントの遷移中も、要素が所有する状態が保たれます。

`minSize` と `maxSize` は、アクティブな分割軸のみを制約します。水平ツリーでは幅、垂直ツリーでは高さです。交差軸は制限しないため、ナビゲーション、チャット、その他の全高のマウントは自身のトラックを埋められます。ドロワーのマウントはアニメーションするドロワーのジオメトリに従い、開いている間だけ、コンテンツを再マウントすることなくアンカーと背景の上へ引き上げられます。

## スプリッターとハンドルのスタイル

スプリッターの当たり判定は目に見える線より広く、パッケージの分離されたレイヤースタックに存在します。`--wippy-layout-splitter-z-index` のデフォルトは `700` で、ドロワーやモーダルの背景より下です。円形のハンドルはオプトインです。

| 変数 | デフォルト | 目的 |
|---|---|---|
| `--wippy-layout-splitter-size` | `1px` | 目に見えるスプリッター線の太さ |
| `--wippy-layout-splitter-hit-size` | `10px` | 線の周囲のポインター当たり判定。粗いポインターでは `24px` |
| `--wippy-layout-splitter-z-index` | `700` | スプリッターとハンドルのレイヤー |
| `--wippy-layout-splitter-handle-size` | `0` | ハンドルの直径。`0` で無効 |
| `--wippy-layout-splitter-handle-bg` | `transparent` | ハンドルの塗り |
| `--wippy-layout-splitter-handle-border` | `0 solid transparent` | border のショートハンド |
| `--wippy-layout-splitter-handle-shadow` | `none` | ハンドルの影 |
| `--wippy-layout-splitter-handle-icon-color` | `transparent` | `currentColor` によるテーマ対応の SVG 色 |

オプトインする際は、サイズ、塗り、border／影、アイコン色をまとめて設定してください。SVG は垂直スプリッターでは90度回転し、ロックされた分割では非表示のままです。

## どのモードで何が動くか

プロキシ API の*サーフェス*は compat とマネージドで同一です — 同じ `@wippy-fe/proxy` の import が両方で解決されます — が、そのうち2つの部分は**効果がモード依存**です。この食い違いは、アプリをマネージドレイアウトへ移すときにもっとも注意すべき点であり、マネージドがまだ早期アクセスである理由でもあります。

### `host.layout` はマネージドモードでのみ効果がある

ホストがレイアウトのレシーバーをインストールするのは、**レイアウトが宣言されている場合だけ**です（`hostConfig.layout` によってゲートされるマネージドのエントリ）。compat モードでも `host.layout` は存在しますが、`host.layout.snapshot` は `null` であり、すべてのミューテーションとバスの呼び出し（`resizePanel`、`updatePanel`、`movePanel`、`openModal`、`addFloating`、`broadcast`、`send`、`on` など）は**黙って何もしません** — メッセージは送られますが、ホスト側で誰も待ち受けていません。ミューテーションの前にスナップショットでゲートしてください。

```typescript
if (host.layout.snapshot) {
  host.layout.updatePanel('right', { route: '/details' })   // マネージド専用
}
// Vue: const { isManaged } = useWippyLayout(); if (isManaged.value) { … }
```

（これとは別の軸として、`addPanel` と `setLayout` はどちらのモードでもプロキシ越しに*まったく*公開されていません。[既知の制限](#known-limitations) を参照してください。）

### compat のシェルを前提とする `host.*` コマンド

マネージドのシェルは**宣言されたレイアウトだけ**を描画します。Web ホスト 1.0.50 以降、通常なら compat のクロームを対象とするコマンドは、黙って失敗する代わりに型付きの `@HOST/intent` メッセージを発行します。それらのインテントを自分のパネルへ対応付けるには、`@HOST/compat-coordinator` を宣言するか、同等のコーディネーターを実装してください。

| `host.*` コマンド | Compat（デフォルト） | Managed |
|---|---|---|
| `setContext`、`toast`、`confirm`、`handleError`、`logout`、`bridge.*`、トップレベルの `state` / `ws` / `on` | 動作します | 直接動作します。マネージドはグローバルなトーストと確認のサーフェスをマウントします |
| `openArtifact(id, ...)` | 右パネルまたはモーダルで開きます | インテントを発行します。compat コーディネーターが `artifactPanel` または `modalId` を対象にします |
| `startChat(token)` / `openSession(uuid)` | セッションを開いて表示します | インテントを発行します。compat コーディネーターが開始トークンを解決し、宣言された `chatPanel` を更新します |
| `navigate(url)` | compat のルートルーターへ push します | インテントを発行します。`routeSync` がそれをメインパネルへ適用し、ブラウザー履歴との整合を保ちます |
| `onRouteChanged(route, navId?)` | ホストのブラウザー URL を駆動します | パネルのルート状態を更新します。`routeSync` がメインパネルのルートをブラウザー URL へ投影します |

コーディネーターがまだ利用できない場合、起動時のインテントは最初のコーディネーターの購読まで上限付きのキューに保持されます。ハンドラーのない宣言は、起動時の対応表で報告されます。予約されたインテントは `coordinators` のエントリだけが読め、通常のパネルが偽造することはできません。

## 状態管理のアプローチ

優先順位の高い順に3つの層があります。

**ルート** — ユーザーがその状態をブックマークしたり共有したりすることに意味があるなら、URL に入れてください。各 `kind: page` パネルは自身のルーターを動かし、`@history` イベントに反応します。これは疎結合で、ディープリンク可能で、ブラウザー履歴を意識したやり方です。

**レイアウトのスナップショット** — レイアウトの形（サイズ、折りたたみのフラグ、コンポーネントの props）に影響するなら、`updatePanel` や `resizePanel` を通じてスナップショットに入れてください。購読しているすべてのパネルがすべてのスナップショットの変更を見るため、ペイロードは小さく保ってください。

**パネルローカル** — それ以外のすべて（フォームの下書き、モーダルの状態、一時的な UI）は、パネル自身の Pinia ストアや ref の中に留め、パネルの外へ出しません。

## 正典の調整パターン

パネル間のやり取りに推奨されるパターンは、バスのイベント → コーディネーターのサービス → `updatePanel` → パネルが自身のルーターで反応する、です。

```typescript
// コーディネーターのサービス内
this.host?.layout.on('open-chat', ({ payload }) => {
  this.host?.layout.updatePanel('right', { route: `/open-chat/${payload.token}` })
  this.host?.layout.expandPanel('right')
})

// 右パネルのアプリ内（通常の Vue ページモジュール）
const router = createAppRouter([...])
// createAppRouter はすでにホストの history イベントを、エコー／現在ルートの
// ガード付きでルーターへ反映している。手動のルーティング購読は追加しないこと。
```

コーディネーターは薄く保ってください。パネルは自身の UI を所有し続けてください。

## 既知の制限

Draft 1 時点で、以下はまだ実装されていません。

- **プロキシ越しの `addPanel` / `setLayout`** — 未出荷です。これらは内部の `@wippy-fe/layout` の `LayoutManager` にのみ存在し、iframe のプロキシ境界を越えて公開されていません。（`openModal`、`closeModal`、`movePanel` は出荷済みです — レイアウト API リファレンスを参照してください。）
- **パネルのドラッグによる並べ替え UI** — データモデルと `movePanel()` API は動作しますが、ユーザー向けのドラッグはまだ実装されていません。
- **タブのプリミティブ** — まだ実装されていません。
- **グリッドタイルのコンテナ** — 後続対応として追跡中です。
- **実行時ミューテーションの永続化** — ミューテーションはリロードをまたいで永続化されません。必要なら手動で永続化してください:
  ```typescript
  on('@layout-change', () =>
    state.set('layout', host.layout.snapshot)
  )
  ```
- **`nav-sidebar` のヘッダースロットの拡張点** — このドラフトでは、ロゴ、アプリ名、トグルボタンの位置は固定です。

## 関連項目

- [ファサードのエントリーポイント](./entry-point.md) — ファサードが JS モジュールのエントリを読み込み、設定を配信する仕組み
- [ブートストラップのシーケンス](./bootstrap.md) — ホストが起動時にマネージドレイアウトのエントリへ振り分ける仕組み
- [パッケージ](./packages.md) — `@wippy-fe/layout`、`@wippy-fe/vue-host`、`@wippy-fe/webcomponent-core`、`@wippy-fe/webcomponent-vue`
