---
title: "컴포넌트 구축"
description: "재사용 가능한 모듈 작성하기: ns.requirement로 요구사항 인터페이스를 선언하는 방법과 호스트가 의존성 파라미터를 통해 값을 공급하는 방식."
---

# 컴포넌트 구축

**컴포넌트**는 Hub에 publish되어 host application에 mount되는 reusable Wippy module입니다. component는 host의 entry ID를 알지 못해도 database, process host 또는 router에 의존할 수 있습니다. 이러한 dependency를 **requirement interface**로 선언하고 host가 값을 제공합니다.

이 guide는 author side, 즉 interface 선언과 value가 entry에 주입되는 방식을 다룹니다. consumer side(lock file, version constraint, `wippy add`/`update`)는 [의존성 관리](guides/dependency-management.md), component internal structure는 [애플리케이션 아키텍처](concepts/architecture.md)를 참조하십시오.

## 세 가지 종류

| 종류 | 측 | 역할 |
|------|------|------|
| `ns.definition` | 컴포넌트 | 모듈 메타데이터; 게시에 필수. |
| `ns.requirement` | 컴포넌트 | 호스트가 채워야 하는 구멍과 값을 주입할 위치. |
| `ns.dependency` | 호스트 | 컴포넌트를 마운트하고 그 요구사항에 값을 공급. |

## ns.definition

publish되는 각 module에는 정확히 하나의 definition이 있어야 합니다. definition은 module metadata, README reference, wiki page reference를 담을 수 있습니다.

```yaml
- name: definition
  kind: ns.definition
  module: jobs                # optional module metadata
  readme: file://README.md    # path to the module's documentation
  meta:
    title: Durable Jobs
    description: Leased job queue with retry and dead-lettering.
```

`module`, `readme`, `wiki`는 모두 optional definition data입니다. `meta`는 management UI용 ordinary entry metadata입니다. release note는 여기서가 아니라 publish 시 제공합니다.

## ns.requirement

요구사항은 **주입 타겟 목록을 가진 이름 있는 구멍**입니다. 호스트가 값을 공급하면, 런타임이 그 값을 각 타겟 엔트리의 지정된 경로에 씁니다.

```yaml
- name: target_db
  kind: ns.requirement
  meta:
    description: SQL database backing every table in this module.
  default: app:db
  targets:
    - entry: app.jobs.migrations:schema
      path: .meta.target_db
    - entry: app.jobs.persist:lifecycle
      path: .db
```

### `default` — 필수 vs 선택

`default` 필드가 호스트가 값을 *반드시* 공급해야 하는지를 결정합니다:

- **`default`가 non-null value로 있음** (빈 문자열 포함) → 요구사항은 **선택 사항**입니다. host가 아무것도 제공하지 않으면 default를 사용합니다.
- **`default`가 없음** → 요구사항은 **필수**입니다. 아무것도 공급되지 않으면 strict 모드에서 링크가 실패합니다 (그 외에는 경고).

<note>
명시적으로 빈 default(<code>default: ""</code>)는 absent 또는 null default와 다릅니다. empty string은 "optional, falls back to nothing"을 뜻하고 absent와 <code>default: null</code>은 둘 다 "host가 반드시 제공"해야 함을 뜻합니다. 합리적인 in-app convention(<code>app:db</code>, <code>app:processes</code>)이 있는 infrastructure에는 non-null default를 사용하고 host만 아는 value에는 생략하십시오.
</note>

### `targets` — 값이 도착하는 곳

각 타겟은 `{entry, path}` 쌍입니다:

- **`entry`** — 값이 주입되는 엔트리. 단독 이름(`schema`)은 요구사항 자신의 네임스페이스 안에서 해석됩니다; 완전히 한정된 id(`app.jobs.migrations:schema`)는 네임스페이스를 가로질러 정확히 그 엔트리를 가리킵니다.
- **`path`** — 타겟 엔트리로의 점 경로, 예: `.meta.target_db`, `.host`, `.database.url`. 선행 점은 관례입니다.

requirement는 target을 하나 이상 선언해야 합니다.

경로에 `+=` 접미사를 붙이면 설정 대신 추가합니다 — 여러 요구사항이 하나의 리스트에 기여할 때(예: 미들웨어) 유용합니다:

```yaml
targets:
  - entry: app.api:router
    path: .middleware+=     # appends the value to the list at .middleware
```

### 하나의 요구사항, 여러 타겟

같은 값이 필요한 모든 것을 하나의 요구사항 아래에 묶으세요. 이것이 관용적 패턴입니다: `target_db` 요구사항이 모든 마이그레이션의 `.meta.target_db`와 모든 영속성 라이브러리의 `.db`에 주입하고, `process_host`가 감독되는 각 service의 `.host`에 주입하고, `api_router`가 각 엔드포인트의 `.meta.router`에 주입합니다:

```yaml
- name: process_host
  kind: ns.requirement
  default: app:processes
  targets:
    - { entry: app.jobs.service:worker.service, path: .host }
    - { entry: app.jobs.service:sweeper.service, path: .host }
```

host는 value 하나를 제공하고 runtime은 이를 모든 declared target에 씁니다. requirement entry가 이 wiring을 직접 포함합니다.

## 컴포넌트 소비하기

호스트는 `ns.dependency`로 컴포넌트를 마운트하고 `parameters`를 통해 그 요구사항을 채웁니다:

```yaml
version: "1.0"
namespace: app
entries:
  - name: dep.jobs
    kind: ns.dependency
    component: acme/jobs
    version: "^1.0.0"
    parameters:
      - name: target_db
        value: app:db
      - name: process_host
        value: app:processes
      - name: api_router
        value: app:api
```

각 `parameter.name`은 요구사항과 매칭됩니다; 그 `value`가 해당 요구사항의 타겟에 주입되는 값입니다. 기본값이 있는 요구사항은 생략할 수 있습니다; 필수 요구사항은 반드시 공급해야 합니다.

### 파라미터 이름 매칭

파라미터 이름이 요구사항에 바인딩되는 방식:

- **단독 이름** (`target_db`)은 마운트되는 컴포넌트에 속한 그 이름의 요구사항과 매칭됩니다. 다른 모듈의 요구사항으로 넘어가지 않습니다.
- **한정된 이름** (`acme.jobs:target_db`)은 그 요구사항 id와 정확히 매칭됩니다. 전이적 의존성을 배선할 때 구분이 필요하면 이를 사용하세요.

두 의존성이 같은 요구사항에 **서로 다른** 값을 공급하면 충돌이며 보고됩니다 (동일한 값은 괜찮습니다).

## 값이 해석되는 시점

주입은 빌드 파이프라인의 **Link 단계**에서 일어납니다 — 게시 시, 의존성 확장 중, 그리고 부트 시 — 런타임이 아닙니다. 이 단계는:

1. 모든 `ns.requirement`와 파라미터를 가진 모든 `ns.dependency`를 수집합니다.
2. 각 요구사항에 대해 값을 해석합니다: 매칭되는 파라미터가 이깁니다; 없으면 기본값; 없으면(기본값도 없으면) 미해석 상태입니다.
3. 해석된 값을 각 타겟 엔트리의 경로에 씁니다 (설정, 또는 `+=`이면 추가).

**strict requirements** 아래에서는 미해석된 필수 요구사항이 빌드를 실패시킵니다; 그 외에는 경고를 기록하고 진행합니다. 엔트리가 런타임에 도달할 때쯤에는 채워진 모든 요구사항이 이미 타겟에 구워져 있습니다.

## Mount Test로 통합 검증

unit test는 assembled module의 registry relationship을 검증하지 않습니다. requirement-injected registry를 대상으로 packaging 또는 mount test를 추가해 다음을 확인하십시오.

- 감독되는 모든 `service`가 존재하는 프로세스 엔트리를 가리키는지,
- 스폰되거나 스케줄되는 모든 id가 실제 엔트리로 해석되는지,
- 모든 `env.variable`의 스토리지가 등록되어 있는지.

이 검사는 supervisor가 등록되지 않은 worker를 참조하거나 test fixture가 harness-only storage ID를 사용하는 것과 같은 unresolved relationship을 찾습니다. [슈퍼비전](guides/supervision.md)과 [테스트](framework/testing.md)를 참조하십시오.

## 참고

- [애플리케이션 아키텍처](concepts/architecture.md) — component internal structure
- [의존성 관리](guides/dependency-management.md) — lock file, version, consumer workflow
- [모듈 게시](guides/publishing.md) — component를 Hub에 publish
- [엔트리 종류 가이드](guides/entry-kinds.md) — `ns.definition`, `ns.requirement`, `ns.dependency` reference
