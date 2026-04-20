# 네트워크 오버레이

SOCKS5, Tailscale, 또는 I2P 오버레이를 통해 아웃바운드 HTTP 호출과 스폰된 프로세스를 라우팅합니다.

## 개요

Wippy는 함수, 프로세스, HTTP 클라이언트에서 발생하는 트래픽을 투명하게 전달하는 오버레이 네트워크를 지원합니다. 각 오버레이는 레지스트리 엔트리이며, 코드는 호출 단위로 선택하고 해당 선택은 하위 호출에 상속됩니다 — 하위 항목이 명시적으로 재정의하지 않는 한.

지원되는 오버레이:

- `network.socks5` — 범용 SOCKS5 프록시 (Tor의 SOCKS5 리스너도 포함)
- `network.tailscale` — tsnet 오버레이 노드
- `network.i2p` — I2P SAM v3 브릿지

## 프로젝트 구조

```
netdemo/
├── wippy.lock
└── src/
    ├── _index.yaml
    └── probe.lua
```

## 1단계: 오버레이 정의

`src/_index.yaml` 생성:

```yaml
version: "1.0"
namespace: app

entries:
  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true

  # SOCKS5 프록시 엔트리 (Tor는 기본적으로 127.0.0.1:9050에 노출)
  - name: tor
    kind: network.socks5
    host: 127.0.0.1
    port: 9050
    isolate_streams: true

  - name: probe
    kind: process.lua
    meta:
      command:
        name: probe
        short: Check outbound IP through overlays
    source: file://probe.lua
    method: main
    modules:
      - io
      - http_client
      - json
```

`isolate_streams: true`는 SOCKS5 드라이버가 연결마다 임의의 자격증명을 생성하도록 하여 Tor가 각 다이얼에 대해 새로운 회로를 열게 합니다.

## 2단계: 아웃바운드 호출 라우팅

`src/probe.lua` 생성:

```lua
local io = require("io")
local http_client = require("http_client")
local json = require("json")

local function fetch_ip(overlay)
    local options = { timeout = "15s" }
    if overlay then
        options.overlay_network = overlay
    end

    local resp, err = http_client.get("https://api.ipify.org?format=json", options)
    if err then
        return nil, tostring(err)
    end
    if resp.status_code ~= 200 then
        return nil, "HTTP " .. resp.status_code
    end

    local body = json.decode(resp.body or "")
    return body and body.ip, nil
end

local function main()
    local direct, d_err = fetch_ip(nil)
    if d_err then
        io.print("direct failed: " .. d_err)
    else
        io.print("direct IP: " .. direct)
    end

    local routed, r_err = fetch_ip("app:tor")
    if r_err then
        io.print("tor failed: " .. r_err)
    else
        io.print("tor IP:    " .. routed)
    end

    return 0
end

return { main = main }
```

`http_client`의 `overlay_network` 옵션은 해당 호출에만 오버레이를 선택합니다. 지정하지 않으면 다이얼은 프로세스 기본값(`.wippy.yaml`의 `network_service.default_network` 또는 직접 연결)을 통해 진행됩니다.

## 3단계: 실행

```bash
wippy init
wippy run probe
```

Tor가 로컬에서 실행 중인 경우:

```
direct IP: 203.0.113.42
tor IP:    185.220.101.61
```

Tor가 실행 중이지 않으면 `tor IP` 줄에 다이얼 오류가 표시됩니다 — SOCKS5 오버레이는 직접 연결로 자동 폴백하지 않습니다.

## 상속

오버레이 선택은 중첩 호출을 통해 흐릅니다. `funcs.call` 또는 `process.spawn` 경계에서 한 번 오버레이를 선택하면 명시적 재정의가 있을 때까지 그 아래의 모든 내부 HTTP 호출, 중첩된 `funcs.call`, `process.spawn`이 이를 사용합니다:

```lua
local funcs = require("funcs")

local result, err = funcs.new()
    :with_options({ network = "app:tor" })
    :call("app:scrape_site", url)
```

```lua
local pid, err = process.with_options({ network = "app:tor" })
    :spawn_monitored("app.workers:probe", "app:processes")
```

중첩된 함수나 스폰된 프로세스는 명시적으로 전달하지 않아도 모든 아웃고잉 다이얼에서 오버레이를 사용합니다.

## 리스너 바인딩

인바운드 트래픽을 지원하는 오버레이(Tailscale, I2P)는 HTTP 리스너도 수신할 수 있습니다. 클라이언트 대신 `http.service`에 오버레이를 첨부합니다:

```yaml
  - name: tailnet
    kind: network.tailscale
    hostname: wippy-node
    auth_key_env: TS_AUTHKEY
    ephemeral: true

  - name: gateway
    kind: http.service
    addr: ":8080"
    network: app:tailnet
    lifecycle:
      auto_start: true
```

서버는 tailnet 인터페이스에 바인딩되고 클라이언트는 Tailscale 주소를 통해 접근합니다. SOCKS5는 아웃바운드 전용으로 `http.service`에 할당하면 거부됩니다.

## 앱 전체 기본값

`.wippy.yaml`에서 기본 오버레이를 설정하면 재정의하지 않는 한 모든 호출이 이를 사용합니다:

```yaml
network_service:
  state_dir: .wippy/net
  default_network: app:tor
```

`network = nil`로 명시적 선택을 하면 해당 호출에서 기본값이 지워집니다.

## 권한

`network.select` 액션은 명시적 오버레이 선택을 제어합니다. 스코프에서 거부하면 해당 코드가 오버레이를 선택할 수 없습니다:

```yaml
  - name: deny_network
    kind: security.policy
    policy:
      actions: "network.select"
      resources: "*"
      effect: deny
    groups:
      - untrusted
```

상속된 오버레이는 이 검사를 우회합니다 — 이는 호출자 경계에서 이미 승인된 것입니다. Lua 경계에서의 명시적 재선택만 제한됩니다.

## 다음 단계

- [네트워크 시스템](system/network.md) - 엔트리 종류 참조
- [HTTP 클라이언트](lua/http/client.md) - 호출별 오버레이 옵션
- [보안 모델](system/security.md) - 정책 및 스코프
- [인증](tutorials/auth.md) - 토큰 기반 보안
