---
title: "다중 패널 레이아웃"
description: "managed 레이아웃 모드는 표준 Wippy 크롬을 완전히 선언적인 패널 트리로 대체합니다. 고정된 채팅·사이드바 셸 대신…"
---

# 다중 패널 레이아웃

> **상태: 초안 1(프리뷰) — 얼리 액세스이며 프로덕션용이 아닙니다.** managed 레이아웃 API는 출시되었지만 아직 프로덕션 소비자에서 충분히 검증되지 않았습니다. 필드 이름, 기본값, 검증 규칙은 마이너 릴리스 사이에도 바뀔 수 있습니다. 이 표시가 사라질 때까지 정확한 CDN 버전에 고정하세요. **거의 모든 애플리케이션에는 표준 `compat` 모드가 권장되는 프로덕션 모드입니다** — 크롬 자체를 조합해야 하는 경우에만 managed 레이아웃에 손을 뻗으세요.

managed 레이아웃 모드는 표준 Wippy 크롬을 완전히 선언적인 패널 트리로 대체합니다. 고정된 채팅·사이드바 셸 대신, 백엔드 YAML에 이름 있는 패널의 트리를 기술합니다. 웹 호스트가 부팅 시 레이아웃을 조립하고, 검증하고, 런타임에 반응형으로 유지합니다. 패널은 페이지 리로드 없이 크기 조정, 접기, 교체, 추가, 제거가 가능합니다.

## managed 레이아웃을 언제 사용하는가

표준 `compat` 모드(기본값)는 고정된 Wippy 제품을 제공합니다: 내비게이션 사이드바, 채팅 패널, 페이지 영역, 우측 아티팩트 패널. 현재 가장 널리 쓰이는 프로덕션 모드이며 거의 모든 애플리케이션에 충분합니다.

크롬 자체를 조합해야 할 때에만 `fe_mode = managed`(얼리 액세스)를 선택하세요:

| 필요 | Compat | Managed |
|------|--------|---------|
| 표준 Wippy 채팅 + 내비게이션 | 예 | 교체 가능 |
| 여러 페이지 슬롯을 나란히 배치 | 아니오 | 예 |
| 커스텀 사이드바 또는 코디네이터 컴포넌트 | 제한적 | 예 — 모든 패널 종류 |
| 브레이크포인트별 반응형 레이아웃 | 아니오 | 예 |
| 부동 오버레이 패널 | 아니오 | 예 |
| 헤드리스 코디네이터 컴포넌트 | 아니오 | 예 (`coordinators`) |
| 패널별 URL 인지 라우팅 | 메인 패널만 | 모든 `kind: page` 패널 |
| 패널 간 메시지 버스 | 아니오 | 예 (`broadcast`/`send`/`on`) |

## 호환성

managed 레이아웃은 웹 호스트, 파사드, 여러 `@wippy-fe/*` 패키지에 걸쳐 있습니다. 정확한 대상 웹 호스트 릴리스에 맞는 하나의 호환 패키지 계열을 사용하고 서빙되는 임포트 맵을 확인하세요. 무관한 릴리스의 패키지 버전을 섞지 마세요.

### 릴리스 맵

| 릴리스 | managed 레이아웃 추가 사항 |
|---|---|
| 웹 호스트 `1.0.50`, Wippy FE `0.0.50` | 타입이 정의된 compat 인텐트, `@HOST/compat-coordinator`, 브라우저 URL 및 뒤로/앞으로 동기화, 내장 패널 탭, 앵커된 부동 패널, `useSwapBuffer()`. |
| 웹 호스트 `1.0.51`, Wippy FE `0.0.51` | 반응형이며 경쟁 조건에 안전한 `<wippy-chat>` 세션/토큰 제어, 옵트인 테마 스플리터 핸들, 분할 축 전용 크기 제약, 드로어 지오메트리/스태킹 수정, 패키징된 프록시 소스 맵. |
| 웹 호스트 `1.0.52`, Wippy FE `0.0.52` | 타입이 정의된 유지형 WC 가시성과 `useHostVisibilityRefresh()`, 14초 폴백을 기다리는 대신 즉시 페이지 준비, 오래된 렌더러 키 거부, 컴포넌트 prop의 제자리 갱신, `--wippy-layout-splitter-z-index`를 갖는 격리된 스플리터 레이어. |

14초 페이지 노출은 웹 호스트 `1.0.52`의 폴백이며, 1.0.51의 기능도 아니고
애플리케이션 로딩 지연도 아닙니다. 분할 축 크기 지정과 반응형 채팅은 1.0.51에,
유지형 가시성, 키 기반 준비, 스플리터 레이어링은 1.0.52에 들어왔습니다.

유지형 직접 웹 컴포넌트 가시성에는 웹 호스트 `1.0.52`와
`@wippy-fe/webcomponent-core`, `@wippy-fe/webcomponent-vue`,
`@wippy-fe/shared` `0.0.52`가 필요합니다. 이전 managed 레이아웃 릴리스는 타입이
정의된 `data-wippy-visible` 계약이나 `useHostVisibilityRefresh()`를 제공하지
않습니다.

### 유지형 웹 컴포넌트 활성 상태

managed 레이아웃은 버퍼 교체, 브레이크포인트 변경, 드로어 열기/닫기 주기에 걸쳐
패널을 마운트된 상태로 유지합니다. 호스트는 직접 커스텀 엘리먼트를 연결하기 전에
`data-wippy-visible="true" | "false"`를 설정하고, 논리적 소유권이 바뀌면 이를
제자리에서 갱신합니다. 이는 CSS, 뷰포트, 문서 가시성이 아니며, 리마운트를
의미하지도 않습니다.

Vue 컴포넌트는 `useHostVisibility()`로 상태를 읽거나, 일반적인 초기 로딩과 노출
시 새로고침을 `useHostVisibilityRefresh(task)`로 결합합니다. 후자는 마운트 후에
실행되고 그다음에는 정확히 `false -> true`일 때만 실행됩니다. 직접 WC에서 프록시
`@visibility` 토픽을 사용하지 마세요. 그것은 iframe/Web Fragment 메시지 채널입니다.

초안 1 표시가 사라질 때까지 정확한 CDN 태그 — 최소 `https://web-host.wippy.ai/webcomponents-1.0.52` — 에 고정하세요.

## managed 레이아웃 활성화

파사드 설정에서 managed 엔트리를 활성화하고 백엔드 `host_config.layout` 선언을 제공하세요:

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

managed 엔트리가 선택되면 파사드는 `module.js` 대신 `managed-layout.js`를 서빙합니다. `fe_mode`는 현재 파사드 요구 사항 파라미터이며(기본값 `compat`, 옵트인 `managed`), `AppConfig` 페이로드 안이 아니라 `wippy.facade` 요구 사항에 설정됩니다. `AppConfig.feature` 필드는 없습니다 — managed 레이아웃은 전적으로 `AppConfig.hostConfig.layout`을 통해 자식에게 전달됩니다. 프록시 API *표면*은 두 모드에서 동일하지만, 일부 명령은 한 모드에서만 효과가 있습니다 — [어느 모드에서 무엇이 동작하는가](#what-works-in-which-mode)를 참고하세요.

## `HostLayoutDeclaration`

전체 레이아웃은 파사드 설정의 백엔드 `host_config.layout` 아래에 중첩된 단일 `HostLayoutDeclaration` 객체로 기술되며, 프론트엔드 `AppConfig.hostConfig.layout`으로 투영됩니다. 호스트는 마운트 전에 이를 검증하며, 모든 `LayoutValidationError`는 `{ kind, message, panelId? }` 형태로 브라우저 콘솔에 나타납니다.

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `layouts` | `Record<string, PanelTree> & { default: PanelTree }` | 브레이크포인트를 키로 하는 패널 트리. `default` 키는 필수입니다. |
| `breakpoints?` | `Record<string, number>` | 기본이 아닌 레이아웃 키를 활성화하는 픽셀 너비. |
| `panels` | `Record<string, HostPanelDef>` | 이름 있는 패널 콘텐츠 정의. |
| `floating?` | `Record<string, HostFloatingDef>` | 부팅 시점의 부동 오버레이 패널. |
| `modals?` | `Record<string, HostModalDef>` | 부팅 시점의 모달 정의. |
| `coordinators?` | `Record<string, HostCoordinatorDef>` | 헤드리스 코디네이터 컴포넌트. |
| `services?` | `Record<string, HostCoordinatorDef>` | `coordinators`의 더 이상 권장되지 않는 별칭. 새 선언은 `coordinators`를 사용해야 합니다. |
| `dragEnabled?` | boolean | 사용자가 스플리터를 드래그하도록 허용. 기본값 `true`. |

## 패널 종류

`panels`, `floating`, `modals`, `coordinators`의 각 항목은 `kind`를 태그로 하는 유니온입니다:

| 종류 | 설명 | 필수 필드 |
|------|-------------|-----------------|
| `page` | srcdoc iframe에 마운트되는 Wippy 페이지 모듈 | `id`(페이지 레지스트리 id) |
| `artifact` | srcdoc iframe에 마운트되는 Wippy 아티팩트 | `id`(아티팩트 UUID) |
| `component` | 호스트 DOM에 직접 마운트되는 웹 컴포넌트 | `tagName` |
| `builtin` | 프레임워크가 소유하는 호스트 컴포넌트(아래 참조) | `id` |

레이아웃 트리에서 정확히 하나의 패널이 `main: true`를 가져야 합니다. 브라우저 URL 소유권은 여전히 `@HOST/compat-coordinator` 또는 동등한 소비자 조율을 통한 라우트 동기화가 필요합니다. 다른 모든 패널은 자신의 iframe 안에서 독립적으로 라우팅합니다.

### 내장 패널 ID

`kind: builtin`은 다음 `id` 값을 받습니다. `@HOST/` 접두사는 프레임워크가 소유하는 패널을 위해 예약되어 있습니다:

| ID | 렌더링 내용 |
|----|-----------------|
| `@HOST/nav-sidebar` | 표준 Wippy 내비게이션 사이드바(세션, 페이지, 설정) |
| `@HOST/chat-wrapper` | 활성 세션을 위한 표준 Wippy 채팅 패널 |
| `@HOST/artifact-viewer` | 범용 아티팩트 뷰어(라우트 `/:uuid`와 함께 사용) |
| `@HOST/session-selector` | 세션 목록과 선택기 |
| `@HOST/compat-coordinator` | 헤드리스 compat 인텐트 및 메인 라우트 코디네이터. `coordinators` 아래에 선언 |
| `@HOST/panel-tab` | 접힌 패널을 드러내기 위한 가장자리 탭. `floating` 아래에 선언 |

알 수 없는 `@HOST/<id>`는 빈 슬롯을 조용히 렌더링하는 대신 선언 로드 시점에 `LayoutValidationError`를 일으킵니다.

## 브레이크포인트 키 레이아웃

`layouts` 필드는 브레이크포인트 키를 패널 트리에 매핑합니다. 더 좁은 브레이크포인트가 일치하지 않는 한 항상 `default`가 사용됩니다. 브레이크포인트 픽셀 너비는 `breakpoints` 아래에 정의합니다:

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

브레이크포인트가 바뀌면 같은 `id`를 가진 패널은 재부모화 없이 활성 슬롯을 시각적으로 따라가는 하나의 안정적인 콘텐츠 호스트를 유지합니다. iframe `contentWindow`, 웹 컴포넌트 상태, Vue 상태, 스크롤 위치가 전환을 넘어 유지됩니다. Teleport를 통한 재부모화는 의도적으로 피합니다. iframe을 제거하고 다시 삽입하면 다시 로드되기 때문입니다.

### 드로어 모드 패널

패널 슬롯은 `display: 'drawer-left' | 'drawer-right' | 'drawer-bottom'`을 선언하여 인라인 flex 항목 대신 슬라이드인 오버레이로 렌더링될 수 있습니다. 드로어 패널은:

- 부모 컨테이너의 트랙 크기 계산에 참여하지 않습니다(`size`는 무시됩니다)
- 지정된 가장자리에 앵커된 절대 위치 오버레이로 렌더링됩니다
- `host.layout.openDrawer(id)` / `closeDrawer(id)` / `toggleDrawer(id)`로 전환되는 열림/닫힘 상태를 가집니다
- 열려 있을 때 백드롭을 표시하며, 백드롭을 클릭하면 열린 모든 드로어가 닫힙니다

`main: true` 슬롯은 드로어 모드가 될 수 없습니다 — 호스트 검증이 예외를 던집니다. `drawerSize.width` 필드는 좌/우 드로어의 너비를, `drawerSize.height`는 하단 드로어의 높이를 제어합니다. 기본값은 `320px`입니다.

## 부동 패널

부동 패널은 `floating` 아래에 선언되는 자유 위치 오버레이입니다. flex 레이아웃 트리에 참여하지 않으며 런타임에 추가하거나 제거할 수 있습니다:

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
// 부동 패널 추가
host.layout.addFloating('inspector', {
  kind: 'component',
  tagName: 'my-inspector',
  position: { x: 100, y: 100 },
  size: { width: 400, height: 300 },
})

// 제거
host.layout.removeFloating('inspector')
```

## 헤드리스 코디네이터

코디네이터는 숨겨진 호스트에 마운트되는 컴포넌트입니다. 보이는 슬롯이 없지만 패널 범위 호스트 API를 받습니다. 표시용 패널이 렌더링에 집중할 수 있도록 횡단 로직에 사용하세요. 구버전 `services` 필드는 더 이상 권장되지 않는 호환 별칭으로 남아 있습니다.

```yaml
coordinators:
  coordinator:
    kind: component
    tagName: my-coordinator
```

코디네이터 컴포넌트는 패널 범위 호스트 래퍼를 받으며 `onMount`에서 즉시 버스 채널을 구독할 수 있습니다:

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

### 제공되는 compat 코디네이터

managed 레이아웃은 선언된 서피스만 포함합니다. 따라서
`host.openArtifact()`, `host.startChat()`, `host.openSession()`,
`host.navigate()` 같은 호출은 예약 채널 `@HOST/intent`에 타입이 정의된 인텐트를
발행합니다. 이를 처리하고 브라우저 URL을 메인 패널에 묶으려면 제공되는
코디네이터를 선언하세요:

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

표준 내비게이션 계약을 사용할 때는 `routeSync: true`를 유지하세요. 코디네이터나
동등한 소비자 로직이 없으면 딥 링크, 뒤로/앞으로, `@HOST/nav-sidebar` 내비게이션이
구동할 패널 라우트를 갖지 못합니다. 자식 부팅 중에 발생한 인텐트는 첫 코디네이터가
구독할 때까지 제한된 큐에 보관됩니다.

`@HOST/`는 양방향으로 예약되어 있습니다. 일반 패널은 시스템 트래픽을 발행할 수
없고, `coordinators` 아래의 항목만이 지원되는 호스트 API를 통해 이를 받습니다. 이
경계는 iframe/Web Fragment 패널에 대해 강제됩니다. 호스트 영역에 직접 마운트된
컴포넌트는 호스트 DOM을 공유하며 보안 샌드박스가 아닙니다. 부팅 시 호스트는
코디네이터 처리, 모달 대상 서피스, 메인 패널 URL 바인딩, 선언된 코디네이터 태그가
빠졌을 때 패리티 표를 출력합니다. 완전한 선언은 경고를 만들지 않습니다.

## 탭 내 브로드캐스트 버스

패널은 현재 브라우저 탭으로 범위가 한정된 버스를 통해 통신합니다. 버스는 다른 탭으로 넘어가지 않습니다 — 다중 탭 동기화가 필요하면 커스텀 WebSocket 토픽을 사용하세요.

| 메서드 | 설명 |
|--------|-------------|
| `host.layout.broadcast(channel, payload)` | 모든 패널에 발행. 발신자는 제외 |
| `host.layout.send(targetPanelId, channel, payload)` | 특정 패널 하나에 발행 |
| `host.layout.on(channel, handler)` | 구독. 구독 해제 함수 `off()`를 반환 |

수신 메시지의 `sourcePanelId`는 호스트가 발행 윈도우로부터 설정하며 위조할 수 없습니다. 채널 이름은 대소문자를 구분하는 평범한 문자열입니다.

**중요:** `@wippy-fe/proxy`에서 `host`를 직접 임포트하는 컴포넌트는 패널 범위 지정을 우회합니다 — 버스 호출은 전달되지만 `sourcePanelId`를 잃습니다. 항상 패널 범위 래퍼를 사용하세요:

```typescript
// 순수 HTMLElement
import { getWippyHost } from '@wippy-fe/webcomponent-core'
const host = getWippyHost(this)

// WippyElement 서브클래스 — this.host는 이미 패널 범위입니다
this.host?.layout.broadcast('open-chat', { token: 'abc' })

// Vue 컴포넌트
import { useHost } from '@wippy-fe/webcomponent-vue'
// ProxyApiInstance는 앰비언트 전역 타입입니다(@wippy-fe/types-global-proxy에서) — 임포트 없이 참조하세요.
const host = useHost<ProxyApiInstance['host']>()
host?.layout.broadcast('open-chat', { token: 'abc' })
```

## 레이아웃 API 레퍼런스 (`host.layout`)

| 메서드 | 설명 |
|--------|-------------|
| `.snapshot` | 전체 레이아웃 스냅샷을 반환하는 동기 게터. managed 레이아웃 모드 밖에서는 `null` |
| `.resizePanel(id, size)` | 활성 브레이크포인트에서 지정한 패널의 크기 조정 |
| `.collapsePanel(id)` | `collapsible: true`로 선언된 패널 접기 |
| `.expandPanel(id)` | 접힌 패널 펼치기 |
| `.openDrawer(id)` | 드로어 모드 패널 열기 |
| `.closeDrawer(id)` | 드로어 모드 패널 닫기 |
| `.toggleDrawer(id)` | 드로어 모드 패널 전환 |
| `.movePanel(id, target)` | 패널을 트리의 새 위치로 이동 |
| `.removePanel(id)` | 모든 브레이크포인트 레이아웃에서 패널 제거 |
| `.updatePanel(id, def)` | 런타임에 패널 정의를 패치. `props`는 얕게 병합되고 최상위 필드는 교체됩니다 |
| `.addFloating(id, def)` | 부동 패널 추가 |
| `.removeFloating(id)` | 부동 패널 제거 |
| `.openModal(id, def?)` | 선언된 모달을 id로 열며, 선택적으로 정의를 오버라이드합니다. 런타임 전용 모달에는 `def`가 필요합니다. 네이티브 `<dialog>.showModal()`이 기본이며, 레거시 div 오버레이를 원하면 `useNativeDialog: false`를 전달하세요. 이미 열린 id를 다시 여는 것은 조용한 무동작입니다. |
| `.closeModal(id)` | 열린 모달 닫기 |
| `.broadcast(channel, payload)` | 모든 패널에 발행 |
| `.send(target, channel, payload)` | 패널 하나에 발행 |
| `.on(channel, handler)` | 버스 채널 구독 |

`openModal()`은 호스트 내부의 레이아웃 인프라를 문서화한 것이지 애플리케이션 컴포넌트를 위한 레시피가 아닙니다. 배포되는 Vue 제품 UI는 이 네이티브 다이얼로그 동작을 커스텀 모달 스타일로 복제하는 대신 PrimeVue `Dialog`나 호스트 확인 API를 사용해야 합니다.

### `updatePanel` 병합 의미론

`host.layout.updatePanel(id, def)`는 기존 패널 정의를 패치하며 교체하지 않습니다. `props` 객체는 패널의 현재 props에 **얕게 병합**됩니다. 제공된 키는 추가되거나 덮어써지고, 생략된 키는 보존됩니다. `def`의 **다른** 모든 최상위 필드(`route`, `kind`, `id`, `tagName`, `title`, `icon`, …)는 현재 값을 통째로 **교체**합니다.

현재 props가 `{ artifactId: 'old', zoom: 2 }`인 패널이 있다고 하면:

```typescript
// props는 얕게 병합 → { artifactId: 'abc', zoom: 2 }
host.layout.updatePanel('right', { props: { artifactId: 'abc' } })

// route는 통째로 교체. props는 그대로
host.layout.updatePanel('right', { route: '/x' })
```

두 가지 주의점: props 병합은 **얕습니다** — `props` 안의 중첩 객체는 깊게 병합되지 않고 통째로 교체됩니다 — 그리고 얕은 병합으로는 prop 키를 삭제할 수 없습니다(덮어쓰기만 가능합니다).

## Vue 컴포저블 — `@wippy-fe/vue-host`

이 컴포저블들은 프록시 레이아웃 API를 반응형 Vue 3 ref로 감쌉니다. 기저 구독은 모듈 범위이며 iframe의 수명 동안 유지되므로, 언마운트 시 컴포넌트별 정리가 없습니다:

| 컴포저블 | 반환값 |
|------------|---------|
| `useWippyLayout()` | 전체 레이아웃 상태와 변형 메서드 |
| `useWippyPanel(panelId)` | 지정한 패널의 실시간 상태(`panelId`는 필수이며 `string`, `Ref<string>`, 또는 getter) |
| `useWippyBreakpoint()` | 활성 브레이크포인트 이름을 담은 반응형 ref |
| `useWippyMainRoute()` | 메인 패널의 현재 라우트에 대한 반응형 ref |

컴포저블은 결코 `null`을 반환하지 않습니다 — 항상 객체/ref를 돌려주며, managed 레이아웃 호스트가 없을 때 내부의 `.value`가 저하됩니다. `useWippyLayout().snapshot.value`는 `null`이고(`isManaged.value`는 `false`이므로 변형은 조용한 무동작입니다), `useWippyBreakpoint().value`와 `useWippyMainRoute().value`는 빈 문자열, id가 없을 때 `useWippyPanel(id).value`는 `null`입니다. 호스트 존재 여부는 반환값에 대한 `=== null` 검사가 아니라 `layout.isManaged.value`(또는 `layout.snapshot.value !== null`)로 가드하세요. 덕분에 managed 레이아웃 호스트가 없는 독립 플레이그라운드와 유닛 테스트에서도 컴포저블을 사용할 수 있습니다.

## 리마운트 없는 교체 버퍼링

`@wippy-fe/layout`의 `useSwapBuffer()`는 들어오는 콘텐츠가 준비 상태를 보고할
때까지 나가는 서피스를 마운트된 채로 유지하며, 명시적인 타임아웃 상한을 둡니다.
불변 `slot.index`를 DOM 키로 사용하고, 오래된 비동기 신호가 거부되도록
`markReady()` / `markFailed()`에 인덱스와 콘텐츠 키를 함께 전달하며, 오류는 버퍼별로
범위를 한정하세요. 콘텐츠 정체성은 `keyOf`에 두어야 합니다. DOM 키를 바꾸면
iframe이 다시 삽입되어, 버퍼링이 지키려던 상태가 파괴됩니다.

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
// 또는: swap.markFailed(slot.index, error, slot.key)
```

위 값들은 기본값입니다. 준비 타임아웃은 기본적으로 오래된 콘텐츠를 로더 뒤에
남겨두는 대신 콘텐츠를 노출합니다. 로딩 UI는 준비 상태에 직접 묶지 말고
`swap.showLoader`에 묶으세요. 실패한 버퍼는 형제 버퍼로부터 격리된 상태로 남으며,
오류를 처리한 뒤 `clearError(index)`를 호출해 재시도하세요.

### 웹 호스트 페이지 준비 상태

웹 호스트는 managed 페이지 서피스에 동일한 키 기반 준비 규율을 사용하며, 최종
노출 상한은 14초입니다. iframe 및 직접 웹 컴포넌트 렌더러는 Vue 이벤트 리스너를
통해 `load` / `error`를 방출하고 그 렌더러가 소유한 불변 콘텐츠 키를 포함합니다.
따라서 그려진 콘텐츠는 즉시 노출되며, 상한은 아무것도 보고하지 않는 콘텐츠를 위한
폴백일 뿐입니다. 축출된 렌더러에서 늦게 온 이벤트는 그 버퍼 인덱스가 이미 재사용된
경우 거부됩니다.

14초 호스트 상한을 애플리케이션 로딩 지연으로 사용하지 말고, 일반적인 페이지 준비
상태 주위에 두 번째 타이머를 두지 마세요. 정기적으로 상한에 도달하는 페이지는 준비
상태나 라이프사이클 경로가 망가진 것이며, 그 소유자 쪽에서 고쳐야 합니다.

### 안정적인 컴포넌트 갱신과 패널 크기 지정

`kind: component`의 경우 패널 `props`를 바꾸면 기존 커스텀 엘리먼트의 어트리뷰트가
갱신되거나 제거됩니다. 호스트는 `tagName`이 바뀔 때만 엘리먼트를 교체합니다. 덕분에
`updatePanel()` 호출과 브레이크포인트 전환 중에도 엘리먼트가 소유한 상태가
보존됩니다.

`minSize`와 `maxSize`는 활성 분할 축만 제약합니다. 수평 트리에서는 너비, 수직
트리에서는 높이입니다. 교차 축은 제한하지 않으므로 내비게이션, 채팅, 기타 전체 높이
마운트가 자신의 트랙을 채울 수 있습니다. 드로어 마운트는 애니메이션 드로어
지오메트리를 따르며, 열려 있는 동안에만 앵커와 백드롭 위로 올라가고 콘텐츠를
리마운트하지 않습니다.

## 스플리터와 핸들 스타일

스플리터의 히트 영역은 보이는 선보다 넓으며 패키지의 격리된 레이어 스택에
존재합니다. `--wippy-layout-splitter-z-index`의 기본값은 `700`으로, 드로어와 모달
백드롭보다 아래입니다. 원형 핸들은 옵트인입니다:

| 변수 | 기본값 | 용도 |
|---|---|---|
| `--wippy-layout-splitter-size` | `1px` | 보이는 스플리터 선의 두께 |
| `--wippy-layout-splitter-hit-size` | `10px` | 선 주변의 포인터 히트 영역. 거친 포인터에서는 `24px` |
| `--wippy-layout-splitter-z-index` | `700` | 스플리터와 핸들 레이어 |
| `--wippy-layout-splitter-handle-size` | `0` | 핸들 지름. `0`이면 비활성 |
| `--wippy-layout-splitter-handle-bg` | `transparent` | 핸들 채움 |
| `--wippy-layout-splitter-handle-border` | `0 solid transparent` | 테두리 단축 속성 |
| `--wippy-layout-splitter-handle-shadow` | `none` | 핸들 그림자 |
| `--wippy-layout-splitter-handle-icon-color` | `transparent` | `currentColor`를 통한 테마 인지 SVG 색상 |

옵트인할 때는 크기, 채움, 테두리/그림자, 아이콘 색상을 함께 설정하세요. SVG는 수직
스플리터에서 90도 회전하며, 잠긴 분할에서는 숨겨진 채로 남습니다.

## 어느 모드에서 무엇이 동작하는가

프록시 API *표면*은 compat 모드와 managed 모드에서 동일합니다 — 같은 `@wippy-fe/proxy` 임포트가 두 모드 모두에서 해석됩니다 — 그러나 그중 두 부분은 **효과가 모드에 따라 다릅니다**. 앱을 managed 레이아웃으로 옮길 때 가장 주의할 점이며, managed가 아직 얼리 액세스인 이유이기도 합니다.

### `host.layout`은 managed 모드에서만 효과가 있다

호스트는 **레이아웃이 선언되었을 때에만** 레이아웃 리시버를 설치합니다(`hostConfig.layout`으로 게이팅되는 managed 엔트리). compat 모드에서도 `host.layout`은 존재하지만 `host.layout.snapshot`이 `null`이고 모든 변형과 버스 호출(`resizePanel`, `updatePanel`, `movePanel`, `openModal`, `addFloating`, `broadcast`, `send`, `on`, …)은 **조용한 무동작**입니다 — 메시지는 전송되지만 호스트 쪽에서 아무도 듣고 있지 않습니다. 변형 전에 스냅샷으로 게이팅하세요:

```typescript
if (host.layout.snapshot) {
  host.layout.updatePanel('right', { route: '/details' })   // managed 전용
}
// Vue: const { isManaged } = useWippyLayout(); if (isManaged.value) { … }
```

(별개의 축입니다만 — `addPanel`과 `setLayout`은 두 모드 어디에서도 프록시로 *전혀* 노출되지 않습니다. [알려진 제약](#known-limitations)을 참고하세요.)

### compat 셸을 전제하는 `host.*` 명령

managed 셸은 **여러분이 선언한 레이아웃만** 렌더링합니다. 웹 호스트 1.0.50부터, 보통 compat 크롬을 대상으로 하는 명령들은 조용히 실패하는 대신 타입이 정의된 `@HOST/intent` 메시지를 발행합니다. `@HOST/compat-coordinator`를 선언하거나 동등한 코디네이터를 구현하여 그 인텐트를 여러분의 패널에 매핑하세요:

| `host.*` 명령 | Compat(기본) | Managed |
|---|---|---|
| `setContext`, `toast`, `confirm`, `handleError`, `logout`, `bridge.*`, 최상위 `state` / `ws` / `on` | 동작 | 직접 동작. managed는 전역 토스트와 확인 서피스를 마운트합니다 |
| `openArtifact(id, ...)` | 우측 패널이나 모달에서 열림 | 인텐트를 발행. compat 코디네이터가 `artifactPanel` 또는 `modalId`를 대상으로 함 |
| `startChat(token)` / `openSession(uuid)` | 세션을 열고 표시 | 인텐트를 발행. compat 코디네이터가 시작 토큰을 해석하고 선언된 `chatPanel`을 갱신 |
| `navigate(url)` | compat 루트 라우터에 push | 인텐트를 발행. `routeSync`가 이를 메인 패널에 적용하고 브라우저 히스토리를 맞춰 유지 |
| `onRouteChanged(route, navId?)` | 호스트 브라우저 URL을 구동 | 패널 라우트 상태를 갱신. `routeSync`가 메인 패널 라우트를 브라우저 URL에 투영 |

아직 코디네이터가 없다면 부팅 시점의 인텐트는 첫 코디네이터 구독을 위해 제한된 큐에 보관됩니다. 핸들러가 없는 선언은 부팅 패리티 표에 보고됩니다. 예약 인텐트는 `coordinators` 항목만 읽을 수 있으며 일반 패널이 위조할 수 없습니다.

## 상태 관리 접근법

선호 순서대로 세 단계입니다:

**라우트** — 사용자가 의미 있게 북마크하거나 공유할 수 있는 상태라면 URL에 두세요. 각 `kind: page` 패널은 자체 라우터를 실행하고 `@history` 이벤트에 반응합니다. 결합도가 낮고, 딥 링크가 가능하며, 브라우저 히스토리를 인지합니다.

**레이아웃 스냅샷** — 레이아웃 형태(크기, 접힘 플래그, 컴포넌트 props)에 영향을 준다면 `updatePanel`이나 `resizePanel`을 통해 스냅샷에 두세요. 구독 중인 모든 패널이 모든 스냅샷 변경을 보므로 페이로드는 작게 유지하세요.

**패널 로컬** — 그 외 모든 것(폼 초안, 모달 상태, 일시적 UI)은 패널 자체의 Pinia 스토어나 ref 안에 머무르며 패널을 떠나지 않습니다.

## 정식 조율 패턴

패널 간 상호작용에 권장되는 패턴은: 버스 이벤트 → 코디네이터 서비스 → `updatePanel` → 패널이 자체 라우터로 반응.

```typescript
// 코디네이터 서비스 안에서
this.host?.layout.on('open-chat', ({ payload }) => {
  this.host?.layout.updatePanel('right', { route: `/open-chat/${payload.token}` })
  this.host?.layout.expandPanel('right')
})

// 우측 패널 앱에서 (평범한 Vue 페이지 모듈)
const router = createAppRouter([...])
// createAppRouter는 에코/현재 라우트 가드와 함께 호스트 히스토리 이벤트를
// 이미 라우터에 반영합니다. 수동 라우팅 구독을 추가하지 마세요.
```

코디네이터는 얇게 유지하세요. 패널은 자기 UI를 소유하게 하세요.

## 알려진 제약

초안 1 기준으로 다음은 아직 구현되지 않았습니다:

- **프록시를 통한 `addPanel` / `setLayout`** — 출시되지 않았습니다. 이들은 내부 `@wippy-fe/layout` `LayoutManager`에만 존재하며 iframe 프록시 경계를 넘어 노출되지 않습니다. (`openModal`, `closeModal`, `movePanel`은 출시되었습니다 — 레이아웃 API 레퍼런스 참조.)
- **패널 드래그 재배치 UI** — 데이터 모델과 `movePanel()` API는 동작하지만, 사용자 대상 드래그는 아직 구현되지 않았습니다.
- **탭 프리미티브** — 아직 구현되지 않았습니다.
- **그리드 타일 컨테이너** — 후속 작업으로 추적 중입니다.
- **런타임 변형의 지속성** — 변형은 리로드를 넘어 유지되지 않습니다. 필요하면 직접 저장하세요:
  ```typescript
  on('@layout-change', () =>
    state.set('layout', host.layout.snapshot)
  )
  ```
- **`nav-sidebar` 헤더 슬롯 확장 지점** — 로고, 앱 이름, 토글 버튼 위치는 이 초안에서 고정되어 있습니다.

## 함께 보기

- [파사드 엔트리 포인트](./entry-point.md) — 파사드가 JS 모듈 엔트리를 로드하고 설정을 전달하는 방식
- [부트스트랩 시퀀스](./bootstrap.md) — 호스트가 부팅 시 managed 레이아웃 엔트리로 디스패치하는 방식
- [패키지](./packages.md) — `@wippy-fe/layout`, `@wippy-fe/vue-host`, `@wippy-fe/webcomponent-core`, `@wippy-fe/webcomponent-vue`
