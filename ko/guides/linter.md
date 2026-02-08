# 린터

Wippy에는 Lua 코드에 대한 타입 검사 및 정적 분석을 수행하는 내장 린터가 포함되어 있습니다. `wippy lint`로 실행합니다.

## 사용법

```bash
wippy lint                        # Check all Lua entries
wippy lint --level hint           # Show all diagnostics including hints
wippy lint --json                 # Output in JSON format
wippy lint --ns app               # Check only the app namespace
wippy lint --summary              # Group results by error code
```

## 검사 대상

린터는 모든 Lua 엔트리 종류를 검증합니다:

- `function.lua.*` - 함수
- `library.lua.*` - 라이브러리
- `process.lua.*` - 프로세스
- `workflow.lua.*` - 워크플로우

각 엔트리는 파싱, 타입 검사, 정확성 분석을 거칩니다.

## 심각도 수준

진단에는 세 가지 심각도 수준이 있습니다:

| 수준 | 설명 |
|------|------|
| `error` | 반드시 수정해야 하는 타입 오류 및 정확성 문제 |
| `warning` | 버그 가능성이 있거나 문제가 될 수 있는 패턴 |
| `hint` | 스타일 제안 및 정보성 참고 사항 |

`--level`로 표시할 수준을 제어합니다:

```bash
wippy lint --level error          # Errors only
wippy lint --level warning        # Warnings and errors (default)
wippy lint --level hint           # Everything
```

## 오류 코드

### 파싱 오류

| 코드 | 설명 |
|------|------|
| `P0001` | Lua 구문 오류 - 소스를 파싱할 수 없음 |

### 타입 검사 오류 (E 시리즈)

타입 검사 오류(`E0001`+)는 타입 시스템이 발견한 문제를 보고합니다: 타입 불일치, 정의되지 않은 변수, 잘못된 연산 등의 정확성 문제입니다. 이들은 항상 오류로 보고됩니다.

```lua
local x: number = "hello"         -- E: string not assignable to number

local function add(a: number, b: number): number
    return a + b
end

add("one", "two")                  -- E: string not assignable to number
```

### 린트 규칙 경고 (W 시리즈)

린트 규칙은 코드 스타일과 품질 검사를 제공합니다. `--rules`로 활성화합니다:

```bash
wippy lint --rules
```

| 코드 | 규칙 | 설명 |
|------|------|------|
| `W0001` | no-empty-blocks | 빈 블록문 |
| `W0002` | no-global-assign | 전역 변수에 대한 할당 |
| `W0003` | no-self-compare | 값의 자기 자신과 비교 |
| `W0004` | no-unused-vars | 사용되지 않는 지역 변수 |
| `W0005` | no-unused-params | 사용되지 않는 함수 매개변수 |
| `W0006` | no-unused-imports | 사용되지 않는 임포트 |
| `W0007` | no-shadowed-vars | 외부 스코프의 변수를 가림 |

`--rules` 없이는 타입 검사(P 및 E 코드)만 수행됩니다.

## 필터링

### 네임스페이스별

`--ns`를 사용하여 특정 네임스페이스를 검사합니다:

```bash
wippy lint --ns app               # Exact namespace match
wippy lint --ns "app.*"           # All under app
wippy lint --ns app --ns lib      # Multiple namespaces
```

선택된 엔트리의 의존성은 타입 검사를 위해 로드되지만 해당 진단은 보고되지 않습니다.

### 오류 코드별

코드별로 진단을 필터링합니다:

```bash
wippy lint --code E0001
wippy lint --code E0001 --code E0004
```

### 개수별

표시되는 진단 수를 제한합니다:

```bash
wippy lint --limit 10             # Show first 10 issues
```

## 출력 형식

### 테이블 형식 (기본값)

각 진단은 소스 컨텍스트, 파일 위치, 오류 메시지와 함께 표시됩니다. 결과는 엔트리, 심각도, 줄 번호순으로 정렬됩니다.

요약 줄에 합계가 표시됩니다:

```
Checked 42 entries: 5 errors, 12 warnings
```

### 요약 형식

네임스페이스 및 오류 코드별로 진단을 그룹화합니다:

```bash
wippy lint --summary
```

```
By namespace:

  app                              15 issues (5 errors, 10 warnings)
  lib                               2 issues (2 warnings)

By error code:

  E0001      [error  ]    5 occurrences
  E0004      [error  ]    3 occurrences

Checked 42 entries: 5 errors, 12 warnings
```

### JSON 형식

CI/CD 통합을 위한 기계 판독 가능 출력:

```bash
wippy lint --json
```

```json
{
  "diagnostics": [
    {
      "entry_id": "app:handler",
      "code": "E0001",
      "severity": "error",
      "message": "string not assignable to number",
      "line": 10,
      "column": 5
    }
  ],
  "total_entries": 42,
  "error_count": 5,
  "warning_count": 12,
  "hint_count": 0
}
```

## 캐싱

린터는 반복 실행 속도를 높이기 위해 결과를 캐싱합니다. 캐시 키는 소스 코드 해시, 메서드 이름, 의존성, 타입 시스템 구성을 기반으로 합니다.

결과가 오래된 것 같으면 캐시를 지웁니다:

```bash
wippy lint --cache-reset
```

## CI/CD 통합

자동화된 검사를 위해 JSON 출력과 종료 코드를 사용합니다:

```bash
wippy lint --json --level error > lint-results.json
```

린터는 오류가 발견되지 않으면 종료 코드 0으로, 오류가 있으면 0이 아닌 코드로 종료합니다.

GitHub Actions 단계 예시:

```yaml
- name: Lint
  run: wippy lint --level warning
```

## 플래그 참조

| 플래그 | 축약 | 기본값 | 설명 |
|--------|------|--------|------|
| `--level` | | warning | 최소 심각도 수준 (error, warning, hint) |
| `--json` | | false | JSON 형식으로 출력 |
| `--ns` | | | 네임스페이스 패턴으로 필터링 |
| `--code` | | | 오류 코드로 필터링 |
| `--limit` | | 0 | 표시할 최대 진단 수 (0 = 무제한) |
| `--summary` | | false | 오류 코드별 그룹화 |
| `--no-color` | | false | 색상 출력 비활성화 |
| `--rules` | | false | 린트 규칙 활성화 (W 시리즈 스타일/품질 검사) |
| `--cache-reset` | | false | 린팅 전 캐시 지우기 |
| `--lock-file` | `-l` | wippy.lock | 잠금 파일 경로 |

## 같이 보기

- [CLI](guides/cli.md) - 전체 CLI 참조
- [타입](lua/types.md) - 타입 시스템 문서
- [LSP](guides/lsp.md) - 실시간 진단을 통한 에디터 통합
