---
title: "테마 작성"
description: "facade가 PrimeVue 테마를 작성하고 모듈이 이식성을 유지하는 방법입니다."
---

# 테마 작성

**분류: 테마 소유권 및 런타임 계약 레퍼런스.** 모드 전환 블록은 공개 API 흐름 하나를 보여 줍니다. 실행 중인 Host가 있다고 가정하며, 자체적으로 facade를 설정하거나 모듈을 빌드하지 않습니다.

facade가 PrimeVue 테마를 작성합니다. 모듈은 독립적인 디자인 시스템을 정의하지 않고 이 테마를 사용합니다.

Wippy는 현재 `theme: 'none'`으로 PrimeVue를 실행합니다. 컴포넌트의 외형은 Wippy의 Tailwind 기반 PrimeVue CSS, 공개 런타임 변수, facade 사용자 지정으로 제공됩니다.

## 스타일이 속하는 위치

| 스타일 관심사 | 소유자 |
|---|---|
| 제품 전체에서 공유되는 PrimeVue 컴포넌트 외형 | `custom_css`의 facade PrimeVue 테마와 공개 테마 변수 |
| Host 셸 크롬에만 적용 | `.wippy-host-app`으로 범위를 제한한 facade CSS |
| 호스트와 자식 루트에 모두 적용하려는 공유 `.p-*` 규칙 | 전역 facade `custom_css`, 호스트 범위 불필요 |
| 페이지 전용 테마 재정의 | 지원되는 프런트엔드 표기를 사용하는 페이지 설정 |
| 도메인 레이아웃 또는 새로운 구조 | 모듈 CSS 또는 Tailwind |
| 필요한 비 PrimeVue 커스텀 부분 | 공개 토큰과 문서화된 불변 유틸리티를 재사용하는 모듈 CSS |
| 여러 자체 모듈에 필요한 동일한 비 PrimeVue 부분 | 공유 패키지 — [디자인 계층](../design-layer.md) 참조 |
| 특정 facade에만 있다고 가정한 임의 클래스 | 이식 불가, FE-STYLE-001에서 금지 |

호스트와 자식 루트의 모든 Drawer에 적용하려는 전역 `.p-drawer-content` 규칙은 유효한 테마 구현입니다. `.wippy-host-app .p-drawer-content`는 규칙이 호스트 전용일 때만 적절합니다.

중복된 모듈 CSS를 facade CSS로 옮겨도 의존성이 사라지지는 않습니다. 선택자가 공유 PrimeVue 테마 어휘에 속하지 않으면 비공개 facade 계약이 생깁니다. 테마에는 없지만 자체 모듈들이 공유하는 어휘는 게시된 패키지에 두어야 합니다. [디자인 계층](../design-layer.md)을 참조하세요.

## 의미적 동등성

의미가 같은 컨트롤은 모양도 같아야 합니다. PrimeVue 컴포넌트를 직접 사용하는 방식을 우선하세요. 꼭 필요한 커스텀 컨트롤이라면 시각적으로 대응하는 PrimeVue 컴포넌트를 정하고 색상, 테두리, 포커스, 상태 및 테마 변수로 분류된 기하 속성에 동일한 공개 런타임 속성을 사용합니다.

커스텀 부분은 대응 컴포넌트에 없는 새로운 구조만 소유할 수 있습니다. 문서화된 테마 패딩, 크기, 타이포그래피, 반경, 그림자, 포커스, 모션 계약이 있다면 재사용하세요. 생성된 컴포넌트 CSS에서 복사한 리터럴 값은 이후 테마 변경을 따라가지 않습니다.

## 런타임 속성과 불변 속성

공유 외형 속성에는 다음 정책 중 하나가 적용됩니다.

- `theme-variable`: 문서화된 공개 런타임 변수를 통해 해석되어야 합니다.
- `platform-invariant`: 공유 컴파일 Tailwind 값이 모든 준수 테마에서 의도적으로 고정됩니다.

이론적 유연성만을 위해 런타임 토큰을 추가하지 마세요. 실제 런타임 공백, 정확히 지원되는 경로, 실제 소비자, 변경 증거가 문서화된 경우에만 토큰을 추가하거나 채택합니다.

## CSS 전달은 사용 권한이 아닙니다

페이지 스타일 전달은 선택된 렌더링 엔진을 따릅니다. iframe 페이지는 프록시 주입 파이프라인을 사용하고, Web Fragment 페이지는 fragment gateway의 플랫폼 CSS와 반영된 head의 페이지 재정의를 받습니다. 웹 컴포넌트는 Shadow Root 내부로 스타일을 전달받을 수 있습니다. 이러한 메커니즘은 CSS가 어디에 적용될 수 있는지만 설명하며, 모듈이 임의의 facade 선택자에 의존하도록 허용하지 않습니다.

## 런타임 모드 전환

공개 테마 모드 계약은 AppConfig와 `@wippy-fe/proxy`입니다.

```typescript
import { host, on } from '@wippy-fe/proxy'

async function setThemeMode(mode: 'auto' | 'light' | 'dark') {
  if (host.getThemeMode() === mode) return

  await new Promise<void>((resolve, reject) => {
    let settled = false
    let stop = () => {}
    const finish = (error?: unknown) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      stop()
      if (error) reject(error)
      else resolve()
    }
    const timeout = window.setTimeout(
      () => finish(new Error(`Timed out waiting for theme mode: ${mode}`)),
      5_000,
    )

    stop = on('@theme', (appliedMode) => {
      if (appliedMode !== mode) return
      finish()
    })

    try {
      host.setThemeMode(mode)
    } catch (error) {
      finish(error)
    }
  })
}

await setThemeMode('dark')
```

`auto`, `light`, `dark`만 사용하세요. 호스트가 애플리케이션과 재귀적 자식 전파를 소유하고, facade/임베더가 지속성을 소유합니다. `w-theme-dark`/`w-theme-light`를 직접 편집하거나 내부 테마 헬퍼를 호출하거나 AppConfig 전역을 쓰거나 호스트 메시지를 게시하면 계약을 우회하므로 준수하지 않습니다. 공개 API가 전파된 모드를 보고한 뒤에만 시각적 증거가 유효합니다.

[Tailwind 계약](./tailwind-contract.md), [토큰 카탈로그](./token-catalogue.md), [이식 가능한 UI 계약](../portable-ui-contract.md)을 참조하세요.
