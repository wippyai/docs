---
title: "부트로더"
description: "wippy/bootloader를 사용하여 시작 시 정해진 순서에 따라 애플리케이션 초기화 함수를 탐색하고 실행합니다."
---

# 부트로더

`wippy/bootloader` 모듈은 시작 시 정해진 순서에 따라 애플리케이션 초기화 함수를 탐색하고 실행합니다. 프레임워크 모듈은 암호화 키 설정이나 데이터베이스 마이그레이션 같은 작업에 부트로더를 사용합니다.

이 페이지는 부분적인 통합 레시피이자 API 참조이며, 독립 실행형 애플리케이션이 아닙니다. 아래 정의는 구조적으로 완전하지만 `apply_seed()`는 실제 시드 작업과 멱등성 검사를 구현해야 하는 애플리케이션 코드를 나타냅니다. 영구 데이터의 정리나 되돌리기 역시 해당 애플리케이션 작업에 따라 달라집니다.

## 설정

프로젝트에 모듈을 추가합니다:

```bash
wippy add wippy/bootloader
wippy install
```

의존성과 필요한 애플리케이션 호스트를 선언합니다:

```yaml
version: "1.0"
namespace: app

entries:
  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: os_env
    kind: env.storage.os

  - name: dep.bootloader
    kind: ns.dependency
    component: wippy/bootloader
    version: "*"
    parameters:
      - name: application_host
        value: app:processes
      - name: env_storage
        value: app:os_env
```

이 의존성은 `auto_start: true`인 `process.service`, 즉 `wippy.bootloader:bootloader.service`를 활성화합니다.

## 동작 방식

시작 시 부트로더는 다음을 수행합니다:

1. 레지스트리에서 `meta.type: bootloader`를 가진 모든 엔트리를 탐색합니다.
2. `meta.order` 오름차순으로 정렬합니다(가장 낮은 것이 먼저).
3. 각각을 Lua 함수로 순차적으로 실행합니다.
4. `status = "error"`를 반환하는 첫 번째 오류에서 중단합니다.
5. 완료 시 총계 / 성공 / 실패 / 건너뜀 카운트를 보고합니다.

각 부트로더는 자체 조건을 확인하고 작업을 수행한 뒤 구조화된 결과를 보고합니다.

## 부트로더 정의

부트로더는 `meta.type: bootloader`를 가진 모든 `function.*` 엔트리입니다. 대부분의 애플리케이션 부트로더는 `function.lua`를 사용합니다:

```yaml
- name: seed_defaults
  kind: function.lua
  meta:
    type: bootloader
    order: 50
    description: Seed default rows for a new install
  source: file://seed_defaults.lua
  method: run
  modules:
    - logger
  imports:
    sql: :sql
```

| 필드 | 필수 | 설명 |
|-------|----------|-------------|
| `meta.type` | 예 | `bootloader`여야 함 |
| `meta.order` | 아니오 | 실행 순서(기본값 `999`); 낮은 값이 먼저 실행됨 |
| `meta.description` | 아니오 | 사람이 읽을 수 있는 요약 |
| `meta.requires` | 아니오 | 부트로더 또는 서비스 ID 하나나 배열. 이전 부트로더는 `success` 또는 `skipped`를 반환해야 하고, 서비스 의존성은 레지스트리에 존재해야 합니다. 충족되지 않은 의존성이 있으면 남은 시퀀스를 중단합니다. |

의존성 유형은 참조된 레지스트리 엔트리에서 결정됩니다. `meta.type: bootloader`는 부트로더를 나타내며, 그 밖의 확인된 엔트리는 서비스로 처리됩니다. ID를 확인할 수 없으면 점으로 구분된 네임스페이스는 부트로더 ID로, 그 밖의 콜론 한정 ID는 서비스 ID로 간주합니다. 서비스 검사는 500ms 간격으로 최대 20회 기다리지만 런타임 상태가 아니라 레지스트리 존재 여부만 확인합니다.

### 반환 계약

`method`는 결과를 설명하는 테이블을 반환합니다:

```lua
local function run()
    local ok, err = apply_seed()
    if err then
        return {
            status = "error",
            message = "seed failed: " .. tostring(err)
        }
    end

    if not ok then
        return {
            status = "skipped",
            message = "already seeded"
        }
    end

    return {
        status = "success",
        message = "seeded default rows"
    }
end

return { run = run }
```

| 상태 | 의미 |
|--------|---------|
| `success` | 작업 완료 |
| `skipped` | 작업 없음(이미 완료됨, 사전 조건 미충족) |
| `error` | 실패 -- 부팅 시퀀스 중단 |

Lua 오류를 발생시키거나 실행 오류 또는 테이블이 아닌 값을 반환하는 부트로더는 `error` 결과로 변환됩니다. 오케스트레이터는 `duration`을 측정하여 덮어쓰며, 반환된 `details` 값은 로그에 남기기 위해 보존합니다.

세 가지 상태 문자열을 정확히 사용하세요. 다른 값은 `UNKNOWN`으로 기록되고 상태 카운터에 포함되지 않으며, 현재는 이후 부트로더의 실행을 중단하지 않습니다.

## 실행 순서

낮은 `order` 값이 먼저 실행됩니다. 인프라용으로 낮은 순서를 예약하세요:

| 순서 | 일반적인 용도 |
|-------|-------------|
| `10` | 시크릿 및 암호화 키(모듈에서 제공) |
| `20` | 스키마 마이그레이션(`wippy/migration`에서 제공) |
| `50` | 데이터 시딩, 검색 인덱스 워밍업 |
| `100` | 애플리케이션 수준 작업(관례) |

두 부트로더의 순서가 같으면 완전 수식 엔트리 ID의 알파벳순으로 실행됩니다.

## 내장 부트로더

### 암호화 키(순서 `10`)

32바이트의 난수를 생성하고 64자 16진수 `ENCRYPTION_KEY`로 인코딩한 다음, 값이 없으면 구성된 `env_storage`를 통해 저장합니다. 변수가 이미 있으면 건너뜁니다.

### 마이그레이션 부트로더(순서 `20`)

`wippy/migration`에서 제공합니다. `meta.type: migration`인 모든 엔트리를 탐색하고 `meta.target_db`별로 그룹화한 뒤 대기 중인 마이그레이션을 적용합니다. [마이그레이션](./migration.md)을 참조하세요.

## 부트 상태 관찰

서비스는 먼저 탐색한 부트로더 수를 기록한 다음, 실행한 부트로더마다 엔트리 ID, 순서, 실행 시간과 함께 결과 한 줄(`SUCCESS`, `FAILED`, `SKIPPED`)을 기록합니다. 마지막 요약은 실행 수와 상태별 수를 보고합니다. 부트로더가 실패하면 이후 부트로더를 중단하고 오케스트레이터가 통계와 함께 `false`를 반환하지만, 그 자체로 Lua 프로세스 오류를 발생시키지는 않습니다.

<tip>
부트로더를 멱등하게 유지하세요. `bootloader.service`가 다시 시작될 때마다 다시 실행되므로, 작업 전에 사전 조건(행 존재, 파일 존재, env 변수 설정)을 확인하세요.
</tip>

## 참고

- [마이그레이션](./migration.md) - 마이그레이션 부트로더와 DSL
- [슈퍼비전](../guides/supervision.md) - 서비스 라이프사이클 및 재시작 정책
- [프레임워크 개요](./overview.md) - 프레임워크 모듈 사용법
