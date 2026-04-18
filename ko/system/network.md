# 네트워크 오버레이

오버레이 네트워크(SOCKS5 프록시, Tor, Tailscale 메시, I2P)를 통해 아웃바운드 트래픽을 라우팅하고 리스너를 바인딩합니다. 오버레이 선택은 호출별로 옵트인이며 함수, 프로세스 및 HTTP 경계를 거쳐 상속됩니다.

## 엔트리 종류

| Kind | 설명 |
|------|-------------|
| `network.socks5` | 일반 SOCKS5 프록시 (Tor의 SOCKS5 리스너도 포함) |
| `network.tailscale` | Tailscale tsnet 오버레이 노드 |
| `network.i2p` | I2P SAM v3 브리지 |

## SOCKS5

```yaml
- name: proxy
  kind: network.socks5
  host: 127.0.0.1
  port: 1080
  username: "optional"
  password: "optional"
  isolate_streams: false
```

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `host` | string | 프록시 호스트 |
| `port` | int | 프록시 포트 (1-65535) |
| `username` | string | 선택적 SOCKS5 인증 |
| `password` | string | 선택적 SOCKS5 인증 |
| `isolate_streams` | bool | 연결별 랜덤 자격 증명 (Tor 스트림 격리) |

## Tailscale

```yaml
- name: tailnet
  kind: network.tailscale
  hostname: "wippy-node"
  auth_key_env: "TS_AUTHKEY"
  ephemeral: false
  control_url: ""
```

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `hostname` | string | tsnet 노드 이름 (노드별 상태 디렉토리에서 사용) |
| `auth_key` | string | 인라인 tailnet 인증 키 |
| `auth_key_env` | string | 인증 키를 담고 있는 환경 변수 이름 (env 레지스트리를 통해 해결) |
| `state_dir` | string | tsnet 상태 디렉토리 재정의 |
| `control_url` | string | 대체 조정 서버 |
| `ephemeral` | bool | 임시 tailnet 노드로 등록 |

`auth_key` 또는 `auth_key_env` 중 하나가 필요합니다.

## I2P

```yaml
- name: i2p_bridge
  kind: network.i2p
  host: 127.0.0.1
  port: 7656
  session_name: "wippy"
```

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `host` | string | SAM v3 브리지 호스트 |
| `port` | int | SAM v3 브리지 포트 |
| `session_name` | string | 선택적 세션 식별자 |

## 오버레이 선택

### http.service에서

오버레이(Tailscale, I2P)를 통해 서버 리스너를 바인딩합니다:

```yaml
- name: gateway
  kind: http.service
  addr: ":8080"
  network: app.net:tailnet
```

SOCKS5는 인바운드 수신을 지원하지 않습니다 — 아웃바운드 다이얼에만 사용하세요.

### Lua에서

`with_options`를 사용하여 호출된 함수나 생성된 프로세스를 오버레이를 통해 라우팅합니다:

```lua
local funcs = require("funcs")

local result, err = funcs.new()
    :with_options({ network = "app.net:proxy" })
    :call("app.api:fetch_data")
```

```lua
local pid, err = process.with_options({ network = "app.net:tailnet" })
    :spawn_monitored("app.workers:probe", "app:processes")
```

`httpclient` 모듈은 호출별 옵션에서 동일한 키를 받습니다.

## 상속

오버레이 선택은 호출 스택을 따라 흐릅니다. `funcs.new():with_options({network=...})`를 통해 호출된 함수는 모든 내부 다이얼, 모든 중첩된 `funcs.call`, 수행하는 모든 `process.spawn`에서 오버레이를 봅니다 — 후손이 명시적으로 다른 오버레이를 선택하거나 지울 때까지.

앰비언트 상속은 후손 자체의 `network.select` 거부 규칙을 우회합니다. Lua 경계에서의 명시적 선택만 게이트됩니다.

## 권한

| 액션 | 리소스 | 설명 |
|--------|----------|-------------|
| `network.select` | 네트워크 Registry ID | `funcs.call`, `process.spawn`, `http_client`에서 명시적 오버레이 선택 |

범위에서 `network.select`를 거부하여 그 안의 코드가 명시적으로 오버레이를 선택하지 못하도록 합니다. 상속된 오버레이는 영향을 받지 않습니다 — 호출자에서 권한이 부여되었습니다.

## 참고

- [보안](system/security.md) - 정책 및 액터
- [HTTP 서비스](http/server.md) - 서버 바인딩
- [HTTP 클라이언트](lua/http/client.md) - 호출별 오버레이 선택
