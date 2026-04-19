# Referência da CLI

Interface de linha de comando para o runtime do Wippy.

## Flags Globais

Disponíveis em todos os comandos:

| Flag | Curta | Descrição |
|------|-------|-----------|
| `--config` | | Arquivo de configuração (padrão: .wippy.yaml) |
| `--verbose` | `-v` | Ativar logs de depuração |
| `--very-verbose` | | Depuração com stack traces |
| `--console` | `-c` | Logs coloridos no console |
| `--silent` | `-s` | Desativar logs no console |
| `--event-streams` | `-e` | Transmitir logs para o barramento de eventos |
| `--profiler` | `-p` | Ativar pprof em localhost:6060 |
| `--memory-limit` | `-m` | Limite de memória (ex: 1G, 512M) |

Prioridade do limite de memória: flag `--memory-limit` > variável de ambiente `GOMEMLIMIT` > padrão de 1GB.

## wippy init

Criar um novo arquivo de lock.

```bash
wippy init
wippy init --src-dir ./src --modules-dir .wippy
```

| Flag | Curta | Padrão | Descrição |
|------|-------|--------|-----------|
| `--src-dir` | `-d` | ./src | Diretório de fontes |
| `--modules-dir` | | .wippy | Diretório de módulos |
| `--lock-file` | `-l` | wippy.lock | Caminho do arquivo de lock |

## wippy run

Iniciar o runtime ou executar um comando.

```bash
wippy run                                    # Iniciar o runtime
wippy run list                               # Listar comandos disponíveis
wippy run test                               # Executar testes
wippy run snapshot.wapp                      # Executar a partir de arquivo pack
wippy run acme/http                          # Executar módulo
wippy run --exec app:worker                  # Executar um único processo
```

| Flag | Curta | Descrição |
|------|-------|-----------|
| `--override` | `-o` | Sobrescrever valores de entrada (namespace:entry:field=value) |
| `--exec` | `-x` | Executar processo e encerrar (host/namespace:entry) |
| `--host` | | Host para execução |
| `--registry` | | URL do registry |

## wippy lint

Verificar erros de tipo e avisos no código Lua.

```bash
wippy lint
wippy lint --level warning
```

Valida todas as entradas Lua: `function.lua`, `library.lua`, `process.lua`, `workflow.lua` (incluindo suas variantes `.bc`).

| Flag | Curta | Padrão | Descrição |
|------|-------|--------|-----------|
| `--lock-file` | `-l` | `wippy.lock` | Caminho do arquivo de lock |
| `--level` | | `warning` | Severidade mínima: `error`, `warning`, `hint` |
| `--ns` | | | Filtrar por padrões de namespace (ex: `app`, `lib.*`) |
| `--code` | | | Filtrar por códigos de erro (ex: `E0001,E0004`) |
| `--rules` | | `false` | Habilitar regras de estilo/qualidade do lint |
| `--summary` | | `false` | Agrupar saída por código de erro |
| `--limit` | | `0` | Máximo de diagnósticos exibidos (0 = ilimitado) |
| `--json` | | `false` | Saída em JSON |
| `--no-color` | | `false` | Desabilitar saída colorida |
| `--cache-reset` | | `false` | Limpar cache Lua antes do lint |

## wippy add

Adicionar uma dependência de módulo.

```bash
wippy add acme/http
wippy add acme/http@1.2.3
wippy add acme/http@latest
```

| Flag | Curta | Padrão | Descrição |
|------|-------|--------|-----------|
| `--lock-file` | `-l` | wippy.lock | Caminho do arquivo de lock |
| `--registry` | | | URL do registry |

## wippy install

Instalar dependências a partir do arquivo de lock.

```bash
wippy install                            # Instalar todos
wippy install acme/http                  # Instalar um modulo especifico
wippy install --refresh acme/http        # Recarregar um modulo especifico
```

| Flag | Curta | Padrão | Descrição |
|------|-------|--------|-----------|
| `--lock-file` | `-l` | wippy.lock | Caminho do arquivo de lock |
| `--refresh` | | false | Re-baixar cada módulo, ignorando o cache |
| `--force` | | false | Alias de `--refresh` |
| `--repair` | | false | Alias de `--refresh` |
| `--registry` | | | URL do registry |

## wippy update

Atualizar dependências e regenerar o arquivo de lock.

```bash
wippy update                      # Atualizar todas
wippy update acme/http            # Atualizar módulo específico
wippy update acme/http demo/sql   # Atualizar múltiplos
```

| Flag | Curta | Padrão | Descrição |
|------|-------|--------|-----------|
| `--lock-file` | `-l` | wippy.lock | Caminho do arquivo de lock |
| `--src-dir` | `-d` | ./src | Diretório de fontes |
| `--modules-dir` | | .wippy | Diretório de módulos |
| `--registry` | | | URL do registry |

## wippy pack

Criar um pack de snapshot (arquivo .wapp).

```bash
wippy pack snapshot.wapp
wippy pack release.wapp --description "Release 1.0"
wippy pack app.wapp --embed app:assets --bytecode **
```

| Flag | Curta | Descrição |
|------|-------|-----------|
| `--lock-file` | `-l` | Caminho do arquivo de lock |
| `--description` | `-d` | Descrição do pack |
| `--tags` | `-t` | Tags do pack (separadas por vírgula) |
| `--meta` | | Metadados personalizados (chave=valor) |
| `--embed` | | Incorporar entradas fs.directory (padrões) |
| `--list` | | Listar entradas fs.directory (simulação) |
| `--exclude-ns` | | Excluir namespaces (padrões) |
| `--exclude` | | Excluir entradas (padrões) |
| `--bytecode` | | Compilar Lua para bytecode (** para todos) |

## wippy publish

Publicar módulo no hub.

```bash
wippy publish
wippy publish --version 1.0.0
wippy publish --dry-run
```

Lê a partir do `wippy.yaml` no diretório atual.

| Flag | Descrição |
|------|-----------|
| `--version` | Versão a publicar |
| `--dry-run` | Validar sem publicar |
| `--label` | Publicar como label mutável em vez de versão |
| `--release-notes` | Notas de lançamento |
| `--protected` | Marcar versão como protegida |
| `--embed` | Incorporar entradas fs.directory por id ou nome |
| `--config` | Caminho para o diretório contendo wippy.yaml (padrão: .) |
| `--registry` | URL do registry |

## wippy search

Buscar módulos no hub.

```bash
wippy search http
wippy search "sql driver" --limit 20
wippy search auth --json
```

| Flag | Padrão | Descrição |
|------|--------|-----------|
| `--json` | false | Saída em JSON |
| `--limit` | 20 | Máximo de resultados |
| `--registry` | | URL do registry |

## wippy auth

Gerenciar autenticação no registry.

### wippy auth login

```bash
wippy auth login
wippy auth login --token YOUR_TOKEN
```

| Flag | Descrição |
|------|-----------|
| `--token` | Token de API |
| `--registry` | URL do registry |
| `--local` | Armazenar credenciais localmente |

### wippy auth logout

```bash
wippy auth logout
```

| Flag | Descrição |
|------|-----------|
| `--registry` | URL do registry |
| `--local` | Remover credenciais locais |

### wippy auth status

```bash
wippy auth status
wippy auth status --json
```

## wippy registry

Consultar e inspecionar entradas do registry.

### wippy registry list

```bash
wippy registry list
wippy registry list --kind function.lua
wippy registry list --ns app --json
```

| Flag | Curta | Descrição |
|------|-------|-----------|
| `--kind` | `-k` | Filtrar por tipo |
| `--ns` | `-n` | Filtrar por namespace |
| `--name` | | Filtrar por nome |
| `--meta` | | Filtrar por metadados |
| `--json` | | Saída em JSON |
| `--yaml` | | Saída em YAML |
| `--lock-file` | `-l` | Caminho do arquivo de lock |

### wippy registry show

```bash
wippy registry show app:http:handler
wippy registry show app:config --yaml
```

| Flag | Curta | Descrição |
|------|-------|-----------|
| `--field` | `-f` | Mostrar campo específico |
| `--json` | | Saída em JSON |
| `--yaml` | | Saída em YAML |
| `--raw` | | Saída bruta |
| `--lock-file` | `-l` | Caminho do arquivo de lock |

## wippy version

Imprimir informações de versão.

```bash
wippy version
wippy version --short
```

## Comandos Personalizados

Qualquer entrada `process.lua` ou `process.wasm` pode ser registrada como um comando nomeado adicionando metadados de `command`:

```yaml
entries:
  - name: test_runner
    kind: process.lua
    meta:
      command:
        name: test
        short: Run application tests
    source: file://runner.lua
    method: main
    modules:
      - io
      - registry
      - funcs
```

Execute com:

```bash
wippy run test
```

Liste todos os comandos disponíveis:

```bash
wippy run list
```

### Campos de Metadados do Comando

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `name` | Sim | Nome do comando usado com `wippy run <name>` |
| `short` | Não | Descrição curta exibida em `wippy run list` |

Qualquer tipo de entrada de processo funciona (`process.lua`, `process.wasm`). O nome do comando deve ser único entre todas as entradas carregadas. Argumentos após o nome do comando são passados para o processo.

## Exemplos

### Fluxo de Desenvolvimento

```bash
# Inicializar projeto
wippy init
wippy add wippy/http wippy/sql
wippy install

# Verificar erros
wippy lint

# Executar com saída de depuração
wippy run -c -v

# Sobrescrever configuração para desenvolvimento local
wippy run -o app:db:host=localhost -o app:db:port=5432
```

### Deploy em Produção

```bash
# Criar pack de release com bytecode
wippy pack release.wapp --bytecode ** --exclude-ns test.**

# Executar a partir do pack com limite de memória
wippy run release.wapp -m 2G
```

### Depuração

```bash
# Executar um único processo
wippy run --exec app:worker

# Com profiler ativado
wippy run -p -v
# Depois: go tool pprof http://localhost:6060/debug/pprof/heap
```

### Gerenciamento de Dependências

```bash
# Adicionar nova dependência
wippy add acme/http@latest

# Forçar re-download
wippy install --force

# Atualizar módulo específico
wippy update acme/http
```

### Publicação

```bash
# Login no hub
wippy auth login

# Validar módulo
wippy publish --dry-run

# Publicar
wippy publish --version 1.0.0 --release-notes "Initial release"
```

## Arquivo de Configuração

Crie `.wippy.yaml` para configurações persistentes:

```yaml
logger:
  encoding: console

logmanager:
  min_level: -1  # depuração

profiler:
  enabled: true
  address: localhost:6060

override:
  app:gateway:addr: ":9090"
  app:db:host: "localhost"
```

## Veja Também

- [Configuração](guides/configuration.md) - Referência do arquivo de configuração
- [Observabilidade](guides/observability.md) - Monitoramento e logging
