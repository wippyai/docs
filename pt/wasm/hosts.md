---
title: "Funções do host"
description: "Ative chamadas de funções Wippy, compatibilidade com WASI Preview 1 ou interfaces selecionadas do WASI Preview 2 por meio dos imports da entrada."
---

# Funções do host

Cada entrada opta pelas interfaces de host listadas abaixo pelo campo `imports`.

**Classificação: referência de interfaces do host.** O bloco YAML é uma entrada parcial: substitua o ID do sistema de arquivos, o caminho, o método e o hash pelos valores de um módulo compilado. O digest deve ser o valor SHA-256 real do módulo.

## Tipos de import

| Importação | Descrição |
|--------|-------------|
| `funcs` | Chamar funções do registro Wippy a partir de um módulo Component Model |
| `wasi1` | Compatibilidade com WASI Preview 1 para módulos raw/core |
| `wasi:cli` | Ambiente, saída, stdin/stdout/stderr, terminal |
| `wasi:io` | Streams e tratamento de erros |
| `wasi:poll` | Polling assíncrono / yield cooperativo (interface `wasi:io/poll`) |
| `wasi:clocks` | Relógio de parede e relógio monotônico |
| `wasi:filesystem` | Acesso ao sistema de arquivos por diretórios montados |
| `wasi:random` | Números aleatórios criptograficamente seguros |
| `wasi:sockets` | Rede TCP/UDP e resolução DNS |
| `wasi:http` | Solicitações HTTP de saída |

Ative os imports na configuração da entrada:

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

Declare somente os imports que o módulo realmente usa.

Os perfis `funcs` e `wasi:*` abaixo exigem um módulo Component Model. Use `wasi1` para um módulo raw/core que importe `wasi_snapshot_preview1`; os aliases `wasi-preview1`, `preview1` e `wasi_snapshot_preview1` resolvem para o mesmo perfil. Imports não suportados, ou perfis exclusivos do Component Model usados em um módulo core, falham durante a preparação do módulo.

## Chamadas de funções Wippy

O perfil `funcs` registra a interface `wippy:runtime/funcs@0.1.0` para módulos Component Model:

```wit
interface funcs {
  call-string: func(target: string, input: string) -> result<string, string>;
  call-bytes: func(target: string, input: list<u8>) -> result<list<u8>, string>;
}
```

Os dois métodos invocam o destino pelo registro de funções do Wippy. A chamada herda o contexto de segurança da execução e exige a permissão `funcs.call` para o ID de registro de destino.

## Imports WASI

Cada import `wasi:*` ativa um grupo de interfaces relacionadas do WASI Preview 2.

### wasi:clocks

**Interfaces disponíveis:** `wasi:clocks/wall-clock`, `wasi:clocks/monotonic-clock`

Relógios de parede e monotônico para operações de tempo. O relógio monotônico se integra ao dispatcher do Wippy para suspensão assíncrona.

### wasi:io

**Interfaces disponíveis:** `wasi:io/error`, `wasi:io/streams`

Operações de leitura e escrita em streams e tratamento de erros. A interface `wasi:io/poll` é fornecida separadamente pelo import `wasi:poll`.

### wasi:poll

**Interfaces disponíveis:** `wasi:io/poll`

Polling assíncrono. A interface de poll permite yield cooperativo pelo dispatcher.

### wasi:cli

**Interfaces disponíveis:** `wasi:cli/environment`, `wasi:cli/exit`, `wasi:cli/stdin`, `wasi:cli/stdout`, `wasi:cli/stderr`, `wasi:cli/terminal-stdin`, `wasi:cli/terminal-stdout`, `wasi:cli/terminal-stderr`

Acesso a variáveis de ambiente, códigos de saída do processo e streams de E/S padrão. As variáveis de ambiente são mapeadas do registro de ambiente do Wippy pela configuração WASI.

### wasi:filesystem

**Interfaces disponíveis:** `wasi:filesystem/types`, `wasi:filesystem/preopens`

Acesso ao sistema de arquivos por diretórios montados. As montagens são configuradas por entrada e mapeiam entradas do sistema de arquivos Wippy para caminhos no guest.

```yaml
wasi:
  mounts:
    - fs: myns:data
      guest: /data
      read_only: true
```

### wasi:random

**Interfaces disponíveis:** `wasi:random/random`, `wasi:random/insecure`, `wasi:random/insecure-seed`

Geração de números aleatórios criptograficamente seguros e inseguros.

### wasi:sockets

**Interfaces disponíveis:** `wasi:sockets/instance-network`, `wasi:sockets/ip-name-lookup`, `wasi:sockets/tcp`, `wasi:sockets/tcp-create-socket`, `wasi:sockets/udp`, `wasi:sockets/udp-create-socket`

Rede TCP e UDP com resolução DNS. As operações de socket se integram ao dispatcher para E/S assíncrona.

### wasi:http

**Interfaces disponíveis:** `wasi:http/types`, `wasi:http/outgoing-handler`

Solicitações de cliente HTTP de saída feitas dentro de módulos WASM. Suporta os tipos de solicitação e resposta definidos pela especificação WASI HTTP.

Solicitações de saída exigem a permissão `http_client.request` para a URL. Solicitações a endereços IP privados também exigem `http_client.private_ip` para o endereço resolvido.

## Permissões de socket

Ativar `wasi:sockets` disponibiliza as interfaces, mas não autoriza acesso à rede. A resolução DNS exige `socket.resolve` para o nome, conexões TCP de saída exigem `socket.connect` para o endereço e o bind de TCP ou UDP exige `socket.listen` para o endereço.

## Veja também

- [Visão geral](./overview.md) - Visão geral do runtime WebAssembly
- [Funções](./functions.md) - Configuração de funções WASM
- [Processos](./processes.md) - Execução de WASM como processos
