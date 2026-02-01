# HTTP 미들웨어

미들웨어는 라우트 처리 전후로 HTTP 요청을 처리합니다.

## 미들웨어 작동 방식

미들웨어는 처리 로직을 추가하기 위해 HTTP 핸들러를 래핑합니다. 각 미들웨어는 옵션 맵을 받고 핸들러 래퍼를 반환합니다:

```yaml
middleware:
  - cors
  - ratelimit
options:
  cors.allow.origins: "https://example.com"
  ratelimit.requests: "100"
```

옵션은 점 표기법 사용: `middleware_name.option.name`. 이전 밑줄 형식도 하위 호환성을 위해 지원됩니다.

## 매칭 전 vs 매칭 후

<tip>
<b>매칭 전</b>은 라우트 매칭 전에 실행—CORS와 압축 같은 공통 관심사에 사용.
<b>매칭 후</b>는 라우트 매칭 후에 실행—라우트 정보가 필요한 인가에 사용.
</tip>

```yaml
middleware:        # 매칭 전
  - cors
  - compress
options:
  cors.allow.origins: "*"

post_middleware:   # 매칭 후
  - endpoint_firewall
post_options:
  endpoint_firewall.action: "access"
```

---

## 사용 가능한 미들웨어

### CORS {#cors}

<note>매칭 전</note>

브라우저 요청을 위한 Cross-Origin Resource Sharing.

```yaml
middleware:
  - cors
options:
  cors.allow.origins: "https://app.example.com"
  cors.allow.credentials: "true"
```

| 옵션 | 기본값 | 설명 |
|--------|---------|-------------|
| `cors.allow.origins` | `*` | 허용된 오리진 (쉼표 구분, `*.example.com` 지원) |
| `cors.allow.methods` | `GET,POST,PUT,DELETE,OPTIONS,PATCH` | 허용된 메서드 |
| `cors.allow.headers` | `Origin,Content-Type,Accept,Authorization,X-Requested-With` | 허용된 요청 헤더 |
| `cors.expose.headers` | - | 클라이언트에 노출되는 헤더 |
| `cors.allow.credentials` | `false` | 쿠키/인증 허용 |
| `cors.max.age` | `86400` | 프리플라이트 캐시 (초) |
| `cors.allow.private.network` | `false` | 프라이빗 네트워크 접근 |

OPTIONS 프리플라이트 요청은 자동으로 처리됩니다.

---

### 레이트 리미팅 {#ratelimit}

<note>매칭 전</note>

키별 추적이 있는 토큰 버킷 레이트 리미팅.

```yaml
middleware:
  - ratelimit
options:
  ratelimit.requests: "100"
  ratelimit.window: "1m"
  ratelimit.key: "ip"
```

| 옵션 | 기본값 | 설명 |
|--------|---------|-------------|
| `ratelimit.requests` | `100` | 윈도우당 요청 수 |
| `ratelimit.window` | `1m` | 시간 윈도우 |
| `ratelimit.burst` | `20` | 버스트 용량 |
| `ratelimit.key` | `ip` | 키 전략 |
| `ratelimit.cleanup_interval` | `5m` | 정리 빈도 |
| `ratelimit.entry_ttl` | `10m` | 항목 만료 |
| `ratelimit.max_entries` | `100000` | 최대 추적 키 |

**키 전략:** `ip`, `header:X-API-Key`, `query:api_key`

헤더와 함께 `429 Too Many Requests` 반환: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

---

### 압축 {#compress}

<note>매칭 전</note>

응답에 대한 Gzip 압축.

```yaml
middleware:
  - compress
options:
  compress.level: "default"
  compress.min.length: "1024"
```

| 옵션 | 기본값 | 설명 |
|--------|---------|-------------|
| `compress.level` | `default` | `fastest`, `default`, 또는 `best` |
| `compress.min.length` | `1024` | 최소 응답 크기 (바이트) |

클라이언트가 `Accept-Encoding: gzip`을 보낼 때만 압축.

---

### Real IP {#real_ip}

<note>매칭 전</note>

프록시 헤더에서 클라이언트 IP 추출.

```yaml
middleware:
  - real_ip
options:
  real_ip.trusted.subnets: "10.0.0.0/8,172.16.0.0/12"
```

| 옵션 | 기본값 | 설명 |
|--------|---------|-------------|
| `real_ip.trusted.subnets` | 프라이빗 네트워크 | 신뢰할 수 있는 프록시 CIDR |
| `real_ip.trust_all` | `false` | 모든 소스 신뢰 (비보안) |

**헤더 우선순위:** `True-Client-IP` > `X-Real-IP` > `X-Forwarded-For`

---

### 토큰 인증 {#token_auth}

<note>매칭 전</note>

토큰 기반 인증. 토큰 스토어 설정은 [보안](system-security.md) 참조.

```yaml
middleware:
  - token_auth
options:
  token_auth.store: "app:tokens"
```

| 옵션 | 기본값 | 설명 |
|--------|---------|-------------|
| `token_auth.store` | 필수 | 토큰 스토어 레지스트리 ID |
| `token_auth.header.name` | `Authorization` | 헤더 이름 |
| `token_auth.header.prefix` | `Bearer ` | 헤더 프리픽스 |
| `token_auth.query.param` | `x-auth-token` | 쿼리 파라미터 폴백 |
| `token_auth.cookie.name` | `x-auth-token` | 쿠키 폴백 |

다운스트림 미들웨어를 위해 컨텍스트에 액터와 보안 스코프를 설정합니다. 요청을 차단하지 않음—인가는 방화벽 미들웨어에서 발생.

---

### 메트릭 {#metrics}

<note>매칭 전</note>

Prometheus 스타일 HTTP 메트릭. 설정 옵션 없음.

```yaml
middleware:
  - metrics
```

| 메트릭 | 타입 | 설명 |
|--------|------|-------------|
| `wippy_http_requests_total` | Counter | 총 요청 수 |
| `wippy_http_request_duration_seconds` | Histogram | 요청 지연 |
| `wippy_http_requests_in_flight` | Gauge | 동시 요청 |

---

### 엔드포인트 방화벽 {#endpoint_firewall}

<warning>매칭 후</warning>

매칭된 엔드포인트 기반 인가. `token_auth`의 액터 필요.

```yaml
post_middleware:
  - endpoint_firewall
post_options:
  endpoint_firewall.action: "access"
```

| 옵션 | 기본값 | 설명 |
|--------|---------|-------------|
| `endpoint_firewall.action` | `access` | 확인할 권한 액션 |

`401 Unauthorized` (액터 없음) 또는 `403 Forbidden` (권한 거부) 반환.

---

### 리소스 방화벽 {#resource_firewall}

<warning>매칭 후</warning>

ID로 특정 리소스 보호. 라우터 레벨에서 유용.

```yaml
post_middleware:
  - resource_firewall
post_options:
  resource_firewall.action: "admin"
  resource_firewall.target: "app:admin-panel"
```

| 옵션 | 기본값 | 설명 |
|--------|---------|-------------|
| `resource_firewall.action` | `access` | 권한 액션 |
| `resource_firewall.target` | 필수 | 리소스 레지스트리 ID |

---

### Sendfile {#sendfile}

<note>매칭 전</note>

핸들러에서 `X-Sendfile` 헤더로 파일 서빙.

```yaml
middleware:
  - sendfile
options:
  sendfile.fs: "app:downloads"
```

핸들러가 파일 서빙을 트리거하기 위해 헤더 설정:

| 헤더 | 설명 |
|--------|-------------|
| `X-Sendfile` | 파일시스템 내 파일 경로 |
| `X-File-Name` | 다운로드 파일명 |

재개 가능한 다운로드를 위한 범위 요청 지원.

---

### WebSocket 릴레이 {#websocket_relay}

<warning>매칭 후</warning>

프로세스로 WebSocket 연결 릴레이. [WebSocket 릴레이](http-websocket-relay.md) 참조.

```yaml
post_middleware:
  - websocket_relay
post_options:
  wsrelay.allowed.origins: "https://app.example.com"
```

---

## 미들웨어 순서

미들웨어는 나열된 순서로 실행됩니다. 권장 순서:

```yaml
middleware:
  - real_ip       # 1. 먼저 실제 IP 추출
  - cors          # 2. CORS 프리플라이트 처리
  - compress      # 3. 응답 압축 설정
  - ratelimit     # 4. 레이트 제한 확인
  - metrics       # 5. 메트릭 기록
  - token_auth    # 6. 요청 인증

post_middleware:
  - endpoint_firewall  # 라우트 매칭 후 인가
```

## 참고

- [라우팅](http-router.md) - 라우터 설정
- [보안](system-security.md) - 토큰 스토어 및 정책
- [WebSocket 릴레이](http-websocket-relay.md) - WebSocket 처리
- [터미널](system-terminal.md) - 터미널 서비스
