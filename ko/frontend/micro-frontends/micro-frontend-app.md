---
title: "페이지 레시피"
description: "지원되는 라우팅, 테마 전달, 의존성, 빌드 소유권을 갖춘 이식 가능한 view.page 레시피입니다."
---

# 페이지 레시피

페이지는 Vite로 빌드된 애플리케이션이며 레거시 `about:srcdoc` iframe 엔진 또는 Web Fragment 엔진을 통해 렌더링됩니다. 라우트와 호스트 컨텍스트는 브라우저 위치가 아니라 Wippy AppConfig와 패키지에서 가져옵니다.

이 문서는 기존 Vue/Vite 프로젝트를 위한 통합 레시피입니다. Wippy 전용 진입 코드와 배포 계약을 설명하며, 독립 실행형 프로젝트 스캐폴드나 백엔드 설정을 제공하지는 않습니다.

## 필수 설정

1. `view.page`와 이를 제공하는 파일 시스템/라우터 항목을 등록합니다.
2. 필요한 CSS 전달을 활성화합니다. iframe 엔진이 선택될 수 있다면 기본 스크롤바 일관성을 위해 `iframe` CSS 블록을 활성 상태로 유지합니다.
3. Vue 라우팅에는 `@wippy-fe/router`를 사용합니다.
4. 페이지에서 PrimeVue 계열 컨트롤을 하나라도 렌더링한다면 PrimeVue와 Wippy PrimeVue 플러그인을 설치합니다.
5. 페이지에서 Tailwind 유틸리티를 작성한다면 공유 Wippy Tailwind 프리셋을 사용합니다.
6. 고정된 Web Host import-map 스냅샷에서 externals를 생성합니다.
7. 애플리케이션을 `#app`에 마운트합니다. 콘텐츠 크기를 따르는 Web Fragment는 정확히 이 루트 ID를 요구합니다.
8. 배포에서 선택한 출력 디렉터리로 빌드합니다.

```ts
import { createApp } from 'vue'
import PrimeVue from '@wippy-fe/theme/primevue-plugin'
import { createAppRouter } from '@wippy-fe/router'
import { config } from '@wippy-fe/proxy'
import App from './App.vue'
import { routes } from './routes'

const app = createApp(App)
app.use(PrimeVue)
app.use(createAppRouter(routes, {
  initialPath: config.context?.route ?? '/',
}))
app.mount('#app')
```

선택한 패키지 버전에서 정확한 내보내기 시그니처를 확인하세요. 로컬 라우터 동기화 계층을 만들지 마세요.

## 테마 주입

페이지는 선택된 페이지 실행 영역에 전달된 facade 테마를 사용합니다. 공개 PrimeVue 컴포넌트, 공개 테마 변수, 문서화된 런타임 기반 Tailwind 유틸리티, 명시적으로 불변인 컴파일 시점 유틸리티를 사용하세요.

호스트 쿼리 매개변수를 애플리케이션 픽스처로 사용하지 마세요. 호스트 컨텍스트는 AppConfig가 소유합니다.

## 빌드

Wippy 모듈 저장소의 Make 대상을 호출합니다. 해당 레시피는 배포 출력에 다음 명령을 적용합니다.

```text
npm run build -- --outDir <target> --emptyOutDir
```

`vite.config.ts`는 상대 자산 동작을 유지하며 배포 `outDir`을 하드코딩하지 않습니다.

하위 패키지 관리자나 Vite 빌드 명령을 직접 호출하지 마세요. Windows에서는 `make.bat`를 호출합니다. 이 파일은 대상의 `make.ps1` 구현에 위임합니다.

[빌드 및 의존성 계약](./build-system.md), [플랫폼 토폴로지](../platform-topology.md), [설정과 대소문자 표기](./configuration-casing.md)를 참조하세요.
