# 레지스트리

레지스트리는 Wippy의 중앙 설정 저장소입니다. 모든 정의(엔트리 포인트, 서비스, 리소스)가 여기에 있으며, 변경 사항은 시스템 전체에 반응적으로 전파됩니다.

## 엔트리

레지스트리는 **엔트리**를 저장합니다. 엔트리는 고유 ID를 가진 타입화된 정의입니다:

```
app.api:get_user          → HTTP 핸들러
app.workers:email_sender  → 백그라운드 프로세스
app:database              → 데이터베이스 연결
app:templates             → 템플릿 세트
```

각 엔트리에는 `ID`(namespace:name 형식), 핸들러를 결정하는 `kind`, 임의의 `meta` 필드, kind별 `data`가 있습니다.

## Kind 핸들러

엔트리가 등록되면 `kind` 값에 따라 처리할 핸들러가 결정됩니다. 핸들러는 설정을 검증하고 런타임 리소스를 생성합니다. 예를 들어 `http.service` 엔트리는 HTTP 서버를 시작하고, `function.lua` 엔트리는 함수 풀을 생성하며, `sql.database` 엔트리는 연결 풀을 설정합니다. 사용 가능한 kind는 [엔트리 종류 가이드](guides/entry-kinds.md)를, 핸들러 구현은 [커스텀 엔트리 종류](internals/kinds.md)를 참조하세요.

## 라이브 업데이트

레지스트리는 런타임 중 변경을 지원합니다. 시스템이 실행되는 동안 엔트리를 추가, 수정, 삭제할 수 있습니다. 변경 사항은 이벤트 버스를 통해 전달되며 리스너가 검증하거나 거부할 수 있고, 트랜잭션이 원자성을 보장합니다. 버전 히스토리를 통해 롤백도 가능합니다.

YAML 정의 파일은 시작 시 로드되는 직렬화된 레지스트리 스냅샷입니다. 프로그래밍 방식 접근은 [레지스트리 모듈](lua/core/registry.md)을 참조하세요.

## 참고

- [YAML 및 프로젝트 구조](start/structure.md) - 정의 파일
- [커스텀 엔트리 종류](internals/kinds.md) - kind 핸들러 구현
- [프로세스 모델](concepts/process-model.md) - 프로세스 작동 방식
