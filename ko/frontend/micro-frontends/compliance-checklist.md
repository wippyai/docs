---
title: "프론트엔드 준수 규칙 색인"
description: "정식 프론트엔드 규칙과 결정적 검사기 소유권에 대한 간결한 색인."
---

# 프론트엔드 준수 규칙 색인

이 페이지는 색인이며 계약의 두 번째 사본이 아닙니다. 규범적 규칙 서술은
[이식 가능 UI 계약](../portable-ui-contract.md)이 소유하며, 아래 링크는 상세한
구현 지침을 제공합니다.

| 규칙 | 상세 지침 | 결정적 결과 |
|---|---|---|
| FE-PORT-001 | [이식 가능 UI 계약](../portable-ui-contract.md) | 비공개 이식성 가정 거부 |
| FE-UI-001 | [이식 가능 UI 계약](../portable-ui-contract.md) | 원시 또는 직접 만든 표준 컨트롤 거부 |
| FE-UI-002 | [이식 가능 UI 계약](../portable-ui-contract.md) | 어포던스 분석 요구 |
| FE-UI-003 | [이식 가능 UI 계약](../portable-ui-contract.md) | 형제 계약 및 대체 테마 증거 요구 |
| FE-UI-004 | [이식 가능 UI 계약](../portable-ui-contract.md) | 컨트롤이 존재할 때 PrimeVue 설정 요구 |
| FE-UI-005 | [이식 가능 UI 계약](../portable-ui-contract.md) | 임의로 만든 props와 API 거부 |
| FE-TW-001 | [Tailwind 계약](./tailwind-contract.md) | 선택된 Wippy 프리셋 해석 |
| FE-TW-002 | [Tailwind 계약](./tailwind-contract.md) | 런타임으로 문서화된 컴파일 타임 값 거부 |
| FE-TW-003 | [Tailwind 계약](./tailwind-contract.md) | 불변성 분류 없는 고정 형제 값 거부 |
| FE-TW-004 | [Tailwind 계약](./tailwind-contract.md) | 보호된 매핑 오버라이드 거부 |
| FE-TOKEN-001 | [토큰 카탈로그](./token-catalogue.md) | 선언되지 않은 `--p-*` 참조 거부 |
| FE-TOKEN-002 | [토큰 카탈로그](./token-catalogue.md) | 추론되거나 임의로 만든 토큰 이름 거부 |
| FE-STYLE-001 | [테마 작성](./theming.md) | 비공개 파사드 클래스와 모듈 로컬 `.p-*` 테마 적용 거부 |
| FE-A11Y-001 | [이식 가능 UI 계약](../portable-ui-contract.md) | 유효하지 않거나 접근 불가능한 커스텀 컨트롤 거부 |

## 필수 검사기 그룹

- 토큰 CSS를 PostCSS로 파싱하고, 생성된 토큰 스냅샷을 바이트 단위로 비교합니다.
- 실제 Tailwind 구성을 해석하고 대표 유틸리티를 컴파일합니다.
- 방출된 선언을 런타임 변수, 컴파일 상수, 임의 리터럴, 내부/일시적 값으로 분류합니다.
- 원시 컨트롤, 누락된 PrimeVue 설정, 보호된 매핑 오버라이드, 선언되지 않은 토큰, 비공개 파사드 의존성, 계약 해시 표류를 거부합니다.
- 임포트 맵 외부 모듈을 완전한 핀 고정 스냅샷과 비교합니다.
- 빌드 산출물을 구성된 레지스트리 및 서빙되는 애셋과 대조하여 검사합니다.
- 테마 전환은 `host.setThemeMode()`를 사용하고 전파된 AppConfig 상태를 검증합니다.
  테마 클래스 직접 조작과 내부 프록시 배선은 거부됩니다.
- 생성된 카탈로그에 대해 출처, 버전 튜플, 소스 해시를 검사합니다.
- 복사 가능한 예제를 파싱하고, 해당하는 경우 빌드하며, 중첩된 인터랙티브 콘텐츠가 있는지 검사합니다.
- 프로젝트 종속 모드는 정확히 `UNSUPPORTED`를 반환하며 표준 CI가 실패합니다.

Promptmap은 단서를 만들어낼 수 있습니다. 토큰의 존재, 유틸리티 해석, 도달 가능성, 삭제에 대한 증거는 아닙니다.

## 생성 결과물의 게시 게이트

생성된 토큰 및 Tailwind 섹션에는 게시 시점에 보류 표시가 남아 있으면 안 됩니다. 모든 새 런타임 토큰에는 실제 Wippy CSS 소비자, 계산 스타일 변형 테스트, 문서화된 이식 가능 소비자 목적이 필요합니다.

게시는 런타임 증거를 저장소 밖에 둡니다. 다음을 설정하세요:

- `WIPPY_THEME_ROOT`: 선택된 `@wippy-fe/theme` 패키지.
- `WIPPY_FE_EVIDENCE_ROOT`: `runtime-acceptance-evidence.json`,
  `visual-evidence-index.json`, 그에 대응하는 상대 시나리오 매니페스트,
  스크린샷이 들어 있는 릴리스 증거 디렉터리.
- `WIPPY_FE_RUNTIME_EVIDENCE_SHA256`: `runtime-acceptance-evidence.json` 바이트
  그대로의 소문자 SHA-256.

`FRONTEND_DOCS_PUBLICATION=1 node scripts/check-frontend-docs.mjs`는 선택된
테마의 정식 수용 검사기를 그 증거 경로와 해시로 호출한 뒤, 시각적 증거를
검증하고 다시 계산합니다. 일반적인 문서 최신성 검사에는 로컬 릴리스 증거가
필요하지 않습니다.

## 결정적 시각 검증

외관 변경의 영향을 받는 모든 컴포넌트에는 시나리오 매니페스트와 변경 불가능한
before/after/diff 증거가 있습니다. 베이스라인과 후보는 동일한 브라우저 빌드,
디바이스 픽셀 비율, 폰트, 픽스처 데이터, 테마, 뷰포트, 모션 감소 설정, 안정화
규칙을 사용합니다. 라이트·다크 테마, 인터랙션 상태, 오버레이,
비활성/오류 상태, 제품이 지원하는 데스크톱 레이아웃을 포함해 해당하는 모든
상태를 캡처하세요. 데스크톱 전용 제품에 좁은 화면/모바일 요구 사항을 임의로
만들지 마세요.

각 시나리오는 컴포넌트 크롭과 주변 애플리케이션 컨텍스트를 캡처합니다. 또한
오버레이, 오버플로, 페이지 레이아웃이 영향을 받을 수 있을 때는 전체 페이지도
캡처합니다. 컴포넌트 색인은 해당하는 전체 매트릭스를 선언하고 시나리오당 하나의
변경 불가능한 매니페스트를 가리킵니다:

```json
{
  "schemaVersion": "1.0.0",
  "componentId": "module.component",
  "applicability": {
    "themes": ["light", "dark"],
    "viewports": [{ "id": "desktop", "width": 1440, "height": 900 }],
    "states": ["default"],
    "overlay": false
  },
  "finalBuild": {
    "candidateCommit": "generated-candidate-commit",
    "candidateBuildHash": "sha256:generated-candidate-build-hash",
    "recapturedAfterBuild": true
  },
  "scenarios": [
    {
      "scenarioId": "module.component.light.default",
      "theme": "light",
      "viewport": "desktop",
      "state": "default",
      "manifest": "scenarios/module.component.light.default.json"
    },
    {
      "scenarioId": "module.component.dark.default",
      "theme": "dark",
      "viewport": "desktop",
      "state": "default",
      "manifest": "scenarios/module.component.dark.default.json"
    }
  ]
}
```

검사기는 해당성 교차곱을 전개하고, 선언된 테마·뷰포트·상태 중 고유한 시나리오가
없는 것이 있으면 실패합니다. `overlay`가 true이면 모든 시나리오에 `full-page`
캡처 범위도 필요합니다. 최종 빌드의 커밋과 해시는 모든 시나리오의 후보와
일치해야 하며 `recapturedAfterBuild`는 true여야 합니다.

각 시나리오 매니페스트는 파일 이름을 신뢰하는 대신 해시를 기록합니다:

```json
{
  "schemaVersion": "1.0.0",
  "scenarioId": "module.component.light.default",
  "componentId": "module.component",
  "state": {
    "theme": "light",
    "viewport": { "width": 1440, "height": 900 },
    "interaction": "default"
  },
  "runtime": {
    "browserVersion": "pinned-browser-version",
    "devicePixelRatio": 1,
    "fontsHash": "sha256:generated-font-set-hash",
    "fixtureHash": "sha256:generated-fixture-hash"
  },
  "baseline": {
    "commit": "generated-baseline-commit",
    "buildHash": "sha256:generated-baseline-build-hash"
  },
  "candidate": {
    "commit": "generated-candidate-commit",
    "buildHash": "sha256:generated-candidate-build-hash",
    "recapturedAfterBuild": true
  },
  "requiredScopes": ["component", "context"],
  "captures": [
    {
      "scope": "component",
      "before": {
        "artifactId": "component-before",
        "path": "screenshots/component-before.png",
        "sha256": "sha256:generated-before-hash"
      },
      "after": {
        "artifactId": "component-after",
        "path": "screenshots/component-after.png",
        "sha256": "sha256:generated-after-hash"
      },
      "diff": {
        "artifactId": "component-diff",
        "path": "screenshots/component-diff.png",
        "sha256": "sha256:generated-diff-hash"
      }
    },
    {
      "scope": "context",
      "before": {
        "artifactId": "context-before",
        "path": "screenshots/context-before.png",
        "sha256": "sha256:generated-before-hash"
      },
      "after": {
        "artifactId": "context-after",
        "path": "screenshots/context-after.png",
        "sha256": "sha256:generated-after-hash"
      },
      "diff": {
        "artifactId": "context-diff",
        "path": "screenshots/context-diff.png",
        "sha256": "sha256:generated-diff-hash"
      }
    }
  ],
  "diff": {
    "changedPixels": 0,
    "totalPixels": 1296000,
    "changedRatio": 0,
    "pixelDeltaThreshold": 8,
    "changedRatioThreshold": 0.001,
    "disposition": "within-threshold",
    "result": "passed",
    "waiver": null
  },
  "console": { "unexpectedErrors": [] },
  "fixtureCleanup": { "temporaryArtifactsRemaining": [], "verified": true }
}
```

위 값들은 필요한 형태를 보여줄 뿐 유효한 증거가 아닙니다. 변경된 컴포넌트나
필수 상태에 시나리오가 없거나, 필수 캡처 범위가 빠졌거나, 참조된 이미지나 해시가
없거나, 빌드가 오래되었거나, 예상치 못한 콘솔 오류가 남아 있거나, 임시 픽스처
코드가 남아 있거나, 검토된 디자인 면제 없이 diff가 허용치를 초과하면 게시가
실패합니다. 면제는 정확한 변경 픽셀 수, 디자인 사유, 검토자, 영향받는 시나리오를
기록합니다. 누락된 캡처, 콘솔 오류, 픽스처 정리는 면제할 수 없습니다.
