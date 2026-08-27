---
title: "웹 컴포넌트 레시피"
description: "콘텐츠 전용 및 컨트롤 포함 커스텀 엘리먼트를 위한 이식 가능한 view.component 레시피입니다."
---

# 웹 컴포넌트 레시피

웹 컴포넌트는 `view.component`로 등록되며 일반적으로 Shadow Root에서 렌더링됩니다. 유효한 설정 중 가장 작은 것을 선택하세요.

이 문서는 기존 Vue/Vite 프로젝트를 위한 통합 레시피입니다. 독립 실행형 프로젝트 스캐폴드 대신 Wippy 전용 엘리먼트, 메타데이터, 빌드 설정을 보여 줍니다.

## 변형 A: 콘텐츠 전용

차트, 다이어그램, 렌더러, 시각화가 컨트롤을 렌더링하지 않고 공유 Tailwind 유틸리티도 작성하지 않는다면 PrimeVue와 Tailwind를 생략할 수 있습니다.

그래도 다음 요구 사항은 지켜야 합니다.

- 유효한 커스텀 엘리먼트 태그를 게시합니다.
- 렌더링된 콘텐츠의 접근성을 보장합니다.
- 지원되는 Wippy 설정과 CSS 전달 방식을 사용합니다.
- 프로젝트 비공개 facade 클래스를 피합니다.
- Wippy 모듈 저장소의 정식 Make 대상을 통해 빌드합니다.

나중에 버튼, 입력, 폼, 메뉴 또는 다른 PrimeVue 계열 컨트롤을 추가하면 이 면제는 끝납니다.

## 변형 B: 컨트롤 포함

컨트롤이 있는 컴포넌트는 Wippy PrimeVue 플러그인을 통해 PrimeVue를 설치하고 호스트의 테마와 PrimeVue CSS를 받아야 합니다. 웹 컴포넌트 패키지는 기본적으로 모든 호스트 CSS 키를 로드합니다. 아래 명시적 목록은 이 예제가 사용하는 자산과 공유 iframe/스크롤바 CSS로 기본값을 좁힙니다.

```ts
import { defineComponent, h } from 'vue'
import Button from 'primevue/button'
import { PrimeVuePlugin } from '@wippy-fe/theme/primevue-plugin'
import {
  WippyVueElement,
  define,
  type WippyElementConfig,
} from '@wippy-fe/webcomponent-vue'
import pkg from '../package.json'

const Root = defineComponent({
  name: 'ExampleControlsRoot',
  setup() {
    return () => h(Button, { label: 'Save' })
  },
})

class ExampleControlsElement extends WippyVueElement {
  static get wippyConfig(): WippyElementConfig {
    return {
      propsSchema: pkg.wippy.props,
      hostCssKeys: ['themeConfigUrl', 'primeVueCssUrl', 'iframeCssUrl'],
    }
  }

  static get vueConfig() {
    return {
      rootComponent: Root,
      plugins: [PrimeVuePlugin],
    }
  }
}

export async function webComponent() {
  return ExampleControlsElement
}

define(import.meta.url, ExampleControlsElement)
```

### 패키지 메타데이터 계약

패키지 메타데이터는 동일한 커스텀 엘리먼트를 식별해야 합니다.

```json
{
  "name": "@example/controls",
  "version": "0.1.0",
  "type": "module",
  "specification": "wippy-component-1.0",
  "browser": "dist/index.js",
  "wippy": {
    "type": "component",
    "tagName": "example-controls",
    "props": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  }
}
```

유효한 패키지 `wippy.type` 값은 `"component"`와 `"widget"`입니다. 레지스트리 종류인 `view.component`를 패키지 `wippy.type` 값으로 사용하지 마세요.

컴포넌트 빌드는 엄격한 Wippy 컴포넌트 플러그인과 고정된 대상 호스트 import-map 전체 스냅샷을 사용합니다.

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { wippyComponentPlugin } from '@wippy-fe/vite-plugin'
import hostImportMap from './wippy-import-map.json'

export default defineConfig({
  plugins: [vue(), wippyComponentPlugin({ required: true })],
  build: {
    lib: {
      entry: 'src/element.ts',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: Object.keys(hostImportMap.imports),
      preserveEntrySignatures: 'strict',
    },
  },
})
```

`preserveEntrySignatures: 'strict'`를 유지하세요. 다른 Rollup 값은 여기에 문서화된 Wippy 컴포넌트 빌드 계약을 만족하지 않습니다.

이 컴포넌트에서 Tailwind 유틸리티를 작성한다면 공유 Wippy Tailwind 프리셋을 사용합니다. PrimeVue 자체 때문에 모듈이 Tailwind 유틸리티를 임의로 만들 필요는 없습니다.

## Shadow Root 규칙

- 공개 CSS 변수는 Shadow Root로 상속될 수 있습니다.
- 선택자 규칙은 호스트가 루트 안으로 전달한 경우에만 적용됩니다.
- 공유 PrimeVue 테마 CSS는 지원되는 의존성입니다.
- 임의의 facade 클래스는 이식 가능한 API가 아닙니다.
- 오버레이 배치는 실제 런타임에서 검증해야 합니다. 일반적인 배치 레시피를 강제하지 마세요.

## 메타데이터와 빌드

패키지 메타데이터에 props와 이벤트를 문서화합니다. 레지스트리 항목은 배포별 `meta.props` 및 `meta.events` 재정의로 이를 반복할 수 있으며, 재정의가 있으면 번들 메타데이터보다 우선합니다. 모듈 저장소의 Make 대상을 호출합니다. 해당 레시피는 다음 명령을 사용합니다.

```text
npm run build -- --outDir <target> --emptyOutDir
```

하위 명령을 직접 호출하지 마세요. Windows에서는 `make.bat`를 호출합니다. 이 파일은 `make.ps1`에 위임합니다.

[테마 작성](./theming.md), [Tailwind 계약](./tailwind-contract.md), [빌드 및 의존성 계약](./build-system.md)을 참조하세요.
