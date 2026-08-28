---
title: "Wippy 마이크로 프런트엔드"
description: "마이크로 프런트엔드 앱과 웹 컴포넌트 중 하나를 선택하고 관련 빌드, 라우팅, 프록시, 테마 가이드를 따라갑니다."
---

# Wippy 마이크로 프런트엔드

**분류: 개념 및 선택 가이드.** 이 페이지는 두 아티팩트 유형을 비교하고 빌드 및 API 레퍼런스로 안내합니다. 독립 실행형 프로젝트 튜토리얼은 아닙니다.

Wippy 프런트엔드 코드는 Web Host의 격리 경계 안에서 실행됩니다. 빌드할 수 있는 아티팩트는 **마이크로 프런트엔드 앱**과 **웹 컴포넌트** 두 가지입니다. 둘 다 독립적인 Vite 프로젝트이며 `@wippy-fe/proxy`를 통해 플랫폼과 통신하고, 백엔드의 `_index.yaml` 레지스트리 항목에 선언됩니다. 렌더링 방식과 사용 위치는 서로 다릅니다.

## 마이크로 프런트엔드 앱과 웹 컴포넌트 비교

| | 마이크로 프런트엔드 앱 (`view.page`) | 웹 컴포넌트 (`view.component`) |
|---|---|---|
| **렌더링 방식** | 페이지 표면: srcdoc iframe 또는 Web Fragment | 페이지 안의 Shadow DOM에 있는 커스텀 엘리먼트 |
| **자체 URL/내비게이션 항목** | 있음 — 백엔드 `mountRoute`를 점유 | 없음 — 다른 페이지나 채팅 아티팩트 안에 삽입 |
| **내부 라우팅** | 있음 — 메모리 히스토리를 사용하는 `vue-router` | 없음 — 라우터 없는 단일 컴포넌트 |
| **할당된 표면 제어** | 있음 — 표면은 브라우저 뷰포트가 아니라 패널 하나일 수 있음 | 없음 — 주변 레이아웃이 크기를 결정 |
| **페이지 간 재사용** | 없음 — 하나의 URL, 하나의 위치 | 있음 — 어느 페이지에서든 태그를 삽입 가능 |
| **타입이 지정된 props 수신** | 없음 — `AppConfig`를 읽음 | 있음 — 스키마에 선언된 HTML 속성 |
| **타입이 지정된 이벤트 발생** | 없음 — 프록시 API로 통신 | 있음 — 스키마에 선언된 `CustomEvent` |
| **CSS 격리** | 엔진에 따라 다름: iframe 경계, 또는 호스트 문서를 공유하는 Web Fragment | Shadow DOM 선택자 경계 |

**간단한 선택 기준:** `vue-router`, 전용 URL, 라우팅된 페이지 표면의 소유권이 필요하면 마이크로 프런트엔드 앱을 사용합니다. 삽입 가능하고 재사용 가능하며 자체 완결적이어야 한다면 웹 컴포넌트를 사용합니다.

## 다음에 읽을 문서

[빠른 시작](./quickstart.md)은 Vue 마이크로 프런트엔드 앱과 Vue 웹 컴포넌트의 최소 종단 간 예제를 제공하며, 공개 [`app`](https://github.com/wippyai/app) 저장소로 연결됩니다.

마이크로 프런트엔드 앱 만들기:

1. [마이크로 프런트엔드 앱](./micro-frontend-app.md) — 스캐폴딩, `package.json`의 wippy 블록, Vite 설정, 부트스트랩 순서, 라우터 동기화
2. [빌드 시스템](./build-system.md) — `@wippy-fe/vite-plugin`, `wippy-meta.json`, externals
3. [프록시 API](./proxy-api.md) — 호스트와 통신하기 위한 `@wippy-fe/proxy` 레퍼런스
4. [테마 작성](./theming.md) → [테마: 마이크로 프런트엔드 앱](./micro-frontend-app-theming.md) — CSS 변수 카탈로그와 프록시 주입을 통한 수신 방법

웹 컴포넌트 만들기:

1. [웹 컴포넌트](./web-component.md) — 스캐폴딩, `WippyVueElement`, props, 이벤트, Shadow DOM CSS
2. [빌드 시스템](./build-system.md) — 같은 Vite 도구 체인, 다른 플러그인과 출력 형식
3. [프록시 API](./proxy-api.md) — `@wippy-fe/proxy`에서 직접 가져오는 동일한 API
4. [테마 작성](./theming.md) → [테마: 웹 컴포넌트](./web-component-theming.md) — CSS 변수 카탈로그와 Shadow DOM 경계를 넘어 전달받는 방법

공통 문서:

- [호스트 없이 실행](./host-less-mode.md) — 전체 Web Host를 실행하지 않고 개발하고 테스트하기
- [컴플라이언스 규칙 인덱스](./compliance-checklist.md) — 정식 규칙 소유 문서와 결정론적 게이트
- [디버깅](./debugging.md) — 가장 흔한 실패 상황을 증상별로 찾는 가이드

## 사전 요구 사항

- `wippy/views`를 의존성으로 선언한 Wippy 백엔드 모듈([Views](../../framework/views.md) 참조)
- Web Host 진입점용 `wippy/facade`([Facade 진입점](../web-host/entry-point.md) 참조)
- 이 문서 기준으로 Node.js 22.12 이상 및 Vite 7. Host 소스 패키지는 Node 22 이상을 선언하고 Vite 7을 사용하며, Vite 7 자체는 Node 20.19 이상 또는 22.12 이상을 요구합니다. `@wippy-fe/vite-plugin` 0.0.56은 Vite 5와 6도 허용하지만, 해당 버전을 선택한 소비자는 그 Vite 릴리스의 Node 요구 사항을 따라야 합니다.
