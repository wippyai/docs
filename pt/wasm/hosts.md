# Funcoes Host

Modulos WASM acessam capacidades do runtime atraves de imports de funcoes host. Cada import e declarado explicitamente por entrada na lista `imports`.

## Tipos de Import

| Import | Descricao |
|--------|-----------|
| `wasi:cli` | Ambiente, exit, stdin/stdout/stderr, terminal |
| `wasi:io` | Streams, tratamento de erros, polling |
| `wasi:clocks` | Relogio de parede e relogio monotonico |
| `wasi:filesystem` | Acesso ao sistema de arquivos atraves de diretorios montados |
| `wasi:random` | Numeros aleatorios criptograficamente seguros |
| `wasi:sockets` | Rede TCP/UDP e resolucao DNS |
| `wasi:http` | Requisicoes HTTP de saida |

Habilite imports na configuracao da sua entrada:

```yaml
  - name: my_function
    kind: function.wasm
    fs: myns:assets
    path: /module.wasm
    hash: sha256:...
    method: run
    imports:
      - wasi:cli
      - wasi:io
      - wasi:clocks
      - wasi:filesystem
    pool:
      type: inline
```

Declare apenas os imports que seu modulo realmente precisa.

## Imports WASI

Cada import `wasi:*` habilita um grupo de interfaces WASI Preview 2 relacionadas.

### wasi:clocks

**Interfaces:** `wasi:clocks/wall-clock`, `wasi:clocks/monotonic-clock`

Relogio de parede e relogio monotonico para operacoes de tempo. O relogio monotonico se integra com o dispatcher do Wippy para sleep assincrono.

### wasi:io

**Interfaces:** `wasi:io/error`, `wasi:io/streams`, `wasi:io/poll`

Operacoes de leitura/escrita de streams e polling assincrono. A interface poll permite yield cooperativo atraves do dispatcher.

### wasi:cli

**Interfaces:** `wasi:cli/environment`, `wasi:cli/exit`, `wasi:cli/stdin`, `wasi:cli/stdout`, `wasi:cli/stderr`

Acesso a variaveis de ambiente, codigos de saida de processo e streams de I/O padrao. Variaveis de ambiente sao mapeadas a partir do registro de ambiente do Wippy atraves da configuracao WASI.

### wasi:filesystem

**Interfaces:** `wasi:filesystem/types`, `wasi:filesystem/preopens`

Acesso ao sistema de arquivos atraves de diretorios montados. Montagens sao configuradas por entrada e mapeiam entradas de sistema de arquivos do Wippy para caminhos do guest.

```yaml
wasi:
  mounts:
    - fs: myns:data
      guest: /data
      read_only: true
```

### wasi:random

**Interfaces:** `wasi:random/random`, `wasi:random/insecure`, `wasi:random/insecure-seed`

Geracao de numeros aleatorios criptograficamente seguros e inseguros.

### wasi:sockets

**Interfaces:** `wasi:sockets/network`, `wasi:sockets/instance-network`, `wasi:sockets/ip-name-lookup`, `wasi:sockets/tcp`, `wasi:sockets/tcp-create-socket`, `wasi:sockets/udp`

Rede TCP e UDP com resolucao DNS. Operacoes de socket se integram com o dispatcher para I/O assincrono.

### wasi:http

**Interfaces:** `wasi:http/types`, `wasi:http/outgoing-handler`

Requisicoes HTTP de saida de dentro de modulos WASM. Suporta tipos de requisicao/resposta definidos pela especificacao WASI HTTP.

## Veja Tambem

- [Visao Geral](wasm/overview.md) - Visao geral do runtime WebAssembly
- [Funcoes](wasm/functions.md) - Configuracao de funcoes WASM
- [Processos](wasm/processes.md) - Executando WASM como processos
