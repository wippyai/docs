---
title: "컴포넌트 구축"
description: "재사용 가능한 모듈 작성하기: ns.requirement로 요구사항 인터페이스를 선언하는 방법과 호스트가 의존성 파라미터를 통해 값을 공급하는 방식."
---

# 컴포넌트 구축

**컴포넌트**는 재사용 가능한 Wippy 모듈입니다 — 허브에 게시되어 호스트 애플리케이션에 마운트되는 기능의 슬라이스입니다. 컴포넌트가 마주하는 과제는 자신이 의존하는 것들의 이름을 부를 수 없다는 점입니다: *어떤* 데이터베이스, *어떤* 프로세스 호스트, *어떤* 라우터가 필요하지만, 호스트가 어느 것을 줄지 알지 못합니다. Wippy는 이를 **요구사항 인터페이스**로 해결합니다 — 컴포넌트는 구멍을 선언하고, 호스트가 그것을 채웁니다.

이 가이드는 작성자 측을 다룹니다: 그 인터페이스를 선언하는 방법과 값이 엔트리로 흘러들어오는 방식의 이해. 소비자 측(잠금 파일, 버전 제약, `wippy add`/`update`)은 [의존성 관리](guides/dependency-management.md)를, 컴포넌트의 내부 구조는 [애플리케이션 아키텍처](concepts/architecture.md)를 참조하세요.

## 세 가지 종류

| Kind | 측 | 역할 |
|------|------|------|
| `ns.definition` | 컴포넌트 | 모듈 메타데이터; 게시에 필수. |
| `ns.requirement` | 컴포넌트 | 호스트가 채워야 하는 구멍과 값을 주입할 위치. |
| `ns.dependency` | 호스트 | 컴포넌트를 마운트하고 그 요구사항에 값을 공급. |

## ns.definition

모듈당 하나, 게시에 필수입니다. 모듈의 표시 이름과 README 경로를 담습니다 — 그 이상은 없습니다.

```yaml
- name: definition
  kind: ns.definition
  module: jobs                # optional; defaults to the entry name
  readme: file://README.md    # path to the module's documentation
  meta:
    title: Durable Jobs
    description: Leased job queue with retry and dead-lettering.
```

`module`과 `readme`만이 컴포넌트 데이터입니다; `meta`는 관리 UI를 위한 일반 엔트리 메타데이터입니다. 릴리스 노트는 여기가 아니라 게시 시점에 제공합니다.

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

### default — 필수 vs 선택

`default` 필드가 호스트가 값을 *반드시* 공급해야 하는지를 결정합니다:

- **`default`가 있음** (빈 문자열을 포함한 어떤 값이든) → 요구사항은 **선택 사항**입니다. 호스트가 아무것도 공급하지 않으면 기본값이 사용됩니다.
- **`default`가 없음** → 요구사항은 **필수**입니다. 아무것도 공급되지 않으면 strict 모드에서 링크가 실패합니다 (그 외에는 경고).

<note>
명시적으로 빈 기본값(<code>default: ""</code>)은 기본값이 전혀 없는 것과 다릅니다. 빈 문자열은 "선택 사항이며, 아무것도 아닌 값으로 폴백"을 의미하고, 없음은 "호스트가 반드시 제공해야 함"을 의미합니다. 앱 내부에 합리적인 관례가 있는 인프라(<code>app:db</code>, <code>app:processes</code>)에는 기본값을 사용하고, 호스트만이 알 수 있는 값에는 생략하세요.
</note>

### targets — 값이 도착하는 곳

각 타겟은 `{entry, path}` 쌍입니다:

- **`entry`** — 값이 주입되는 엔트리. 단독 이름(`schema`)은 요구사항 자신의 네임스페이스 안에서 해석됩니다; 완전히 한정된 id(`app.jobs.migrations:schema`)는 네임스페이스를 가로질러 정확히 그 엔트리를 가리킵니다.
- **`path`** — 타겟 엔트리로의 점 경로, 예: `.meta.target_db`, `.host`, `.database.url`. 선행 점은 관례입니다.

타겟이 없는 요구사항은 오류입니다 — 아무 데도 주입하지 않는 구멍은 의미가 없습니다.

경로에 `+=` 접미사를 붙이면 설정 대신 추가합니다 — 여러 요구사항이 하나의 리스트에 기여할 때(예: 미들웨어) 유용합니다:

```yaml
targets:
  - entry: app.api:router
    path: .middleware+=     # appends the value to the list at .middleware
```

### 하나의 요구사항, 여러 타겟

같은 값이 필요한 모든 것을 하나의 요구사항 아래에 묶으세요. 이것이 관용적 패턴입니다: `target_db` 요구사항이 모든 마이그레이션의 `.meta.target_db`와 모든 영속성 라이브러리의 `.db`에 주입하고, `process_host`가 감독되는 각 `service`의 `.host`에 주입하고, `api_router`가 각 엔드포인트의 `.meta.router`에 주입합니다:

```yaml
- name: process_host
  kind: ns.requirement
  default: app:processes
  targets:
    - { entry: app.jobs.service:worker.service, path: .host }
    - { entry: app.jobs.service:sweeper.service, path: .host }
```

호스트는 하나의 구멍을 채우고, 런타임이 값을 모든 타겟으로 퍼뜨립니다. 병렬 설정 엔트리로 미러링되는 것은 아무것도 없습니다 — 요구사항 엔트리가 곧 배선*입니다*.

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

## 이음새 검증: 마운트 테스트

단위 테스트는 슬라이스를 고립시켜 실행합니다; *조립된* 모듈이 일관성 있는지는 볼 수 없습니다. 요구사항이 주입된 라이브 레지스트리에 대해 모듈 전체를 감사하는 패키징/마운트 테스트를 추가하세요:

- 감독되는 모든 `service`가 존재하는 프로세스 엔트리를 가리키는지,
- 스폰되거나 스케줄되는 모든 id가 실제 엔트리로 해석되는지,
- 모든 `env.variable`의 스토리지가 등록되어 있는지.

이것들이 고립된 단위 스위트가 가리는 통합 이음새입니다 — 슈퍼바이저가 등록된 적 없는 워커를 참조하게 하거나, 테스트 픽스처가 하네스 전용 스토리지 id를 마운트된 부트로 누출하게 하는 틈입니다. [슈퍼비전](guides/supervision.md)과 [테스트](framework/testing.md) 프레임워크를 참조하세요.

## 참고

- [애플리케이션 아키텍처](concepts/architecture.md) — 컴포넌트의 내부 구조
- [의존성 관리](guides/dependency-management.md) — 잠금 파일, 버전, 소비자 워크플로우
- [모듈 게시](guides/publishing.md) — 컴포넌트를 허브에 올리기
- [엔트리 종류 가이드](guides/entry-kinds.md) — `ns.definition`, `ns.requirement`, `ns.dependency` 레퍼런스
