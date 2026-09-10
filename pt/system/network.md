---
title: "Sobreposições de rede"
description: "Roteie conexões de saída e vincule listeners por overlays SOCKS5, Tor, Tailscale ou I2P."
---

# Sobreposições de rede

Entradas de overlay de rede roteiam conexões de saída ou vinculam listeners por SOCKS5, Tor, Tailscale ou I2P. A seleção se propaga por limites de função, processo e HTTP.

Esta página é uma referência de configuração. Os blocos YAML são fragmentos de entrada ou de configuração da aplicação e pressupõem que o proxy, tailnet ou serviço I2P SAM externo já exista.

## Tipos de entrada

| Tipo | Descrição |
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
| `auth_key` | string | Chave de autenticação tailnet — inline ou `${env:NAME}` resolvida via o [registro env](system/env.md) |
| `state_dir` | string | Sobrescrita do diretório de estado tsnet |
| `control_url` | string | Servidor de coordenação alternativo |
| `ephemeral` | bool | Registrar como nó tailnet efêmero |

`auth_key` é obrigatório (forneça-o diretamente ou via `${env:NAME}`). A diretiva legada `auth_key_env` resolve da mesma forma, mas está obsoleta; prefira `auth_key: ${env:NAME}`.

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
  state_dir: .wippy/net          # Diretorio base para o estado do driver (chaves do Tailscale, etc.)
  default_network: app.net:tailnet  # Overlay aplicado quando nenhuma chamada define um
```

| Campo | Padrao | Descricao |
|-------|--------|-----------|
| `state_dir` | `.wippy/net` | Diretorio para o estado do driver. Caminhos relativos sao resolvidos contra o diretorio de config de boot. |
| `default_network` | — | Registry ID de um overlay aplicado a cada tarefa ou processo que nao define sua propria rede via opcoes. |

## Conexoes Diretas

A seleção de sobreposição não se limita a bordas Lua. Conexões feitas através do serviço de rede do runtime — o [host `socket`](wasm/hosts.md#socket) do WASM e o dispatcher `wasi:sockets` — leem a sobreposição do frame e roteiam por ela, tenha ela sido definida por `with_options`, por `meta.options.network` na entrada, ou por `network_service.default_network`.

O controle de IP privado se comporta de forma diferente nesse caminho. Uma conexão direta resolve o alvo e verifica cada endereço resultante contra `socket.private_ip`. Com uma sobreposição selecionada, apenas um endereço IP literal no alvo é verificado; nomes de host são entregues à sobreposição para resolução, então o resolver local nunca é consultado e nenhuma verificação é feita sobre o que ele teria retornado.

Quando uma sobreposição é selecionada mas o contexto não carrega um registro de rede, a conexão falha com `network "<id>" selected without a network registry`.

## Atualizando Overlays

Entradas de overlay são substituídas em atualizações do registro. O driver constrói o novo serviço antes da troca; se a criação falhar, o anterior continua ativo. A troca bem-sucedida é atômica para novas buscas e então o serviço anterior é fechado; trabalhos que ainda o usam podem observar esse fechamento.

## Permissões

| Ação | Recurso | Descrição |
|--------|----------|-------------|
| `network.select` | Registry ID de rede | Seleção explícita de sobreposição em `funcs.call`, `process.spawn`, `http_client` |
| `network.bind` | Registry ID de rede | Vinculação de um listener `http.service` através de um overlay (o campo `network:`) |
| `socket.connect` | `host:port` | Qualquer conexão de saída através do serviço de rede |
| `socket.listen` | `host:port` | Vinculação de um listener TCP ou de um socket UDP através do serviço de rede |
| `socket.resolve` | Nome de host | Resolução DNS através do serviço de rede |
| `socket.private_ip` | Endereço IP | Alcançar um endereço de loopback, privado, link-local ou não especificado |

Negue `network.select` em um escopo para impedir que o código dentro dele escolha explicitamente uma sobreposição. As sobreposições herdadas não são afetadas — elas foram autorizadas no chamador. `network.bind` é verificado quando um servidor com um overlay `network:` inicia seu listener.

As permissões `socket.*` são verificadas pelo próprio serviço de rede. `socket.connect`, `socket.listen` e `socket.resolve` são verificadas antes de qualquer roteamento por sobreposição, então se aplicam igualmente ao tráfego de clearnet e de sobreposição; `socket.private_ip` se restringe a endereços literais assim que uma sobreposição é selecionada, como descrito em [Conexoes Diretas](system/network.md#raw-dials).

## Veja também

- [Segurança](system/security.md) - Políticas e atores
- [Serviço HTTP](http/server.md) - Vinculação do servidor
- [Cliente HTTP](lua/http/client.md) - Seleção de sobreposição por chamada
- [Funções de Host](wasm/hosts.md) - Imports de socket do WASM
