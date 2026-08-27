---
title: "Sobreposições de rede"
description: "Roteie conexões de saída e vincule listeners por overlays SOCKS5, Tor, Tailscale ou I2P."
---

# Sobreposições de rede

Entradas de overlay de rede roteiam conexões de saída ou vinculam listeners por SOCKS5, Tor, Tailscale ou I2P. A seleção se propaga por limites de função, processo e HTTP.

Esta página é uma referência de configuração. Os blocos YAML são fragmentos de entrada ou de configuração da aplicação e pressupõem que o proxy, tailnet ou serviço I2P SAM externo já exista.

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

`host` e `port` são obrigatórios. `isolate_streams` usa `false` por padrão. Quando o isolamento está ativo, o runtime gera novos usuário e senha para cada conexão em vez de usar as credenciais configuradas.

## Tailscale

```yaml
- name: tailnet
  kind: network.tailscale
  hostname: "wippy-node"
  auth_key: ${env:TS_AUTHKEY}
  ephemeral: false
  control_url: ""
```

| Campo | Tipo | Descrição |
|-------|------|-------------|
| `hostname` | string | Nome do nó tsnet (usado no diretório de estado por nó) |
| `auth_key` | string | Chave do tailnet inline ou `${env:NAME}`, resolvida pelo [registro de ambiente](./env.md) |
| `state_dir` | string | Sobrescrita do diretório de estado tsnet |
| `control_url` | string | Servidor de coordenação alternativo |
| `ephemeral` | bool | Registrar como nó tailnet efêmero |

`auth_key` é obrigatório, fornecido diretamente ou por `${env:NAME}`. A diretiva legada `auth_key_env` resolve da mesma forma, mas está obsoleta; prefira `auth_key: ${env:NAME}`.

O hostname do tsnet usa `wippy` por padrão. Sem `state_dir`, o runtime usa `<network_service.state_dir>/tailscale/<node>`, onde `<node>` é o hostname configurado ou, na ausência dele, o nome da entrada no registro.

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

`host` e `port` são obrigatórios. `session_name` usa `wippy` por padrão e serve de prefixo para IDs de sessão SAM por conexão e listener.

## Selecionando uma sobreposição

### Em `http.service`

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

Criar o spawner com opções personalizadas também exige `process.context` sobre o recurso `context`. Uma negação gera erro Lua antes que o spawner seja retornado; `network.select` é verificado separadamente para o ID de rede selecionado.

O modulo `http_client` aceita a mesma selecao de overlay nas opcoes por chamada sob a chave `overlay_network`.

## Herança

A seleção se propaga pela pilha. Uma função chamada por `funcs.new():with_options({network=...})` usa o overlay em conexões internas, chamadas aninhadas e processos gerados, salvo quando uma nova fronteira escolhe outro overlay. Uma opção `network` vazia significa “sem sobrescrita”; ela não limpa o overlay herdado nem o padrão da aplicação.

Em uma chamada de função, as opções de runtime prevalecem sobre `meta.options` antes da seleção. Em uma nova fronteira de função ou processo, um `options.network` não vazio é escolhido primeiro. Se estiver ausente, usa-se `network_service.default_network` quando configurado; sem ambos, permanece a seleção herdada. O ID selecionado já deve estar registrado. Um ID desconhecido falha a chamada ou o spawn, sem fallback para a rede do host.

A herança ambiente ignora as próprias regras de negação `network.select` do descendente. Apenas a seleção explícita em uma borda Lua é controlada.

## Configuracao do App

Drivers de overlay leem configuracoes a nivel de app a partir de um bloco `network_service:` em `.wippy.yaml`:

```yaml
network_service:
  state_dir: .wippy/net          # base dir for driver state (Tailscale keys, etc.)
  default_network: app.net:tailnet  # overlay applied when no call sets one
```

| Campo | Padrao | Descricao |
|-------|--------|-----------|
| `state_dir` | `.wippy/net` | Diretorio para o estado do driver. Caminhos relativos sao resolvidos contra o diretorio de config de boot. |
| `default_network` | — | Registry ID de um overlay aplicado a cada tarefa ou processo que nao define sua propria rede via opcoes. |

## Atualizando Overlays

Entradas de overlay são substituídas em atualizações do registro. O driver constrói o novo serviço antes da troca; se a criação falhar, o anterior continua ativo. A troca bem-sucedida é atômica para novas buscas e então o serviço anterior é fechado; trabalhos que ainda o usam podem observar esse fechamento.

## Permissões

| Ação | Recurso | Descrição |
|--------|----------|-------------|
| `network.select` | Registry ID de rede | Seleção explícita de sobreposição em `funcs.call`, `process.spawn`, `http_client` |
| `network.bind` | Registry ID de rede | Vinculação de um listener `http.service` através de um overlay (o campo `network:`) |
| `process.context` | `context` | Construção de um spawner com `process.with_options(...)` |

Negue `network.select` em um escopo para impedir que o código dentro dele escolha explicitamente uma sobreposição. As sobreposições herdadas não são afetadas — elas foram autorizadas no chamador. `network.bind` é verificado quando um servidor com um overlay `network:` inicia seu listener.

## Veja também

- [Segurança](./security.md) - Políticas e atores
- [Serviço HTTP](../http/server.md) - Vinculação do servidor
- [Cliente HTTP](../lua/http/client.md) - Seleção de overlay por chamada
