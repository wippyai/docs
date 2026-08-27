---
title: "프런트엔드 컴플라이언스 및 게시 게이트"
description: "규범적 프런트엔드 컴플라이언스 규칙, 검사기 소유권, 게시 게이트, 결정론적 시각 증거 요구 사항입니다."
---

# 프런트엔드 컴플라이언스 및 게시 게이트

**분류: 규범적 컴플라이언스 및 증거 레퍼런스.** JSON 블록은 자리표시자가 포함된 검사기 입력 형태를 정의하며 통과 증거나 독립 실행형 애플리케이션 픽스처가 아닙니다.

이 페이지가 아래의 결정론적 검사기 및 게시 요구 사항을 소유합니다. [이식 가능한 UI 계약](../portable-ui-contract.md)은 기반 이식성 및 UI 규칙 문장을 소유하고, 링크된 가이드는 자세한 구현 지침을 제공합니다. 인덱스는 각 규칙을 원본과 필수 검사 결과에 매핑합니다.

공개 `@wippy-fe/*` 0.0.56 패키지군은 모듈 컴플라이언스 CLI를 제공하지 않습니다. 저장소 문서 검사기는 문서 예제와 생성 카탈로그의 최신 상태를 검증합니다. 모듈이 선택한 컴플라이언스 워크플로는 아래 애플리케이션 대상 검사를 구현해야 합니다.

| 규칙 | 상세 지침 | 결정론적 결과 |
|---|---|---|
| FE-PORT-001 | [이식 가능한 UI 계약](../portable-ui-contract.md) | 비공개 이식성 가정 거부 |
| FE-UI-001 | [이식 가능한 UI 계약](../portable-ui-contract.md) | 원시 또는 직접 만든 표준 컨트롤 거부 |
| FE-UI-002 | [이식 가능한 UI 계약](../portable-ui-contract.md) | 어포던스 분석 요구 |
| FE-UI-003 | [이식 가능한 UI 계약](../portable-ui-contract.md) | 대응 계약과 대체 테마 증거 요구 |
| FE-UI-004 | [이식 가능한 UI 계약](../portable-ui-contract.md) | 컨트롤이 있으면 PrimeVue 설정 요구 |
| FE-UI-005 | [이식 가능한 UI 계약](../portable-ui-contract.md) | 임의로 만든 props 및 API 거부 |
| FE-TW-001 | [Tailwind 계약](./tailwind-contract.md) | 선택한 Wippy 프리셋 해석 |
| FE-TW-002 | [Tailwind 계약](./tailwind-contract.md) | 런타임 값으로 문서화한 컴파일 시점 값 거부 |
| FE-TW-003 | [Tailwind 계약](./tailwind-contract.md) | 불변 분류가 없는 고정 대응 값 거부 |
| FE-TW-004 | [Tailwind 계약](./tailwind-contract.md) | 보호된 매핑 재정의 거부 |
| FE-TOKEN-001 | [토큰 카탈로그](./token-catalogue.md) | 선언되지 않은 `--p-*` 참조 거부 |
| FE-TOKEN-002 | [토큰 카탈로그](./token-catalogue.md) | 추론하거나 임의로 만든 토큰 이름 거부 |
| FE-STYLE-001 | [테마 작성](./theming.md) | 비공개 facade 클래스와 모듈 로컬 `.p-*` 테마 거부 |
| FE-A11Y-001 | [이식 가능한 UI 계약](../portable-ui-contract.md) | 유효하지 않거나 접근 불가능한 커스텀 컨트롤 거부 |

## 필수 검사기 그룹

- PostCSS로 토큰 CSS를 파싱하고 생성 토큰 스냅샷을 바이트 단위로 비교합니다.
- 실제 Tailwind 설정을 해석하고 대표 유틸리티를 컴파일합니다.
- 출력 선언을 런타임 변수, 컴파일 상수, 임의 리터럴 또는 내부/임시 값으로 분류합니다.
- 원시 컨트롤, 누락된 PrimeVue 설정, 보호 매핑 재정의, 선언되지 않은 토큰, 비공개 facade 의존성, 계약 해시 드리프트를 거부합니다.
- Import-map externals를 고정된 전체 스냅샷과 비교합니다.
- 빌드 출력을 설정된 레지스트리와 제공 자산에 대해 검사합니다.
- 테마 전환은 `host.setThemeMode()`를 사용하고 전파된 AppConfig 상태를 검증합니다. 테마 클래스 직접 조작과 내부 프록시 연결은 거부합니다.
- 생성 카탈로그의 출처, 버전 튜플, 소스 해시를 검사합니다.
- 복사 가능한 예제를 파싱하고 해당하는 경우 빌드하며 중첩된 대화형 콘텐츠를 검사합니다.
- 프로젝트 종속 모드는 정확히 `UNSUPPORTED`를 반환하고 표준 CI가 실패합니다.

Promptmap은 단서를 생성할 수 있지만 토큰 존재, 유틸리티 해석, 도달 가능성 또는 삭제의 증거가 아닙니다.

## 생성 게시 게이트

생성된 토큰과 Tailwind 섹션에는 게시 시 pending 마커가 없어야 합니다. 새 런타임 토큰마다 실제 Wippy CSS 소비자, computed-style 변경 테스트, 문서화된 이식 가능 소비자 목적이 필요합니다.

게시할 때 런타임 증거는 저장소 밖에 둡니다. 다음을 설정하세요.

- `WIPPY_THEME_ROOT`: 선택한 `@wippy-fe/theme` 패키지
- `WIPPY_FE_EVIDENCE_ROOT`: `runtime-acceptance-evidence.json`, `visual-evidence-index.json`, 상대 시나리오 매니페스트, 스크린샷이 있는 릴리스 증거 디렉터리
- `WIPPY_FE_RUNTIME_EVIDENCE_SHA256`: 정확한 `runtime-acceptance-evidence.json` 바이트의 소문자 SHA-256

위의 네 변수를 모두 설정한 뒤 Wippy Docs 저장소 루트에서 Node.js 22 이상으로 게시 검사를 실행합니다. PowerShell에서는 다음과 같습니다.

```powershell
$env:FRONTEND_DOCS_PUBLICATION = '1'
node scripts/check-frontend-docs.mjs
Remove-Item Env:FRONTEND_DOCS_PUBLICATION
```

POSIX 셸에서는 다음과 같습니다.

```sh
FRONTEND_DOCS_PUBLICATION=1 node scripts/check-frontend-docs.mjs
```

이 검사는 선택한 테마의 정식 수용 검사기를 증거 경로 및 해시와 함께 호출한 뒤 시각적 증거를 검증하고 재계산합니다. 일반 문서 최신성 검사에는 로컬 릴리스 증거가 필요하지 않습니다.

## 결정론적 시각 검증

외형 변경의 영향을 받는 모든 컴포넌트에는 시나리오 매니페스트와 변경할 수 없는 전/후/차이 증거가 있습니다. 기준과 후보는 동일한 브라우저 빌드, 기기 픽셀 비율, 글꼴, 픽스처 데이터, 테마, 뷰포트, 모션 감소 설정, 안정화 규칙을 사용합니다. 밝게/어둡게 테마, 상호작용 상태, 오버레이, 비활성/오류 상태, 제품이 지원하는 데스크톱 레이아웃을 포함한 모든 해당 상태를 캡처합니다. 데스크톱 전용 제품에 좁은 화면/모바일 요구 사항을 임의로 만들지 마세요.

각 시나리오는 컴포넌트 크롭과 주변 애플리케이션 컨텍스트를 캡처합니다. 오버레이, overflow 또는 페이지 레이아웃에 영향을 줄 수 있다면 전체 페이지도 캡처합니다. 컴포넌트 인덱스는 해당하는 전체 행렬을 선언하고 시나리오마다 변경 불가능한 매니페스트 하나를 가리킵니다.

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

검사기는 applicability의 곱집합을 펼치고 선언된 테마, 뷰포트, 상태에 고유 시나리오가 없으면 실패합니다. `overlay`가 true이면 모든 시나리오에 `full-page` 캡처 범위도 필요합니다. 최종 빌드 커밋과 해시는 모든 시나리오 후보와 일치해야 하며 `recapturedAfterBuild`는 true여야 합니다.

각 시나리오 매니페스트는 파일 이름을 신뢰하는 대신 해시를 기록합니다.

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

위 값은 필수 형태를 보여 줄 뿐 유효한 증거가 아닙니다. 변경된 컴포넌트나 필수 상태에 시나리오가 없거나, 필수 캡처 범위가 없거나, 참조 이미지 또는 해시가 누락되거나, 빌드가 오래되었거나, 예상치 못한 콘솔 오류가 남아 있거나, 임시 픽스처 코드가 남아 있거나, 검토된 디자인 면제 없이 차이가 허용치를 넘으면 게시가 실패합니다. 면제에는 정확히 변경된 픽셀, 디자인 사유, 검토자, 영향받는 시나리오가 기록되어야 합니다. 누락된 캡처, 콘솔 오류, 픽스처 정리는 면제할 수 없습니다.
