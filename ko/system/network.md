---
title: "네트워크 오버레이"
description: "SOCKS5, Tor, Tailscale 또는 I2P 오버레이를 통해 아웃바운드 연결을 라우팅하고 리스너를 바인딩합니다."
---

# 네트워크 오버레이

네트워크 오버레이 엔트리는 SOCKS5, Tor, Tailscale 또는 I2P를 통해 아웃바운드
연결을 라우팅하거나 리스너를 바인딩합니다. 선택한 오버레이는 함수, 프로세스,
HTTP 경계를 넘어 전파됩니다.

이 페이지는 설정 레퍼런스입니다. YAML 펜스는 엔트리 또는 애플리케이션 설정
조각이며 외부 프록시, tailnet 또는 I2P SAM 서비스가 이미 존재한다고 가정합니다.

## 엔트리 종류

| 종류 | 설명 |
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

`host`와 `port`는 필수입니다. `isolate_streams`의 기본값은 `false`입니다. 격리를
활성화하면 런타임은 설정된 자격 증명 대신 다이얼마다 새로운 사용자 이름과
비밀번호를 생성합니다.

## Tailscale

```yaml
- name: tailnet
  kind: network.tailscale
  hostname: "wippy-node"
  auth_key: ${env:TS_AUTHKEY}
  ephemeral: false
  control_url: ""
```

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `hostname` | string | tsnet 노드 이름 (노드별 상태 디렉토리에서 사용) |
| `auth_key` | string | Tailnet 인증 키 — 인라인 또는 [env 레지스트리](system/env.md)를 통해 해석되는 `${env:NAME}` |
| `state_dir` | string | tsnet 상태 디렉토리 재정의 |
| `control_url` | string | 대체 조정 서버 |
| `ephemeral` | bool | 임시 tailnet 노드로 등록 |

`auth_key`는 필수입니다(직접 지정하거나 `${env:NAME}`으로 제공). 레거시 `auth_key_env` 디렉티브도 동일한 방식으로 해석되지만 더 이상 사용되지 않습니다. `auth_key: ${env:NAME}`을 사용하세요.

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

`host`와 `port`는 필수입니다. `session_name`의 기본값은 `wippy`이며 다이얼 및
리스너별 SAM 세션 ID의 접두사로 사용됩니다.

## 오버레이 선택

### `http.service`에서

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

local caller, err = funcs.new():with_options({ network = "app.net:proxy" })
if err then return nil, err end
local result, call_err = caller:call("app.api:fetch_data")
if call_err then return nil, call_err end
```

```lua
local process = require("process")

local pid, err = process.with_options({ network = "app.net:tailnet" })
    :spawn_monitored("app.workers:probe", "app:processes")
if err then return nil, err end
```

사용자 지정 옵션으로 프로세스 spawner를 구성하려면 `context`에 대한
`process.context` 권한도 필요합니다. 거부되면 spawner가 반환되기 전에 Lua 오류가
발생하며, 선택한 네트워크 ID에 대해서는 `network.select`가 별도로 검사됩니다.

`http_client` 모듈은 호출별 옵션에서 `overlay_network` 키를 통해 동일한 오버레이 선택을 받습니다.

## 상속

오버레이 선택은 호출 스택을 통해 전파됩니다. `funcs.new():with_options({network=...})`로
호출된 함수는 새 경계가 다른 오버레이를 선택하지 않는 한 내부 다이얼, 중첩 호출,
생성된 프로세스에 해당 오버레이를 사용합니다. 빈 `network` 옵션은 "재정의 없음"을
의미하며 상속된 오버레이나 애플리케이션 기본값을 지우지 않습니다.

함수 호출에서는 네트워크를 선택하기 전에 런타임 옵션이 함수 엔트리의
`meta.options`를 재정의합니다. 새 함수 또는 프로세스 경계에서는 비어 있지 않은
`options.network`가 먼저 선택됩니다. 없으면 설정된 `network_service.default_network`가
선택되고, 둘 다 없으면 상속된 프레임 선택이 유지됩니다. 선택한 ID는 이미 등록되어
있어야 합니다. 알 수 없는 ID는 호스트 네트워크로 폴백하지 않고 호출이나 spawn을 실패시킵니다.

앰비언트 상속은 후손 자체의 `network.select` 거부 규칙을 우회합니다. Lua 경계에서의 명시적 선택만 게이트됩니다.

## 앱 구성

오버레이 드라이버는 `.wippy.yaml`의 `network_service:` 블록에서 앱 전역 설정을 읽습니다:

```yaml
network_service:
  state_dir: .wippy/net          # base dir for driver state (Tailscale keys, etc.)
  default_network: app.net:tailnet  # overlay applied when no call sets one
```

| 필드 | 기본값 | 설명 |
|------|----------|--------------|
| `state_dir` | `.wippy/net` | 드라이버 상태 디렉터리. 상대 경로는 부트 config 디렉터리를 기준으로 해석됩니다. |
| `default_network` | — | 옵션을 통해 자체 네트워크를 설정하지 않는 모든 작업 또는 프로세스에 적용되는 오버레이의 레지스트리 ID. |

## Raw 다이얼

오버레이 선택은 Lua 경계에만 국한되지 않습니다. 런타임 네트워크 서비스를 통한 다이얼 — WASM [`socket` 호스트](wasm/hosts.md#socket)와 `wasi:sockets` 디스패처 — 은 프레임에서 오버레이를 읽어 그 경로로 라우팅합니다. 오버레이가 `with_options`로 설정되었든, 엔트리의 `meta.options.network`로 설정되었든, `network_service.default_network`로 설정되었든 동일합니다.

프라이빗 IP 게이트는 이 경로에서 다르게 동작합니다. 직접 다이얼은 대상을 해석하고 그 결과 나온 모든 주소를 `socket.private_ip`에 대해 검사합니다. 오버레이가 선택된 경우에는 대상에 들어 있는 리터럴 IP 주소만 검사합니다. 호스트 이름은 오버레이가 해석하도록 넘겨지므로 로컬 리졸버는 전혀 사용되지 않고, 그것이 반환했을 값에 대한 검사도 이루어지지 않습니다.

오버레이가 선택되었지만 컨텍스트에 네트워크 레지스트리가 없으면 다이얼은 `network "<id>" selected without a network registry`로 실패합니다.

## 오버레이 업데이트

오버레이 엔트리는 레지스트리 업데이트 시 교체됩니다. 드라이버는 전환 전에 교체
서비스를 빌드하며, 생성에 실패하면 기존 오버레이가 계속 실행됩니다. 성공한 교체는
새 조회에 대해 원자적이며 이후 이전 서비스가 닫힙니다. 따라서 이전 서비스를 이미
사용 중인 작업은 해당 종료를 관찰할 수 있습니다.

## 권한

| 액션 | 리소스 | 설명 |
|--------|----------|-------------|
| `network.select` | 네트워크 Registry ID | `funcs.call`, `process.spawn`, `http_client`에서 명시적 오버레이 선택 |
| `network.bind` | 네트워크 Registry ID | 오버레이를 통해 `http.service` 리스너를 바인딩(`network:` 필드) |
| `socket.connect` | `host:port` | 네트워크 서비스를 통한 모든 아웃바운드 다이얼 |
| `socket.listen` | `host:port` | 네트워크 서비스를 통한 TCP 리스너 또는 UDP 소켓 바인딩 |
| `socket.resolve` | 호스트 이름 | 네트워크 서비스를 통한 DNS 해석 |
| `socket.private_ip` | IP 주소 | 루프백, 프라이빗, 링크 로컬 또는 unspecified 주소에 대한 접근 |

범위에서 `network.select`를 거부하여 그 안의 코드가 명시적으로 오버레이를 선택하지 못하도록 합니다. 상속된 오버레이는 영향을 받지 않습니다 — 호출자에서 권한이 부여되었습니다. `network.bind`는 `network:` 오버레이가 설정된 서버가 리스너를 시작할 때 검사됩니다.

`socket.*` 권한은 네트워크 서비스 자체가 검사합니다. `socket.connect`, `socket.listen`, `socket.resolve`는 오버레이 라우팅 이전에 검사되므로 클리어넷 트래픽과 오버레이 트래픽에 동일하게 적용됩니다. `socket.private_ip`는 오버레이가 선택되면 [Raw 다이얼](system/network.md#raw-다이얼)에서 설명한 대로 리터럴 주소로 범위가 좁혀집니다.

## 참고

- [보안](system/security.md) - 정책 및 액터
- [HTTP 서비스](http/server.md) - 서버 바인딩
- [HTTP 클라이언트](lua/http/client.md) - 호출별 오버레이 선택
- [호스트 함수](wasm/hosts.md) - WASM 소켓 임포트
