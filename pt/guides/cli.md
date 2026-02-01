# Referência do CLI

Interface de linha de comando para o runtime Wippy.

## Flags Globais

Disponíveis em todos os comandos:

| Flag | Curta | Descrição |
|------|-------|-----------|
| `--config` | | Arquivo de configuração (padrão: .wippy.yaml) |
| `--verbose` | `-v` | Habilita logging de debug |
| `--very-verbose` | | Debug com stack traces |
| `--console` | `-c` | Logging colorido no console |
| `--silent` | `-s` | Desabilita logging no console |
| `--event-streams` | `-e` | Transmite logs para o barramento de eventos |
| `--profiler` | `-p` | Habilita pprof em localhost:6060 |
| `--memory-limit` | `-m` | Limite de memória (ex: 1G, 512M) |

Prioridade do limite de memória: flag `--memory-limit` > env `GOMEMLIMIT` > padrão 1GB.

## wippy init

Cria um novo arquivo lock.

```bash
wippy init
wippy init --src-dir ./src --modules-dir .wippy
```

| Flag | Curta | Padrão | Descrição |
|------|-------|--------|-----------|
| `--src-dir` | `-d` | ./src | Diretório fonte |
| `--modules-dir` | | .wippy | Diretório de módulos |
| `--lock-file` | `-l` | wippy.lock | Caminho do arquivo lock |

## wippy run

Inicia o runtime ou executa um comando.

```bash
wippy run                                    # Inicia o runtime
wippy run list                               # Lista comandos disponíveis
wippy run test                               # Executa testes
wippy run snapshot.wapp                      # Executa a partir de arquivo pack
wippy run acme/http                          # Executa módulo
wippy run --exec app:processes/app:worker   # Executa processo único
```

| Flag | Curta | Descrição |
|------|-------|-----------|
| `--override` | `-o` | Sobrescreve valores de entrada (namespace:entry:field=value) |
| `--exec` | `-x` | Executa processo e sai (host/namespace:entry) |
| `--host` | | Host para execução |
| `--registry` | | URL do registro |

## wippy lint

Verifica código Lua em busca de erros de tipo e avisos.

```bash
wippy lint
wippy lint --level warning
```

Valida todas as entradas Lua: `function.lua.*`, `library.lua.*`, `process.lua.*`, `workflow.lua.*`.

| Flag | Descrição |
|------|-----------|
| `--level` | Nível de severidade mínimo a reportar |

## wippy add

Adiciona uma dependência de módulo.

```bash
wippy add acme/http
wippy add acme/http@1.2.3
wippy add acme/http@latest
```

| Flag | Curta | Padrão | Descrição |
|------|-------|--------|-----------|
| `--lock-file` | `-l` | wippy.lock | Caminho do arquivo lock |
| `--registry` | | | URL do registro |

## wippy install

Instala dependências do arquivo lock.

```bash
wippy install
wippy install --force
wippy install --repair
```

| Flag | Curta | Descrição |
|------|-------|-----------|
| `--lock-file` | `-l` | Caminho do arquivo lock |
| `--force` | | Ignora cache, sempre baixa |
| `--repair` | | Verifica hashes, re-baixa se divergir |
| `--registry` | | URL do registro |

## wippy update

Atualiza dependências e regenera arquivo lock.

```bash
wippy update                      # Atualiza tudo
wippy update acme/http            # Atualiza módulo específico
wippy update acme/http demo/sql   # Atualiza múltiplos
```

| Flag | Curta | Padrão | Descrição |
|------|-------|--------|-----------|
| `--lock-file` | `-l` | wippy.lock | Caminho do arquivo lock |
| `--src-dir` | `-d` | . | Diretório fonte |
| `--modules-dir` | | .wippy | Diretório de módulos |
| `--registry` | | | URL do registro |

## wippy pack

Cria um pack de snapshot (arquivo .wapp).

```bash
wippy pack snapshot.wapp
wippy pack release.wapp --description "Release 1.0"
wippy pack app.wapp --embed app:assets --bytecode **
```

| Flag | Curta | Descrição |
|------|-------|-----------|
| `--lock-file` | `-l` | Caminho do arquivo lock |
| `--description` | `-d` | Descrição do pack |
| `--tags` | `-t` | Tags do pack (separadas por vírgula) |
| `--meta` | | Metadados personalizados (chave=valor) |
| `--embed` | | Embute entradas fs.directory (padrões) |
| `--list` | | Lista entradas fs.directory (dry-run) |
| `--exclude-ns` | | Exclui namespaces (padrões) |
| `--exclude` | | Exclui entradas (padrões) |
| `--bytecode` | | Compila Lua para bytecode (** para todos) |

## wippy publish

Publica módulo no hub.

```bash
wippy publish
wippy publish --version 1.0.0
wippy publish --dry-run
```

Lê de `wippy.yaml` no diretório atual.

| Flag | Descrição |
|------|-----------|
| `--version` | Versão a publicar |
| `--dry-run` | Valida sem publicar |
| `--label` | Rótulo da versão |
| `--release-notes` | Notas de lançamento |
| `--registry` | URL do registro |

## wippy search

Busca módulos no hub.

```bash
wippy search http
wippy search "sql driver" --limit 20
wippy search auth --json
```

| Flag | Descrição |
|------|-----------|
| `--json` | Saída como JSON |
| `--limit` | Máximo de resultados |
| `--registry` | URL do registro |

## wippy auth

Gerencia autenticação do registro.

### wippy auth login

```bash
wippy auth login
wippy auth login --token YOUR_TOKEN
```

| Flag | Descrição |
|------|-----------|
| `--token` | Token de API |
| `--registry` | URL do registro |
| `--local` | Armazena credenciais localmente |

### wippy auth logout

```bash
wippy auth logout
```

| Flag | Descrição |
|------|-----------|
| `--registry` | URL do registro |
| `--local` | Remove credenciais locais |

### wippy auth status

```bash
wippy auth status
wippy auth status --json
```

## wippy registry

Consulta e inspeciona entradas do registro.

### wippy registry list

```bash
wippy registry list
wippy registry list --kind function.lua
wippy registry list --ns app --json
```

| Flag | Curta | Descrição |
|------|-------|-----------|
| `--kind` | `-k` | Filtra por kind |
| `--ns` | `-n` | Filtra por namespace |
| `--name` | | Filtra por nome |
| `--meta` | | Filtra por metadados |
| `--json` | | Saída como JSON |
| `--yaml` | | Saída como YAML |
| `--lock-file` | `-l` | Caminho do arquivo lock |

### wippy registry show

```bash
wippy registry show app:http:handler
wippy registry show app:config --yaml
```

| Flag | Curta | Descrição |
|------|-------|-----------|
| `--field` | `-f` | Mostra campo específico |
| `--json` | | Saída como JSON |
| `--yaml` | | Saída como YAML |
| `--raw` | | Saída bruta |
| `--lock-file` | `-l` | Caminho do arquivo lock |

## wippy version

Imprime informações de versão.

```bash
wippy version
wippy version --short
```

## Exemplos

### Fluxo de Desenvolvimento

```bash
# Inicializa projeto
wippy init
wippy add wippy/http wippy/sql
wippy install

# Verifica erros
wippy lint

# Executa com saída de debug
wippy run -c -v

# Sobrescreve configuração para dev local
wippy run -o app:db:host=localhost -o app:db:port=5432
```

### Deploy em Produção

```bash
# Cria pack de release com bytecode
wippy pack release.wapp --bytecode ** --exclude-ns test.**

# Executa a partir do pack com limite de memória
wippy run release.wapp -m 2G
```

### Depuração

```bash
# Executa processo único
wippy run --exec app:processes/app:worker

# Com profiler habilitado
wippy run -p -v
# Depois: go tool pprof http://localhost:6060/debug/pprof/heap
```

### Gerenciamento de Dependências

```bash
# Adiciona nova dependência
wippy add acme/http@latest

# Repara módulos corrompidos
wippy install --repair

# Força re-download
wippy install --force

# Atualiza módulo específico
wippy update acme/http
```

### Publicação

```bash
# Login no hub
wippy auth login

# Valida módulo
wippy publish --dry-run

# Publica
wippy publish --version 1.0.0 --release-notes "Release inicial"
```

## Arquivo de Configuração

Crie `.wippy.yaml` para configurações persistentes:

```yaml
logger:
  mode: development
  level: debug
  encoding: console

logmanager:
  min_level: -1  # debug

profiler:
  enabled: true
  address: localhost:6060

override:
  app:gateway:addr: ":9090"
  app:db:host: "localhost"
```

## Veja Também

- [Configuração](guide-configuration.md) - Referência do arquivo de configuração
- [Observabilidade](guide-observability.md) - Monitoramento e logging
