---
title: "보안 모델: 프로세스 격리와 정책 검사"
description: "Wippy가 Lua 및 WASM 실행 환경을 제한하고 actor, scope, policy로 보호된 런타임 작업을 승인하는 방식을 설명합니다."
---

# 보안 모델

Wippy는 실행 격리와 속성 기반 접근 제어(ABAC)를 결합합니다. 격리는 코드가 접근할 수 있는 모듈과 호스트 리소스를 결정합니다. ABAC는 현재 actor와 policy scope에서 보호된 작업을 허용할지 결정합니다. 두 경계가 모두 중요합니다. 모듈을 import해도 권한이 부여되지 않으며, policy가 선언되지 않은 모듈을 Lua 코드에 제공할 수도 없습니다.

## 승인 규칙

보안 context는 **actor**와 **scope**를 포함할 수 있습니다. actor는 주체를 식별하며 metadata를 포함할 수 있습니다. scope는 변경 불가능한 policy 집합입니다. policy는 action과 resource를 일치시키고 actor 또는 resource metadata를 검사할 수 있으며 `allow`, `deny`, `undefined` 중 하나를 반환합니다.

actor와 scope가 모두 있으면 다음 규칙을 적용합니다.

1. 일치하는 deny가 하나라도 있으면 거부합니다.
2. deny가 없고 allow가 하나 이상이면 작업을 허용합니다.
3. 일치하는 policy가 없으면 `undefined`이며, 보호된 런타임 작업은 이를 거부로 처리합니다.

`security.strict_mode`는 actor 또는 scope가 없어 context가 불완전할 때만 적용됩니다. 런타임 v0.3.32a는 strict mode를 켠 상태로 시작합니다. 레거시 또는 전환 중인 코드가 불완전한 context에서 허용적 동작을 유지해야 할 때만 비활성화하십시오.

```yaml
# .wippy.yaml
security:
  strict_mode: false
```

| Context | `strict_mode: false` | `strict_mode: true` |
|---------|----------------------|---------------------|
| Actor와 scope 있음 | policy를 평가하며 `allow`만 접근 허용 | 동일 |
| Actor 또는 scope 없음 | 보호된 작업 허용 | 보호된 작업 거부 |

불완전한 context가 반드시 fail closed해야 하는 배포에서는 strict mode를 유지하고, 서비스가 작업에 필요한 actor와 scope로 시작되게 하십시오. strict mode를 꺼도 완전한 scope의 `undefined` 결과가 allow로 바뀌지는 않습니다.

policy 구문, actor, scope, token store는 [보안 참조](../system/security.md)를 확인하십시오.

## Lua 격리

각 Lua actor 프로세스는 하나의 Lua state를 소유하고 함수 엔트리는 격리된 state pool을 통해 실행됩니다. 런타임은 전체 Lua 호스트 환경 대신 제한된 기본 환경을 엽니다.

- ambient library는 제한된 `table`, `math`, `os`, `coroutine`, `string`, `errors`와 `channel`, `payload`, `print` 같은 core global입니다.
- `package.path`와 `package.cpath`는 비어 있고 `package.loadlib`는 비활성화됩니다.
- 레지스트리 기반 모듈과 라이브러리는 `modules:` 또는 `imports:`로 선언한 chunk에서만 보입니다.
- `require()`는 이 범위 집합만 resolve하며 선언되지 않은 레지스트리 모듈에는 실패합니다.

따라서 Lua 코드는 호스트 파일 시스템, socket, native process, 환경 변수 API에 직접 접근할 수 없습니다. `fs`, `http_client`, `exec`, `env` 같은 런타임 모듈을 통해서만 해당 기능에 접근하며, 보호된 작업은 여전히 policy 검사를 수행합니다.

import한 라이브러리는 자신의 import를 호출자에게 누출하지 않습니다. 각 라이브러리와 entrypoint는 자체 범위 환경을 받으므로 라이브러리 내부에서 사용하는 기능이 해당 라이브러리를 import한 함수에 자동으로 제공되지 않습니다.

## WASM 격리

WASM 코드는 설정된 host import와 WASI 설정을 통해 실행됩니다. 환경 값과 파일 시스템 mount는 WASM 엔트리에 선언해야 합니다. 런타임은 인스턴스 생성 전에 각 환경 엔트리에 `env.get`, 각 mount에 `fs.get`을 검사합니다. 파일 시스템 mount는 호스트 root를 노출하지 않고 설정한 파일 시스템을 기준으로 다시 root됩니다.

WASM socket 및 outgoing HTTP host 함수도 `socket.connect`, `socket.listen`, `socket.resolve`, `http_client.request` 같은 작업별 검사를 수행합니다.

## 기능 획득과 사용

많은 런타임 리소스는 레지스트리 엔트리입니다. 모듈은 엔트리 ID로 리소스를 획득하고 대응하는 action을 검사합니다. v0.3.32a의 예는 다음과 같습니다.

| Operation | Check | Resource |
|-----------|-------|----------|
| 레지스트리 엔트리 읽기 | `registry.get` | 엔트리 ID |
| 함수 호출 | `funcs.call` | 함수 ID |
| SQL 데이터베이스 handle 획득 | `db.get` | 데이터베이스 엔트리 ID |
| 파일 시스템 획득 | `fs.get` | 파일 시스템 엔트리 ID |
| 환경 값 읽기 | `env.get` | 변수 이름 또는 ID |
| 프로세스 spawn | `process.spawn` | 프로세스 엔트리 ID |
| 프로세스 host 선택 | `process.host` | host 엔트리 ID |

이 검사들은 모두 같은 세분성으로 일어나지 않습니다. 예를 들어 `db.get`은 데이터베이스 handle 획득을 승인하며, 그 handle을 통한 개별 SQL query는 `db.get`을 반복하지 않습니다. 마찬가지로 `fs.get`은 각 파일 작업에 ABAC 결정을 적용하는 것이 아니라 파일 시스템 handle 획득을 승인합니다. 신뢰가 낮은 context에 획득한 handle을 전달하려면 그 context가 해당 권한을 유지해야 하는지 먼저 확인하십시오.

네트워크 모듈은 문서에 따라 각 요청, 연결 또는 listener에 추가 검사를 수행합니다. 작업별 action과 resource는 해당 모듈 참조를 확인하십시오.

## Context 상속

Actor와 scope는 상속 가능한 frame-context 값입니다. 함수 호출과 spawn된 프로세스는 호출자가 대체 context를 만들지 않는 한 이를 상속합니다. spawn된 프로세스에 actor 또는 scope를 명시적으로 설정하려면 해당 spawn 권한 외에 `process.security` 권한이 필요합니다.

이 상속은 call chain에 승인을 유지하지만, 권한이 높은 parent가 신뢰가 낮은 코드에 위임할 작업의 context를 의도적으로 좁혀야 한다는 뜻이기도 합니다.

## 레지스트리 변경

엔트리 읽기와 레지스트리 변경은 서로 다른 권한입니다. 표준 durable changeset에는 `registry.apply`가 필요합니다. v0.3.32a에서 이 검사는 빈 resource를 사용하며 엔트리별 또는 namespace별 쓰기 결정이 아닙니다. 신뢰할 수 없는 agent에 `registry.apply`를 부여한 뒤 namespace pattern으로 쓰기를 제한할 수 있다고 가정하지 마십시오.

프로세스 로컬 overlay는 더 좁은 권한 표면을 가집니다. overlay owner와 `registry.overlay.create.<kind>`, `registry.overlay.update.<kind>`, `registry.overlay.delete.<kind>` 같은 작업별 action을 영향받는 엔트리 ID에 대해 검사합니다. [엔트리 레지스트리](../lua/core/registry.md#process-local-overlays)를 확인하십시오.

## 데이터 경계

tenant별 데이터베이스, 파일 시스템, 함수, 환경 변수에 서로 다른 레지스트리 ID를 사용하고 의도한 ID만 허용하는 policy를 작성하십시오. 모든 접근 경로가 검사를 수행하는 런타임 모듈을 사용하면 context가 다른 tenant의 보호된 리소스를 획득하는 것을 막을 수 있습니다.

환경 참조는 provider credential을 source manifest 밖에 둡니다. provider가 설정된 `env.variable`을 내부적으로 resolve할 수 있지만, 그 값이 애플리케이션 코드에서 본질적으로 읽을 수 없다는 뜻은 아닙니다. `env`를 import하고 같은 변수에 `env.get`을 허용받은 코드는 값을 읽을 수 있습니다. module scoping과 policy를 모두 사용하여 secret을 보호하십시오.

strict mode는 actor 또는 scope가 없는 작업이 policy 평가를 우회하지 못하게 하므로 multi-tenant 배포에서 중요합니다. 하지만 tenant identity를 추론하거나 tenant policy를 생성하지는 않습니다. 애플리케이션이 올바른 actor, scope, resource, policy coverage를 구성해야 합니다.

## Agent와 도구 경계

Framework agent는 정의와 trait에서 선택한 tool을 compile합니다. tool schema는 tool에 전달되는 인자를 제한하고 검증합니다. 레지스트리 기반 tool 구현은 `funcs` 호출 경로를 통해 실행되므로 대상 함수 ID에 대해 `funcs.call`을 검사합니다.

tool list와 policy scope는 서로 보완합니다.

- tool을 생략하면 모델이 일반 agent tool interface를 통해 선택할 수 없습니다.
- `funcs.call`을 deny하면 compile된 목록에 tool이 있어도 실행할 수 없습니다.
- `funcs.call`을 grant해도 선언되지 않은 tool이 모델 목록에 추가되지는 않습니다.

tool wrapper와 외부 통합도 추가 애플리케이션 코드로 취급하십시오. 런타임 검사를 대체하지 않으며, 자체 네트워크 credential과 승인 규칙도 검토해야 합니다.

## 배포 책임

Wippy의 실행 및 policy 경계는 인프라 제어를 대체하지 않습니다.

- storage encryption과 backup policy는 설정된 데이터베이스, disk 또는 object store의 책임입니다.
- VPC, firewall, service policy가 네트워크 수준 접근성을 제어합니다.
- 인증은 Wippy 승인을 적용하기 전에 사용자 또는 서비스 identity를 확립합니다.
- host 관리, SSH 접근, database administrator 작업에는 인프라 audit logging이 필요합니다.
- tenant별 CPU 및 메모리 quota에는 배포 수준 리소스 제어가 필요합니다.

OpenTelemetry는 설정된 런타임 및 framework 작업을 trace할 수 있지만 coverage는 활성화된 instrumentation에 따라 달라집니다. [관측성](../guides/observability.md)을 확인하십시오.

## 검토 체크리스트

- 불완전한 context가 fail closed해야 하는 곳에서는 `security.strict_mode`를 유지합니다.
- 모든 서비스에 의도된 actor와 scope를 부여합니다.
- 선언된 Lua module/import와 보호된 작업의 policy를 함께 검토합니다.
- 전체 durable-registry 변경이 의도된 경우가 아니면 신뢰할 수 없는 코드에 `registry.apply`를 제공하지 않습니다.
- 신뢰 경계를 넘어 획득한 데이터베이스 또는 파일 시스템 handle을 공유하지 않습니다.
- tenant 리소스를 레지스트리 ID로 분리하고 각 tenant scope 밖의 거부를 테스트합니다.
- import scoping과 `env.get` policy를 모두 사용해 환경 secret을 보호합니다.
- runtime authorization과 별개로 tracing 및 인프라 제어를 검증합니다.

## 관련 문서

- [보안 참조](../system/security.md) — Policy, scope, actor, strict mode, token store
- [엔트리 레지스트리](../lua/core/registry.md) — 레지스트리 읽기, 변경, overlay 권한
- [프로세스 관리](../lua/core/process.md) — Spawn, context, process security 권한
- [프로세스 모델](./process-model.md) — 프로세스 격리와 lifecycle
- [Agent](../framework/agents.md) — Agent 정의와 tool 선택
