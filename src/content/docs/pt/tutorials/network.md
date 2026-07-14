---
title: "Redes de Sobreposição"
---

# Redes de Sobreposição

Roteie chamadas HTTP de saída e processos criados através de sobreposições SOCKS5, Tailscale ou I2P.

## Visão Geral

O Wippy suporta redes de sobreposição que transportam de forma transparente o tráfego originado de funções, processos e clientes HTTP. Cada sobreposição é uma entrada de registro; o código opta por ela por chamada, e a seleção é herdada pelas chamadas internas até que um descendente a substitua explicitamente.

Sobreposições suportadas:

- `network.socks5` — proxy SOCKS5 genérico (também o listener SOCKS5 do Tor)
- `network.tailscale` — nó de sobreposição tsnet
- `network.i2p` — bridge SAM v3 do I2P

## Estrutura do Projeto

```
netdemo/
├── wippy.lock
└── src/
    ├── _index.yaml
    └── probe.lua
```

## Passo 1: Definir uma Sobreposição

Crie `src/_index.yaml`:

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

  # Entrada de proxy SOCKS5 (o Tor expõe um em 127.0.0.1:9050 por padrão)
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

`isolate_streams: true` faz o driver SOCKS5 gerar credenciais aleatórias por conexão, de modo que o Tor abre um circuito novo para cada dial.

## Passo 2: Rotear Chamadas de Saída

Crie `src/probe.lua`:

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

A opção `overlay_network` no `http_client` seleciona a sobreposição apenas para aquela chamada. Sem ela, o dial usa o padrão do processo (definido via `network_service.default_network` em `.wippy.yaml` ou direto).

## Passo 3: Executar

```bash
wippy init
wippy run probe
```

Com o Tor rodando localmente:

```
direct IP: 203.0.113.42
tor IP:    185.220.101.61
```

Se o Tor não estiver em execução, a linha `tor IP` reportará um erro de dial — a sobreposição SOCKS5 não recorre silenciosamente a uma conexão direta.

## Herança

A seleção de sobreposição flui pelas chamadas aninhadas. Escolha a sobreposição uma vez na borda de um `funcs.call` ou `process.spawn` e toda chamada HTTP interna, `funcs.call` aninhado e `process.spawn` subsequente a utilizará até uma substituição explícita:

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

A função aninhada ou processo criado verá a sobreposição em todo dial de saída sem precisar passá-la explicitamente.

## Vinculando um Listener

Sobreposições que suportam tráfego de entrada (Tailscale, I2P) também podem aceitar listeners HTTP. Anexe a sobreposição ao `http.service` em vez do cliente:

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

O servidor vincula na interface tailnet; os clientes o acessam via endereço Tailscale. SOCKS5 é apenas de saída — atribuí-lo a um `http.service` é rejeitado.

## Padrão para a Aplicação Inteira

Defina uma sobreposição padrão em `.wippy.yaml` para que todas as chamadas a utilizem, salvo substituição:

```yaml
network_service:
  state_dir: .wippy/net
  default_network: app:tor
```

A seleção explícita com `network = nil` cancela o padrão para aquela chamada.

## Permissões

A ação `network.select` controla a seleção explícita de sobreposição. Negue-a em um escopo para impedir que o código escolha uma sobreposição:

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

Sobreposições herdadas ignoram essa verificação — elas foram autorizadas na borda do chamador. Apenas a reseleção explícita em uma fronteira Lua é controlada.

## Próximos Passos

- [Network System](system/network.md) - Referência de tipos de entrada
- [HTTP Client](lua/http/client.md) - Opções de sobreposição por chamada
- [Security Model](system/security.md) - Políticas e escopos
- [Authentication](tutorials/auth.md) - Segurança baseada em token
