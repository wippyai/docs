---
title: "멀티 패널 레이아웃"
description: "Web Host의 managed 멀티 패널 레이아웃을 선언하고 제어하는 조기 접근 참조입니다."
---

# 멀티 패널 레이아웃

이 페이지는 조기 접근 구성 및 API 참조입니다. YAML과 TypeScript 블록은 부분 선언과 통합 패턴이며 그 자체로 production-ready shell은 아닙니다.

> **상태: Draft 1 preview — 조기 접근 기능이며 production용이 아닙니다.** managed-layout API를 사용할 수 있지만 production 소비자와 검증되지 않았습니다. minor release 사이에 필드 이름, 기본값, 검증 규칙이 바뀔 수 있습니다. 이 표시가 제거될 때까지 정확한 CDN 버전을 고정하십시오. 애플리케이션이 호스트 chrome을 직접 구성해야 하는 경우가 아니라면 production에서는 표준 `compat` 모드를 사용합니다.

Managed-layout 모드는 표준 Wippy chrome을 선언적 패널 tree로 교체합니다. 백엔드 YAML에 이름 있는 패널을 정의하면 Web Host가 boot 시 레이아웃을 조립하고 검증하며 런타임에 반응형으로 유지합니다. 페이지 reload 없이 패널 크기 조정, 접기, 교환, 추가, 제거가 가능합니다.

## Managed Layout을 사용할 때

표준 `compat` 모드가 기본 production 모드입니다. 탐색 사이드바, 채팅 패널, 페이지 영역, 오른쪽 아티팩트 패널로 구성된 고정 Wippy shell을 제공합니다.

chrome을 직접 구성해야 할 때만 `fe_mode = managed`(조기 접근)를 선택합니다.

| 요구사항 | Compat | Managed |
|------|--------|---------|
| 표준 Wippy 채팅 + 탐색 | 예 | 교체 가능 |
| 여러 페이지 slot을 나란히 배치 | 아니요 | 예 |
| 사용자 정의 sidebar 또는 coordinator 컴포넌트 | 제한적 | 예 — 모든 패널 kind |
| breakpoint별 반응형 레이아웃 | 아니요 | 예 |
| floating overlay 패널 | 아니요 | 예 |
| headless coordinator 컴포넌트 | 아니요 | 예(`coordinators`) |
| 패널별 URL 인식 라우팅 | main 패널만 | 모든 `kind: page` 패널 |
| 패널 간 message bus | 아니요 | 예(`broadcast`/`send`/`on`) |

## 호환성

Managed layout은 Web Host, facade, 여러 `@wippy-fe/*` 패키지에 걸쳐 있습니다. 대상 Web Host 릴리스에 맞는 하나의 호환 패키지 family를 사용하고 제공 import map을 확인하십시오. 관계없는 릴리스의 패키지 버전을 섞지 마십시오.

### 릴리스 맵

| 릴리스 | Managed-layout 추가 사항 |
|---|---|
| Web Host `1.0.50`, Wippy FE `0.0.50` | 타입이 지정된 compat 인텐트, `@HOST/compat-coordinator`, 브라우저 URL 및 뒤로/앞으로 동기화, 내장 패널 탭, 앵커 기반 플로팅 패널, `useSwapBuffer()` |
| Web Host `1.0.51`, Wippy FE `0.0.51` | 반응형·race-safe `<wippy-chat>` session/token 제어, 선택적 테마 splitter handle, split axis 전용 크기 제약, drawer geometry/stacking 수정, 패키지 proxy source map |
| Web Host `1.0.52`, Wippy FE `0.0.52` | 타입이 지정된 유지 WC 가시성과 `useHostVisibilityRefresh()`, 14초 폴백을 기다리지 않는 즉시 페이지 준비 완료, 오래된 렌더러 키 거부, 제자리 컴포넌트 prop 업데이트, `--wippy-layout-splitter-z-index`를 사용하는 격리 splitter 계층 |
| Web Host `1.0.53`, Wippy FE `0.0.53` | light/dark 모드 강제 시 구성 테마 토큰의 올바른 전파 |
| Web Host `1.0.54`, Wippy FE `0.0.54` | managed-layout 등록과 반응형 크기 변경을 포함한 iframe 및 Web Fragment 페이지용 surface portability contract v1 |
| Web Host `1.0.55`, Wippy FE `0.0.55` | managed artifact와 독립 채팅 계약, cold deep-link 보존, 안정적인 managed artifact 렌더링, 테마 splitter handle |
| Web Host `1.0.56`, Wippy FE `0.0.56` | managed artifact/modal 렌더링 수정, 공개 artifact-open reason, 채팅 selector 및 slot lifecycle 수정 |

14초 페이지 표시는 Web Host `1.0.52`의 폴백이며 1.0.51 기능이나 애플리케이션 로딩 지연이 아닙니다.

유지된 직접 Web Component 가시성에는 Web Host `1.0.52`와 `@wippy-fe/webcomponent-core`, `@wippy-fe/webcomponent-vue`, `@wippy-fe/shared` `0.0.52`가 필요합니다. 이전 managed-layout 릴리스는 타입이 지정된 `data-wippy-visible` 계약이나 `useHostVisibilityRefresh()`를 제공하지 않습니다.

### 유지되는 웹 컴포넌트 activity

Managed layout은 buffer 교환, breakpoint 변경, drawer 닫기/열기 사이에서도 패널을 마운트 상태로 유지합니다. 호스트는 직접 사용자 정의 요소를 connect하기 전에 `data-wippy-visible="true" | "false"`를 설정하고 논리적 소유권이 바뀌면 in-place로 업데이트합니다. 이는 CSS, viewport, 문서 visibility가 아니며 remount를 의미하지 않습니다.

Vue 컴포넌트는 `useHostVisibility()`로 상태를 읽거나 `useHostVisibilityRefresh(task)`로 일반 초기 로드와 reveal refresh를 결합합니다. 후자는 mount 후 실행되고 이후 정확한 `false -> true`에서만 실행됩니다. 직접 WC에서 proxy `@visibility` topic을 사용하지 마십시오. 이는 iframe/Web Fragment 메시지 채널입니다.

Draft 1 표시가 제거될 때까지 정확한 CDN tag를 고정하십시오. 이 참조는 `https://web-host.wippy.ai/webcomponents-1.0.56`과 일치하는 `@wippy-fe/*` `0.0.56` family에 대해 검증되었습니다. 유지되는 직접 웹 컴포넌트 visibility는 최소 1.0.52/0.0.52가 필요합니다.

## Managed Layout 활성화

facade 구성에서 managed 엔트리를 활성화하고 백엔드 `host_config.layout` 선언을 제공합니다.

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

managed 엔트리를 선택하면 facade는 `module.js` 대신 `managed-layout.js`를 제공합니다. `fe_mode`는 현재 facade 요구 parameter이며 기본값은 `compat`, 선택 값은 `managed`입니다. `AppConfig` payload 안이 아니라 `wippy.facade` 요구사항에서 설정합니다. `AppConfig.feature` 필드는 없습니다. managed layout은 전적으로 `AppConfig.hostConfig.layout`을 통해 자식에 전달됩니다. proxy API *surface*는 두 모드에서 같지만 일부 명령은 한 모드에서만 효과가 있습니다. [모드별 동작](#모드별-동작)을 참고하십시오.

## `HostLayoutDeclaration`

전체 레이아웃은 facade 구성의 백엔드 `host_config.layout` 아래 중첩된 단일 `HostLayoutDeclaration` 객체로 설명되고 프런트엔드 `AppConfig.hostConfig.layout`으로 투영됩니다. 호스트는 마운트 전에 검증하며 `LayoutValidationError`는 `{ kind, message, panelId? }`와 함께 브라우저 콘솔에 나타납니다.

| 필드 | 유형 | 설명 |
|-------|------|-------------|
| `layouts` | `Record<string, PanelTree> & { default: PanelTree }` | breakpoint 키별 패널 tree. `default` 키 필수 |
| `breakpoints?` | `Record<string, number>` | default가 아닌 layout 키를 활성화하는 pixel 너비 |
| `panels` | `Record<string, HostPanelDef>` | 이름 있는 패널 콘텐츠 정의 |
| `floating?` | `Record<string, HostFloatingDef>` | boot 시 floating overlay 패널 |
| `modals?` | `Record<string, HostModalDef>` | boot 시 modal 정의 |
| `coordinators?` | `Record<string, HostCoordinatorDef>` | headless coordinator 컴포넌트 |
| `services?` | `Record<string, HostCoordinatorDef>` | `coordinators`의 deprecated 별칭. 새 선언은 `coordinators` 사용 |
| `dragEnabled?` | boolean | 사용자의 splitter drag 허용. 기본값 `true` |

## 패널 Kind

`panels`, `floating`, `modals`, `coordinators`의 각 엔트리는 `kind` 기준 tagged union입니다.

| 종류 | 설명 | 필수 필드 |
|------|-------------|-----------------|
| `page` | 선택된 iframe 또는 Web Fragment 엔진을 통해 마운트되는 Wippy page 모듈 | `id`(page registry ID) |
| `artifact` | 호스트 artifact/page resolver로 렌더링되는 Wippy artifact | `id`(artifact UUID) |
| `component` | 호스트 DOM에 직접 마운트되는 웹 컴포넌트 | `tagName` |
| `builtin` | framework 소유 호스트 컴포넌트(아래 참고) | `id` |

레이아웃 tree의 정확히 한 패널에 `main: true`가 있어야 합니다. 브라우저 URL 소유권에는 여전히 `@HOST/compat-coordinator` 또는 동등한 소비자 조정을 통한 경로 동기화가 필요합니다. 다른 page 패널은 선택된 page realm 안에서 독립적으로 라우팅합니다.

### 내장 패널 ID

`kind: builtin`은 다음 `id` 값을 받습니다. `@HOST/` 접두사는 framework 소유 패널용으로 예약되어 있습니다.

| ID | 렌더링 대상 |
|----|-----------------|
| `@HOST/nav-sidebar` | 표준 Wippy 탐색 sidebar(session, page, 설정) |
| `@HOST/chat-wrapper` | 활성 session용 표준 Wippy 채팅 패널 |
| `@HOST/artifact-viewer` | 일반 artifact viewer(경로 `/:uuid`와 조합) |
| `@HOST/session-selector` | session 목록과 picker |
| `@HOST/compat-coordinator` | headless compat intent 및 main-route coordinator. `coordinators` 아래 선언 |
| `@HOST/panel-tab` | 접힌 패널을 드러내는 edge tab. `floating` 아래 선언 |

알 수 없는 `@HOST/<id>`는 빈 slot을 조용히 렌더링하지 않고 선언 로드 시 `LayoutValidationError`를 발생시킵니다.

## Breakpoint 기반 레이아웃

`layouts` 필드는 breakpoint 키를 패널 tree에 매핑합니다. 더 좁은 breakpoint가 일치하지 않으면 항상 `default`를 사용합니다. pixel 너비는 `breakpoints`에 정의합니다.

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

breakpoint가 바뀌면 같은 `id`를 가진 패널은 reparent 없이 활성 slot을 시각적으로 따라가는 하나의 안정적인 content host를 유지합니다. Iframe `contentWindow`, 웹 컴포넌트 상태, Vue 상태, scroll 위치가 전환 후에도 유지됩니다. Teleport로 iframe을 제거하고 다시 삽입하면 reload되므로 의도적으로 사용하지 않습니다.

### Drawer 모드 패널

패널 slot은 `display: 'drawer-left' | 'drawer-right' | 'drawer-bottom'`을 선언해 inline flex item 대신 slide-in overlay로 렌더링할 수 있습니다. Drawer 패널은:

- 부모 container track sizing에 참여하지 않음(`size` 무시)
- 지정된 edge에 고정된 absolute-position overlay로 렌더링
- `host.layout.openDrawer(id)` / `closeDrawer(id)` / `toggleDrawer(id)`로 전환하는 open/close 상태 보유
- 열릴 때 backdrop 표시. backdrop 클릭 시 열린 모든 drawer 닫힘

`main: true` slot은 drawer 모드일 수 없으며 호스트 검증이 오류를 냅니다. 왼쪽/오른쪽 drawer 너비는 `drawerSize.width`, 아래 drawer 높이는 `drawerSize.height`가 제어합니다. 기본값은 `320px`입니다.

## Floating 패널

Floating 패널은 `floating` 아래 선언되는 자유 배치 overlay입니다. flex layout tree에 참여하지 않으며 런타임에 추가하거나 제거할 수 있습니다.

```yaml
floating:
  flap:
    kind: component
    tagName: my-right-flap
    position: { x: 0, y: 200 }
    size: { width: 48, height: 80 }
```

런타임 관리:
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

## 헤드리스 코디네이터

Coordinator는 숨겨진 host에 마운트되는 컴포넌트입니다. 보이는 slot은 없지만 패널 범위 host API를 받습니다. 표시 패널이 렌더링에 집중하도록 횡단 로직에 사용합니다. 이전 `services` 필드는 deprecated 호환 별칭입니다.

```yaml
coordinators:
  coordinator:
    kind: component
    tagName: my-coordinator
```

Coordinator 컴포넌트는 패널 범위 host wrapper를 받고 `onMount`에서 즉시 bus channel을 구독할 수 있습니다.

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

### 제공 compat coordinator

Managed layout에는 선언한 surface만 존재합니다. 따라서 `host.openArtifact()`, `host.startChat()`, `host.openSession()`, `host.navigate()` 같은 호출은 예약 `@HOST/intent` 채널에 타입이 지정된 인텐트를 발행합니다. 제공된 coordinator를 선언하여 인텐트를 처리하고 브라우저 URL을 main 패널에 연결합니다.

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

표준 탐색 계약을 사용한다면 `routeSync: true`를 유지하십시오. coordinator나 동등한 소비자 로직이 없으면 딥 링크, 뒤로/앞으로, `@HOST/nav-sidebar` 탐색이 구동할 패널 경로가 없습니다. 자식 부팅 중 발생한 인텐트는 첫 coordinator가 구독할 때까지 제한된 큐에 보관됩니다.

`@HOST/`는 양방향으로 예약되어 있습니다. 일반 패널은 시스템 traffic을 publish할 수 없고 `coordinators` 아래 엔트리만 지원 host API를 통해 받을 수 있습니다. 이 경계는 iframe/Web Fragment 패널에 강제됩니다. 호스트 realm에 직접 마운트된 컴포넌트는 host DOM을 공유하며 보안 sandbox가 아닙니다. boot 시 호스트는 coordinator 처리, modal target surface, main 패널 URL binding, 선언된 coordinator tag가 누락되면 parity table을 출력합니다. 완전한 선언은 warning을 만들지 않습니다.

## 탭 내부 Broadcast Bus

패널은 현재 브라우저 탭 범위 bus로 통신합니다. 다른 탭으로 넘어가지 않으므로 multi-tab 동기화에는 사용자 정의 WebSocket topic을 사용합니다.

| 메서드 | 설명 |
|--------|-------------|
| `host.layout.broadcast(channel, payload)` | 모든 패널에 publish. sender 제외 |
| `host.layout.send(targetPanelId, channel, payload)` | 특정 패널 하나에 publish |
| `host.layout.on(channel, handler)` | 구독하고 unsubscribe 함수 `off()` 반환 |

수신 메시지의 `sourcePanelId`는 publish window로부터 호스트가 설정하므로 위조할 수 없습니다. channel 이름은 대소문자를 구분하는 일반 문자열입니다.

**중요:** `@wippy-fe/proxy`에서 `host`를 직접 import하는 컴포넌트는 패널 scoping을 우회합니다. bus 호출은 통과하지만 `sourcePanelId`를 잃습니다. 항상 패널 범위 wrapper를 사용합니다.

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

## Layout API 참조(`host.layout`)

| 메서드 | 설명 |
|--------|-------------|
| `.snapshot` | 전체 layout snapshot을 동기식 반환. managed-layout 모드 밖에서는 `null` |
| `.resizePanel(id, size)` | 활성 breakpoint의 이름 있는 패널 크기 조정 |
| `.collapsePanel(id)` | `collapsible: true`로 선언된 패널 접기 |
| `.expandPanel(id)` | 접힌 패널 펼치기 |
| `.openDrawer(id)` | drawer 모드 패널 열기 |
| `.closeDrawer(id)` | drawer 모드 패널 닫기 |
| `.toggleDrawer(id)` | drawer 모드 패널 전환 |
| `.movePanel(id, target)` | 패널을 새 tree 위치로 이동 |
| `.removePanel(id)` | 모든 breakpoint layout에서 패널 제거 |
| `.updatePanel(id, def)` | 런타임 패널 정의 patch. `props`는 shallow merge, 최상위 필드는 교체 |
| `.addFloating(id, def)` | floating 패널 추가 |
| `.removeFloating(id)` | floating 패널 제거 |
| `.openModal(id, def)` | modal 열기. 공개 0.0.56 TypeScript API는 `def` 필수. 호스트가 같은 ID 선언 위에 merge. 기본값은 네이티브 `<dialog>.showModal()`. 레거시 div overlay에는 `useNativeDialog: false`. 열린 ID를 다시 열면 조용히 no-op |
| `.closeModal(id)` | 열린 modal 닫기 |
| `.broadcast(channel, payload)` | 모든 패널에 publish |
| `.send(target, channel, payload)` | 한 패널에 publish |
| `.on(channel, handler)` | bus channel 구독 |

`openModal()`은 호스트 내부 layout 기반을 문서화하며 애플리케이션 컴포넌트 레시피가 아닙니다. 제공 Vue product UI는 사용자 정의 modal 스타일로 이 native-dialog 동작을 복제하지 말고 PrimeVue `Dialog` 또는 호스트 confirmation API를 사용해야 합니다.

### `updatePanel` 병합 의미

`host.layout.updatePanel(id, def)`는 기존 패널 def를 patch하며 교체하지 않습니다. `props` 객체는 현재 props에 **shallow merge**됩니다. 제공 키는 추가 또는 덮어쓰고 생략 키는 유지합니다. `def`의 **다른** 최상위 필드(`route`, `kind`, `id`, `tagName`, `title`, `icon` 등)는 현재 값을 통째로 **교체**합니다.

현재 props가 `{ artifactId: 'old', zoom: 2 }`인 패널의 예:

```typescript
// props shallow-merges → { artifactId: 'abc', zoom: 2 }
host.layout.updatePanel('right', { props: { artifactId: 'abc' } })

// route replaces wholesale; props left untouched
host.layout.updatePanel('right', { route: '/x' })
```

두 주의점이 있습니다. props merge는 **shallow**이므로 `props` 안의 중첩 객체는 deep merge되지 않고 완전히 교체됩니다. 그리고 shallow merge로 prop 키를 삭제할 수는 없으며 덮어쓸 수만 있습니다.

## Vue 컴포저블 — `@wippy-fe/vue-host`

이 composable은 proxy layout API를 반응형 Vue 3 ref로 감쌉니다. 내부 subscription은 module 범위이고 iframe lifetime 동안 유지되므로 컴포넌트 unmount별 정리는 없습니다.

| 컴포저블 | 반환값 |
|------------|---------|
| `useWippyLayout()` | 전체 layout 상태와 mutation 메서드 |
| `useWippyPanel(panelId)` | 이름 있는 패널의 live 상태(`panelId` 필수: `string`, `Ref<string>`, getter) |
| `useWippyBreakpoint()` | 활성 breakpoint 이름의 반응형 ref |
| `useWippyMainRoute()` | main 패널 현재 경로의 반응형 ref |

composable은 `null`을 반환하지 않습니다. 항상 객체/ref를 주며 managed-layout 호스트가 없으면 내부 `.value`가 저하됩니다. `useWippyLayout().snapshot.value`는 `null`이고 `isManaged.value`는 `false`이며 mutation은 조용한 no-op입니다. `useWippyBreakpoint().value`, `useWippyMainRoute().value`는 빈 문자열이고 ID가 없으면 `useWippyPanel(id).value`는 `null`입니다. 반환값 자체에 `=== null` 검사를 하지 말고 `layout.isManaged.value` 또는 `layout.snapshot.value !== null`로 호스트 존재를 확인합니다. 덕분에 managed-layout 호스트가 없는 독립 playground와 단위 테스트에서도 사용할 수 있습니다.

## Remount 없는 Swap buffering

`@wippy-fe/layout`의 `useSwapBuffer()`는 incoming 콘텐츠가 준비되었다고 보고할 때까지 outgoing surface를 마운트 상태로 유지하며 명시적 timeout 상한이 있습니다. immutable `slot.index`를 DOM key로 사용하고 오래된 비동기 신호를 거부하도록 index와 content key를 `markReady()`/`markFailed()`에 모두 전달하며 오류는 buffer별로 격리합니다. 콘텐츠 identity는 `keyOf`에 속합니다. DOM key를 바꾸면 iframe이 다시 삽입되어 buffering이 보존하려는 상태를 파괴합니다.

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

표시된 값이 기본값입니다. readiness timeout은 stale 콘텐츠를 loader 뒤에 두지 않고 기본적으로 새 콘텐츠를 reveal합니다. loading UI는 readiness가 아니라 `swap.showLoader`에 bind합니다. 실패한 buffer는 형제와 격리됩니다. 오류 처리 후 재시도하려면 `clearError(index)`를 호출합니다.

### Web Host 페이지 readiness

Web Host는 managed 페이지 surface에 같은 키 기반 준비 규율을 사용하며 최종 표시 상한은 14초입니다. 페이지와 직접 Web Component 렌더러는 Vue 이벤트 리스너를 통해 `load`/`error`를 내보내고 렌더러가 소유한 불변 콘텐츠 키를 포함합니다. 그려진 콘텐츠는 즉시 표시되며 상한은 보고하지 않는 콘텐츠용 폴백일 뿐입니다. 제거된 렌더러의 늦은 이벤트는 해당 버퍼 인덱스가 이미 재사용되었으면 거부됩니다.

14초 호스트 상한을 애플리케이션 loading delay로 사용하거나 정상 page readiness 주위에 두 번째 timer를 추가하지 마십시오. 정기적으로 상한에 도달하는 페이지는 소유자가 수정해야 할 readiness 또는 lifecycle 경로가 망가진 것입니다.

### 안정적 컴포넌트 업데이트와 패널 크기

`kind: component`에서 패널 `props`가 바뀌면 기존 사용자 정의 요소의 attribute를 업데이트하거나 제거합니다. 호스트는 `tagName`이 바뀔 때만 요소를 교체합니다. 이로써 `updatePanel()` 호출과 breakpoint 전환 중에도 요소 소유 상태가 보존됩니다.

`minSize`, `maxSize`는 활성 split axis만 제한합니다. horizontal tree에서는 너비, vertical tree에서는 높이입니다. cross axis를 제한하지 않으므로 탐색, 채팅, 기타 full-height mount가 track을 채울 수 있습니다. Drawer mount는 animated drawer geometry를 따르며 열려 있을 때만 anchor와 backdrop 위로 올라가고 콘텐츠는 remount하지 않습니다.

## Splitter 및 handle 스타일

splitter hit area는 보이는 line보다 넓고 패키지의 격리 layer stack에 있습니다. `--wippy-layout-splitter-z-index` 기본값은 `700`으로 drawer와 modal backdrop보다 아래입니다. 원형 handle은 opt-in입니다.

| 변수 | 기본값 | 목적 |
|---|---|---|
| `--wippy-layout-splitter-size` | `1px` | 보이는 splitter line 두께 |
| `--wippy-layout-splitter-hit-size` | `10px` | line 주변 pointer hit area. coarse pointer에서는 `24px` |
| `--wippy-layout-splitter-z-index` | `700` | splitter와 handle layer |
| `--wippy-layout-splitter-handle-size` | `0` | handle 지름. `0`이면 비활성 |
| `--wippy-layout-splitter-handle-bg` | `transparent` | handle fill |
| `--wippy-layout-splitter-handle-border` | `0 solid transparent` | border shorthand |
| `--wippy-layout-splitter-handle-shadow` | `none` | handle shadow |
| `--wippy-layout-splitter-handle-icon-color` | `transparent` | `currentColor`를 통한 테마 인식 SVG 색상 |

opt-in할 때 size, fill, border/shadow, icon color를 함께 설정합니다. SVG는 vertical splitter에서 90도 회전하며 locked split에서는 숨겨집니다.

## 모드별 동작

proxy API *surface*는 compat와 managed 모드에서 동일합니다. 같은 `@wippy-fe/proxy` import가 두 모드에서 해석됩니다. API의 두 부분은 **모드에 따라 효과가 다르므로** 애플리케이션을 managed layout으로 옮길 때 활성 모드를 고려해야 합니다.

### `host.layout`은 managed 모드에서만 효과가 있음

호스트는 layout이 선언된 경우에만 layout receiver를 설치합니다(`hostConfig.layout`으로 gate되는 managed 엔트리). compat 모드에도 `host.layout`은 존재하지만 `host.layout.snapshot`은 `null`이며 모든 mutation과 bus 호출(`resizePanel`, `updatePanel`, `movePanel`, `openModal`, `addFloating`, `broadcast`, `send`, `on` 등)은 **조용한 no-op**입니다. 메시지는 post되지만 host listener가 없습니다. mutation 전 snapshot을 검사합니다.

```typescript
if (host.layout.snapshot) {
  host.layout.updatePanel('right', { route: '/details' })   // managed only
}
// Vue: const { isManaged } = useWippyLayout(); if (isManaged.value) { … }
```

(별개의 축으로 `addPanel`, `setLayout`은 어느 모드에서도 proxy를 통해 *전혀* 노출되지 않습니다. [알려진 제한](#알려진-제한)을 참고하십시오.)

### compat shell을 전제로 하는 `host.*` 명령

managed shell은 **선언한 layout만** 렌더링합니다. Web Host 1.0.50부터 compat chrome을 대상으로 하던 명령은 조용히 실패하는 대신 타입이 지정된 `@HOST/intent` 메시지를 발행합니다. `@HOST/compat-coordinator`를 선언하거나 동등한 coordinator를 구현해 인텐트를 패널에 매핑합니다.

| `host.*` 명령 | Compat(기본값) | Managed |
|---|---|---|
| `setContext`, `toast`, `confirm`, `handleError`, `logout`, `bridge.*`, 최상위 `state` / `ws` / `on` | 동작 | 직접 동작. managed가 전역 toast와 confirmation surface를 마운트 |
| `openArtifact(id, ...)` | 오른쪽 패널 또는 modal에서 열기 | intent publish. compat coordinator가 `artifactPanel` 또는 `modalId` 대상 지정 |
| `startChat(token)` / `openSession(uuid)` | session을 열고 표시 | intent publish. compat coordinator가 start token을 해석하고 선언된 `chatPanel` 업데이트 |
| `navigate(url)` | compat root router push | intent publish. `routeSync`가 main 패널에 적용하고 브라우저 history 정렬 |
| `onRouteChanged(route, navId?)` | 호스트 브라우저 URL 구동 | 패널 경로 상태 업데이트. `routeSync`가 main 패널 경로를 브라우저 URL에 투영 |

coordinator가 아직 없으면 boot 시 intent를 첫 coordinator 구독까지 제한된 queue에 보관합니다. handler가 없는 선언은 boot parity table에 보고됩니다. 예약 intent는 `coordinators` 엔트리만 읽을 수 있고 일반 패널은 위조할 수 없습니다.

## 상태 관리 접근법

선호 순서대로 세 계층을 사용합니다.

**Route** — 사용자가 의미 있게 bookmark하거나 공유할 수 있는 상태는 URL에 둡니다. 각 `kind: page` 패널은 자체 router를 실행하고 `@history` event에 반응합니다. 결합도가 낮고 deep-link와 브라우저 history를 지원합니다.

**Layout snapshot** — 크기, collapsed flag, 컴포넌트 prop처럼 layout 형태에 영향을 주면 `updatePanel` 또는 `resizePanel`을 통해 snapshot에 둡니다. 구독한 모든 패널이 모든 snapshot 변경을 보므로 payload를 작게 유지합니다.

**패널 로컬** — 폼 draft, modal 상태, 일시적 UI 등 나머지는 패널 자체 Pinia store 또는 ref 안에 두고 패널 밖으로 내보내지 않습니다.

## 정식 조정 패턴

권장 패널 간 상호작용 패턴은 bus event → coordinator service → `updatePanel` → 자체 router를 통한 패널 반응입니다.

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

Coordinator는 얇게 유지하고 UI는 패널이 소유하게 합니다.

## 알려진 제한

Draft 1에서 아직 구현되지 않은 항목:

- **proxy를 통한 `addPanel` / `setLayout`** — 제공되지 않습니다. 내부 `@wippy-fe/layout` `LayoutManager`에만 있고 iframe proxy 경계를 넘어 노출되지 않습니다. (`openModal`, `closeModal`, `movePanel`은 제공됩니다. Layout API 참조 참고.)
- **패널 drag-to-rearrange UI** — 데이터 모델과 `movePanel()` API는 동작하지만 사용자 대상 drag는 아직 없습니다.
- **탭 컨테이너 기본 요소** — 아직 없습니다. 제공된 `@HOST/panel-tab`은 접힌 패널을 드러내는 가장자리 컨트롤이며 일반 탭 레이아웃 컨테이너가 아닙니다.
- **Grid-tile container** — 아직 없습니다.
- **런타임 mutation 지속성** — reload 사이에 mutation이 유지되지 않습니다. 필요하면 직접 저장합니다.
  ```typescript
  on('@layout-change', () =>
    state.set('layout', host.layout.snapshot)
  )
  ```
- **`nav-sidebar` header slot extension point** — 이 draft에서는 logo, app-name, toggle button 위치가 고정입니다.

## 함께 보기

- [Facade 엔트리 포인트](./entry-point.md) — facade가 JS 모듈 엔트리를 불러오고 구성을 전달하는 방식
- [Bootstrap 순서](./bootstrap.md) — boot 시 호스트가 managed-layout 엔트리로 dispatch하는 방식
- [패키지](./packages.md) — `@wippy-fe/layout`, `@wippy-fe/vue-host`, `@wippy-fe/webcomponent-core`, `@wippy-fe/webcomponent-vue`
