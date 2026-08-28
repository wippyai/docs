---
title: "프런트엔드 계약: 시작하기"
description: "이식 가능한 Wippy 페이지와 웹 컴포넌트, 빌드, 라우팅, 테마 통합을 위한 출발점입니다."
---

# 프런트엔드 계약: 시작하기

이 페이지는 방향 안내와 탐색을 위한 참조 문서입니다. 프런트엔드 모듈이 따라야 할 계약을 설명하며, 빌드 튜토리얼이나 완전한 애플리케이션 예제는 아닙니다.

Wippy 프런트엔드 모듈은 기본적으로 이식 가능해야 합니다. 다른 규격 준수 Wippy 프로젝트로 가져갔을 때, 그 프로젝트의 facade가 다른 PrimeVue 호환 테마를 제공하고 프로젝트 전용 CSS를 전혀 제공하지 않더라도 모듈은 계속 동작해야 합니다.

## 올바른 경로 선택

1. 구성된 페이지 엔진, 즉 레거시 `about:srcdoc` iframe 또는 Web Fragment에서 렌더링되는 애플리케이션에는 `view.page`를 사용합니다.
2. 호스트 문서에서 렌더링되며 일반적으로 shadow root를 사용하는 사용자 정의 요소에는 `view.component`를 사용합니다.
3. UI가 버튼, 입력, 폼 필드, 메뉴, 오버레이 또는 PrimeVue와 유사한 다른 컨트롤을 렌더링한다면, PrimeVue가 필요한 의미와 어포던스를 제공하지 못하는 경우가 아니라면 PrimeVue를 사용합니다.
4. 컨트롤이 전혀 없는 Chart.js 시각화처럼 콘텐츠만 있는 컴포넌트는 PrimeVue와 Tailwind를 생략할 수 있습니다.
5. 사용자 정의 컨트롤이 필요하다면 [이식 가능한 UI 계약](./portable-ui-contract.md)과 [사용자 정의 복합 컨트롤](./micro-frontends/custom-composites.md)을 따릅니다.

PrimeVue는 공유 컴포넌트 어휘입니다. Wippy Tailwind 프리셋은 지원되는 빌드 시점 어휘입니다. 문서에 런타임 기반이라고 명시된 유틸리티만 컴파일 후 facade 테마 변경에 반응합니다.

## 소유권 지도

```text
module source
  -> build command
  -> emitted artifact
  -> registry owner
  -> served URL
  -> Web Host
  -> page surface (srcdoc iframe or Web Fragment) or component shadow root
  -> AppConfig / router / theme delivery
```

한 단계로부터 다음 단계를 추론하지 마십시오. 누락된 자산을 디버깅하기 전에 소스 패키지, 빌드 대상, 출력 파일, 레지스트리 엔트리, 파일시스템 마운트, 제공 URL을 각각 확인합니다.

## 계약 문서

- [플랫폼 토폴로지](./platform-topology.md): 런타임 경계, 라우팅, CSS 전달, 오버레이, 소유권.
- [이식 가능한 UI 계약](./portable-ui-contract.md): 컴포넌트와 스타일링에 대한 규범적 규칙.
- [테마 작성](./micro-frontends/theming.md): facade `custom_css`, PrimeVue 테마 CSS 또는 모듈에 무엇을 배치할지.
- [Tailwind 계약](./micro-frontends/tailwind-contract.md): 런타임 기반 유틸리티와 컴파일된 상수의 차이.
- [토큰 카탈로그](./micro-frontends/token-catalogue.md): 생성된 토큰 참조와 출처.
- [디자인 계층](./design-layer.md): 여러 자체 모듈이 공통으로 필요하지만 테마 컴포넌트가 제공하지 않는 항목의 위치.
- [페이지 레시피](./micro-frontends/micro-frontend-app.md)와 [웹 컴포넌트 레시피](./micro-frontends/web-component.md).
- [빌드 및 의존성 계약](./micro-frontends/build-system.md).
- [구성 및 대소문자](./micro-frontends/configuration-casing.md).
- [규격 준수 규칙 색인](./micro-frontends/compliance-checklist.md).

## 타협할 수 없는 검사

- PrimeVue prop, 컴포넌트 API, CSS 변수 또는 Tailwind 시맨틱 유틸리티를 만들어 내지 마십시오. 선택한 패키지 소스와 생성된 카탈로그에서 확인합니다.
- 유추로 `--p-*` 토큰 이름을 만들지 마십시오.
- 이식 가능한 모듈이 임의의 facade 클래스에 의존하게 하지 마십시오.
- 브라우저 위치에서 호스트 경로 컨텍스트를 추론하지 마십시오. 페이지는 AppConfig를 통해 호스트 컨텍스트를 받고 `@wippy-fe/router`를 사용합니다.
- 브라우저 검증 전에 실제 제공 출력물을 만드는 정확한 소유 패키지를 다시 빌드합니다.
- 탐색과 의미 있는 상호작용 후 브라우저 콘솔을 확인합니다.

프로젝트 종속 모듈은 이식 가능 계약의 범위 밖입니다. 해당 모듈은 [지원되지 않는 프로젝트 종속 모듈](./micro-frontends/unsupported-project-bound.md) 페이지에서만 문서화되며, 표준 규격 준수 검사는 `UNSUPPORTED`를 반환하고 표준 CI는 실패합니다.
