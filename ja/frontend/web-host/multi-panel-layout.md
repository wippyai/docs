---
title: "マルチパネルレイアウト"
description: "Web Host の managed multi-panel layout を宣言・制御する early-access reference。"
---

# マルチパネルレイアウト

このページは early-access configuration/API reference です。YAML と TypeScript block は部分的な declaration/integration pattern であり、単体で production-ready shell ではありません。

> **Status: Draft 1 preview — early access、production 非対応。** managed-layout API は利用できますが production consumer で未検証です。minor release 間で field、default、validation rule が変わる可能性があります。この label が外れるまで exact CDN version を pin し、host chrome 自体を compose する必要がなければ production では標準 `compat` mode を使ってください。

managed-layout mode は標準 Wippy chrome を declarative panel tree に置換します。backend YAML で named panel を定義し、Web Host が boot 時に layout を組み立てて検証し、runtime で reactive に維持します。page reload なしで resize、collapse、swap、add、remove ができます。

## Managed Layout を使う場面

標準 `compat` mode が production のデフォルトです。custom chrome composition が必要な場合だけ `fe_mode = managed` を選びます。

| Need | Compat | Managed |
|---|---|---|
| 標準 chat + nav | Yes | 置換可能 |
| 複数 page slot | No | Yes |
| custom sidebar/coordinator | 制限あり | Yes |
| breakpoint ごとの responsive layout | No | Yes |
| floating overlay | No | Yes |
| headless coordinator | No | Yes（`coordinators`） |
| panel 単位 routing | main のみ | 全 `kind: page` |
| cross-panel bus | No | Yes |

## 互換性

Web Host、facade、`@wippy-fe/*` package は exact release に対応する 1 family を使い、served import map を検証してください。無関係な release の version を混在させません。

### Release map

| Release | Managed-layout の追加内容 |
|---|---|
| `1.0.50` / `0.0.50` | typed compat intent、coordinator、URL 同期、panel tab、floating panel、`useSwapBuffer()` |
| `1.0.51` / `0.0.51` | race-safe chat control、splitter handle、axis constraint、drawer fix、proxy source map |
| `1.0.52` / `0.0.52` | retained-WC visibility、即時 readiness、stale key rejection、in-place prop update、splitter layer |
| `1.0.53` / `0.0.53` | forced light/dark で configured token を正しく伝播 |
| `1.0.54` / `0.0.54` | surface portability contract v1 |
| `1.0.55` / `0.0.55` | managed artifact/chat、cold deep-link、stable artifact、themed splitter handle |
| `1.0.56` / `0.0.56` | artifact/modal、artifact-open reason、chat selector/slot lifecycle の修正 |

14 秒の page reveal は 1.0.52 の fallback です。retained direct WC visibility は Web Host 1.0.52 と core/vue/shared 0.0.52 以上が必要です。

### 保持された Web Component の動作

panel は swap、breakpoint change、drawer cycle をまたいで mount を保持します。Host は direct custom element の接続前に `data-wippy-visible="true" | "false"` を設定し、logical ownership の変更時に in-place update します。CSS/viewport/document visibility ではなく remount も意味しません。Vue は `useHostVisibility()`、または mount 後と exact `false -> true` reveal 時だけ task を動かす `useHostVisibilityRefresh(task)` を使います。direct WC では iframe/Fragment channel の proxy `@visibility` を使いません。この reference は `webcomponents-1.0.56` と package `0.0.56` を基準にします。

## Managed Layout の有効化

facade で managed entry を有効にし、backend `host_config.layout` を指定します。

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

facade は `module.js` の代わりに `managed-layout.js` を配信します。`fe_mode` は facade requirement parameter（default `compat`）で、`AppConfig` 内ではありません。layout は `AppConfig.hostConfig.layout` で child に伝わります。API surface は両 mode で同じですが効果は異なります。

## `HostLayoutDeclaration`

backend `host_config.layout` から frontend `AppConfig.hostConfig.layout` へ投影される単一 object です。mount 前に検証され、`LayoutValidationError` は `{ kind, message, panelId? }` とともに console に出ます。

| Field | Type | Description |
|---|---|---|
| `layouts` | `Record<string, PanelTree> & { default: PanelTree }` | breakpoint-keyed tree。`default` 必須 |
| `breakpoints?` | `Record<string, number>` | non-default key を有効にする pixel width |
| `panels` | `Record<string, HostPanelDef>` | named panel content |
| `floating?` | `Record<string, HostFloatingDef>` | boot-time overlay |
| `modals?` | `Record<string, HostModalDef>` | boot-time modal |
| `coordinators?` | `Record<string, HostCoordinatorDef>` | headless coordinator |
| `services?` | 同上 | deprecated alias |
| `dragEnabled?` | boolean | splitter drag。default `true` |

## Panel Kind

| Kind | Description | Required |
|---|---|---|
| `page` | iframe/Fragment engine の Wippy page | `id` |
| `artifact` | host resolver の artifact | `id` |
| `component` | host DOM の web component | `tagName` |
| `builtin` | framework-owned component | `id` |

tree 内 exactly one panel に `main: true` が必要です。browser URL ownership には `@HOST/compat-coordinator` 等の route sync が必要です。

### Built-in Panel ID

`@HOST/` は framework-owned panel 用です。

| ID | Render |
|---|---|
| `@HOST/nav-sidebar` | 標準 nav sidebar |
| `@HOST/chat-wrapper` | active session chat |
| `@HOST/artifact-viewer` | artifact viewer |
| `@HOST/session-selector` | session picker |
| `@HOST/compat-coordinator` | headless intent/route coordinator |
| `@HOST/panel-tab` | collapsed panel reveal tab |

未知の `@HOST/<id>` は `LayoutValidationError` になります。

## Breakpoint-keyed layout

`default` は常に存在し、より狭い breakpoint が一致したとき切り替わります。

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

同じ `id` の panel は stable content host を維持し、iframe、WC/Vue state、scroll position を保持します。iframe を reload する reparenting は避けます。

### Drawer-mode panel

`display: 'drawer-left' | 'drawer-right' | 'drawer-bottom'` は overlay drawer を作ります。track sizing に参加せず、edge に absolute position、layout API で開閉し、backdrop click で全 drawer を閉じます。`main: true` は禁止。左右は `drawerSize.width`、bottom は `height`、default は `320px`。

## Floating Panel

```yaml
floating:
  flap:
    kind: component
    tagName: my-right-flap
    position: { x: 0, y: 200 }
    size: { width: 48, height: 80 }
```

```typescript
// Add a floating panel
host.layout.addFloating('inspector', {
  kind: 'component',
  tagName: 'my-inspector',
  position: { x: 100, y: 100 },
  size: { width: 400, height: 300 },
})

// Remove it
host.layout.removeFloating('inspector')
```

## Headless Coordinator

hidden host に mount され、panel-scoped API を受け取る component です。

```yaml
coordinators:
  coordinator:
    kind: component
    tagName: my-coordinator
```

```typescript
import { WippyElement } from '@wippy-fe/webcomponent-core'

class MyCoordinator extends WippyElement {
  private offOpenChat: (() => void) | null = null

  protected onMount() {
    this.offOpenChat = this.host?.layout.on('open-chat', ({ payload }) => {
      this.host?.layout.updatePanel('right', { route: `/open-chat/${payload.token}` })
      this.host?.layout.expandPanel('right')
    }) ?? null
  }
  protected onUnmount() {
    this.offOpenChat?.()
    this.offOpenChat = null
  }
  static get wippyConfig() { return { propsSchema: { properties: {} } } }
}
customElements.define('my-coordinator', MyCoordinator)
```

### Shipped compat coordinator

managed layout は宣言済み surface だけを持つため compat command は `@HOST/intent` に typed intent を publish します。次を宣言して browser URL と main panel も bind します。

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

標準 navigation contract では `routeSync: true` を保ちます。coordinator がなければ deep link、Back/Forward、sidebar navigation を panel route に反映できません。boot 中の intent は最初の subscriber まで bounded queue に保持されます。`@HOST/` traffic は ordinary panel から偽装できません。ただし host realm の direct component は security sandbox ではありません。boot parity table が不足を警告します。

## In-tab Broadcast Bus

current browser tab 内だけで通信します。multi-tab は custom WebSocket topic を使います。

| Method | Description |
|---|---|
| `broadcast` | 全 panel（sender 除外） |
| `send` | 特定 panel |
| `on` | subscribe、`off()` を返す |

`sourcePanelId` は host が設定し spoof 不可です。direct import の `host` は panel scope を失うため、component は scoped wrapper を使います。

```typescript
// raw HTMLElement
import { getWippyHost } from '@wippy-fe/webcomponent-core'
const host = getWippyHost(this)

// WippyElement subclass — this.host is already panel-scoped
this.host?.layout.broadcast('open-chat', { token: 'abc' })

// Vue component
import { useHost } from '@wippy-fe/webcomponent-vue'
// ProxyApiInstance is an ambient global type (from @wippy-fe/types-global-proxy) — reference it without an import.
const host = useHost<ProxyApiInstance['host']>()
host?.layout.broadcast('open-chat', { token: 'abc' })
```

## Layout API Reference（`host.layout`）

| Method | 説明 |
|---|---|
| `.snapshot` | full layout snapshot を同期的に返す。managed-layout 外では `null` |
| `.resizePanel(id, size)` | active breakpoint の named panel を resize |
| `.collapsePanel(id)` | `collapsible: true` の panel を collapse |
| `.expandPanel(id)` | collapsed panel を expand |
| `.openDrawer(id)` | drawer-mode panel を開く |
| `.closeDrawer(id)` | drawer-mode panel を閉じる |
| `.toggleDrawer(id)` | drawer-mode panel を切り替える |
| `.movePanel(id, target)` | panel を新しい tree position へ移動 |
| `.removePanel(id)` | 全 breakpoint layout から panel を削除 |
| `.updatePanel(id, def)` | runtime で panel definition を patch。`props` は shallow-merge、ほかは replace |
| `.addFloating(id, def)` | floating panel を追加する |
| `.removeFloating(id)` | floating panel を削除する |
| `.openModal(id, def)` | modal を開く。public 0.0.56 API は `def` 必須で、同 id の declaration に merge。default は native `<dialog>.showModal()`、`useNativeDialog: false` で legacy overlay。open 済み id は no-op |
| `.closeModal(id)` | open modal を閉じる |
| `.broadcast(channel, payload)` | 全 panel へ publish |
| `.send(target, channel, payload)` | 1 panel へ publish |
| `.on(channel, handler)` | bus channel を subscribe |

`openModal()` は host-internal layout infrastructure の説明で、application component recipe ではありません。Vue product UI は custom native-dialog styling を複製せず、PrimeVue `Dialog` または host confirmation API を使います。

### `updatePanel` merge semantics

`props` は shallow-merge、それ以外の top-level field は wholesale replace です。

```typescript
// props shallow-merges → { artifactId: 'abc', zoom: 2 }
host.layout.updatePanel('right', { props: { artifactId: 'abc' } })

// route replaces wholesale; props left untouched
host.layout.updatePanel('right', { route: '/x' })
```

nested object は replace され、prop key は削除できず overwrite のみです。

## Vue Composable — `@wippy-fe/vue-host`

これらの composable は proxy layout API を reactive な Vue 3 ref でラップします。基盤の subscription は module scope にあり、iframe の存続期間中維持されるため、component の unmount ごとの cleanup はありません。

| Composable | 戻り値 |
|------------|--------|
| `useWippyLayout()` | layout state と変更メソッド全体 |
| `useWippyPanel(panelId)` | 指定した panel の live state（`panelId` は必須で、`string`、`Ref<string>`、getter のいずれか） |
| `useWippyBreakpoint()` | active breakpoint 名の reactive ref |
| `useWippyMainRoute()` | main panel の現在の route を表す reactive ref |

composable 自体は `null` を返しません。managed-layout host がない場合は内部の `.value` が低機能状態になります。`useWippyLayout().snapshot.value` は `null`（`isManaged.value` は `false` で、変更操作は何もしません）、`useWippyBreakpoint().value` と `useWippyMainRoute().value` は空文字列、存在しない ID に対する `useWippyPanel(id).value` は `null` です。戻り値を `=== null` で確認するのではなく、`layout.isManaged.value`（または `layout.snapshot.value !== null`）で host の存在を確認してください。

## Remount しない swap buffering

`useSwapBuffer()` は incoming content readiness まで outgoing surface を維持します。immutable `slot.index` を DOM key にし、index と content key の両方を readiness call に渡します。

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
// or: swap.markFailed(slot.index, error, slot.key)
```

timeout は stale content を残さず content を reveal します。loading UI は `swap.showLoader` に bind。failed buffer は sibling から分離し、retry 前に `clearError(index)`。

### Web Host page readiness

Host も keyed readiness と 14 秒の最終 ceiling を使い、painted content は即時 reveal、ceiling は report しない content の fallback だけです。late stale event は拒否します。application loading delay として timer を追加しないでください。

### Stable component update と panel sizing

component の prop change は既存 element の attribute を update/remove し、`tagName` 変更時だけ element を置換します。`minSize`/`maxSize` は active split axis だけを制限。drawer content は remount せず open 時だけ前面化します。

## Splitter と handle styling

splitter layer は default z-index `700`。handle は opt-in です。

| Variable | Default | Purpose |
|---|---|---|
| `--wippy-layout-splitter-size` | `1px` | line thickness |
| `--wippy-layout-splitter-hit-size` | `10px` | hit area、coarse pointer は `24px` |
| `--wippy-layout-splitter-z-index` | `700` | layer |
| `--wippy-layout-splitter-handle-size` | `0` | diameter、`0` で無効 |
| `--wippy-layout-splitter-handle-bg` | `transparent` | fill |
| `--wippy-layout-splitter-handle-border` | `0 solid transparent` | border |
| `--wippy-layout-splitter-handle-shadow` | `none` | shadow |
| `--wippy-layout-splitter-handle-icon-color` | `transparent` | SVG color |

opt-in 時は size/fill/border/shadow/icon を一緒に設定します。

## Mode ごとの効果 :id=what-works-in-which-mode

### `host.layout` が効くのは managed mode のみ

layout 未宣言の compat mode では `snapshot` は null、全 mutation/bus call は silent no-op です。

```typescript
if (host.layout.snapshot) {
  host.layout.updatePanel('right', { route: '/details' })   // managed only
}
// Vue: const { isManaged } = useWippyLayout(); if (isManaged.value) { … }
```

`addPanel` / `setLayout` はどちらの mode でも proxy に未公開です。

### Compat shell を前提とする `host.*` command

managed shell は宣言済み layout だけを render します。compat chrome を対象とする command は typed `@HOST/intent` を publish し、`@HOST/compat-coordinator` または同等の coordinator が panel へ対応付けます。

| `host.*` command | Compat | Managed |
|---|---|---|
| `setContext`、`toast`、`confirm`、`handleError`、`logout`、`bridge.*`、top-level `state` / `ws` / `on` | 動作 | global toast/confirm surface を含め直接動作 |
| `openArtifact(id, ...)` | right panel または modal で開く | intent を publish。coordinator が `artifactPanel` / `modalId` を選ぶ |
| `startChat(token)` / `openSession(uuid)` | session を開く | intent を publish。coordinator が token を解決し `chatPanel` を更新 |
| `navigate(url)` | compat root router を push | intent を publish。`routeSync` が main panel と browser history を同期 |
| `onRouteChanged(route, navId?)` | host browser URL を駆動 | panel route state を更新し、`routeSync` が main route を browser URL に投影 |

coordinator がまだなければ boot-time intent は最初の subscription まで bounded queue に保持されます。handler 不在は boot parity table が報告し、reserved intent は `coordinators` entry だけが読めます。

## State management

次の 3 tier を順に使います。

**Route** — bookmark/share できる state。各 `kind: page` panel は自身の router と `@history` event を使います。

**Layout snapshot** — size、collapsed flag、component props など layout shape に関わる state。`updatePanel` / `resizePanel` を使い、全 subscriber に届くため payload は小さくします。

**Panel-local** — form draft、modal state、transient UI。panel 自身の Pinia store/ref に留めます。

## Canonical coordination pattern

bus event → coordinator → `updatePanel` → panel router の順です。

```typescript
// In the coordinator service
this.host?.layout.on('open-chat', ({ payload }) => {
  this.host?.layout.updatePanel('right', { route: `/open-chat/${payload.token}` })
  this.host?.layout.expandPanel('right')
})

// In the right-panel app (a normal Vue page module)
const router = createAppRouter([...])
// createAppRouter already mirrors host history events into the router
// with an echo/current-route guard; add no manual routing subscription.
```

## 既知の制約

- proxy の `addPanel` / `setLayout` は未提供。internal `LayoutManager` にだけ存在し、iframe proxy boundary を越えて公開されません。`openModal`、`closeModal`、`movePanel` は提供済みです。
- panel data model と `movePanel()` は動作しますが、user-facing drag-to-rearrange UI は未実装です。
- tabbed-container primitive は未実装です。`@HOST/panel-tab` は collapsed panel を表示する edge control で、汎用 tab container ではありません。
- grid-tile container は未実装です。
- runtime mutation は reload 間で保存されない。必要なら手動保存する。
  ```typescript
  on('@layout-change', () =>
    state.set('layout', host.layout.snapshot)
  )
  ```
- `nav-sidebar` header の logo、app-name、toggle button position はこの draft では固定です。

## 関連項目

- [Facade Entry Point](./entry-point.md)
- [Bootstrap Sequence](./bootstrap.md)
- [Packages](./packages.md)
