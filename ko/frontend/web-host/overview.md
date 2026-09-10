---
title: "웹 호스트 개요"
description: "Wippy 웹 호스트는 Feature-Sliced Design 방법론으로 만들어진 Vue 3 싱글 페이지 애플리케이션이며 CDN에서 제공됩니다…"
---

# 웹 호스트 개요

Wippy 웹 호스트는 Feature-Sliced Design 방법론으로 만들어진 Vue 3 싱글 페이지 애플리케이션이며 `https://web-host.wippy.ai`의 CDN에서 제공됩니다. Wippy 애플리케이션의 모든 사용자 대상 페이지와 UI 컴포넌트를 호스팅합니다. 여러분이 빌드하거나 배포하지 않습니다 — `wippy/facade` 백엔드 모듈로 설정하면 자동으로 로드됩니다.

![Wippy FE 아키텍처](../diagrams/fe-arch-overview.svg)

## 3계층 모델

실행 중인 Wippy 애플리케이션은 중첩된 세 개의 계층으로 구성됩니다:

**계층 1 — `wippy/facade`가 서빙하는 페이지.** 백엔드가 렌더링하는 HTML 페이지입니다. `wippy/facade` 모듈은 Wippy 게이트웨이에 정적 파일 서버와 `/facade/config` 엔드포인트를 등록합니다. 사용자가 애플리케이션으로 이동하면 `wippy/facade`는 CDN에서 웹 호스트 JS 모듈 엔트리(compat은 `module.js`, managed는 `managed-layout.js`)를 로드하고 `/facade/config`의 설정으로 초기화하는 얇은 HTML 페이지를 서빙합니다. 페이지 자체에는 Vue도 React도 없습니다 — 의도적으로 얇습니다.

**계층 2 — 웹 호스트.** 웹 호스트 번들은 페이지 전체와 브라우저 히스토리를 인수하는 JS 모듈로 로드됩니다. Wippy 크롬을 소유합니다: 내비게이션 사이드바, 채팅 패널, 세션 관리, 페이지 렌더링 서피스. 전체 설정을 페이지의 초기화 호출로부터 받으며, 번들 자체에는 배포에 특수한 URL이나 토큰이 결코 들어 있지 않습니다. 이것이 CDN에 호스팅되는 번들을 배포 간에 이식 가능하게 만듭니다. (수동, 파사드 없는 임베딩에서는 같은 호스트가 `iframe.html` 엔트리를 통해 iframe 안에서 실행될 수도 있습니다 — 아래 엔트리 포인트 표 참조.)

**계층 3 — 자식 마이크로 프론트엔드.** 웹 호스트는 다시 사용자가 정의한 뷰를 중첩 iframe(`view.page` 모듈) 또는 웹 컴포넌트(`view.component` 모듈)로 임베드합니다. 각 자식은 격리되어 실행됩니다. 웹 호스트는 프록시 스크립트를 주입하여 자식에게 Wippy API, 인증 컨텍스트, 테마 CSS, 통신 채널에 대한 접근을 제공합니다 — 자식이 자신이 어디에 배포되었는지 알 필요 없이 말입니다.

```
Page (wippy/facade HTML — module.js / managed-layout.js 로드)
  └─ Web Host (페이지 + 브라우저 히스토리 인수)
       ├─ 채팅 UI, 내비게이션, 사이드바
       └─ 자식 마이크로 프론트엔드
            ├─ view.page  → srcdoc iframe + proxy.js
            └─ view.component → 커스텀 엘리먼트 + @wippy-fe/proxy ESM
```

## 엔트리 포인트

웹 호스트 CDN은 동일한 버전 디렉터리에서 여러 엔트리 포인트를 서빙합니다. 어느 것이 맞는지는 통합 방식에 달려 있습니다:

각 엔트리는 CDN의 `<release-tag>/<entry>`에서 서빙됩니다(예: `/<release-tag>/module.js`).

| 엔트리 | 사용 사례 |
|-------|----------|
| `module.js` | **compat** 모드의 전체 앱 — 표준 내비게이션 사이드바 + 페이지 영역 + 우측 채팅 패널 셸. `window.initWippyApp()`으로 페이지에 직접 마운트되며, 페이지 전체와 브라우저 히스토리를 인수합니다. 현재 `wippy/facade`가 기본으로 서빙하는 엔트리입니다. |
| `managed-layout.js` | **managed** 모드의 전체 앱 — 선언적 다중 패널 레이아웃. `fe_mode = managed`일 때 파사드가 서빙합니다. 얼리 액세스([다중 패널 레이아웃](./multi-panel-layout.md) 참조). |
| `iframe.html` | 격리나 부분 페이지 임베딩을 위해 **iframe 안에서** 실행되는 전체 앱. `SetConfig` PostMessage 핸드셰이크로 설정을 제공하는 수동, 파사드 없는 임베딩에 사용하세요. 파사드 자체는 이것이 아니라 위의 JS 모듈 엔트리를 로드합니다. |
| `chat-iframe.html` | 사이드바나 페이지가 없는 최소 채팅 인터페이스. 집중된 채팅 위젯을 임베드할 때 유용합니다. |
| `chat.js` | 채팅 스토어와 WebSocket 클라이언트를 노출하는 헤드리스 ESM 모듈. 완전히 커스텀한 UI를 만들 때 사용하세요. |
| `ws.js` | Vue나 Pinia 의존성이 없는 독립 WebSocket 서비스. 저수준 실시간 통합에 사용하세요. |

표준 `wippy/facade` 기반 배포에서는 이 경로들을 직접 참조할 일이 없습니다. 파사드가 설정에서 `fe_facade_url`을 읽고, `fe_mode`에 맞는 JS 모듈 엔트리(compat은 `module.js`, managed는 `managed-layout.js`)를 선택하여 올바른 URL을 자동으로 구성합니다.

## CDN 버전 관리

웹 호스트는 git 태그로 버전 관리됩니다. 정식 프로덕션 URL 패턴은 다음과 같습니다:

```
https://web-host.wippy.ai/<release-tag>/
```

여기서 `<release-tag>`는 웹 호스트의 git 릴리스 태그이며, 안정 릴리스이거나 기능 브랜치 프리뷰 배포입니다. 스테이징 CDN은 `https://web-host.staging.wippy.ai/<release-tag>/`에 있습니다.

보통은 버전을 전혀 설정하지 않습니다. `wippy/facade` 모듈은 대응하는 웹 호스트 빌드를 가리키는 기본 `fe_facade_url`을 제공하므로, **웹 호스트 버전은 파사드 모듈과 함께 움직입니다** — `wippy/facade`를 업데이트하는 것이 더 새로운 웹 호스트로 옮겨가는 방법입니다. 임포트 맵을 통해 벤더 라이브러리를 공유하는 자식 앱들은 그 빌드가 제공하는 버전을 정확히 받습니다.

특정 웹 호스트 버전을 고정하려면 — 검증된 빌드에 머무르거나 기능 브랜치 / 얼리 액세스 태그를 선택하려면 — `fe_facade_url` 파라미터를 오버라이드하세요:

```yaml
- name: fe_facade_url
  value: https://web-host.wippy.ai/<release-tag>
```

이는 배포 전체를 그 빌드에 고정합니다. 대신 런타임에 설정하는 `-o` / `--override` 문법은 [CLI 오버라이드](../../guides/cli.md)를 참고하세요.

## 기술 스택

웹 호스트는 Vue 3(Composition API), UI 컴포넌트를 위한 PrimeVue + Tailwind CSS 3, 상태 관리를 위한 Pinia, 내비게이션을 위한 Vue Router, HTTP를 위한 Axios로 만들어졌습니다. 개발 중에는 `<fe_facade_url>/import-map.json`을 가져와, 현재 산출물이 그 키를 임포트하지 않더라도 `imports` 객체의 모든 키를 Rollup 외부 모듈에 넣으세요. 정확한 스펙파이어가 없을 때에만 임포트한 의존성을 번들에 포함하세요. 웹 호스트 태그가 바뀌거나 새 의존성이 추가되면 다시 가져오세요.

## 함께 보기

- [파사드 엔트리 포인트](./entry-point.md) — 파사드가 웹 호스트를 사용자에게 전달하는 방식과 설정 흐름
- [부트스트랩 시퀀스](./bootstrap.md) — 웹 호스트가 설정을 받은 뒤 내부에서 벌어지는 일
- [다중 패널 레이아웃](./multi-panel-layout.md) — 커스텀 다중 패널 셸을 위한 managed 레이아웃 모드
- [패키지](./packages.md) — 자식 앱 개발자가 사용할 수 있는 `@wippy-fe/*` npm 패키지
- [파사드 모듈](../../framework/facade.md) — `wippy/facade` 백엔드 설정
- [렌더 엔진](./render-engines.md) — 두 가지 페이지 렌더 엔진(srcdoc iframe vs Web Fragment)
