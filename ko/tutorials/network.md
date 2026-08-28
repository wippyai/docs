---
title: "네트워크 오버레이"
description: "SOCKS5를 통해 아웃바운드 HTTP 호출과 생성된 프로세스를 라우팅하고 부분적인 Tailscale 통합 구성을 살펴봅니다."
---

# 네트워크 오버레이

아웃바운드 HTTP 호출용 SOCKS5 오버레이를 구성한 다음 상속, 인바운드 리스너, 애플리케이션 기본값, 권한을 살펴봅니다.

**분류:** 실행 가능한 SOCKS5 튜토리얼과 부분적인 Tailscale 구성법. 외부 Tor 리스너가 준비되면 직접/Tor 프로브는 완전하게 실행할 수 있습니다. Tailscale 섹션은 Wippy 연결 방법을 설명하지만 계정 프로비저닝은 의도적으로 Tailscale에 맡깁니다. I2P 구성은 아래에 연결된 네트워크 시스템 참조를 사용하세요.

## 개요

Wippy는 오버레이 네트워크를 레지스트리 엔트리로 표현합니다. 코드는 호출에 사용할 오버레이를 선택할 수 있으며, 후손이 재정의할 때까지 해당 선택이 중첩 호출로 전파됩니다.

Wippy는 세 가지 오버레이 엔트리 종류를 지원합니다.

- `network.socks5` — 범용 SOCKS5 프록시(Tor의 SOCKS5 리스너 포함)
- `network.tailscale` — tsnet 오버레이 노드
- `network.i2p` — I2P SAM v3 브리지

## 사전 요구 사항

- Wippy 런타임 `v0.3.32a`
- `curl` 및 `api.ipify.org`에 대한 아웃바운드 HTTPS 접근
- `127.0.0.1:9050`에서 SOCKS5를 제공하는 Tor 데몬. [Tor 프로젝트 다운로드 페이지](https://www.torproject.org/download/tor/)에서 지원 패키지를 설치하고 시작한 뒤, Wippy를 실행하기 전에 리스너를 확인하세요.

  ```bash
  curl --socks5-hostname 127.0.0.1:9050 https://api.ipify.org?format=json
  ```

  확인에 성공하면 IP 주소가 포함된 JSON을 반환합니다. Tor Browser는 흔히 포트 9150을 사용합니다. 의도적으로 그 리스너를 사용한다면 레지스트리 엔트리와 확인 명령을 함께 변경하세요.
- 빈 작업 디렉터리:

  ```bash
  mkdir netdemo
  cd netdemo
  mkdir src
  ```

## 프로젝트 구조

```
netdemo/
├── wippy.lock
└── src/
    ├── _index.yaml
    └── probe.lua
```

## 1단계: 오버레이 정의

`src/_index.yaml`을 만듭니다.

```yaml
version: "1.0"
namespace: app

entries:
  - name: probe_policy
    kind: security.policy
    policy:
      actions:
        - http_client.request
        - network.select
      resources: "*"
      effect: allow

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true

  # SOCKS5 proxy entry (Tor exposes one at 127.0.0.1:9050 by default)
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
        security:
          actor:
            id: app:probe
          policies:
            - app:probe_policy
    source: file://probe.lua
    method: main
    modules:
      - io
      - http_client
      - json
```

`isolate_streams: true`를 사용하면 SOCKS5 드라이버가 연결마다 임의의 자격 증명을 생성하므로, Tor가 각 다이얼에 새 회로를 열 수 있습니다.

## 2단계: 아웃바운드 호출 라우팅

`src/probe.lua`를 만듭니다.

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

`overlay_network` 옵션은 해당 HTTP 호출에 사용할 오버레이를 선택합니다. 이 옵션이 없으면 다이얼은 프로세스 기본값을 사용합니다. 즉, `.wippy.yaml`의 `network_service.default_network`를 사용하거나 기본값이 없으면 직접 연결합니다.

## 3단계: 실행

```bash
wippy init
wippy run probe
```

Tor가 로컬에서 실행 중이면 다음과 같이 출력됩니다.

```
direct IP: <your public IP>
tor IP:    <Tor exit IP>
```

두 줄 모두 유효한 IP 주소를 포함해야 합니다. 일반적으로 두 주소는 달라야 합니다. 핵심 증거는 라우팅된 요청이 구성된 SOCKS 리스너를 통해서만 성공한다는 것입니다.

Tor가 실행 중이 아니면 `tor IP` 줄에 다이얼 오류가 표시됩니다. SOCKS5 오버레이는 직접 연결로 자동 폴백하지 않습니다.

## 상속

오버레이 선택은 중첩 호출로 전파됩니다. `funcs.call` 또는 `process.spawn` 경계에서 오버레이를 선택하면, 중첩된 HTTP 호출, 함수 호출, 프로세스 생성에 적용되며 그중 하나가 명시적으로 재정의할 때까지 유지됩니다.

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

중첩 함수나 생성된 프로세스는 매번 명시적으로 전달하지 않아도 모든 아웃바운드 다이얼에서 오버레이를 사용합니다.

## 리스너 바인딩

Tailscale은 HTTP 리스너도 받을 수 있습니다. 오버레이를 클라이언트가 아니라 `http.service`에 연결합니다.

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

서버는 tailnet 인터페이스에 바인딩되며, 클라이언트는 Tailscale 주소로 접근합니다. SOCKS5는 아웃바운드 전용이므로 `http.service`에 할당하면 거부됩니다.

## 애플리케이션 전체 기본값

재정의하지 않는 한 모든 호출이 사용하도록 `.wippy.yaml`에 기본 오버레이를 설정합니다.

```yaml
network_service:
  state_dir: .wippy/net
  default_network: app:tor
```

## 권한

`network.select` 작업은 명시적인 오버레이 선택을 제어합니다. 특정 범위에서 이 작업을 거부하면 코드가 오버레이를 선택하지 못합니다.

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

상속된 오버레이는 이 검사를 우회합니다. 호출자 경계에서 이미 권한을 부여받았기 때문입니다. Lua 경계에서 명시적으로 다시 선택하는 경우에만 검사가 적용됩니다.

## 문제 해결과 정리

- `127.0.0.1:9050`의 `connection refused`는 구성한 포트에서 Tor가 수신 중이 아니라는 뜻입니다. Wippy를 디버깅하기 전에 사전 요구 사항의 `curl` 명령으로 Tor를 확인하세요.
- 직접 요청은 실패하고 라우팅 요청은 성공한다면 대개 로컬 DNS, 프록시 또는 방화벽 규칙이 직접 경로에 영향을 주는 것입니다. 두 호출은 서로 독립적입니다.
- 라우팅 호출의 `access denied`는 명령 보안 컨텍스트에 `app:tor`에 대한 `network.select` 권한이 없다는 뜻입니다. `meta.command.security` 아래에 `app:probe_policy`를 연결해 두세요.
- SOCKS5 드라이버는 직접 연결로 폴백하지 않습니다. 데모를 계속 실행하려고 오류를 제거하지 마세요.
- Wippy 명령이 종료되면 중지하고, 이 튜토리얼만을 위해 Tor 데몬을 시작했다면 Tor도 중지합니다. SOCKS5 예제는 지속 네트워크 상태를 만들지 않습니다. Tailscale 엔트리는 `.wippy/net/tailscale/` 아래에 노드 상태를 영속화할 수 있습니다. Wippy를 중지한 뒤 로컬 tailnet ID를 폐기하려는 경우에만 `.wippy/net` 상태 디렉터리를 제거하세요.

## 다음 단계

- [네트워크 시스템](system/network.md) — 엔트리 종류 참조
- [HTTP 클라이언트](lua/http/client.md) — 호출별 오버레이 옵션
- [보안 모델](system/security.md) — 정책과 범위
- [인증](tutorials/auth.md) — 토큰 기반 보안
