---
title: "레지스트리"
description: "Wippy가 typed entry를 저장하고 runtime resource를 초기화하며 configuration change를 전파하는 방식입니다."
---

# 레지스트리

registry는 entry point, service, resource 및 기타 runtime definition을 위한 Wippy의 versioned store입니다. 대부분의 runtime entry kind는 event-bus transaction을 통해 reconcile되며 `registry.entry` 및 namespace metadata 같은 internal kind는 기본적으로 event dispatch를 우회합니다.

## 엔트리

레지스트리는 **엔트리**를 저장합니다. 엔트리는 고유 ID를 가진 타입화된 정의입니다:

```
app.api:get_user          → HTTP handler
app.workers:email_sender  → Background process
app:database              → Database connection
app:templates             → Template set
```

각 엔트리에는 `ID`(namespace:name 형식), 핸들러를 결정하는 `kind`, 임의의 `meta` 필드, kind별 `data`가 있습니다.

registry ID는 많은 authorization check에서 resource로도 사용됩니다. registry는 definition을 저장하고 security scope는 guarded operation이 이에 접근할 수 있는지 결정합니다. [보안 모델](./security-model.md)을 참조하십시오.

## Kind 핸들러

dispatch된 엔트리가 제출되면 `kind`가 등록된 handler를 선택합니다. handler는 해당 runtime resource를 검증하고 reconcile합니다. 예를 들어 `http.service` 엔트리는 HTTP server, `function.lua` 엔트리는 function pool, `db.sql.postgres` 엔트리는 connection pool을 관리합니다. 사용 가능한 kind는 [엔트리 종류 가이드](guides/entry-kinds.md), handler 구현은 [커스텀 엔트리 종류](internals/kinds.md)를 참조하십시오.

## 라이브 업데이트

시스템 실행 중 엔트리를 추가, update 또는 remove할 수 있습니다. dispatch되는 kind에서 registry transaction은 commit 전에 참여 handler에게 각 operation의 수락 또는 거부를 요청합니다. 거부되면 transaction을 폐기하고 inverse transition을 적용합니다. 관련 topology change는 하나의 새 registry version을 만듭니다.

history가 활성화되면 version history가 backward 및 forward transition을 지원합니다. memory history는 기본값이며 process lifetime 동안 유지되고, SQLite 및 PostgreSQL backend는 restart 이후에도 history를 영속화합니다.

YAML 및 JSON 정의 파일은 boot loader가 entry로 변환하는 source manifest이며 serialized registry snapshot이 아닙니다. 프로그래밍 방식 접근은 [레지스트리 모듈](lua/core/registry.md)을 참조하십시오.

## 참고

- [YAML 및 프로젝트 구조](start/structure.md) — 정의 파일
- [커스텀 엔트리 종류](internals/kinds.md) — kind handler 구현
- [프로세스 모델](concepts/process-model.md) — 프로세스 실행 이해하기
