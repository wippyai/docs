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
|-------|------|---------|-------------|
| `addr` | string | 필수 | 리슨 주소 (`:8080`, `0.0.0.0:443`) |
| `timeouts.read` | duration | - | 요청 읽기 타임아웃 |
| `timeouts.write` | duration | - | 응답 쓰기 타임아웃 |
| `timeouts.idle` | duration | - | Keep-alive 연결 타임아웃 |
| `host.buffer_size` | int | 1024 | 메시지 릴레이 버퍼 크기 |
| `host.worker_count` | int | NumCPU | 메시지 릴레이 워커 |

## 타임아웃

리소스 고갈 방지를 위한 타임아웃 설정:

```yaml
timeouts:
  read: "10s"    # 요청 헤더 읽기 최대 시간
  write: "60s"   # 응답 쓰기 최대 시간
  idle: "120s"   # Keep-alive 타임아웃
```

- `read` - API의 경우 짧게 (5-10s), 업로드의 경우 길게
- `write` - 예상 응답 생성 시간에 맞춤
- `idle` - 연결 재사용과 리소스 사용 간 균형

<note>
기간 형식: <code>30s</code>, <code>1m</code>, <code>2h15m</code>. 비활성화하려면 <code>0</code> 사용.
</note>

## 호스트 설정

`host` 섹션은 WebSocket 릴레이 같은 컴포넌트가 사용하는 서버의 내부 메시지 릴레이를 설정합니다:

```yaml
host:
  buffer_size: 2048
  worker_count: 8
```

| 필드 | 기본값 | 설명 |
|-------|---------|-------------|
| `buffer_size` | 1024 | 워커당 메시지 큐 용량 |
| `worker_count` | NumCPU | 병렬 메시지 처리 고루틴 |

<tip>
높은 처리량의 WebSocket 애플리케이션의 경우 이 값들을 증가시키세요. 메시지 릴레이는 HTTP 컴포넌트와 프로세스 간의 비동기 전달을 처리합니다.
</tip>

## 보안

HTTP 서버는 라이프사이클 설정을 통해 기본 보안 컨텍스트를 적용할 수 있습니다:

```yaml
lifecycle:
  auto_start: true
  security:
    actor:
      id: "gateway-service"
    policies:
      - app:http_access_policy
```

이 설정은 모든 요청에 대한 기본 액터와 정책을 지정합니다. 인증된 요청의 경우 [token_auth 미들웨어](http/middleware.md)가 검증된 토큰을 기반으로 액터를 재정의하여 사용자별 보안 정책을 적용할 수 있습니다.

## 라이프사이클

서버는 슈퍼바이저가 관리합니다:

```yaml
lifecycle:
  auto_start: true
  start_timeout: 30s
  stop_timeout: 60s
  depends_on:
    - app:database
```

| 필드 | 설명 |
|-------|-------------|
| `auto_start` | 애플리케이션 시작 시 시작 |
| `start_timeout` | 서버 시작 대기 최대 시간 |
| `stop_timeout` | 정상 종료 최대 시간 |
| `depends_on` | 이 엔트리들이 준비된 후 시작 |

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

## 다중 서버

다른 목적을 위해 별도의 서버 실행:

```yaml
entries:
  # 퍼블릭 API
  - name: public
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true

  # 관리자 (localhost만)
  - name: admin
    kind: http.service
    addr: "127.0.0.1:9090"
    lifecycle:
      auto_start: true
```

<warning>
TLS 종료는 일반적으로 리버스 프록시(Nginx, Caddy, 로드 밸런서)가 처리합니다. Wippy의 HTTP 서버로 전달하도록 프록시를 설정하세요.
</warning>

## 참고

- [라우팅](http/router.md) - 라우터와 엔드포인트
- [정적 파일](http/static.md) - 정적 파일 서빙
- [미들웨어](http/middleware.md) - 사용 가능한 미들웨어
- [보안](system/security.md) - 보안 정책
- [WebSocket Relay](http/websocket-relay.md) - WebSocket 메시징
