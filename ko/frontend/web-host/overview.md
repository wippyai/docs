---
title: "Web Host 개요"
description: "CDN에서 호스팅되는 Web Host, facade 페이지, 자식 마이크로 프런트엔드가 Wippy 애플리케이션에서 결합되는 방식입니다."
---

# Web Host 개요

이 페이지는 아키텍처 참조입니다. 배포 경계와 엔트리 포인트를 설명하며 설정 절차는 연결된 facade 및 마이크로 프런트엔드 안내서에서 다룹니다.

Wippy Web Host는 Feature-Sliced Design 방법론으로 구축된 Vue 3 single-page 애플리케이션이며 `https://web-host.wippy.ai`에서 제공됩니다. Wippy 애플리케이션의 사용자 대상 페이지와 UI 컴포넌트를 호스팅합니다. `wippy/facade` 백엔드 모듈을 통해 구성하며 애플리케이션과 함께 직접 빌드하거나 배포하지 않습니다.

![Wippy FE 아키텍처](../diagrams/fe-arch-overview.svg)

## 3계층 모델

실행 중인 Wippy 애플리케이션은 중첩된 세 계층으로 구성됩니다.

**계층 1 — `wippy/facade`가 제공하는 페이지.** 백엔드가 렌더링하는 HTML 페이지입니다. `wippy/facade` 모듈은 Wippy gateway에 정적 파일 서버와 `/facade/config` endpoint를 등록합니다. 사용자가 애플리케이션으로 이동하면 `wippy/facade`는 CDN에서 Web Host JS 모듈 엔트리(compat은 `module.js`, managed는 `managed-layout.js`)를 불러오고 `/facade/config`의 구성으로 초기화하는 얇은 HTML 페이지를 제공합니다. 페이지 자체에는 Vue나 React가 없습니다.

**계층 2 — Web Host.** Web Host 번들은 전체 페이지와 브라우저 history를 장악하는 JS 모듈로 로드됩니다. 탐색, 채팅, 세션 관리, 페이지 렌더링 surface 등 Wippy chrome을 소유합니다. 페이지의 init 호출에서 전체 구성을 받고 배포별 URL이나 토큰을 포함하지 않습니다. 따라서 같은 CDN 번들로 여러 배포를 제공할 수 있습니다. facade 없이 수동으로 삽입할 때는 아래 설명하는 `iframe.html` 엔트리를 통해 iframe 안에서 호스트를 실행할 수 있습니다.

**계층 3 — 자식 마이크로 프런트엔드.** Web Host는 구성된 페이지 엔진, 즉 레거시 srcdoc iframe 또는 Web Fragment를 통해 `view.page` 모듈을 렌더링하고 `view.component` 모듈은 사용자 정의 요소로 마운트합니다. iframe 엔진은 별도의 browsing context를 제공합니다. Web Fragment는 호스트 문서에 반영되는 reframed realm이며 격리 경계가 아닙니다. 컴포넌트 shadow root는 선택자를 격리하지만 권한을 격리하지 않습니다. 각 surface는 배포별 URL을 알 필요 없이 Wippy API 접근, 인증 컨텍스트, 테마 전달, 통신에 맞는 proxy adapter를 받습니다.

```
Page (wippy/facade HTML — loads module.js / managed-layout.js)
  └─ Web Host (takes over the page + browser history)
       ├─ Chat UI, navigation, sidebar
       └─ Child micro-frontends
            ├─ view.page → srcdoc iframe or Web Fragment + proxy adapter
            └─ view.component → custom element + @wippy-fe/proxy ESM
```

## 엔트리 포인트

Web Host CDN은 같은 버전 디렉터리에서 여러 엔트리 포인트를 제공합니다. 통합 방식에 맞는 항목을 선택합니다. 각 엔트리는 `/<release-tag>/module.js`처럼 `<release-tag>/<entry>`에서 사용할 수 있습니다.

| 엔트리 | 사용 사례 |
|-------|----------|
| `module.js` | **compat** 모드의 전체 앱. 표준 탐색 사이드바 + 페이지 영역 + 오른쪽 채팅 패널 shell. `window.initWippyApp()`으로 페이지에 직접 마운트되어 전체 페이지와 브라우저 history를 장악합니다. 현재 `wippy/facade`가 기본으로 제공하는 엔트리입니다. |
| `managed-layout.js` | **managed** 모드의 전체 앱. 선언적 멀티 패널 레이아웃입니다. `fe_mode = managed`일 때 facade가 제공합니다. 조기 접근 기능([멀티 패널 레이아웃](./multi-panel-layout.md) 참고)입니다. |
| `iframe.html` | 격리 또는 부분 페이지 삽입을 위해 **iframe 내부에서** 실행하는 전체 앱. `SetConfig` PostMessage handshake로 구성을 제공하는 수동 facade 없는 삽입에 사용합니다. facade 자체는 이 파일이 아니라 위 JS 모듈 엔트리를 불러옵니다. |
| `chat-iframe.html` | 사이드바나 페이지가 없는 최소 채팅 인터페이스. 집중형 채팅 widget 삽입에 유용합니다. |
| `chat.js` | 채팅 store와 WebSocket client를 노출하는 headless ESM 모듈. 완전한 사용자 정의 UI 구축에 사용합니다. |
| `ws.js` | Vue 또는 Pinia 의존성이 없는 독립 WebSocket 서비스. 저수준 실시간 통합에 사용합니다. |

표준 `wippy/facade` 기반 배포에서는 이 경로를 직접 참조하지 않습니다. facade가 구성에서 `fe_facade_url`을 읽고 `fe_mode`에 맞는 JS 모듈 엔트리(compat은 `module.js`, managed는 `managed-layout.js`)를 선택하여 정확한 URL을 자동으로 구성합니다.

## CDN 버전 관리

Web Host는 Git tag로 버전을 관리합니다. 정식 production URL 패턴은 다음과 같습니다.

```
https://web-host.wippy.ai/<release-tag>/
```

`<release-tag>`는 안정 릴리스 또는 feature branch preview 배포인 Web Host Git release tag입니다. staging CDN은 `https://web-host.staging.wippy.ai/<release-tag>/`입니다.

일반적으로 `wippy/facade` 모듈은 일치하는 Web Host 빌드를 가리키는 기본 `fe_facade_url`로 버전을 선택합니다. 따라서 `wippy/facade`를 업데이트하면 배포가 대응하는 Web Host 버전으로 이동합니다. import map으로 vendor library를 공유하는 자식 앱은 해당 빌드가 제공하는 버전을 받습니다.

검증된 빌드를 유지하거나 feature branch/조기 접근 tag를 사용하기 위해 특정 Web Host 버전을 고정하려면 `fe_facade_url` parameter를 재정의합니다.

```yaml
- name: fe_facade_url
  value: https://web-host.wippy.ai/<release-tag>
```

이 설정은 전체 배포를 해당 빌드에 고정합니다. 런타임에 설정하는 `-o` / `--override` 문법은 [CLI override](../../guides/cli.md)를 참고하십시오.

## 기술 스택

Web Host는 Vue 3(Composition API), UI 컴포넌트용 PrimeVue + Tailwind CSS 3, 상태 관리용 Pinia, 탐색용 Vue Router, HTTP용 Axios로 구축됩니다.

### 자식 의존성 외부화

개발 중 `<fe_facade_url>/import-map.json`을 가져와 현재 아티팩트가 특정 키를 import하지 않더라도 `imports` 객체의 모든 키를 Rollup external에 넣습니다. import한 의존성의 정확한 specifier가 없을 때만 번들에 포함합니다. Web Host tag가 바뀌거나 새 의존성이 추가되면 다시 가져옵니다.

## 함께 보기

- [Facade 엔트리 포인트](./entry-point.md) — facade가 사용자에게 Web Host를 전달하는 방식과 구성 흐름
- [Bootstrap 순서](./bootstrap.md) — Web Host가 구성을 받은 뒤 내부에서 일어나는 일
- [멀티 패널 레이아웃](./multi-panel-layout.md) — 사용자 정의 멀티 패널 shell을 위한 managed layout 모드
- [패키지](./packages.md) — 자식 앱 개발자가 사용할 수 있는 `@wippy-fe/*` npm 패키지
- [Facade 모듈](../../framework/facade.md) — `wippy/facade` 백엔드 설정
- [렌더 엔진](./render-engines.md) — 두 페이지 렌더 엔진(srcdoc iframe과 Web Fragment)
