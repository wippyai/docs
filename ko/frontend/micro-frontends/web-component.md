---
title: "웹 컴포넌트 레시피"
description: "콘텐츠 전용 및 컨트롤 포함 커스텀 엘리먼트를 위한 이식 가능한 view.component 레시피."
---

# 웹 컴포넌트 레시피

웹 컴포넌트는 `view.component`로 등록되며 보통 섀도우 루트에 렌더링됩니다. 유효한 설정 중 가장 작은 것을 고르세요.

## 변형 A: 콘텐츠 전용

차트, 다이어그램, 렌더러, 시각화는 컨트롤을 렌더링하지 않고 공유 Tailwind 유틸리티를 작성하지 않는다면 PrimeVue와 Tailwind를 생략할 수 있습니다.

그래도 다음은 지켜야 합니다:

- 유효한 커스텀 엘리먼트 태그를 배포한다.
- 렌더링되는 콘텐츠의 접근성을 유지한다.
- 지원되는 Wippy 설정과 CSS 전달 방식을 사용한다.
- 프로젝트 전용 파사드 클래스를 피한다.
- Wippy 모듈 저장소의 정식 Make 타깃으로 빌드한다.

나중에 버튼, 입력, 폼, 메뉴 또는 다른 PrimeVue류 컨트롤이 추가되면 이 면제는 종료됩니다.

## 변형 B: 컨트롤 포함

컨트롤이 있는 컴포넌트는 Wippy PrimeVue 플러그인을 통해 PrimeVue를 설치하고
필요한 CSS 전달 키를 설정해야 합니다. 다음 엔트리는 현재 패키지가 지원하는 Vue
경로입니다:

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

패키지 메타데이터는 동일한 커스텀 엘리먼트를 식별해야 합니다:

```json
{
  "name": "@example/controls",
  "version": "0.1.0",
  "type": "module",
  "specification": "wippy-component-1.0",
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

컴포넌트 빌드는 엄격 모드의 Wippy 컴포넌트 플러그인과 완전한 핀 고정 대상 호스트
임포트 맵 스냅샷을 사용합니다:

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
    },
  },
})
```

이 컴포넌트가 Tailwind 유틸리티를 작성한다면 공유 Wippy Tailwind 프리셋을
사용하세요. PrimeVue 자체는 모듈이 Tailwind 유틸리티를 임의로 만들 것을 요구하지
않습니다.

## 섀도우 루트 규칙

- 공개 CSS 변수는 섀도우 루트로 상속될 수 있습니다.
- 셀렉터 규칙은 호스트가 그것을 루트로 전달할 때만 적용됩니다.
- 공유 PrimeVue 테마 CSS는 지원되는 의존성입니다.
- 임의의 파사드 클래스는 이식 가능한 API가 아닙니다.
- 오버레이 배치는 실제 런타임에서 검증해야 합니다. 일반적인 배치 레시피를 강요하지 마세요.

## 메타데이터와 빌드

선택된 스키마가 요구하는 대로 props와 이벤트를 패키지 메타데이터와 레지스트리 엔트리 양쪽에 문서화하세요. 모듈 저장소의 Make 타깃을 호출하세요. 그 레시피는 다음을 사용합니다:

```text
npm run build -- --outDir <target> --emptyOutDir
```

이 하위 명령을 직접 호출하지 마세요. Windows에서는 `make.bat`을 호출하며,
이는 `make.ps1`로 위임합니다.

[테마 작성](./theming.md), [Tailwind 계약](./tailwind-contract.md), [빌드 및 의존성 계약](./build-system.md)을 참고하세요.
