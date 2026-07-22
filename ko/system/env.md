---
title: "환경 시스템"
description: "설정 가능한 스토리지 백엔드를 통해 환경 변수를 관리합니다."
---

# 환경 시스템

설정 가능한 스토리지 백엔드를 통해 환경 변수를 관리합니다.

## 개요

환경 시스템은 스토리지와 접근을 분리합니다:

- **스토리지** - 값이 저장되는 곳 (OS, 파일, 메모리)
- **변수** - 스토리지의 값에 대한 명명된 참조

변수는 다음으로 참조할 수 있습니다:
- **공개 이름** - `variable` 필드 값 (시스템 전체에서 고유해야 함)
- **엔트리 ID** - 전체 `namespace:name` 참조

변수를 이름으로 공개적으로 접근하게 하고 싶지 않으면 `variable` 필드를 생략하세요.

## 엔트리 종류

| Kind | 설명 |
|------|-------------|
| `env.storage.memory` | 인메모리 키-값 스토리지 |
| `env.storage.file` | 파일 기반 스토리지 (.env 형식) |
| `env.storage.os` | 읽기 전용 OS 환경 접근 |
| `env.storage.static` | 읽기 전용 정적 키-값 스토리지 |
| `env.storage.router` | 여러 스토리지 체인 |
| `env.variable` | 스토리지를 참조하는 명명된 변수 |

## 스토리지 백엔드

### 메모리 스토리지

휘발성 인메모리 스토리지.

```yaml
- name: runtime_env
  kind: env.storage.memory
```

### 파일 스토리지

`.env` 파일 형식(`KEY=VALUE`와 `#` 주석)을 사용한 영구 스토리지.

```yaml
- name: app_config
  kind: env.storage.file
  file_path: /etc/app/config.env
  auto_create: true
  file_mode: 0600
  dir_mode: 0700
```

| 속성 | 타입 | 기본값 | 설명 |
|----------|------|---------|-------------|
| `file_path` | string | 필수 | .env 파일 경로 |
| `auto_create` | boolean | false | 없으면 파일 생성 |
| `file_mode` | integer | 0644 | 파일 권한 |
| `dir_mode` | integer | 0755 | 디렉토리 권한 |

### OS 스토리지

운영 체제 환경 변수에 대한 읽기 전용 접근.

```yaml
- name: os_env
  kind: env.storage.os
```

항상 읽기 전용입니다. 설정 작업은 `PERMISSION_DENIED`를 반환합니다.

### 정적 스토리지

설정에 직접 정의된 값을 가진 읽기 전용 스토리지입니다. 값은 엔트리에 포함되며 런타임에 변경할 수 없습니다. 모듈이나 팩과 함께 배포되는 공개 설정 상수에 유용합니다.

```yaml
- name: defaults
  kind: env.storage.static
  values:
    PUBLIC_API_HOST: "https://api.example.com"
    PUBLIC_WS_HOST: "wss://api.example.com/ws"
    APP_ENV: "production"
```

| 속성 | 타입 | 설명 |
|----------|------|-------------|
| `values` | map | 키-값 쌍 (문자열 대 문자열) |

항상 읽기 전용입니다. 설정 작업은 `PERMISSION_DENIED`를 반환합니다.

### 라우터 스토리지

여러 스토리지를 체인합니다. 읽기는 찾을 때까지 순서대로 검색합니다. 쓰기는 첫 번째 스토리지로만 갑니다.

```yaml
- name: config
  kind: env.storage.router
  storages:
    - app.config:memory    # 기본 (여기에 쓰기)
    - app.config:file      # 폴백
    - app.config:os        # 폴백
```

| 속성 | 타입 | 설명 |
|----------|------|-------------|
| `storages` | array | 정렬된 스토리지 참조 목록 |

## 변수

변수는 스토리지 값에 대한 명명된 접근을 제공합니다.

```yaml
- name: DATABASE_URL
  kind: env.variable
  variable: DATABASE_URL
  storage: app.config:file
  default: postgres://localhost/app
  read_only: false
```

| 속성 | 타입 | 설명 |
|----------|------|-------------|
| `variable` | string | 공개 변수 이름 (선택적, 고유해야 함) |
| `storage` | string | 스토리지 참조 (`namespace:name`) |
| `default` | string | 찾지 못하면 기본값 |
| `read_only` | boolean | 수정 방지 |

### 변수 명명

변수 이름은 다음만 포함해야 합니다: `a-z`, `A-Z`, `0-9`, `_`

### 접근 패턴

```yaml
# 공개 변수 - "PORT" 이름으로 접근 가능
- name: port_var
  kind: env.variable
  variable: PORT
  storage: app.config:os
  default: "8080"

# 비공개 변수 - ID "app.config:internal_key"로만 접근 가능
- name: internal_key
  kind: env.variable
  storage: app.config:secrets
```

## 플레이스홀더 보간

등록된 변수는 `${env:NAME}` 플레이스홀더로 엔트리 설정에 주입되며, 이 레지스트리를 기준으로 디코드 시점에 중앙에서 해석됩니다. 엔트리 데이터의 모든 문자열 필드가 이 방식으로 변수를 참조할 수 있습니다.

| 구문 | 의미 |
|--------|---------|
| `${env:NAME}` | env 레지스트리를 통해 `NAME`을 해석; 값이 없고 기본값도 없으면 에러 |
| `${env:NAME\|default}` | `NAME`을 해석하고, 값이 없으면 `default`로 폴백 |
| `${NAME\|default}` | 축약형; `NAME`은 대문자 스네이크(`A-Z0-9_`)여야 하고 `\|default`가 필수입니다 — 단독 `${VAR}`는 그대로 유지되어 내장된 셸/템플릿 구문이 참조로 오인되지 않습니다 |
| `$${` | 리터럴 `${` (이스케이프) |

`NAME`은 등록된 변수의 공개 이름 또는 그 엔트리 ID(점/콜론을 포함한 레지스트리 id 형식, 예: `app.env:tls_cert`)입니다. 원시 OS 환경 변수가 **아닙니다**: OS 값은 해당 이름으로 `env.storage.os` 기반 변수가 등록된 경우에만 접근할 수 있습니다.

```yaml
- name: api
  kind: http.service
  addr: ":443"
  tls:
    mode: manual
    cert: ${env:app.env:tls_cert}
    key:  ${env:app.env:tls_key}
```

전체 값이 단일 플레이스홀더인 필드는 변수의 타입이 지정된 값을 취합니다 (타입이 지정된 기본값이 주어지면 bool/int/float로 강제 변환); 주변 텍스트와 섞인 플레이스홀더는 문자열로 보간됩니다. 변수 자체의 `default`가 플레이스홀더의 인라인 `|default`보다 먼저 적용됩니다. 아무것도 해석되지 않고 기본값도 없는 참조는 디코딩에 실패합니다.

해석은 디코드 시점에만 일어납니다: 저장된 레지스트리 엔트리는 원시 플레이스홀더를 유지하므로, 해석된 시크릿은 `registry.get` 결과나 영속 상태에 절대 나타나지 않습니다. `${env:...}`를 참조하는 엔트리는 부트 시 자신이 의존하는 env 스토리지와 변수 뒤로 자동으로 정렬됩니다.

<note>
이전 설정은 동일한 방식으로 해석되는 형제 <code>&lt;field&gt;_env</code> 지시자(예: <code>cert_env: app.env:tls_cert</code>)를 사용합니다. 이 형식은 <b>더 이상 사용되지 않습니다</b> — <code>${env:NAME}</code> 플레이스홀더로 마이그레이션하세요. 등록되지 않은 변수를 가리키는 <code>&lt;field&gt;_env</code> 키는 지시자로 취급되지 않고 그대로 유지됩니다; 등록되었지만 비어 있는 변수를 가리키는 키는 인라인 <code>&lt;field&gt;</code> 값을 유지합니다. 기본값 없는 명시적 <code>${env:NAME}</code>만이 누락된 변수에 대해 하드 실패합니다.
</note>

## 에러

| 조건 | Kind | 재시도 가능 |
|-----------|------|-----------|
| 변수 찾을 수 없음 | `errors.NOT_FOUND` | 아니오 |
| 스토리지 찾을 수 없음 | `errors.NOT_FOUND` | 아니오 |
| 변수가 읽기 전용 | `errors.PERMISSION_DENIED` | 아니오 |
| 스토리지가 읽기 전용 | `errors.PERMISSION_DENIED` | 아니오 |
| 유효하지 않은 변수 이름 | `errors.INVALID` | 아니오 |

## 런타임 접근

- [env 모듈](lua/system/env.md) - Lua 런타임 접근

## 참고

- [보안 모델](system/security.md) - 환경 변수에 대한 접근 제어
- [설정 가이드](guides/configuration.md) - 애플리케이션 설정 패턴
