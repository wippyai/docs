---
title: "Sobreposições de rede"
---

# Sobreposições de rede

Roteia o tráfego de saída e vincula ouvintes através de redes de sobreposição (proxies SOCKS5, Tor, malha Tailscale, I2P). A seleção de sobreposição é opcional por chamada e é herdada através dos limites de função, processo e HTTP.

## Tipos de entrada

| Kind | Descrição |
|------|-------------|
| `network.socks5` | Proxy SOCKS5 genérico (também cobre o ouvinte SOCKS5 do Tor) |
| `network.tailscale` | Nó de sobreposição Tailscale tsnet |
| `network.i2p` | Ponte I2P SAM v3 |

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

| Campo | Tipo | Descrição |
|-------|------|-------------|
| `host` | string | Host do proxy |
| `port` | int | Porta do proxy (1-65535) |
| `username` | string | Autenticação SOCKS5 opcional |
| `password` | string | Autenticação SOCKS5 opcional |
| `isolate_streams` | bool | Credenciais aleatórias por conexão (isolamento de fluxos do Tor) |

## Tailscale

```yaml
- name: tailnet
  kind: network.tailscale
  hostname: "wippy-node"
  auth_key_env: "TS_AUTHKEY"
  ephemeral: false
  control_url: ""
```

| Campo | Tipo | Descrição |
|-------|------|-------------|
| `hostname` | string | Nome do nó tsnet (usado no diretório de estado por nó) |
| `auth_key` | string | Chave de autenticação tailnet inline |
| `auth_key_env` | string | Nome da variável de ambiente contendo a chave de autenticação (resolvida via registro env) |
| `state_dir` | string | Sobrescrita do diretório de estado tsnet |
| `control_url` | string | Servidor de coordenação alternativo |
| `ephemeral` | bool | Registrar como nó tailnet efêmero |

É necessário `auth_key` ou `auth_key_env`.

## I2P

```yaml
- name: i2p_bridge
  kind: network.i2p
  host: 127.0.0.1
  port: 7656
  session_name: "wippy"
```

| Campo | Tipo | Descrição |
|-------|------|-------------|
| `host` | string | Host da ponte SAM v3 |
| `port` | int | Porta da ponte SAM v3 |
| `session_name` | string | Identificador de sessão opcional |

## Selecionando uma sobreposição

### Em http.service

Vincula o ouvinte do servidor através de uma sobreposição (Tailscale, I2P):

```yaml
- name: gateway
  kind: http.service
  addr: ":8080"
  network: app.net:tailnet
```

SOCKS5 não suporta escuta de entrada — use-o apenas para conexões de saída.

### A partir de Lua

Roteie uma função chamada ou um processo gerado através de uma sobreposição usando `with_options`:

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

O modulo `http_client` aceita a mesma selecao de overlay nas opcoes por chamada sob a chave `overlay_network`.

## Herança

A seleção de sobreposição flui pela pilha de chamadas. Uma função chamada via `funcs.new():with_options({network=...})` vê a sobreposição em cada conexão interna, cada `funcs.call` aninhada e cada `process.spawn` que executa — até que um descendente selecione explicitamente uma sobreposição diferente ou a limpe.

A herança ambiente ignora as próprias regras de negação `network.select` do descendente. Apenas a seleção explícita em uma borda Lua é controlada.

## Configuracao do App

Drivers de overlay leem configuracoes a nivel de app a partir de um bloco `network_service:` em `.wippy.yaml`:

```yaml
network_service:
  state_dir: .wippy/net          # Diretorio base para o estado do driver (chaves do Tailscale, etc.)
  default_network: app.net:tailnet  # Overlay usado quando nenhuma chamada define um
```

| Campo | Padrao | Descricao |
|-------|--------|-----------|
| `state_dir` | `.wippy/net` | Diretorio para o estado do driver. Caminhos relativos sao resolvidos contra o diretorio de config de boot. |
| `default_network` | — | Registry ID de um overlay aplicado a cada tarefa ou processo que nao define sua propria rede via opcoes. |

## Atualizando Overlays

Entradas de overlay são trocadas a quente em atualização do registro. Quando a configuração de um overlay muda, o driver constrói o serviço substituto primeiro e só o troca depois que ele é criado com sucesso; se a nova configuração falhar, o overlay existente continua rodando. Chamadores concorrentes veem o serviço antigo ou o novo, nunca uma lacuna.

## Permissões

| Ação | Recurso | Descrição |
|--------|----------|-------------|
| `network.select` | Registry ID de rede | Seleção explícita de sobreposição em `funcs.call`, `process.spawn`, `http_client` |
| `network.bind` | Registry ID de rede | Vinculação de um listener `http.service` através de um overlay (o campo `network:`) |

Negue `network.select` em um escopo para impedir que o código dentro dele escolha explicitamente uma sobreposição. As sobreposições herdadas não são afetadas — elas foram autorizadas no chamador. `network.bind` é verificado quando um servidor com um overlay `network:` inicia seu listener.

## Veja também

- [Segurança](system/security.md) - Políticas e atores
- [Serviço HTTP](http/server.md) - Vinculação do servidor
- [Cliente HTTP](lua/http/client.md) - Seleção de sobreposição por chamada
