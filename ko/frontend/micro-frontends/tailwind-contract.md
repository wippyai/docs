---
title: "Tailwind Contract"
description: "유틸리티 이름, 컴파일된 값, 런타임 기반 유틸리티, 그리고 이식 가능한 공개 계약 사이의 차이."
---

# Tailwind Contract

“Tailwind token”은 모호한 표현입니다. 대신 다음 네 가지 용어를 사용하세요.

| 계층 | 예시 | 테마 동작 |
|---|---|---|
| 유틸리티 이름 | `px-3`, `rounded-md`, `bg-primary` | 소스 어휘일 뿐 |
| 컴파일 타임 Tailwind 값 | `px-3`은 고정된 spacing 값을 방출 | 모듈 번들에 임베드됨 |
| 런타임 기반 유틸리티 | `bg-primary`는 공개 `--p-*` 변수에 대한 참조를 방출 | facade의 런타임 테마 변경에 반응 |
| 공개 이식 계약 | 의도적으로 문서화된 Wippy 토큰 또는 시맨틱 유틸리티 | 지원되는 이식 소비자에 대해 안정적 |

Tailwind 3은 런타임이 없는 컴파일러입니다. 유틸리티 이름에서 런타임 동작을 추론하지 말고, 방출된 선언을 확인하세요.

## 런타임 시맨틱 유틸리티

정확한 매핑의 근거는 생성된 유틸리티 카탈로그입니다. 카탈로그는 현재의 primary, surface, severity, text, content, highlight, radius 유틸리티를 방출된 CSS와 공개 변수 의존성에 따라 분류합니다.

의도된 범주의 예로는 시맨틱 색상, 콘텐츠 테두리, 흐린 텍스트, 그리고 생성된 소스가 매핑을 확인해 주는 경우의 `rounded-border`가 있습니다. 항목은 선택된 preset과 패키지 버전에서 생성된 경우에만 여기에 나타납니다.

## 컴파일 타임 기준선

생성된 카탈로그는 상수로 컴파일되는 spacing, sizing, 기본 radius, 폰트 크기, 그림자, 트랜지션 지속 시간, 타이밍 함수를 별도로 기록합니다.

> 빌드 타임 기준선. 이 값은 모듈 번들에 임베드되며 facade의 테마 변경에 반응하지 않습니다.

컴파일 타임 값은 `platform-invariant`로 분류된 속성에 대해 유효합니다. 다른 facade 테마에서 PrimeVue 형제 컴포넌트를 따라가야 하는 속성에는 충분하지 않습니다.

`rounded-md`와 `rounded-border`는 현재 같은 숫자로 해석되더라도 동등한 계약이 아닙니다. 하나는 컴파일된 기본값이고 다른 하나는 런타임 기반입니다. 현재 값이 같다는 것이 시맨틱 역할이 같음을 증명하지도 않습니다.

## 보호된 매핑

모듈은 공유 preset을 확장할 수 있습니다. 그러나 다음에 대한 보호된 Wippy 의미를 재정의해서는 안 됩니다:

- Primary 및 surface 계열.
- Severity 계열.
- Text, content, highlight 시맨틱.
- 공개된 이식 컨트롤 시맨틱.

컴플라이언스는 실제 모듈 Tailwind 구성을 해석하고, 보호된 매핑의 호환되지 않는 대체를 거부합니다.

## 커스텀 형제 컴포넌트

이식 가능한 커스텀 형제 컴포넌트는 다음을 사용할 수 있습니다:

- 생성된 카탈로그에 나열된 런타임 기반 시맨틱 유틸리티.
- 선택된 토큰 매니페스트에 나열된 공개 변수.
- 명시적으로 `platform-invariant`로 분류된 속성에 대한 컴파일 타임 유틸리티.
- 진정으로 새로운 구조를 위한 모듈 로컬 유틸리티.

PrimeVue 형제 컴포넌트를 따라갈 것으로 기대되는 속성에 대해서는 고정된 치수, radius, 지속 시간을 복사해서는 안 됩니다. 공개 런타임 시맨틱이 없다면 테마 계약 공백으로 기록하세요. 유틸리티나 토큰을 임의로 만들어내지 마세요.

## 생성된 유틸리티 카탈로그

체크인된 스냅샷은 다음에서 생성됩니다:

- `@wippy-fe/theme`가 선택한 정확한 Tailwind 버전.
- 정확한 `tailwindcss-primeui` 버전.
- Wippy의 공유 `tailwind.config.ts`.
- Wippy 확장.

생성된 각 행은 유틸리티, 방출된 속성, 확정된 값, 런타임 의존성, 용도, 허용 소비자, 안정성, 패키지 호환성 튜플, 소스 해시를 담습니다.

<!-- GENERATED:TAILWIND-CONTRACT:BEGIN -->
@wippy-fe/theme 0.0.46에서 생성되었습니다. 아래의 모든 대표 매핑은 tailwindcss-primeui 0.6.1과 함께 Tailwind 3.4.19가 컴파일한 CSS에 대해 검증되었습니다.

소스 해시: theme contract `853a01257988861e208b6f7523de25cd329717763d064e4f2c5920cff7f7778a`; theme config `129f1591fd657416b75e913f554329924bade319c38e62f5b72dcc5f72bd8295`; Tailwind config `f1e862105254f082a78823ea685e3c6dc3ff5822516b7434a1e1141c976adc1d`; 참조 테마 소스 `aura/index.mjs=d1a1a574cf1a15aad8aee4cb3fa169aa97bf4029e9f858b84245e7f0b933d5ca; aura/base/index.mjs=9fec80a7ffbd5fb0229da666c1472c27c9a0a6a7ef3bb0a84bd7b070601e4198; aura/inputtext/index.mjs=5c5a4af9bacf0d585120b119bb7bfb02c7deedd9714b131d7009ff6e95f818e8; aura/toggleswitch/index.mjs=1e068fd0ede48eeeca4d10571940d65dadb3450b2ee51a39d09b33dda9da6e66; aura/button/index.mjs=44d8fd7f7ae163ce2653de8c6eb8af097fc453b4c60f702fcf76845be6ec9393`.

### 런타임 기반 시맨틱 유틸리티

| 유틸리티 | CSS 속성 | 확정된 값 | 런타임 의존성 | 분류 | 허용 소비자 | 안정성 | 용도 |
|---|---|---|---|---|---|---|---|
| `bg-danger-500` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-danger-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `bg-emphasis` | background / color | `var(--p-content-hover-background) / var(--p-content-hover-color)` | --p-content-hover-background, --p-content-hover-color | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | public | 호버되었거나 강조된 콘텐츠 |
| `bg-help-500` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-help-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `bg-highlight` | background / color | `var(--p-highlight-background) / var(--p-highlight-color)` | --p-highlight-background, --p-highlight-color | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | public | 선택되었거나 하이라이트된 콘텐츠 |
| `bg-highlight-emphasis` | background / color | `var(--p-highlight-focus-background) / var(--p-highlight-focus-color)` | --p-highlight-focus-background, --p-highlight-focus-color | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | public | 포커스된 하이라이트 콘텐츠 |
| `bg-info-500` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-info-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `bg-primary` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | public | 기본 primary 액션 및 강조 색상 |
| `bg-primary-emphasis` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-primary-hover-color) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-primary-hover-color | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | public | primary 호버 또는 강조 상태 |
| `bg-success-500` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-success-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `bg-surface-0` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-0 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `bg-surface-100` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-100 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `bg-surface-200` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `bg-surface-300` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-300 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `bg-surface-400` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `bg-surface-50` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-50 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `bg-surface-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `bg-surface-950` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-950 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `bg-warn-500` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-warn-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `border-danger-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `border-danger-400` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `border-danger-500` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `border-help-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `border-help-500` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `border-info-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `border-info-500` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `border-primary` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `border-primary-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `border-success-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `border-success-500` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `border-surface` | border-color | `var(--p-content-border-color)` | --p-content-border-color | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | public | 공유 콘텐츠 및 컨트롤 테두리 |
| `border-surface-100` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-100 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `border-surface-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `border-surface-300` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-300 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `border-surface-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `border-surface-950` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-950 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `border-warn-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `border-warn-500` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:bg-danger-400` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-danger-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:bg-help-400` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-help-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:bg-info-400` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-info-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:bg-success-400` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-success-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:bg-surface-0` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-0 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:bg-surface-300` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-300 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:bg-surface-400` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:bg-surface-600` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-600 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:bg-surface-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:bg-surface-800` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-800 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:bg-surface-900` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-900) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-900 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:bg-warn-400` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-warn-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:border-danger-300` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-300 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:border-danger-400` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:border-danger-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:border-help-400` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:border-help-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:border-info-400` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:border-info-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:border-primary-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:border-success-400` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:border-success-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:border-surface-100` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-100 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:border-surface-500` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:border-surface-600` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-600 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:border-surface-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:border-surface-800` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-800 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:border-warn-400` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:border-warn-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:disabled:bg-surface-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:disabled:text-surface-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:bg-danger-200` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-danger-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:bg-danger-400/15` | background-color | `color-mix(in srgb, var(--p-danger-400) calc(100% * 0.15), transparent)` | --p-danger-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:bg-help-200` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-help-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:bg-help-400/15` | background-color | `color-mix(in srgb, var(--p-help-400) calc(100% * 0.15), transparent)` | --p-help-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:bg-info-200` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-info-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:bg-info-400/15` | background-color | `color-mix(in srgb, var(--p-info-400) calc(100% * 0.15), transparent)` | --p-info-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:bg-primary/15` | background-color | `color-mix(in srgb, var(--p-primary-color) calc(100% * 0.15), transparent)` | --p-primary-color | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:bg-success-200` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-success-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:bg-success-400/15` | background-color | `color-mix(in srgb, var(--p-success-400) calc(100% * 0.15), transparent)` | --p-success-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:bg-surface-200` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:bg-surface-600` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-600 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:bg-surface-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:bg-warn-200` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-warn-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:bg-warn-400/15` | background-color | `color-mix(in srgb, var(--p-warn-400) calc(100% * 0.15), transparent)` | --p-warn-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:border-danger-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:border-danger-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:border-help-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:border-help-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:border-info-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:border-info-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:border-primary-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:border-success-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:border-success-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:border-surface-300` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-300 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:border-surface-500` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:border-surface-600` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-600 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:border-surface-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:border-warn-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:border-warn-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:text-danger-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-danger-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:text-danger-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-danger-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-danger-950 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:text-help-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-help-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:text-help-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-help-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-help-950 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:text-info-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-info-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:text-info-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-info-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-info-950 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:text-primary` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:text-success-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-success-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:text-success-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-success-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-success-950 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:text-surface-0` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-0 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:text-surface-100` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-100 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:text-surface-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:text-surface-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-950 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:text-warn-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-warn-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:text-warn-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-warn-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-warn-950 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:focus:border-primary` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:bg-danger-300` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-danger-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-danger-300 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:bg-danger-400/5` | background-color | `color-mix(in srgb, var(--p-danger-400) calc(100% * 0.05), transparent)` | --p-danger-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:bg-help-300` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-help-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-help-300 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:bg-help-400/5` | background-color | `color-mix(in srgb, var(--p-help-400) calc(100% * 0.05), transparent)` | --p-help-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:bg-info-300` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-info-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-info-300 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:bg-info-400/5` | background-color | `color-mix(in srgb, var(--p-info-400) calc(100% * 0.05), transparent)` | --p-info-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:bg-primary/5` | background-color | `color-mix(in srgb, var(--p-primary-color) calc(100% * 0.05), transparent)` | --p-primary-color | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:bg-success-300` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-success-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-success-300 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:bg-success-400/5` | background-color | `color-mix(in srgb, var(--p-success-400) calc(100% * 0.05), transparent)` | --p-success-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:bg-surface-100` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-100 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:bg-surface-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:bg-surface-800` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-800 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:bg-warn-300` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-warn-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-warn-300 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:bg-warn-400/5` | background-color | `color-mix(in srgb, var(--p-warn-400) calc(100% * 0.05), transparent)` | --p-warn-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:border-danger-300` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-300 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:border-danger-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:border-help-300` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-300 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:border-help-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:border-info-300` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-300 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:border-info-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:border-primary-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:border-success-300` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-300 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:border-success-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:border-surface-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:border-surface-500` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:border-surface-600` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-600 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:border-surface-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:border-warn-300` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-300 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:border-warn-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:text-danger-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-danger-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:text-danger-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-danger-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-danger-950 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:text-help-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-help-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:text-help-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-help-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-help-950 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:text-info-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-info-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:text-info-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-info-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-info-950 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:text-primary` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:text-success-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-success-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:text-success-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-success-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-success-950 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:text-surface-0` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-0 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:text-surface-200` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:text-surface-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:text-surface-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-950 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:text-warn-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-warn-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:text-warn-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-warn-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-warn-950 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:focus-visible:outline-danger-400` | outline-color | `color-mix(in srgb, var(--p-danger-400) calc(100% * 1), transparent)` | --p-danger-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:focus-visible:outline-help-400` | outline-color | `color-mix(in srgb, var(--p-help-400) calc(100% * 1), transparent)` | --p-help-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:focus-visible:outline-info-400` | outline-color | `color-mix(in srgb, var(--p-info-400) calc(100% * 1), transparent)` | --p-info-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:focus-visible:outline-success-400` | outline-color | `color-mix(in srgb, var(--p-success-400) calc(100% * 1), transparent)` | --p-success-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:focus-visible:outline-surface-0` | outline-color | `color-mix(in srgb, var(--p-surface-0) calc(100% * 1), transparent)` | --p-surface-0 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:focus-visible:outline-surface-300` | outline-color | `color-mix(in srgb, var(--p-surface-300) calc(100% * 1), transparent)` | --p-surface-300 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:focus-visible:outline-warn-400` | outline-color | `color-mix(in srgb, var(--p-warn-400) calc(100% * 1), transparent)` | --p-warn-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:placeholder:text-surface-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:text-danger-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-danger-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:text-danger-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-danger-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-danger-950 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:text-help-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-help-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:text-help-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-help-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-help-950 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:text-info-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-info-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:text-info-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-info-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-info-950 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:text-primary` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:text-success-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-success-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:text-success-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-success-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-success-950 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:text-surface-0` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-0 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:text-surface-300` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-300 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:text-surface-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:text-surface-800` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-800 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:text-surface-900` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-900) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-900 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:text-surface-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-950 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:text-warn-400` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-warn-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:text-warn-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-warn-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-warn-950 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `disabled:bg-surface-200` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `disabled:text-surface-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:bg-danger-100` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-danger-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-danger-100 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:bg-danger-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-danger-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:bg-help-100` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-help-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-help-100 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:bg-help-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-help-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:bg-info-100` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-info-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-info-100 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:bg-info-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-info-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:bg-primary-100` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-primary-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-primary-100 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:bg-primary-emphasis-alt` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-primary-active-color) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-primary-active-color | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:bg-success-100` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-success-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-success-100 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:bg-success-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-success-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:bg-surface-100` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-100 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:bg-surface-300` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-300 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:bg-surface-800` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-800 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:bg-warn-100` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-warn-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-warn-100 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:bg-warn-700` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-warn-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:border-danger-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:border-danger-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:border-help-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:border-help-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:border-info-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:border-info-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:border-primary-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:border-primary-emphasis-alt` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-active-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-active-color | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:border-success-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:border-success-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:border-surface-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:border-surface-300` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-300 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:border-surface-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:border-surface-800` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-800 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:border-warn-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:border-warn-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:text-danger-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-danger-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:text-help-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-help-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:text-info-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-info-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:text-primary` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:text-success-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-success-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:text-surface-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:text-surface-700` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:text-surface-800` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-800 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:text-surface-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-950 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:text-warn-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-warn-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:focus:border-primary` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:bg-danger-50` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-danger-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-danger-50 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:bg-danger-600` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-danger-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-danger-600 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:bg-help-50` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-help-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-help-50 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:bg-help-600` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-help-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-help-600 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:bg-info-50` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-info-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-info-50 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:bg-info-600` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-info-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-info-600 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:bg-primary-50` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-primary-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-primary-50 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:bg-primary-emphasis` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-primary-hover-color) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-primary-hover-color | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:bg-success-50` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-success-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-success-50 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:bg-success-600` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-success-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-success-600 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:bg-surface-200` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:bg-surface-50` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-50 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:bg-surface-900` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-surface-900) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-surface-900 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:bg-warn-50` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-warn-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-warn-50 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:bg-warn-600` | --tw-bg-opacity / background-color | `1 / color-mix(in srgb, var(--p-warn-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` | --p-warn-600 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:border-danger-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:border-danger-600` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-danger-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-danger-600 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:border-help-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:border-help-600` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-help-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-help-600 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:border-info-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:border-info-600` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-info-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-info-600 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:border-primary-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:border-primary-emphasis` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-primary-hover-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-primary-hover-color | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:border-success-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:border-success-600` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-success-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-success-600 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:border-surface-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:border-surface-400` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-400 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:border-surface-700` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:border-surface-900` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-surface-900) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-surface-900 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:border-warn-200` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-200 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:border-warn-600` | --tw-border-opacity / border-color | `1 / color-mix(in srgb, var(--p-warn-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` | --p-warn-600 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:text-danger-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-danger-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:text-help-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-help-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:text-info-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-info-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:text-primary` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:text-success-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-success-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:text-surface-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:text-surface-700` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:text-surface-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-950 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:text-warn-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-warn-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `focus-visible:outline-danger-500` | outline-color | `color-mix(in srgb, var(--p-danger-500) calc(100% * 1), transparent)` | --p-danger-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `focus-visible:outline-help-500` | outline-color | `color-mix(in srgb, var(--p-help-500) calc(100% * 1), transparent)` | --p-help-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `focus-visible:outline-info-500` | outline-color | `color-mix(in srgb, var(--p-info-500) calc(100% * 1), transparent)` | --p-info-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `focus-visible:outline-primary` | outline-color | `color-mix(in srgb, var(--p-primary-color) calc(100% * 1), transparent)` | --p-primary-color | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `focus-visible:outline-success-500` | outline-color | `color-mix(in srgb, var(--p-success-500) calc(100% * 1), transparent)` | --p-success-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `focus-visible:outline-surface-600` | outline-color | `color-mix(in srgb, var(--p-surface-600) calc(100% * 1), transparent)` | --p-surface-600 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `focus-visible:outline-surface-950` | outline-color | `color-mix(in srgb, var(--p-surface-950) calc(100% * 1), transparent)` | --p-surface-950 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `focus-visible:outline-warn-500` | outline-color | `color-mix(in srgb, var(--p-warn-500) calc(100% * 1), transparent)` | --p-warn-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `placeholder:text-surface-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `rounded-border` | border-radius | `var(--p-content-border-radius)` | --p-content-border-radius | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | public | 폼 컨트롤의 자동 radius가 아닌 일반 콘텐츠 radius |
| `text-color` | color | `var(--p-text-color)` | --p-text-color | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | public | 기본 콘텐츠 텍스트 |
| `text-color-emphasis` | color | `var(--p-text-hover-color)` | --p-text-hover-color | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | public | 강조된 콘텐츠 텍스트 |
| `text-danger-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-danger-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `text-help-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-help-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `text-info-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-info-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `text-muted-color` | color | `var(--p-text-muted-color)` | --p-text-muted-color | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | public | 보조 콘텐츠 텍스트 |
| `text-muted-color-emphasis` | color | `var(--p-text-hover-muted-color)` | --p-text-hover-muted-color | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | public | 강조된 보조 텍스트 |
| `text-primary` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-primary-color | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | public | 기본 primary 액션 및 강조 색상 |
| `text-primary-contrast` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-primary-contrast-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-primary-contrast-color | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | public | primary 배경과 짝을 이루는 전경색 |
| `text-primary-emphasis` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-primary-hover-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-primary-hover-color | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `text-success-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-success-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `text-surface-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `text-surface-600` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-600 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `text-surface-700` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-700 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `text-surface-950` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-surface-950 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `text-warn-500` | --tw-text-opacity / color | `1 / color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` | --p-warn-500 | runtime-variable | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |

### 컴파일 타임 기준선

> 빌드 타임 기준선. 이 값은 모듈 번들에 임베드되며 facade의 테마 변경에 반응하지 않습니다.

| 유틸리티 | CSS 속성 | 확정된 값 | 런타임 의존성 | 분류 | 허용 소비자 | 안정성 | 용도 |
|---|---|---|---|---|---|---|---|
| `absolute` | position | `absolute` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `appearance-none` | appearance | `none` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `bg-transparent` | background-color | `transparent` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `border` | border-width | `1px` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `border-transparent` | border-color | `transparent` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `cursor-pointer` | cursor | `pointer` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:bg-transparent` | background-color | `transparent` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:border-transparent` | border-color | `transparent` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:bg-white/15` | background-color | `rgb(255 255 255 / 0.15)` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:active:border-transparent` | border-color | `transparent` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:bg-white/5` | background-color | `rgb(255 255 255 / 0.05)` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `dark:enabled:hover:border-transparent` | border-color | `transparent` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `disabled:cursor-default` | cursor | `default` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `disabled:opacity-100` | opacity | `1` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `duration-200` | transition-duration | `200ms` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | platform-invariant-only | 정적 Tailwind 모션 기준선 |
| `ease-in-out` | transition-timing-function | `cubic-bezier(0.4, 0, 0.2, 1)` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | platform-invariant-only | 정적 Tailwind 타이밍 기준선 |
| `enabled:active:bg-transparent` | background-color | `transparent` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:border-transparent` | border-color | `transparent` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:active:text-white` | --tw-text-opacity / color | `1 / rgb(255 255 255 / var(--tw-text-opacity, 1))` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:bg-transparent` | background-color | `transparent` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:border-transparent` | border-color | `transparent` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `enabled:hover:text-white` | --tw-text-opacity / color | `1 / rgb(255 255 255 / var(--tw-text-opacity, 1))` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `flex` | display | `flex` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `flex-col` | flex-direction | `column` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `focus-visible:outline` | outline-style | `solid` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `focus-visible:outline-1` | outline-width | `1px` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `focus-visible:outline-offset-2` | outline-offset | `2px` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `font-medium` | font-weight | `500` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `gap-0` | gap | `0px` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `gap-2` | gap | `0.5rem` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | platform-invariant-only | 정적 Tailwind 스페이싱 기준선 |
| `h-10` | height | `2.5rem` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `h-4` | height | `1rem` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `h-6` | height | `1.5rem` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | platform-invariant-only | 정적 Tailwind 사이징 기준선 |
| `h-full` | height | `100%` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `inline-block` | display | `inline-block` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `inline-flex` | display | `inline-flex` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `invisible` | visibility | `hidden` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `items-center` | align-items | `center` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `justify-center` | justify-content | `center` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `leading-4` | line-height | `1rem` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `m-0` | margin | `0px` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `min-w-4` | min-width | `1rem` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `opacity-0` | opacity | `0` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `opacity-100` | opacity | `1` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `order-1` | order | `1` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `order-2` | order | `2` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `order-[-1]` | order | `-1` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `outline-1` | outline-width | `1px` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | platform-invariant-only | 정적 Tailwind 포커스 지오메트리 기준선 |
| `outline-none` | outline / outline-offset | `2px solid transparent / 2px` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `outline-offset-2` | outline-offset | `2px` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | platform-invariant-only | 정적 Tailwind 포커스 지오메트리 기준선 |
| `overflow-hidden` | overflow | `hidden` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `p-0` | padding | `0px` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `px-0` | padding-left / padding-right | `0px / 0px` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `px-2` | padding-left / padding-right | `0.5rem / 0.5rem` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `px-3` | padding-left / padding-right | `0.75rem / 0.75rem` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | platform-invariant-only | 정적 Tailwind 스페이싱 기준선 |
| `px-[0.625rem]` | padding-left / padding-right | `0.625rem / 0.625rem` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `px-[0.875rem]` | padding-left / padding-right | `0.875rem / 0.875rem` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `py-1` | padding-top / padding-bottom | `0.25rem / 0.25rem` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `py-2` | padding-top / padding-bottom | `0.5rem / 0.5rem` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | platform-invariant-only | 정적 Tailwind 스페이싱 기준선 |
| `py-[0.375rem]` | padding-top / padding-bottom | `0.375rem / 0.375rem` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `py-[0.625rem]` | padding-top / padding-bottom | `0.625rem / 0.625rem` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `relative` | position | `relative` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `rounded-[2rem]` | border-radius | `2rem` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `rounded-full` | border-radius | `9999px` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `rounded-md` | border-radius | `0.375rem` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | platform-invariant-only | 정적 Tailwind radius 기준선 |
| `select-none` | user-select | `none` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `shadow-[0_3px_1px_-2px_rgba(0,0,0,0.2),0_2px_2px_0_rgba(0,0,0,0.14),0_1px_5px_0_rgba(0,0,0,0.12)]` | --tw-shadow / --tw-shadow-colored / box-shadow | `0 3px 1px -2px rgba(0,0,0,0.2),0 2px 2px 0 rgba(0,0,0,0.14),0 1px 5px 0 rgba(0,0,0,0.12) / 0 3px 1px -2px var(--tw-shadow-color), 0 2px 2px 0 var(--tw-shadow-color), 0 1px 5px 0 var(--tw-shadow-color) / var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow)` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `start-0` | inset-inline-start | `0px` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `text-[1.125rem]` | font-size | `1.125rem` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `text-lg` | font-size / line-height | `1.125rem / 1.75rem` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `text-sm` | font-size / line-height | `0.875rem / 1.25rem` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | platform-invariant-only | 정적 Tailwind 타이포그래피 기준선 |
| `text-white` | --tw-text-opacity / color | `1 / rgb(255 255 255 / var(--tw-text-opacity, 1))` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `text-xs` | font-size / line-height | `0.75rem / 1rem` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `top-0` | top | `0px` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `top-1/2` | top | `50%` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `transition-[background,color,left]` | transition-property / transition-timing-function / transition-duration | `background,color,left / cubic-bezier(0.4, 0, 0.2, 1) / 150ms` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `transition-colors` | transition-property / transition-timing-function / transition-duration | `color, background-color, border-color, text-decoration-color, fill, stroke / cubic-bezier(0.4, 0, 0.2, 1) / 150ms` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `underline` | text-decoration-line | `underline` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `w-0` | width | `0px` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `w-10` | width | `2.5rem` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | platform-invariant-only | 정적 Tailwind 사이징 기준선 |
| `w-full` | width | `100%` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |
| `z-10` | z-index | `10` | none | compile-time-constant | 시맨틱 용도가 일치하는 경우 이식 가능 모듈; 고정 값은 불변성 검토 이후에만 | generated-representative | 대표 유틸리티. 소비자 측에서 시맨틱 용도를 검토하세요 |

### 내부 또는 임시 유틸리티

| 유틸리티 | CSS 속성 | 확정된 값 | 런타임 의존성 | 분류 | 허용 소비자 | 안정성 | 용도 |
|---|---|---|---|---|---|---|---|

### 컴파일된 대표 프로브

| 유틸리티 | 방출된 선언 |
|---|---|
| `absolute` | `position: absolute` |
| `appearance-none` | `appearance: none` |
| `bg-danger-500` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-emphasis` | `background: var(--p-content-hover-background); color: var(--p-content-hover-color)` |
| `bg-help-500` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-highlight` | `background: var(--p-highlight-background); color: var(--p-highlight-color)` |
| `bg-highlight-emphasis` | `background: var(--p-highlight-focus-background); color: var(--p-highlight-focus-color)` |
| `bg-info-500` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-primary` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-primary-emphasis` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-primary-hover-color) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-success-500` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-surface-0` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-surface-100` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-surface-200` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-surface-300` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-surface-400` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-surface-50` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-surface-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-surface-950` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `bg-transparent` | `background-color: transparent` |
| `bg-warn-500` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `border` | `border-width: 1px` |
| `border-danger-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-danger-400` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-danger-500` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-help-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-help-500` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-info-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-info-500` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-primary` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-primary-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-success-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-success-500` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-surface` | `border-color: var(--p-content-border-color)` |
| `border-surface-100` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-surface-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-surface-300` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-surface-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-surface-950` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-transparent` | `border-color: transparent` |
| `border-warn-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `border-warn-500` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `cursor-pointer` | `cursor: pointer` |
| `dark:bg-danger-400` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-help-400` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-info-400` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-success-400` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-surface-0` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-surface-300` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-surface-400` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-surface-600` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-surface-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-surface-800` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-surface-900` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-900) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:bg-transparent` | `background-color: transparent` |
| `dark:bg-warn-400` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:border-danger-300` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-danger-400` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-danger-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-help-400` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-help-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-info-400` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-info-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-primary-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-success-400` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-success-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-surface-100` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-surface-500` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-surface-600` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-surface-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-surface-800` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-transparent` | `border-color: transparent` |
| `dark:border-warn-400` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:border-warn-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:disabled:bg-surface-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:disabled:text-surface-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:bg-danger-200` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:active:bg-danger-400/15` | `background-color: color-mix(in srgb, var(--p-danger-400) calc(100% * 0.15), transparent)` |
| `dark:enabled:active:bg-help-200` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:active:bg-help-400/15` | `background-color: color-mix(in srgb, var(--p-help-400) calc(100% * 0.15), transparent)` |
| `dark:enabled:active:bg-info-200` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:active:bg-info-400/15` | `background-color: color-mix(in srgb, var(--p-info-400) calc(100% * 0.15), transparent)` |
| `dark:enabled:active:bg-primary/15` | `background-color: color-mix(in srgb, var(--p-primary-color) calc(100% * 0.15), transparent)` |
| `dark:enabled:active:bg-success-200` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:active:bg-success-400/15` | `background-color: color-mix(in srgb, var(--p-success-400) calc(100% * 0.15), transparent)` |
| `dark:enabled:active:bg-surface-200` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:active:bg-surface-600` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:active:bg-surface-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:active:bg-warn-200` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:active:bg-warn-400/15` | `background-color: color-mix(in srgb, var(--p-warn-400) calc(100% * 0.15), transparent)` |
| `dark:enabled:active:bg-white/15` | `background-color: rgb(255 255 255 / 0.15)` |
| `dark:enabled:active:border-danger-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-danger-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-help-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-help-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-info-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-info-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-primary-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-success-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-success-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-surface-300` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-surface-500` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-surface-600` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-surface-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-transparent` | `border-color: transparent` |
| `dark:enabled:active:border-warn-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:border-warn-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:active:text-danger-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-danger-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-danger-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-help-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-help-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-help-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-info-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-info-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-info-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-primary` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-success-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-success-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-success-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-surface-0` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-surface-100` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-surface-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-surface-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-warn-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:active:text-warn-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-warn-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:focus:border-primary` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:bg-danger-300` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-danger-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:hover:bg-danger-400/5` | `background-color: color-mix(in srgb, var(--p-danger-400) calc(100% * 0.05), transparent)` |
| `dark:enabled:hover:bg-help-300` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-help-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:hover:bg-help-400/5` | `background-color: color-mix(in srgb, var(--p-help-400) calc(100% * 0.05), transparent)` |
| `dark:enabled:hover:bg-info-300` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-info-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:hover:bg-info-400/5` | `background-color: color-mix(in srgb, var(--p-info-400) calc(100% * 0.05), transparent)` |
| `dark:enabled:hover:bg-primary/5` | `background-color: color-mix(in srgb, var(--p-primary-color) calc(100% * 0.05), transparent)` |
| `dark:enabled:hover:bg-success-300` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-success-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:hover:bg-success-400/5` | `background-color: color-mix(in srgb, var(--p-success-400) calc(100% * 0.05), transparent)` |
| `dark:enabled:hover:bg-surface-100` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:hover:bg-surface-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:hover:bg-surface-800` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:hover:bg-warn-300` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-warn-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `dark:enabled:hover:bg-warn-400/5` | `background-color: color-mix(in srgb, var(--p-warn-400) calc(100% * 0.05), transparent)` |
| `dark:enabled:hover:bg-white/5` | `background-color: rgb(255 255 255 / 0.05)` |
| `dark:enabled:hover:border-danger-300` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-danger-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-help-300` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-help-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-info-300` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-info-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-primary-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-success-300` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-success-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-surface-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-surface-500` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-surface-600` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-surface-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-transparent` | `border-color: transparent` |
| `dark:enabled:hover:border-warn-300` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:border-warn-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-danger-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-danger-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-danger-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-help-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-help-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-help-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-info-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-info-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-info-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-primary` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-success-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-success-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-success-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-surface-0` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-surface-200` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-surface-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-surface-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-warn-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:enabled:hover:text-warn-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-warn-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:focus-visible:outline-danger-400` | `outline-color: color-mix(in srgb, var(--p-danger-400) calc(100% * 1), transparent)` |
| `dark:focus-visible:outline-help-400` | `outline-color: color-mix(in srgb, var(--p-help-400) calc(100% * 1), transparent)` |
| `dark:focus-visible:outline-info-400` | `outline-color: color-mix(in srgb, var(--p-info-400) calc(100% * 1), transparent)` |
| `dark:focus-visible:outline-success-400` | `outline-color: color-mix(in srgb, var(--p-success-400) calc(100% * 1), transparent)` |
| `dark:focus-visible:outline-surface-0` | `outline-color: color-mix(in srgb, var(--p-surface-0) calc(100% * 1), transparent)` |
| `dark:focus-visible:outline-surface-300` | `outline-color: color-mix(in srgb, var(--p-surface-300) calc(100% * 1), transparent)` |
| `dark:focus-visible:outline-warn-400` | `outline-color: color-mix(in srgb, var(--p-warn-400) calc(100% * 1), transparent)` |
| `dark:placeholder:text-surface-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-danger-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-danger-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-danger-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-danger-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-help-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-help-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-help-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-help-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-info-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-info-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-info-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-info-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-primary` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-success-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-success-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-success-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-success-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-surface-0` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-0) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-surface-300` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-surface-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-surface-800` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-surface-900` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-900) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-surface-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-warn-400` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-warn-400) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `dark:text-warn-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-warn-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `disabled:bg-surface-200` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `disabled:cursor-default` | `cursor: default` |
| `disabled:opacity-100` | `opacity: 1` |
| `disabled:text-surface-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `duration-200` | `transition-duration: 200ms` |
| `ease-in-out` | `transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1)` |
| `enabled:active:bg-danger-100` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-danger-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-danger-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-help-100` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-help-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-help-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-info-100` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-info-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-info-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-primary-100` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-primary-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-primary-emphasis-alt` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-primary-active-color) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-success-100` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-success-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-success-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-surface-100` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-surface-300` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-surface-800` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-transparent` | `background-color: transparent` |
| `enabled:active:bg-warn-100` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-warn-100) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:bg-warn-700` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:active:border-danger-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-danger-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-help-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-help-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-info-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-info-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-primary-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-primary-emphasis-alt` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-active-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-success-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-success-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-surface-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-surface-300` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-300) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-surface-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-surface-800` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-transparent` | `border-color: transparent` |
| `enabled:active:border-warn-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:border-warn-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:active:text-danger-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-help-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-info-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-primary` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-success-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-surface-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-surface-700` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-surface-800` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-800) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-surface-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-warn-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:active:text-white` | `--tw-text-opacity: 1; color: rgb(255 255 255 / var(--tw-text-opacity, 1))` |
| `enabled:focus:border-primary` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:bg-danger-50` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-danger-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-danger-600` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-danger-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-help-50` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-help-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-help-600` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-help-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-info-50` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-info-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-info-600` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-info-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-primary-50` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-primary-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-primary-emphasis` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-primary-hover-color) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-success-50` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-success-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-success-600` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-success-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-surface-200` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-surface-50` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-surface-900` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-surface-900) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-transparent` | `background-color: transparent` |
| `enabled:hover:bg-warn-50` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-warn-50) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:bg-warn-600` | `--tw-bg-opacity: 1; background-color: color-mix(in srgb, var(--p-warn-600) calc(100% * var(--tw-bg-opacity, 1)), transparent)` |
| `enabled:hover:border-danger-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-danger-600` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-danger-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-help-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-help-600` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-help-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-info-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-info-600` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-info-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-primary-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-primary-emphasis` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-primary-hover-color) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-success-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-success-600` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-success-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-surface-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-surface-400` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-400) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-surface-700` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-surface-900` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-surface-900) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-transparent` | `border-color: transparent` |
| `enabled:hover:border-warn-200` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-200) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:border-warn-600` | `--tw-border-opacity: 1; border-color: color-mix(in srgb, var(--p-warn-600) calc(100% * var(--tw-border-opacity, 1)), transparent)` |
| `enabled:hover:text-danger-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:hover:text-help-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:hover:text-info-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:hover:text-primary` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:hover:text-success-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:hover:text-surface-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:hover:text-surface-700` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:hover:text-surface-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:hover:text-warn-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `enabled:hover:text-white` | `--tw-text-opacity: 1; color: rgb(255 255 255 / var(--tw-text-opacity, 1))` |
| `flex` | `display: flex` |
| `flex-col` | `flex-direction: column` |
| `focus-visible:outline` | `outline-style: solid` |
| `focus-visible:outline-1` | `outline-width: 1px` |
| `focus-visible:outline-danger-500` | `outline-color: color-mix(in srgb, var(--p-danger-500) calc(100% * 1), transparent)` |
| `focus-visible:outline-help-500` | `outline-color: color-mix(in srgb, var(--p-help-500) calc(100% * 1), transparent)` |
| `focus-visible:outline-info-500` | `outline-color: color-mix(in srgb, var(--p-info-500) calc(100% * 1), transparent)` |
| `focus-visible:outline-offset-2` | `outline-offset: 2px` |
| `focus-visible:outline-primary` | `outline-color: color-mix(in srgb, var(--p-primary-color) calc(100% * 1), transparent)` |
| `focus-visible:outline-success-500` | `outline-color: color-mix(in srgb, var(--p-success-500) calc(100% * 1), transparent)` |
| `focus-visible:outline-surface-600` | `outline-color: color-mix(in srgb, var(--p-surface-600) calc(100% * 1), transparent)` |
| `focus-visible:outline-surface-950` | `outline-color: color-mix(in srgb, var(--p-surface-950) calc(100% * 1), transparent)` |
| `focus-visible:outline-warn-500` | `outline-color: color-mix(in srgb, var(--p-warn-500) calc(100% * 1), transparent)` |
| `font-medium` | `font-weight: 500` |
| `gap-0` | `gap: 0px` |
| `gap-2` | `gap: 0.5rem` |
| `h-10` | `height: 2.5rem` |
| `h-4` | `height: 1rem` |
| `h-6` | `height: 1.5rem` |
| `h-full` | `height: 100%` |
| `inline-block` | `display: inline-block` |
| `inline-flex` | `display: inline-flex` |
| `invisible` | `visibility: hidden` |
| `items-center` | `align-items: center` |
| `justify-center` | `justify-content: center` |
| `leading-4` | `line-height: 1rem` |
| `m-0` | `margin: 0px` |
| `min-w-4` | `min-width: 1rem` |
| `opacity-0` | `opacity: 0` |
| `opacity-100` | `opacity: 1` |
| `order-1` | `order: 1` |
| `order-2` | `order: 2` |
| `order-[-1]` | `order: -1` |
| `outline-1` | `outline-width: 1px` |
| `outline-none` | `outline: 2px solid transparent; outline-offset: 2px` |
| `outline-offset-2` | `outline-offset: 2px` |
| `overflow-hidden` | `overflow: hidden` |
| `p-0` | `padding: 0px` |
| `placeholder:text-surface-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `px-0` | `padding-left: 0px; padding-right: 0px` |
| `px-2` | `padding-left: 0.5rem; padding-right: 0.5rem` |
| `px-3` | `padding-left: 0.75rem; padding-right: 0.75rem` |
| `px-[0.625rem]` | `padding-left: 0.625rem; padding-right: 0.625rem` |
| `px-[0.875rem]` | `padding-left: 0.875rem; padding-right: 0.875rem` |
| `py-1` | `padding-top: 0.25rem; padding-bottom: 0.25rem` |
| `py-2` | `padding-top: 0.5rem; padding-bottom: 0.5rem` |
| `py-[0.375rem]` | `padding-top: 0.375rem; padding-bottom: 0.375rem` |
| `py-[0.625rem]` | `padding-top: 0.625rem; padding-bottom: 0.625rem` |
| `relative` | `position: relative` |
| `rounded-[2rem]` | `border-radius: 2rem` |
| `rounded-border` | `border-radius: var(--p-content-border-radius)` |
| `rounded-full` | `border-radius: 9999px` |
| `rounded-md` | `border-radius: 0.375rem` |
| `select-none` | `user-select: none` |
| `shadow-[0_3px_1px_-2px_rgba(0,0,0,0.2),0_2px_2px_0_rgba(0,0,0,0.14),0_1px_5px_0_rgba(0,0,0,0.12)]` | `--tw-shadow: 0 3px 1px -2px rgba(0,0,0,0.2),0 2px 2px 0 rgba(0,0,0,0.14),0 1px 5px 0 rgba(0,0,0,0.12); --tw-shadow-colored: 0 3px 1px -2px var(--tw-shadow-color), 0 2px 2px 0 var(--tw-shadow-color), 0 1px 5px 0 var(--tw-shadow-color); box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow)` |
| `start-0` | `inset-inline-start: 0px` |
| `text-[1.125rem]` | `font-size: 1.125rem` |
| `text-color` | `color: var(--p-text-color)` |
| `text-color-emphasis` | `color: var(--p-text-hover-color)` |
| `text-danger-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-danger-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-help-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-help-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-info-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-info-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-lg` | `font-size: 1.125rem; line-height: 1.75rem` |
| `text-muted-color` | `color: var(--p-text-muted-color)` |
| `text-muted-color-emphasis` | `color: var(--p-text-hover-muted-color)` |
| `text-primary` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-primary-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-primary-contrast` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-primary-contrast-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-primary-emphasis` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-primary-hover-color) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-sm` | `font-size: 0.875rem; line-height: 1.25rem` |
| `text-success-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-success-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-surface-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-surface-600` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-600) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-surface-700` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-700) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-surface-950` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-surface-950) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-warn-500` | `--tw-text-opacity: 1; color: color-mix(in srgb, var(--p-warn-500) calc(100% * var(--tw-text-opacity, 1)), transparent)` |
| `text-white` | `--tw-text-opacity: 1; color: rgb(255 255 255 / var(--tw-text-opacity, 1))` |
| `text-xs` | `font-size: 0.75rem; line-height: 1rem` |
| `top-0` | `top: 0px` |
| `top-1/2` | `top: 50%` |
| `transition-[background,color,left]` | `transition-property: background,color,left; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms` |
| `transition-colors` | `transition-property: color, background-color, border-color, text-decoration-color, fill, stroke; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms` |
| `underline` | `text-decoration-line: underline` |
| `w-0` | `width: 0px` |
| `w-10` | `width: 2.5rem` |
| `w-full` | `width: 100%` |
| `z-10` | `z-index: 10` |
<!-- GENERATED:TAILWIND-CONTRACT:END -->
