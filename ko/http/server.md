---
title: "HTTP 서버"
description: "HTTP 서버(http.service)는 포트에서 리스닝하고 라우터, 엔드포인트, 정적 파일 핸들러를 호스팅합니다."
---

# HTTP 서버

HTTP 서버(`http.service`)는 포트에서 리스닝하고 라우터, 엔드포인트, 정적 파일 핸들러를 호스팅합니다.

## 설정

```yaml
- name: gateway
  kind: http.service
  addr: ":8080"
  timeouts:
    read: "5s"
    write: "30s"
    idle: "60s"
  host:
    buffer_size: 1024
    worker_count: 4
  lifecycle:
    auto_start: true
    security:
      actor:
        id: "http-gateway"
      policies:
        - app:http_policy
```

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `addr` | string | 필수 | 수신 주소 (`:8080`, `0.0.0.0:443`) |
| `timeouts.read` | duration | - | 요청 읽기 타임아웃 |
| `timeouts.write` | duration | - | 응답 쓰기 타임아웃 |
| `timeouts.idle` | duration | - | Keep-alive 연결 타임아웃 |
| `host.buffer_size` | int | 1024 | 메시지 릴레이 버퍼 크기 |
| `host.worker_count` | int | NumCPU | 메시지 릴레이 워커 수 |
| `network` | 레지스트리 ID | - | [네트워크 오버레이](system/network.md)를 통해 리스너 바인딩 (예: Tailscale, I2P) |
| `tls` | object | - | TLS 종료 ([TLS](#tls) 참조) |

## 타임아웃

리소스 고갈을 방지하기 위해 타임아웃을 설정합니다:

```yaml
timeouts:
  read: "10s"    # Max time to read the entire request (headers + body)
  write: "60s"   # Max time to write response
  idle: "120s"   # Keep-alive timeout
```

- `read` - API는 짧게 (5-10초), 업로드는 길게
- `write` - 예상 응답 생성 시간에 맞춤
- `idle` - 연결 재사용과 리소스 사용 간 균형

<note>
Duration 형식: <code>30s</code>, <code>1m</code>, <code>2h15m</code>. 비활성화하려면 <code>0</code>을 사용하세요.
</note>

## Host 설정

`host` 섹션은 WebSocket 릴레이와 같은 컴포넌트가 사용하는 서버 내부 메시지 릴레이를 설정합니다:

```yaml
host:
  buffer_size: 2048
  worker_count: 8
```

| 필드 | 기본값 | 설명 |
|------|--------|------|
| `buffer_size` | 1024 | 워커당 메시지 큐 용량 |
| `worker_count` | NumCPU | 병렬 메시지 처리 고루틴 |

<tip>
고처리량 WebSocket 애플리케이션을 위해 이 값들을 증가시키세요. 메시지 릴레이는 HTTP 컴포넌트와 프로세스 간 비동기 전달을 처리합니다.
</tip>

## 보안

HTTP 서버는 lifecycle 설정을 통해 기본 보안 컨텍스트를 적용할 수 있습니다:

```yaml
lifecycle:
  auto_start: true
  security:
    actor:
      id: "gateway-service"
    policies:
      - app:http_access_policy
```

이는 모든 요청에 대한 기본 액터와 정책을 설정합니다. 인증된 요청의 경우, [token_auth 미들웨어](http/middleware.md)가 검증된 토큰을 기반으로 액터를 재정의하여 사용자별 보안 정책을 가능하게 합니다.

## Lifecycle

서버는 supervisor에 의해 관리됩니다:

```yaml
lifecycle:
  auto_start: true
  start_timeout: 30s
  stop_timeout: 60s
  requires:
    - app:database
```

| 필드 | 설명 |
|------|------|
| `auto_start` | 애플리케이션 시작 시 시작 |
| `start_timeout` | 서버 시작 대기 최대 시간 |
| `stop_timeout` | 그레이스풀 셧다운 최대 시간 |
| `requires` | 이 엔트리들이 준비된 후 시작 (`depends_on`은 레거시 표기) |

## 컴포넌트 연결

라우터와 정적 핸들러는 메타데이터를 통해 서버를 참조합니다:

```yaml
entries:
  - name: gateway
    kind: http.service
    addr: ":8080"

  - name: api
    kind: http.router
    meta:
      server: gateway
    prefix: /api

  - name: static
    kind: http.static
    meta:
      server: gateway
    path: /
    fs: app:public
```

## 여러 서버

다양한 목적을 위해 별도의 서버를 실행합니다:

```yaml
entries:
  # Public API
  - name: public
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true

  # Admin (localhost only)
  - name: admin
    kind: http.service
    addr: "127.0.0.1:9090"
    lifecycle:
      auto_start: true
```

## TLS

서버는 직접 TLS를 종료할 수 있습니다. `tls.mode`를 `manual` (자체 인증서 제공) 또는 `auto` (오버레이 네트워크 드라이버가 인증서 제공, 예: `network.tailscale`)로 설정하세요. 일반 clearnet 리스너는 `auto`를 지원하지 않습니다. `tls`를 생략하거나 mode를 비워두면 일반 HTTP로 실행됩니다.

`auto` 모드에서 서버는 `cert`/`key`를 지정해서는 안 됩니다. 네트워크 드라이버가 제공합니다.

### 수동 인증서

`mode: manual`에서 `cert`와 `key`는 PEM 콘텐츠를 담습니다. 각 필드에는 인라인 PEM, manifest 기준 `file://` 참조, 또는 디코딩 시 등록된 [환경 변수](system/env.md)에서 읽는 `${env:NAME}` 참조 중 하나를 사용하세요.

```yaml
- name: api
  kind: http.service
  addr: ":443"
  tls:
    mode: manual
    cert: file://./certs/server.pem
    key:  file://./certs/server.key
```

```yaml
- name: api
  kind: http.service
  addr: ":443"
  tls:
    mode: manual
    cert: ${env:app.env:tls_cert}
    key:  ${env:app.env:tls_key}
```

`${env:NAME}`은 `NAME`을 [환경 레지스트리](../system/env.md)의 공개 이름 또는 엔트리 ID(예: `app.env:tls_cert`)로 해석합니다. 원시 OS 환경 변수가 아니며 OS 값은 해당 이름으로 등록된 `env.storage.os` 기반 변수를 통해서만 접근할 수 있습니다. `${env:NAME|default}`로 기본값을 지정할 수 있습니다.

<note>
레거시 <code>cert_env</code> / <code>key_env</code> 필드도 같은 방식으로 환경 레지스트리를 사용하지만 deprecated입니다. 위의 <code>${env:NAME}</code> placeholder를 사용하세요.
</note>

| 필드 | 설명 |
|------|------|
| `mode` | `""` (끔), `auto`, 또는 `manual` |
| `cert` / `key` | 인라인, `file://` 또는 `${env:NAME}` 참조로 제공하는 PEM 콘텐츠 |

### Mutual TLS (mTLS)

`mode: manual`에서 서버는 추가로 클라이언트 인증서를 검증할 수 있습니다:

```yaml
tls:
  mode: manual
  cert: ${env:app.env:tls_cert}
  key:  ${env:app.env:tls_key}
  client_ca: file://./certs/clients-ca.pem
  client_auth: require_and_verify
```

| 필드 | 설명 |
|------|------|
| `client_auth` | `request`, `require_any`, `verify_if_given`, `require_and_verify` |
| `client_ca` | 인라인, `file://` 또는 `${env:NAME}`으로 제공하는 신뢰할 수 있는 클라이언트 CA PEM 번들 |

`client_ca`도 `cert`/`key`와 같은 세 가지 형식을 받습니다. 레거시 `client_ca_env`는 deprecated이며 `client_ca: ${env:NAME}`을 사용해야 합니다.

`verify_if_given`과 `require_and_verify`는 CA가 필요합니다. `request`와 `require_any`는 CA 검증 없이 모든 클라이언트 인증서를 수락합니다.

## 참고

- [라우팅](http/router.md) - 라우터 및 엔드포인트
- [정적 파일](http/static.md) - 정적 파일 서빙
- [미들웨어](http/middleware.md) - 사용 가능한 미들웨어
- [보안](system/security.md) - 보안 정책
- [WebSocket 릴레이](http/websocket-relay.md) - WebSocket 메시징
