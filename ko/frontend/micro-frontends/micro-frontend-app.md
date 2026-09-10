---
title: "페이지 레시피"
description: "지원되는 라우팅, 테마 전달, 의존성, 빌드 소유권을 갖춘 이식 가능한 view.page 레시피입니다."
---

# 페이지 레시피

페이지는 `about:srcdoc` iframe에서 렌더링되는 Vite 빌드 애플리케이션입니다. 라우트와 호스트 컨텍스트는 브라우저 location이 아니라 Wippy AppConfig와 패키지에서 옵니다.

## 필수 설정

1. `view.page`와 이를 서빙하는 파일시스템/라우터 엔트리를 등록합니다.
2. 필요한 CSS 전달을 활성화합니다. 기본 스크롤바 일관성을 위해 `iframe` CSS 블록은 활성 상태로 유지합니다.
3. Vue 라우팅에는 `@wippy-fe/router`를 사용합니다.
4. 페이지가 PrimeVue와 유사한 컨트롤을 렌더링한다면 PrimeVue와 Wippy PrimeVue 플러그인을 설치합니다.
5. 페이지가 Tailwind 유틸리티를 작성한다면 공유 Wippy Tailwind 프리셋을 사용합니다.
6. 고정된 Web Host import-map 스냅샷에서 externals를 생성합니다.
7. 배포에서 선택한 출력 디렉터리로 빌드합니다.

```ts
import { createApp } from 'vue'
import PrimeVue from '@wippy-fe/theme/primevue-plugin'
import { createAppRouter } from '@wippy-fe/router'
import App from './App.vue'
import { routes } from './routes'

const app = createApp(App)
app.use(PrimeVue)
app.use(createAppRouter(routes))
app.mount('#app')
```

정확한 export 시그니처는 선택한 패키지 버전에 대해 확인하십시오. 로컬 라우터 동기화 레이어를 만들지 마십시오.

## 테마 주입

페이지는 자신의 iframe으로 전달된 파사드 테마를 사용합니다. 공개 PrimeVue 컴포넌트, 공개 테마 변수, 문서화된 런타임 기반 Tailwind 유틸리티, 명시적으로 불변인 컴파일 타임 유틸리티를 사용하십시오.

호스트 쿼리 파라미터를 애플리케이션 픽스처로 사용하지 마십시오. 호스트 컨텍스트는 AppConfig가 소유합니다.

## 빌드

Wippy 모듈 저장소의 Make 타깃을 호출하십시오. 그 레시피가 배포
출력물을 다음과 같이 제공합니다:

```text
npm run build -- --outDir <target> --emptyOutDir
```

`vite.config.ts`는 상대 에셋 동작을 유지하며 배포 `outDir`를 하드코딩하지 않습니다.

하위 패키지 매니저나 Vite 빌드 명령을 직접 호출하지 마십시오.
Windows에서는 `make.bat`를 호출하십시오. 이는 타깃의 `make.ps1`
구현에 위임합니다.

[빌드 및 의존성 계약](./build-system.md), [플랫폼 토폴로지](../platform-topology.md), [설정과 표기 규칙](./configuration-casing.md)을 참고하십시오.
