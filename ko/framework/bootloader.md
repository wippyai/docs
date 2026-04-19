# 부트로더

`wippy/bootloader` 모듈은 시작 시 정의된 순서로 부트로더 함수를 탐색하고 실행하여 애플리케이션 초기화를 조율합니다. 다른 프레임워크 모듈(마이그레이션, 암호화, 인덱스 갱신)은 자체 초기화 단계를 실행하기 위해 부트로더를 등록합니다.

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

부트로더 자체는 `wippy.bootloader:bootloader.service`(`auto_start: true`인 `process.service`)로 실행됩니다. 이를 활성화하기 위해 다른 것은 필요하지 않습니다.

## 동작 방식

시작 시 부트로더는 다음을 수행합니다:

1. 레지스트리에서 `meta.type: bootloader`를 가진 모든 엔트리를 탐색합니다.
2. `meta.order` 오름차순으로 정렬합니다(가장 낮은 것이 먼저).
3. 각각을 Lua 함수로 순차적으로 실행합니다.
4. `status = "error"`를 반환하는 첫 번째 오류에서 중단합니다.
5. 완료 시 총계 / 성공 / 실패 / 건너뜀 카운트를 보고합니다.

부트로더는 자율적입니다 -- 각각이 자신의 조건을 확인하고, 작업을 수행하며, 구조화된 결과를 보고합니다.

## 부트로더 정의

부트로더는 `meta.type: bootloader`를 가진 모든 `function.lua` 엔트리입니다:

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
| `meta.order` | 아니오 | 실행 순서(기본값 `100`); 낮은 값이 먼저 실행됨 |
| `meta.description` | 아니오 | 사람이 읽을 수 있는 요약 |
| `meta.requires` | 아니오 | 로그에 표시되는 의존성 힌트 |

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

Lua 오류를 발생시키는 부트로더는 `error`로 처리됩니다.

## 실행 순서

낮은 `order` 값이 먼저 실행됩니다. 인프라용으로 낮은 순서를 예약하세요:

| Order | 일반적인 용도 |
|-------|-------------|
| `10` | 시크릿 및 암호화 키(모듈에서 제공) |
| `20` | 스키마 마이그레이션(`wippy/migration`에서 제공) |
| `50` | 데이터 시딩, 검색 인덱스 워밍업 |
| `100` | 기본 -- 애플리케이션 레벨 작업 |

두 부트로더가 같은 순서를 공유하는 경우, 그들 사이의 실행 순서는 보장되지 않습니다.

## 내장 부트로더

### 암호화 키(순서 `10`)

256비트 `ENCRYPTION_KEY`를 생성하고 값이 없는 경우 구성된 `env_storage`를 통해 저장합니다. 다른 모듈(보안, 사용량 추적)은 envelope 암호화를 위해 이 변수를 읽습니다. 변수가 이미 존재하는 경우 건너뜁니다.

### 마이그레이션 부트로더(순서 `20`)

`wippy/migration`에서 제공됩니다. `meta.type: migration`을 가진 모든 엔트리를 탐색하고, `meta.target_db`별로 그룹화한 다음, 대기 중인 것을 적용합니다. [마이그레이션](migration.md)을 참조하세요.

## 부트 상태 관찰

서비스는 엔트리 ID, 순서, 소요 시간과 함께 부트로더당 한 줄(`SUCCESS`, `FAILED`, `SKIPPED`)을 로그에 기록합니다. 최종 요약 줄은 집계 카운트를 보고합니다. 실패한 부트로더는 시작을 중단합니다 -- 이후 슈퍼바이저의 재시작 정책이 `bootloader.service`에 적용됩니다.

<tip>
부트로더를 멱등하게 유지하세요. 충돌 재시작 후 다시 실행될 수 있으므로, 작업을 수행하기 전에 사전 조건(행 존재, 파일 존재, env 변수 설정됨)을 확인하세요.
</tip>

## 참고

- [마이그레이션](migration.md) - 마이그레이션 부트로더와 DSL
- [슈퍼비전](../guides/supervision.md) - 서비스 라이프사이클 및 재시작 정책
- [프레임워크 개요](overview.md) - 프레임워크 모듈 사용법
