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
