---
title: "프런트엔드 계약: 여기서 시작"
description: "이식 가능한 Wippy 페이지, 웹 컴포넌트, 빌드, 라우팅, 테마 통합의 진입점."
---

# 프런트엔드 계약: 여기서 시작

Wippy 프런트엔드 모듈은 기본적으로 이식 가능합니다. 모듈은 다른 규격 준수 PrimeVue 테마를 제공하고 프로젝트 전용 CSS는 제공하지 않는 facade를 가진 다른 Wippy 프로젝트로 가져가더라도 계속 동작해야 합니다.

## 올바른 경로 선택

1. `about:srcdoc` iframe에서 렌더링되는 애플리케이션에는 `view.page`를 사용하세요.
2. 호스트 문서에서 렌더링되는 커스텀 엘리먼트(보통 shadow root 사용)에는 `view.component`를 사용하세요.
3. UI가 버튼, 입력, 폼 필드, 메뉴, 오버레이 또는 그 밖의 PrimeVue 유사 컨트롤을 렌더링한다면, 필요한 시맨틱과 어포던스를 PrimeVue가 제공할 수 없는 경우가 아닌 한 PrimeVue를 사용하세요.
4. 컨트롤이 없는 Chart.js 시각화처럼 콘텐츠만 있는 컴포넌트는 PrimeVue와 Tailwind를 생략할 수 있습니다.
5. 커스텀 컨트롤이 필요하다면 [이식 가능 UI 계약](./portable-ui-contract.md)과 [커스텀 컴포지트](./micro-frontends/custom-composites.md)를 따르세요.

PrimeVue는 공유 컴포넌트 어휘입니다. Wippy Tailwind preset은 지원되는 빌드 타임 어휘입니다. 컴파일 이후에도 facade의 테마 변경에 반응하는 것은 런타임 기반으로 문서화된 유틸리티뿐입니다.

## 소유권 맵

```text
module source
  -> build command
  -> emitted artifact
  -> registry owner
  -> served URL
  -> Web Host
  -> page srcdoc iframe or component shadow root
  -> AppConfig / router / theme delivery
```

한 단계에서 다른 단계를 추론하지 마세요. 누락된 애셋을 디버깅하기 전에 소스 패키지, 빌드 타깃, 방출된 파일, registry 엔트리, 파일 시스템 마운트, 서빙되는 URL을 각각 확인하세요.

## 계약 문서

- [플랫폼 토폴로지](./platform-topology.md): 런타임 경계, 라우팅, CSS 전달, 오버레이, 소유권.
- [이식 가능 UI 계약](./portable-ui-contract.md): 규범적인 컴포넌트 및 스타일링 규칙.
- [테마 작성](./micro-frontends/theming.md): facade `custom_css`, PrimeVue 테마 CSS, 모듈 중 어디에 무엇이 속하는지.
- [Tailwind 계약](./micro-frontends/tailwind-contract.md): 런타임 기반 유틸리티 대 컴파일된 상수.
- [토큰 카탈로그](./micro-frontends/token-catalogue.md): 생성된 토큰 레퍼런스와 출처.
- [디자인 레이어](./design-layer.md): 자신의 여러 모듈이 무언가를 필요로 하는데 테마에 해당 컴포넌트가 없을 때 그것이 어디에 속하는지.
- [페이지 레시피](./micro-frontends/micro-frontend-app.md)와 [웹 컴포넌트 레시피](./micro-frontends/web-component.md).
- [빌드 및 의존성 계약](./micro-frontends/build-system.md).
- [구성과 케이싱](./micro-frontends/configuration-casing.md).
- [컴플라이언스 규칙 색인](./micro-frontends/compliance-checklist.md).

## 타협 불가 검사 항목

- PrimeVue prop, 컴포넌트 API, CSS 변수, Tailwind 시맨틱 유틸리티를 임의로 만들어내지 마세요. 선택된 패키지 소스와 생성된 카탈로그에서 확인하세요.
- `--p-*` 토큰 이름을 유추로 구성하지 마세요.
- 이식 가능 모듈에서 임의의 facade 클래스를 요구하지 마세요.
- 브라우저 location에서 호스트 라우트 컨텍스트를 추론하지 마세요. 페이지는 AppConfig를 통해 호스트 컨텍스트를 받고 `@wippy-fe/router`를 사용합니다.
- 브라우저 검증 전에 정확히 그 소유 패키지를 서빙되는 출력으로 다시 빌드하세요.
- 내비게이션과 주요 상호작용 이후 브라우저 콘솔을 확인하세요.

프로젝트에 종속된 모듈은 이식 계약 밖에 있습니다. 이들은 [지원되지 않는 프로젝트 종속 모듈](./micro-frontends/unsupported-project-bound.md) 문서에만 기술되어 있으며, 표준 컴플라이언스는 `UNSUPPORTED`를 반환하고 표준 CI는 실패합니다.
