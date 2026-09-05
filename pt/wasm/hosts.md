---
title: "Funcoes Host"
description: "Modulos WASM acessam capacidades do runtime atraves de imports de funcoes host. Cada import e declarado explicitamente por entrada na lista imports."
---

# Funcoes Host

Modulos WASM acessam capacidades do runtime atraves de imports de funcoes host. Cada import e declarado explicitamente por entrada na lista `imports`.

## Tipos de Import

| Import | Namespace | Tipo de modulo | Descricao |
|--------|-----------|----------------|-----------|
| `wasi:cli` | `wasi:cli/*` | component | Ambiente, exit, stdin/stdout/stderr, terminal |
| `wasi:io` | `wasi:io/error`, `wasi:io/streams` | component | Streams e tratamento de erros |
| `wasi:poll` | `wasi:io/poll` | component | Polling assincrono / cedencia cooperativa |
| `wasi:clocks` | `wasi:clocks/*` | component | Relogio de parede e relogio monotonico |
| `wasi:filesystem` | `wasi:filesystem/*` | component | Acesso ao sistema de arquivos atraves de diretorios montados |
| `wasi:random` | `wasi:random/*` | component | Numeros aleatorios criptograficamente seguros e inseguros |
| `wasi:sockets` | `wasi:sockets/*` | component | Rede TCP/UDP e resolucao DNS |
| `wasi:http` | `wasi:http/*` | component | Requisicoes HTTP de saida |
| `funcs` | `wippy:runtime/funcs@0.1.0` | component | Chamada de funcoes do registro a partir do guest |
| `wasi1` | `wasi_snapshot_preview1` | core | Imports de compatibilidade com WASI Preview 1 |
| `socket` | `wippy:runtime/socket@0.1.0` | core | TCP de saida pertencente a instancia atraves de imports somente inteiros |

Os oito perfis `wasi:*` e `funcs` sao exclusivos de component: declarar um deles em um modulo core faz a entrada falhar. `wasi1` e `socket` expoem imports core.

Cada perfil resolve pelo seu nome curto, por qualquer um dos namespaces de interface que fornece, e por um namespace versionado. O sufixo de versao e removido antes da busca, entao `wasi:io/poll`, `wasi:io/poll@0.2.3` e `wasi:poll` selecionam todos o mesmo perfil.

Um import que nao resolve para nenhum perfil faz a entrada falhar com `unsupported wasm host import: <id>`; um perfil exclusivo de component em um modulo core falha com `wasm host import requires component module: <id>`.

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

**Interfaces:** `wasi:io/error`, `wasi:io/streams`

Operacoes de leitura/escrita de streams e tratamento de erros. A interface `wasi:io/poll` e fornecida separadamente pelo import `wasi:poll`.

### wasi:poll

**Interfaces:** `wasi:io/poll`

Polling assincrono. A interface poll permite yield cooperativo atraves do dispatcher.

### wasi:cli

**Interfaces:** `wasi:cli/environment`, `wasi:cli/exit`, `wasi:cli/stdin`, `wasi:cli/stdout`, `wasi:cli/stderr`, `wasi:cli/terminal-stdin`, `wasi:cli/terminal-stdout`, `wasi:cli/terminal-stderr`

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

**Interfaces:** `wasi:sockets/instance-network`, `wasi:sockets/ip-name-lookup`, `wasi:sockets/tcp`, `wasi:sockets/tcp-create-socket`, `wasi:sockets/udp`, `wasi:sockets/udp-create-socket`

Rede TCP e UDP com resolucao DNS. Operacoes de socket suspendem o guest e executam atraves do dispatcher, que realiza cada dial, bind e lookup no [servico de rede](system/network.md).

### wasi:http

**Interfaces:** `wasi:http/types`, `wasi:http/outgoing-handler`

Requisicoes HTTP de saida de dentro de modulos WASM. Suporta tipos de requisicao/resposta definidos pela especificacao WASI HTTP.

## funcs

**Namespace:** `wippy:runtime/funcs@0.1.0`

Chama funcoes do registro a partir de um guest component. Dois pontos de entrada sao expostos:

```wit
interface funcs {
  call-string: func(target: string, input: string) -> result<string, string>;
  call-bytes: func(target: string, input: list<u8>) -> result<list<u8>, string>;
}
```

`target` e um ID de registro no formato `namespace:name`. Cada chamada e verificada por politica como `funcs.call` contra esse target, entao um guest so pode alcancar funcoes que o escopo do chamador ja permite.

## wasi1

**Namespace:** `wasi_snapshot_preview1`

Declara que um modulo core faz link com WASI Preview 1. O perfil tambem resolve por `preview1` e `wasi-preview1`. Ele nao registra hosts proprios; os imports do Preview 1 sao atendidos pelo runtime WASM subjacente.

## socket

**Namespace:** `wippy:runtime/socket@0.1.0`

TCP de saida para modulos core (nao component). O host exporta quatro funcoes somente com inteiros, entao um guest nao precisa de ferramental de component para usa-lo:

| Funcao | Assinatura | Resultado |
|--------|------------|-----------|
| `connect` | `(host_ptr: i32, host_len: i32, port: i32, timeout_ms: i32) -> i64` | `status << 32 \| handle` |
| `send` | `(handle: i32, buf_ptr: i32, buf_len: i32) -> i64` | `status << 32 \| written` |
| `recv` | `(handle: i32, out_ptr: i32, out_cap: i32) -> i64` | `status << 32 \| read` |
| `close` | `(handle: i32) -> i32` | `status` |

Os 32 bits altos do resultado de 64 bits carregam o status; os 32 bits baixos carregam o valor.

| Status | Valor | Significado |
|--------|-------|-------------|
| `OK` | 0 | Operacao bem-sucedida |
| `Invalid` | 1 | Argumentos invalidos ou regiao de memoria fora do intervalo |
| `Denied` | 2 | O servico de rede negou o dial |
| `Failed` | 3 | A operacao falhou |
| `UnknownHandle` | 4 | O handle nao e uma conexao aberta desta instancia |
| `Limit` | 5 | `max_open_sockets` atingido |
| `Timeout` | 6 | O dial ou o deadline de leitura/escrita expirou |

`connect` le o nome do host da memoria do guest; `host_len` deve estar entre 1 e 253 bytes e `port` entre 1 e 65535. `timeout_ms` estreita o deadline do dial: o deadline efetivo e o menor entre `timeout_ms` e o `socket_timeout_ms` da entrada. `send` e `recv` sao limitados por `socket_timeout_ms`. `recv` reporta um fim de stream limpo como `OK` com contagem de leitura 0.

As conexoes pertencem a instancia que as abriu. Um handle nao tem significado para outra instancia, a contagem de sockets abertos e feita por instancia, e cada conexao e fechada quando a instancia e fechada ou o worker quente e reciclado.

## Autorizacao de Rede

Nenhum dos hosts de socket decide o acesso por conta propria. Cada dial, bind e lookup passa pelo servico de rede do runtime, que verifica as permissoes `socket.connect`, `socket.listen` e `socket.resolve`, aplica a politica de IP privado, e roteia atraves de uma [rede overlay](system/network.md) quando uma e selecionada. `wasi:sockets` adicionalmente pre-verifica `socket.resolve` antes de um lookup DNS e `socket.listen` antes de um bind UDP.

## Veja Tambem

- [Visao Geral](wasm/overview.md) - Visao geral do runtime WebAssembly
- [Funcoes](wasm/functions.md) - Configuracao de funcoes WASM
- [Processos](wasm/processes.md) - Executando WASM como processos
- [Redes Overlay](system/network.md) - Selecao de overlay e permissoes de socket
