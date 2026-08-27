---
title: "Funções WASM"
description: "Configure funções WAT inline e funções WASM pré-compiladas como entradas do registro."
---

# Funções WASM

Use `function.wat` para código WebAssembly Text inline e `function.wasm` para binários pré-compilados.

**Classificação: referência de configuração de funções.** Blocos WAT são exemplos pequenos de registro. Os exemplos pré-compilados pressupõem um build externo do componente, uma entrada de sistema de arquivos, métodos exportados compatíveis com o WIT do guest e um digest SHA-256 calculado a partir do binário exato. Hashes de amostra com aparência real são apenas ilustrativos.

## Funções WAT inline

Defina uma função WAT diretamente em `_index.yaml`:

```yaml
entries:
  - name: answer
    kind: function.wat
    source: |
      (module
        (func (export "answer") (result i32)
          i32.const 42
        )
      )
    wit: |
      answer: func() -> s32;
    method: answer
    pool:
      type: inline
```

Para fontes WAT maiores, use uma referência a arquivo:

```yaml
  - name: answer
    kind: function.wat
    source: file://answer.wat
    wit: |
      answer: func() -> s32;
    method: answer
    pool:
      type: inline
```

### Campos de configuração WAT

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `source` | Sim | Fonte WAT inline ou referência `file://` |
| `method` | Sim | Nome da função exportada a ser chamada |
| `wit` | Não | Assinatura WIT para módulos raw/core |
| `pool` | Não | Configuração do pool de workers |
| `transport` | Não | Mapeamento de entrada e saída; o padrão é `payload` |
| `imports` | Não | Imports do host a habilitar, como `wasi:cli` e `wasi:io` |
| `wasi` | Não | Configuração WASI: args, env e mounts |
| `limits` | Não | Limites de execução |

## Funções WASM pré-compiladas

Carregue binários `.wasm` compilados a partir de uma entrada de sistema de arquivos:

```yaml
entries:
  - name: assets
    kind: fs.directory
    directory: ./wasm

  - name: compute
    kind: function.wasm
    fs: myns:assets
    path: /compute.wasm
    hash: sha256:292b796376f8b4cc360acf2ea6b82d1084871c3607a079f30b446da8e5c984a4
    method: compute
    pool:
      type: lazy
      max_size: 4
```

### Campos de configuração WASM

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `fs` | Sim | ID da entrada de sistema de arquivos que contém o binário |
| `path` | Sim | Caminho para o arquivo `.wasm` dentro do sistema de arquivos |
| `hash` | Sim | Hash SHA-256 para verificação de integridade (`sha256:...`) |
| `method` | Sim | Nome da função exportada a ser chamada |
| `wit` | Não | Assinatura WIT para módulos raw/core |
| `pool` | Não | Configuração do pool de workers |
| `transport` | Não | Mapeamento de entrada e saída; o padrão é `payload` |
| `imports` | Não | Imports do host a habilitar |
| `wasi` | Não | Configuração WASI |
| `limits` | Não | Limites de execução |

## Pools de Workers

Cada função WASM usa um pool de instâncias pré-compiladas. O tipo do pool controla a concorrência e o uso de recursos.

| Tipo | Descrição |
|------|-----------|
| `inline` | Serializado por mutex. Chamadas síncronas sequenciais reutilizam uma instância aquecida; chamadas asyncificadas a fecham depois de cada chamada, e a política de memória retida também pode provocar sua substituição. |
| `lazy` | Nenhum worker ocioso. Escala sob demanda até `max_size`. |
| `static` | Número fixo de workers com fila de requisições. |
| `adaptive` | Pool elástico com escalonamento automático. |

### Configuração do pool

```yaml
pool:
  type: static
  size: 4            # Total pool size
  workers: 2         # Worker threads
  buffer: 16         # Request queue buffer (default: workers * 64)
```

```yaml
pool:
  type: lazy
  max_size: 8        # Maximum concurrent instances
```

```yaml
pool:
  type: adaptive
  max_size: 16       # Upper scaling bound
```

O padrão de 100 workers só se aplica ao pool selecionado implicitamente, quando nenhum `type` é definido. Ao definir explicitamente `type: lazy` ou `type: adaptive` sem `max_size`, o máximo padrão é 16 workers.

### Classes de workers e afinidade de CPU

Definir `pool.worker_class` direciona a função a um pool dedicado de workers fixados em threads do sistema operacional, em vez dos tipos de pool compartilhados acima. Quando ele é definido, `type` é ignorado; o nome convencional é `wasm`:

```yaml
pool:
  worker_class: wasm
  workers: 8         # optional; defaults to reserved cores, else min(NumCPU, 4)
```

O isolamento de CPUs é ativado por runtime em `.wippy.yaml`:

```yaml
scheduler:
  wasm_isolation:
    enabled: true      # default: false
    reserved_cores: 2  # cores reserved for WASM pools (default: 1)
```

Com o isolamento ativado, o agendador de atores e os pools WASM fixados são executados em conjuntos de CPUs distintos (`sched_setaffinity`, somente no Linux; outras plataformas dimensionam os pools, mas não vinculam threads). Assim, chamadas WASM de longa duração não podem privar o escalonamento de atores.

## Transportes

Transportes controlam como entradas e saídas são mapeadas entre o runtime e o módulo WASM.

| Transporte | Descrição |
|------------|-----------|
| `payload` | Mapeia payloads do runtime diretamente para argumentos da chamada WASM; é o padrão |
| `wasi-http` | Mapeia o contexto da requisição e da resposta HTTP para argumentos e resultados WASM |

### Transporte Payload

O transporte padrão passa os argumentos diretamente. Valores Lua são transcodificados para tipos Go e depois reduzidos para tipos WIT:

```yaml
  - name: compute
    kind: function.wasm
    fs: myns:assets
    path: /compute.wasm
    hash: sha256:...
    method: compute
    pool:
      type: inline
```

```lua
-- Arguments passed directly as WASM function parameters
local result, err = funcs.call("myns:compute", 6, 7)
if err then return nil, err end
-- result: 42
```

### Transporte WASI HTTP

O transporte `wasi-http` mapeia requisições HTTP para WASM e escreve os resultados na resposta HTTP. Use-o para expor funções WASM como endpoints HTTP:

```yaml
  - name: greet_wasm
    kind: function.wasm
    fs: myns:assets
    path: /greet.wasm
    hash: sha256:...
    method: greet
    transport: wasi-http
    pool:
      type: inline

  - name: greet_endpoint
    kind: http.endpoint
    method: POST
    path: /api/greet
    func: greet_wasm
```

## Limites de execução

Limite o tempo de execução e recicle instâncias aquecidas que retenham memória linear demais:

```yaml
limits:
  max_execution_ms: 5000
  max_retained_memory_bytes: 67108864
  retained_memory_check_interval: 16
```

| Campo | Padrão | Descrição |
|-------|--------|-----------|
| `max_execution_ms` | `0` | Duração máxima da chamada em milissegundos; `0` desativa o timeout |
| `max_retained_memory_bytes` | 64 MiB | Recicla uma instância aquecida após uma chamada quando a memória retida excede esse valor; `0` explícito desativa a reciclagem |
| `retained_memory_check_interval` | Veja abaixo | Número de chamadas concluídas entre verificações de memória retida |

Quando o limite de tempo é excedido, a chamada é cancelada e retorna um erro. O limite padrão de 64 MiB de memória retida é verificado a cada 16 chamadas. Quando `max_retained_memory_bytes` é definido explicitamente com valor positivo e o intervalo é omitido, o runtime verifica após cada chamada. Defina um intervalo positivo para amortizar essas verificações.

## Configuração WASI

Configure capacidades WASI para o módulo guest:

```yaml
wasi:
  args: ["--verbose"]
  cwd: "/app"
  env:
    - id: myns:api_key
      name: API_KEY
      required: true
    - id: myns:debug_mode
      name: DEBUG
  mounts:
    - fs: myns:data_files
      guest: /data
      read_only: true
    - fs: myns:output
      guest: /output
```

| Campo | Descrição |
|-------|-----------|
| `args` | Argumentos de linha de comando passados ao guest |
| `cwd` | Diretório de trabalho dentro do guest; deve ser absoluto |
| `env` | Variáveis de ambiente mapeadas a partir de entradas env do registro |
| `mounts` | Montagens de sistemas de arquivos a partir de entradas do registro |

As variáveis de ambiente são resolvidas pelo registro de ambiente no momento da chamada. Variáveis obrigatórias causam um erro quando não são encontradas.

Os caminhos de montagem devem ser absolutos e únicos. Cada montagem mapeia uma entrada de sistema de arquivos do runtime para um diretório do guest.

## Exemplos

### Pipeline de transformação de dados

```yaml
entries:
  - name: wasm_binaries
    kind: fs.directory
    directory: ./wasm

  - name: transform_users
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /mapper.wasm
    hash: sha256:7304fc7d19778605458ae5804dae9a7343dcd3f5fc22bcc9415e98b5047192dd
    method: transform-users
    pool:
      type: lazy
      max_size: 4

  - name: filter_active
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /mapper.wasm
    hash: sha256:7304fc7d19778605458ae5804dae9a7343dcd3f5fc22bcc9415e98b5047192dd
    method: filter-active
    pool:
      type: lazy
      max_size: 4
```

```lua
local funcs = require("funcs")

local users = {
    {id = 1, name = "Alice", tags = {"admin", "dev"}, active = true},
    {id = 2, name = "Bob", tags = {"user"}, active = false},
    {id = 3, name = "Carol", tags = {"dev"}, active = true},
}

-- Transform: adds display field and tag count
local transformed, err = funcs.call("myns:transform_users", users)
if err then return nil, err end

-- Filter: returns only active users
local active, filter_err = funcs.call("myns:filter_active", users)
if filter_err then return nil, filter_err end
```

### Sleep assíncrono com WASI Clocks

Componentes WASM que importam `wasi:clocks`, `wasi:io` e o perfil separado `wasi:poll` podem usar relógios e polling. O mecanismo de yield assíncrono se integra ao dispatcher do Wippy:

```yaml
  - name: sleep_ms
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /sleep_test.wasm
    hash: sha256:...
    method: "test-sleep#sleep-ms"
    imports:
      - wasi:io
      - wasi:poll
      - wasi:clocks
    pool:
      type: inline
```

O separador `#` no campo method faz referência a um método de interface: `test-sleep#sleep-ms` chama a função `sleep-ms` da interface `test-sleep`.

## Veja também

- [Visão geral](./overview.md) - Visão geral do runtime WebAssembly
- [Funções do host](./hosts.md) - Interfaces de host disponíveis
- [Processos](./processes.md) - Execução de WASM como processos
- [Tipos de entradas](../guides/entry-kinds.md) - Todos os tipos de entrada do registro
