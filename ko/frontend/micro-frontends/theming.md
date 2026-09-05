---
title: "테마 작성"
description: "파사드가 PrimeVue 테마를 작성하는 방식과 모듈이 이식성을 유지하는 방법입니다."
---

# 테마 작성

파사드가 PrimeVue 테마를 작성합니다. 모듈은 그 테마를 소비할 뿐, 병렬적인 소형 디자인 시스템을 만들지 않습니다.

Wippy는 현재 PrimeVue를 `theme: 'none'`으로 실행합니다. 컴포넌트 외형은 Wippy가 Tailwind로 작성한 PrimeVue CSS, 공개 런타임 변수, 파사드 커스터마이제이션으로 제공됩니다.

## 스타일이 속하는 위치

| 스타일 관심사 | 소유자 |
|---|---|
| 제품 전반에서 공유되는 PrimeVue 컴포넌트 외형 | `custom_css`의 파사드 PrimeVue 테마와 공개 테마 변수 |
| 호스트 셸 크롬 전용 | `.wippy-host-app`으로 스코프된 파사드 CSS |
| 호스트와 자식 root 모두를 대상으로 하는 공유 `.p-*` 규칙 | 전역 파사드 `custom_css`. 호스트 스코프 불필요 |
| 페이지 전용 테마 오버라이드 | 지원되는 프런트엔드 표기를 사용하는 페이지 설정 |
| 도메인 레이아웃 또는 새로운 구조 | 모듈 CSS 또는 Tailwind |
| 반드시 필요한 비 PrimeVue 커스텀 부분 | 공개 토큰과 문서화된 불변 유틸리티를 재사용하는 모듈 CSS |
| 여러 자체 모듈이 필요로 하는 동일한 비 PrimeVue 부분 | 공유 패키지 — [디자인 레이어](../design-layer.md) 참고 |
| 하나의 파사드에서만 기대되는 임의 클래스 | 이식 불가능. FE-STYLE-001로 금지됨 |

전역 `.p-drawer-content` 규칙은 호스트와 자식 root의 모든 Drawer를 대상으로 의도한 경우 유효한 테마 구현입니다. `.wippy-host-app .p-drawer-content`는 그 규칙이 호스트 전용일 때만 적절합니다.

중복된 모듈 CSS를 파사드 CSS로 옮긴다고 해서 의존성이 사라지지는 않습니다. 셀렉터가 공유 PrimeVue 테마 어휘의 일부가 아니라면, 이는 파사드 전용 계약을 만듭니다. 자체 모듈들끼리는 공유하지만 테마에는 없는 어휘가 있어야 할 곳은 게시된 패키지입니다. [디자인 레이어](../design-layer.md)를 참고하십시오.

## 시맨틱 동등성

시맨틱적으로 동등한 컨트롤은 동등하게 보여야 합니다. PrimeVue 컴포넌트를 직접 사용하는 것이 우선입니다. 진짜로 커스텀 컨트롤이 필요하다면, 그 컨트롤의 PrimeVue 시각적 형제를 식별하고 색상, 테두리, 포커스, 상태, theme-variable로 분류된 모든 지오메트리에 동일한 공개 런타임 속성을 사용하십시오.

커스텀 부분은 형제가 제공하지 않는 새로운 구조만 소유할 수 있습니다. 문서화된 테마 패딩, 치수, 타이포그래피, 반경, 그림자, 포커스, 모션 계약이 존재하는 곳에서는 이를 재사용하십시오. 생성된 컴포넌트 CSS에서 현재 리터럴 값을 복사해 놓고 상속이라고 부르지 마십시오.

## 런타임 속성과 불변 속성

각 공유 외형 속성에는 하나의 정책이 있습니다:

- `theme-variable`: 문서화된 공개 런타임 변수를 통해 해석되어야 합니다.
- `platform-invariant`: 공유된 컴파일 결과 Tailwind 값이 모든 준수 테마에서 의도적으로 안정적입니다.

이론적인 유연성을 위해 런타임 토큰을 추가하지 마십시오. 실효 계약 원장이 실제 런타임 공백, 정확한 지원 경로, 실제 소비자, 변경 증거를 입증한 뒤에만 토큰을 추가하거나 채택하십시오.

## CSS 전송은 권한이 아니다

페이지는 iframe에서 스타일을 전달받습니다. 웹 컴포넌트는 shadow root 내부에서 스타일을 전달받을 수 있습니다. 이는 CSS가 어디에서 효력을 갖는지를 설명할 뿐이며, 모듈이 임의의 파사드 셀렉터에 의존하도록 허가하지 않습니다.

## 런타임 모드 전환

공개 테마 모드 계약은 AppConfig와 `@wippy-fe/proxy`입니다:

```typescript
import { host, on } from '@wippy-fe/proxy'

async function setThemeMode(mode: 'auto' | 'light' | 'dark') {
  await new Promise<void>((resolve, reject) => {
    const stop = on('@theme', (appliedMode) => {
      if (appliedMode !== mode) return
      stop()
      const currentMode = host.getThemeMode()
      if (currentMode !== mode) {
        reject(new Error(`Theme propagation mismatch: ${currentMode}`))
        return
      }
      resolve()
    })
    host.setThemeMode(mode)
  })
}

await setThemeMode('dark')
```

`auto`, `light`, `dark`만 사용하십시오. 호스트가 애플리케이션 전파와 재귀적인
자식 전파를 소유하고, 파사드/임베더가 영속화를 소유합니다.
`w-theme-dark` / `w-theme-light`를 직접 편집하거나, 내부 테마 헬퍼를 호출하거나,
AppConfig 전역 값을 쓰거나, 호스트 메시지를 보내는 것은 이 계약을 우회하며
규격 위반입니다. 시각적 증거는 공개 API가 전파된 모드를 보고한 뒤에만
유효합니다.

[Tailwind 계약](./tailwind-contract.md), [토큰 카탈로그](./token-catalogue.md), [이식 가능한 UI 계약](../portable-ui-contract.md)을 참고하십시오.
