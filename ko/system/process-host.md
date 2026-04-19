# 프로세스 호스트

프로세스 호스트는 작업 스틸링 스케줄러를 사용하여 Lua 프로세스 실행을 관리합니다.

<note>
각 호스트는 프로세스를 독립적으로 스케줄링합니다. 호스트 간에 부하가 자동으로 분산되지 않습니다.
</note>

## 엔트리 종류

| Kind | 설명 |
|------|-------------|
| `process.host` | 스케줄러가 있는 프로세스 실행 호스트 |

## 설정

```yaml
- name: main_host
  kind: process.host
  host:
    workers: 8
    queue_size: 1024
    local_queue_size: 256
  lifecycle:
    auto_start: true
```

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `workers` | int | NumCPU | 워커 고루틴 |
| `queue_size` | int | 1024 | 글로벌 큐 용량 |
| `local_queue_size` | int | 256 | 워커별 로컬 데크 크기 |

## 스케줄러

스케줄러는 작업 스틸링 방식을 사용합니다. 각 워커는 로컬 데크를 가지고 있으며, 유휴 워커는 글로벌 큐나 다른 워커에서 작업을 가져옵니다. 이를 통해 부하가 자동으로 분산됩니다.

- **워커**는 프로세스를 동시에 실행합니다
- **글로벌 큐**는 모든 워커가 바쁠 때 대기 중인 프로세스를 보관합니다
- **로컬 큐**는 작업을 워커 가까이 유지하여 경합을 줄입니다

## 프로세스 타입

프로세스 호스트는 다음 종류의 엔트리를 실행합니다:

| Kind | 설명 |
|------|-------------|
| `process.lua` | 소스 기반 Lua 프로세스 |
| `process.lua.bc` | 사전 컴파일된 Lua 바이트코드 |
| `process.wasm` | WebAssembly 프로세스 (실험적) |

프로세스는 자체 컨텍스트로 독립적으로 실행되며, 메시지를 통해 통신하고, 장애 허용을 위해 슈퍼바이즈됩니다.

## 참고

- [프로세스 모듈](lua/core/process.md) - Lua에서 프로세스 스폰 및 관리
- [WASM 프로세스](wasm/processes.md) - `process.wasm` 엔트리 구성
- [프로세스 모델](concepts/process-model.md) - 생명주기 및 슈퍼비전 개념
- [슈퍼비전](guides/supervision.md) - 슈퍼비전 트리 구축
