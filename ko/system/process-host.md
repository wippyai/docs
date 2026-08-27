---
title: "프로세스 호스트"
description: "프로세스 호스트는 work-stealing scheduler를 사용하여 Lua 및 WebAssembly 프로세스 실행을 관리합니다."
---

# 프로세스 호스트

`process.host`는 work-stealing scheduler에서 Lua 및 WebAssembly 프로세스를 실행합니다. 이 페이지는 설정 및 lifecycle 레퍼런스이며 YAML 블록은 entry fragment입니다.

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
| `queue_size` | int | 1024 | 초기 global queue capacity |
| `local_queue_size` | int | 256 | 초기 worker별 local deque capacity |

두 queue는 초기 capacity가 소진되면 확장됩니다. 기본값을 적용한 뒤 값은 양수여야 합니다. global queue는 실제 초기 capacity를 최소 16으로 clamp하고, 각 local deque는 capacity를 2의 거듭제곱으로 올림합니다.

## 생명주기

process host는 supervisor가 관리하는 service입니다. `lifecycle.auto_start` 기본값은 `false`이며 시작되지 않은 host는 process spawn을 거부합니다. `requires`, `startup`, `start_timeout`, `stop_timeout`, `stable_threshold`, `restart`, `security`를 포함한 표준 lifecycle field도 적용됩니다.

host 중지는 해당 host instance에 대해 terminal입니다. scheduler는 각 프로세스에 cancellation event를 보내고 stop context가 만료될 때까지 drain을 기다린 뒤, 남은 프로세스를 cancel하고 close합니다.

live update는 `host.workers` 크기를 조정할 수 있습니다. queue size 또는 lifecycle 설정 변경은 거부되며 host를 교체해야 합니다. CPU affinity가 worker set을 관리하는 경우 worker count도 live 변경할 수 없습니다.

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

프로세스는 자체 frame context에서 독립적으로 실행되고 message로 통신합니다. 프로세스 엔트리에 설정한 security는 실행 전에 해당 process frame에 적용됩니다. monitor, link 및 application supervisor는 failure에 반응할 수 있지만 process host가 실패한 모든 프로세스를 자동으로 restart하지는 않습니다.

## 참고

- [프로세스 모듈](../lua/core/process.md) - Lua에서 프로세스 spawn 및 관리
- [WASM 프로세스](../wasm/processes.md) - `process.wasm` 엔트리 설정
- [프로세스 모델](../concepts/process-model.md) - 생명주기 및 supervision 개념
- [슈퍼비전](../guides/supervision.md) - supervision tree 구축
