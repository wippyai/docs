---
title: "Redes de Sobreposição"
description: "Roteie chamadas HTTP de saída e processos gerados por SOCKS5, com uma receita parcial de integração Tailscale."
---

# Redes de Sobreposição

Configure um overlay SOCKS5 para chamadas HTTP de saída e revise herança, listeners de entrada, padrões da aplicação e permissões.

**Classificação:** tutorial SOCKS5 executável com receita Tailscale parcial. A sondagem direta/Tor é completa quando há um listener Tor externo. A seção Tailscale explica a integração Wippy, mas deixa o provisionamento da conta para o Tailscale. Para I2P, use a referência do sistema abaixo.

## Visão Geral

O Wippy suporta redes de sobreposição que transportam de forma transparente o tráfego originado de funções, processos e clientes HTTP. Cada sobreposição é uma entrada de registro; o código opta por ela por chamada, e a seleção é herdada pelas chamadas internas até que um descendente a substitua explicitamente.

O Wippy oferece três tipos de entrada de overlay:

- `network.socks5` — proxy SOCKS5 genérico (também o listener SOCKS5 do Tor)
- `network.tailscale` — nó de sobreposição tsnet
- `network.i2p` — bridge SAM v3 do I2P

## Pré-requisitos

- Runtime Wippy `v0.3.32a`.
- `curl` e acesso HTTPS a `api.ipify.org`.
- Um daemon Tor expondo SOCKS5 em `127.0.0.1:9050`. Instale-o pelo [Tor Project](https://www.torproject.org/download/tor/), inicie-o e verifique:

  ```bash
  curl --socks5-hostname 127.0.0.1:9050 https://api.ipify.org?format=json
  ```

  Uma verificação bem-sucedida retorna um JSON que contém um endereço IP.

  O Tor Browser costuma usar 9150; nesse caso, altere juntos a entrada e o comando.
- Um diretório vazio:

  ```bash
  mkdir netdemo
  cd netdemo
  mkdir src
  ```

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

A opção `overlay_network` seleciona a sobreposição apenas para aquela chamada HTTP. Sem ela, o dial usa o padrão do processo: `network_service.default_network` em `.wippy.yaml`, ou uma conexão direta quando nenhum padrão está definido.

## Passo 3: Executar

```bash
wippy init
wippy run probe
```

Com o Tor rodando localmente:

```
direct IP: <your public IP>
tor IP:    <Tor exit IP>
```

As duas linhas devem conter endereços IP válidos. Normalmente eles são diferentes; a prova importante é que a requisição roteada só tem sucesso por meio do listener SOCKS configurado.

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

O Tailscale também pode aceitar listeners HTTP. Anexe o overlay ao `http.service` em vez do cliente:

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

## Solução de Problemas e Limpeza

- `connection refused` em `127.0.0.1:9050` indica que o Tor não está ouvindo na porta configurada.
- `access denied` na chamada roteada indica ausência de `network.select` para `app:tor`; mantenha `app:probe_policy` em `meta.command.security`.
- O driver SOCKS5 nunca faz fallback para conexão direta.
- O exemplo SOCKS5 não cria estado persistente. Uma entrada Tailscale pode persistir em `.wippy/net/tailscale/`; remova `.wippy/net` somente após parar o Wippy e quando quiser descartar a identidade local.

## Próximos Passos

- [Sistema de Rede](../system/network.md) - Referência de tipos de entrada
- [Cliente HTTP](../lua/http/client.md) - Opções de overlay por chamada
- [Modelo de Segurança](../system/security.md) - Políticas e escopos
- [Autenticação](auth.md) - Segurança baseada em tokens
