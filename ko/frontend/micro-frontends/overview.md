---
title: "Wippy 마이크로 프론트엔드"
description: "Wippy 프론트엔드 코드는 웹 호스트의 격리 경계 안에서 실행됩니다. 빌드할 수 있는 산출물은 두 종류입니다: 마이크로 프론트엔드 앱과 웹…"
---

# Wippy 마이크로 프론트엔드

Wippy 프론트엔드 코드는 웹 호스트의 격리 경계 안에서 실행됩니다. 빌드할 수 있는 산출물은 두 종류입니다: **마이크로 프론트엔드 앱**과 **웹 컴포넌트**. 둘 다 독립적인 Vite 프로젝트이고, 둘 다 `@wippy-fe/proxy`를 통해 플랫폼과 통신하며, 둘 다 `_index.yaml` 레지스트리 엔트리로 백엔드에 선언됩니다. 차이는 렌더링 방식과 적합한 용도입니다.

## 마이크로 프론트엔드 앱 vs 웹 컴포넌트

| | 마이크로 프론트엔드 앱 (`view.page`) | 웹 컴포넌트 (`view.component`) |
|---|---|---|
| **렌더링 형태** | 전체 iframe, 격리된 브라우징 컨텍스트 | 페이지 안 Shadow DOM의 커스텀 엘리먼트 |
| **자체 URL / 내비게이션 항목 보유** | 예 — 백엔드 `mountRoute`를 선언 | 아니요 — 다른 페이지나 채팅 아티팩트 안에 임베드 |
| **내부 라우팅** | 예 — 메모리 히스토리를 쓰는 `vue-router` | 아니요 — 단일 컴포넌트, 라우터 없음 |
| **뷰포트 제어** | 예 | 아니요 — 주변 레이아웃이 크기를 결정 |
| **페이지 간 재사용** | 아니요 — 하나의 URL, 한 곳 | 예 — 어떤 페이지든 태그를 임베드 가능 |
| **타입이 정의된 props 수신** | 아니요 — `AppConfig`를 읽음 | 예 — 스키마로 선언된 HTML 어트리뷰트 |
| **타입이 정의된 이벤트 방출** | 아니요 — 프록시 API로 통신 | 예 — 스키마로 선언된 `CustomEvent` |
| **CSS 격리** | iframe 경계 | Shadow DOM(완전 캡슐화) |

**빠른 판단 기준:** `vue-router`나 전용 URL이 필요하거나 뷰포트 전체를 소유한다면 마이크로 프론트엔드 앱입니다. 임베드 가능하고, 재사용 가능하며, 자기 완결적이라면 웹 컴포넌트입니다.

확신이 서지 않으면 웹 컴포넌트로 시작하세요. 나중에 마이크로 프론트엔드 앱으로 승격하는 편이 그 반대보다 쉽습니다.

## 다음에 읽을 것

시간이 급하다면? [퀵스타트](./quickstart.md)에 Vue 마이크로 프론트엔드 앱과 Vue 웹 컴포넌트 양쪽의 최소 엔드투엔드 예제가 공개 [`app`](https://github.com/wippyai/app) 저장소 링크와 함께 있습니다.

마이크로 프론트엔드 앱 만들기:
1. [마이크로 프론트엔드 앱](./micro-frontend-app.md) — 스캐폴드, `package.json`의 wippy 블록, Vite 설정, 부트스트랩 시퀀스, 라우터 동기화
2. [빌드 시스템](./build-system.md) — `@wippy-fe/vite-plugin`, `wippy-meta.json`, 외부 모듈
3. [프록시 API](./proxy-api.md) — 호스트와 통신하기 위한 `@wippy-fe/proxy` 레퍼런스
4. [테마 적용](./theming.md) → [테마 적용: 마이크로 프론트엔드 앱](./micro-frontend-app-theming.md) — CSS 변수 카탈로그, 그리고 프록시 주입으로 이를 받는 방법

웹 컴포넌트 만들기:
1. [웹 컴포넌트](./web-component.md) — 스캐폴드, `WippyVueElement`, props, 이벤트, 섀도우 DOM CSS
2. [빌드 시스템](./build-system.md) — 동일한 Vite 툴체인, 다른 플러그인과 출력 포맷
3. [프록시 API](./proxy-api.md) — 동일한 API를 `@wippy-fe/proxy`에서 직접 임포트
4. [테마 적용](./theming.md) → [테마 적용: 웹 컴포넌트](./web-component-theming.md) — CSS 변수 카탈로그, 그리고 섀도우 DOM 경계 너머로 이를 받는 방법

공통:
- [호스트리스 모드](./host-less-mode.md) — 전체 웹 호스트를 실행하지 않고 개발·테스트하기
- [준수 규칙 색인](./compliance-checklist.md) — 정식 규칙 소유자와 결정적 게이트
- [디버깅](./debugging.md) — 가장 흔한 실패 시나리오를 증상부터 짚어가는 가이드

## 사전 요구 사항

- `wippy/views`를 의존성으로 선언한 Wippy 백엔드 모듈([Views](../../framework/views.md) 참조)
- 웹 호스트 엔트리 포인트를 위한 `wippy/facade`([파사드 엔트리 포인트](../web-host/entry-point.md) 참조)
- 선택한 웹 호스트 소스가 선언한 대로 Node.js 22 이상과 Vite 7.
  대상 릴리스가 바뀌면 해당 패키지를 다시 확인하세요
