---
title: "커스텀 컴포지트"
description: "PrimeVue가 제공할 수 없는 어포던스를 요구하는 컨트롤에 대한 계약 우선 예외."
---

# 커스텀 컴포지트

커스텀 컨트롤은 예외이지 대체 컴포넌트 라이브러리가 아닙니다.

## 인정 기준

커스텀 컨트롤은 다음 조건을 모두 만족할 때만 허용됩니다:

1. PrimeVue가 의도한 시맨틱, 인터랙션, 어포던스를 제공하거나 조합할 수 없다.
2. 예외에 기각된 PrimeVue 조합들이 기록되어 있다.
3. 정확한 생성 PrimeVue 형제 계약과 계약 해시를 명시한다.
4. 그 형제 계약이 `shared-runtime`으로 분류한 모든 프로퍼티에 정확한 소스 매핑이 있다.
5. 고정 유틸리티는 형제 계약이 바로 그 프로퍼티를 `platform-invariant`로 분류할 때만 허용된다.
6. 새로운 지오메트리와 동작이 격리되고 문서화되어 있다.
7. 접근성과 시각적 증거가 통과한다.

데이터 형태의 동등성은 어포던스의 동등성이 아닙니다. 다중 옵션 `SelectButton`은 세 개의 값을 표현할 수 있지만, 슬라이딩 3단 토글처럼 보이거나 동작하지는 않습니다. 반대로 `ToggleSwitch`에 `positions` prop을 임의로 만들지 마세요. 어포던스 요구가 실재할 때에만 검토를 거친 커스텀 형제를 만드세요.

## 모듈 계약

검토된 예외는 모듈 루트의 `wippy-fe.contract.json`에 저장합니다:

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

여기 보인 값들은 스키마 자리표시자이지 유효한 증거가 아닙니다. 전체 매핑은
선택된 형제 계약으로부터 생성되며, 한 줄짜리 발췌는 그 자체로 유효한 예외가
아닙니다. 도구가 소스 해시와 계약 해시를 생성합니다. 소스 해시나 형제 계약
해시가 바뀌면 검토는 무효가 됩니다.

이 페이지는 규범적 필드를 정의하며, JSON 스키마가 아니고 문서 검사기는 이 예제가
필요한 형태를 유지하고 있음만 증명합니다. `wippy-fe-compliance`는 실제 모듈
계약을 선택된 테마 매니페스트에 대해 검증하고, 해시와 완전한 프로퍼티 집합을
확인하며, 모든 증거 참조가 동일한 후보 빌드의 명시된 통과 결과 또는 캡처로
해석되는지 검사합니다. 접근성 증거는 컴포넌트 `sourceSha256`, 해시된 파일,
예상치 못한 콘솔 오류 0건, 통과 결과를 결속합니다. 시각적 증거는 정식
before/after/diff 파일, 해시, 재계산된 지표와 처분, 그리고 일치하는 후보 빌드를
결속합니다. 문자열, 없는 파일, 없는 시나리오/결과/캡처, 오래된 빌드 해시,
`pending`, 검토되지 않은 결과는 증거 요건을 충족하지 않습니다.

`platformInvariantUtilities`와 `moduleLocalProperties`는 비어 있을 수 있습니다.
계약 필드를 비어 있지 않게 만들려는 목적만으로 `gap-2`, `w-10`, `rounded-md`
같은 고정 유틸리티를 임의로 만들지 마세요. 특히 ToggleSwitch 형제는, 선택된 형제
계약이 그 프로퍼티들을 `shared-runtime`으로 분류했다면 너비, 높이, 반경, 포커스
지오메트리, 모션을 불변으로 다시 라벨링할 수 없습니다.

형제 매니페스트는 프로퍼티를 다음과 같이 분류합니다:

- `shared-runtime`: 모든 커스텀 형제가 배포된 토큰 또는 런타임이 뒷받침하는
  시맨틱 유틸리티를 매핑하고 소비합니다.
- `platform-invariant`: 바로 이 프로퍼티에 한해 고정 값이 허용됩니다.
- `implementation-private`: PrimeVue 내부 메커니즘은 커스텀 형제의 요구 사항이
  되지 않습니다.

필요한 런타임 시맨틱이 존재하지 않는다면 공유 테마 계약을 먼저 고치세요. 현재 형제의 치수를 복사하거나 토큰 이름을 임의로 만들지 마세요.

`sharedAppearanceMappings`는 예시가 아니라 전수입니다. 선택된 형제 계약의 모든
`shared-runtime` 프로퍼티에 대해 정확히 하나의 매핑을 담으며, 추가 프로퍼티 ID는
없고, 계약 파트, 안정적인 모듈 셀렉터, 그리고 정확한 배포 소스 종류와 이름을
포함합니다. 준수 도구는 셀렉터, 파트, CSS 프로퍼티, 배포 소스를 사용해 PostCSS로
매핑을 구조적으로 증명합니다. 주석이나 무관한 셀렉터에 적힌 토큰 이름은 인정되지
않습니다. Tailwind가 뒷받침하는 매핑은 고유하고 정확한 `utilityClasses`도
기록합니다. 정규화 후 그 집합은 선택된 형제 계약의 소스 집합과 같아야 합니다.
`platformInvariantUtilities`는 유틸리티가 선택된 형제 계약 소스와 같은
`{ "contractProperty": "...", "utility": "..." }` 레코드를 담습니다.
`moduleLocalProperties`는 비어 있지 않을 때 자유 형식 CSS 뭉치가 아니라 구조화된
프로퍼티 ID와 검토 사유를 담습니다.

단일 예외를 위해 공유 `@wippy-fe/ui` 패키지를 만들지 않습니다. 두 번째 독립 소비자가 동일한 동작과 이식성 요구를 입증한 뒤에야 승격 대상이 됩니다.
