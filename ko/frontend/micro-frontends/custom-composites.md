---
title: "커스텀 복합 컨트롤"
description: "PrimeVue로 필요한 어포던스를 제공할 수 없는 컨트롤을 위한 계약 우선 예외입니다."
---

# 커스텀 복합 컨트롤

**분류: 규범적 예외 계약 레퍼런스.** JSON 블록은 자리표시자를 포함한 스키마 예제이며 유효한 계약이나 증거 묶음이 아닙니다.

커스텀 컨트롤은 대체 컴포넌트 라이브러리가 아니라 예외입니다.

## 허용 조건

커스텀 컨트롤은 다음 조건을 모두 만족할 때만 허용됩니다.

1. PrimeVue로 의도한 의미, 상호작용, 어포던스를 제공하거나 조합할 수 없습니다.
2. 예외에 검토 후 배제한 PrimeVue 조합이 기록되어 있습니다.
3. 정확한 생성 PrimeVue 대응 계약과 계약 해시를 지정합니다.
4. 대응 계약에서 `shared-runtime`으로 분류한 모든 속성에 정확한 소스 매핑이 있습니다.
5. 고정 유틸리티는 대응 계약이 해당 속성을 `platform-invariant`로 분류한 경우에만 허용됩니다.
6. 새로운 기하 구조와 동작이 격리되고 문서화되어 있습니다.
7. 접근성 및 시각적 증거가 통과합니다.

데이터 형태가 같다고 어포던스까지 같은 것은 아닙니다. 여러 옵션을 갖는 `SelectButton`은 값 세 개를 표현할 수 있지만 슬라이딩 3단 토글처럼 보이거나 동작하지 않습니다. 반대로 `ToggleSwitch`에 `positions` prop을 임의로 만들지 마세요. 어포던스 요구 사항이 실제로 존재할 때만 검토된 커스텀 대응 컨트롤을 만듭니다.

## 모듈 계약

검토된 예외를 모듈 루트의 `wippy-fe.contract.json`에 저장합니다.

```json
{
  "schemaVersion": "generated-by-selected-contract-tool",
  "exceptions": [
    {
      "id": "module.control.example",
      "source": "src/components/ExampleControl.vue",
      "sourceSha256": "generated-from-source",
      "semanticRole": "documented-role",
      "requiredAffordance": "documented-affordance",
      "rejectedPrimeVueCompositions": [
        {
          "components": ["SelectButton"],
          "reason": "The reviewed sliding affordance cannot be preserved."
        }
      ],
      "visualSibling": {
        "component": "ToggleSwitch",
        "contractId": "primevue.toggleswitch.portable-appearance",
        "contractHash": "generated-from-selected-theme-contract"
      },
      "sharedAppearanceMappings": [
        {
          "contractProperty": "root.width",
          "part": "root",
          "selector": ".example-control",
          "source": {
            "kind": "css-variable",
            "name": "--p-toggleswitch-width"
          }
        }
      ],
      "platformInvariantUtilities": [],
      "moduleLocalProperties": [],
      "accessibilityEvidence": {
        "manifest": ".local/evidence/accessibility-manifest.json",
        "scenarioId": "module.control.example.keyboard",
        "resultId": "module.control.example.keyboard.passed",
        "build": {
          "head": "generated-candidate-commit",
          "trackedFrontendDiffSha256": "generated-diff-hash"
        }
      },
      "visualEvidence": {
        "manifest": ".local/evidence/visual-manifest.json",
        "scenarioId": "module.control.example.light.default",
        "captureId": "module.control.example.light.default.component",
        "build": {
          "head": "generated-candidate-commit",
          "trackedFrontendDiffSha256": "generated-diff-hash"
        }
      }
    }
  ]
}
```

표시된 값은 스키마 자리표시자이며 유효한 증거가 아닙니다. 완전한 매핑은 선택한 대응 계약에서 생성됩니다. 한 행만 있는 발췌는 그 자체로 유효한 예외가 아닙니다. 도구가 소스 해시와 계약 해시를 생성합니다. 소스 해시나 대응 계약 해시가 바뀌면 검토는 무효가 됩니다.

이 페이지는 규범 필드를 정의하지만 JSON Schema는 아닙니다. 문서 검사기는 이 예제가 필수 형태를 유지하는지만 증명합니다. 모듈 컴플라이언스 구현은 실제 계약을 선택한 테마 매니페스트로 검증하고, 해시와 완전한 속성 집합을 확인하며, 모든 증거 참조가 동일 후보 빌드의 이름이 지정된 통과 결과 또는 캡처로 해석되는지 검사해야 합니다. 공개 `@wippy-fe/*` 0.0.56 패키지군은 모듈 컴플라이언스 CLI를 제공하지 않습니다. 접근성 증거는 컴포넌트 `sourceSha256`, 해시된 파일, 예상치 못한 콘솔 오류 0건, 통과 결과를 결합합니다. 시각적 증거는 정식 전/후/차이 파일, 해시, 재계산한 측정값과 판정, 일치하는 후보 빌드를 결합합니다. 문자열, 누락 파일, 누락된 시나리오/결과/캡처, 오래된 빌드 해시, `pending`, 검토되지 않은 결과는 증거 요구 사항을 만족하지 않습니다.

`platformInvariantUtilities`와 `moduleLocalProperties`는 비어 있을 수 있습니다. 계약 필드를 채우기 위해 `gap-2`, `w-10`, `rounded-md` 또는 다른 고정 유틸리티를 임의로 만들지 마세요. 특히 선택한 대응 계약에서 너비, 높이, 반경, 포커스 기하, 모션을 `shared-runtime`으로 분류한다면 ToggleSwitch 대응 컨트롤이 이를 불변으로 다시 표시할 수 없습니다.

대응 매니페스트는 속성을 다음과 같이 분류합니다.

- `shared-runtime`: 모든 커스텀 대응 컨트롤이 게시된 토큰 또는 런타임 기반 의미 유틸리티를 매핑하고 사용합니다.
- `platform-invariant`: 이 정확한 속성에만 고정 값을 허용합니다.
- `implementation-private`: PrimeVue 내부 구현 메커니즘은 커스텀 대응 컨트롤의 요구 사항이 되지 않습니다.

필요한 런타임 의미 요소가 없다면 먼저 공유 테마 계약을 수정하세요. 현재 대응 컴포넌트의 크기를 복사하거나 토큰 이름을 만들어 내지 마세요.

`sharedAppearanceMappings`는 예시가 아니라 완전한 목록입니다. 선택한 대응 계약의 모든 `shared-runtime` 속성마다 정확히 하나의 매핑을 포함하고, 다른 속성 ID는 포함하지 않습니다. 또한 계약 부분, 안정적인 모듈 선택자, 게시된 정확한 소스 종류와 이름을 담습니다. 선택한 컴플라이언스 구현은 선택자, 부분, CSS 속성, 게시된 소스를 사용해 PostCSS로 매핑 구조를 증명해야 합니다. 주석이나 무관한 선택자에 토큰 이름이 있다고 인정되지 않습니다. Tailwind 기반 매핑은 고유하고 정확한 `utilityClasses`도 기록하며, 정규화 후 그 집합은 선택한 대응 계약의 소스 집합과 같아야 합니다. `platformInvariantUtilities`는 유틸리티가 선택한 대응 계약 소스와 같은 `{ "contractProperty": "...", "utility": "..." }` 레코드를 포함합니다. `moduleLocalProperties`가 비어 있지 않다면 자유 형식 CSS 묶음이 아니라 구조화된 속성 ID와 검토 사유를 포함합니다.

하나의 예외를 위해 공유 `@wippy-fe/ui` 패키지를 만들지 않습니다. 서로 독립적인 두 번째 소비자가 동일한 동작과 이식성 요구 사항을 입증한 뒤에야 승격 대상이 될 수 있습니다.
