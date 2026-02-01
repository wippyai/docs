# Referencia do CLI

Interface de linha de comando para o runtime Wippy.

## Flags Globais

Disponiveis em todos os comandos:

| Flag | Curta | Descricao |
|------|-------|-----------|
| `--config` | | Arquivo de configuracao (padrao: .wippy.yaml) |
| `--verbose` | `-v` | Habilita logging de debug |
| `--very-verbose` | | Debug com stack traces |
| `--console` | `-c` | Logging colorido no console |
| `--silent` | `-s` | Desabilita logging no console |
| `--event-streams` | `-e` | Transmite logs para o barramento de eventos |
| `--profiler` | `-p` | Habilita pprof em localhost:6060 |
| `--memory-limit` | `-m` | Limite de memoria (ex: 1G, 512M) |

Prioridade do limite de memoria: flag `--memory-limit` > env `GOMEMLIMIT` > padrao 1GB.

## wippy init

Cria um novo arquivo lock.

```bash
wippy init
wippy init --src-dir ./src --modules-dir .wippy
```

| Flag | Curta | Padrao | Descricao |
|------|-------|--------|-----------|
| `--src-dir` | `-d` | ./src | Diretorio fonte |
| `--modules-dir` | | .wippy | Diretorio de modulos |
| `--lock-file` | `-l` | wippy.lock | Caminho do arquivo lock |

## wippy run

Inicia o runtime ou executa um comando.

```bash
wippy run                                    # Inicia o runtime
wippy run list                               # Lista comandos disponiveis
wippy run test                               # Executa testes
wippy run snapshot.wapp                      # Executa a partir de arquivo pack
wippy run acme/http                          # Executa modulo
wippy run --exec app:processes/app:worker   # Executa processo unico
```

| Flag | Curta | Descricao |
|------|-------|-----------|
| `--override` | `-o` | Sobrescreve valores de entrada (namespace:entry:field=value) |
| `--exec` | `-x` | Executa processo e sai (host/namespace:entry) |
| `--host` | | Host para execucao |
| `--registry` | | URL do registro |

## wippy lint

Verifica codigo Lua em busca de erros de tipo e avisos.

```bash
wippy lint
wippy lint --level warning
```

Valida todas as entradas Lua: `function.lua.*`, `library.lua.*`, `process.lua.*`, `workflow.lua.*`.

| Flag | Descricao |
|------|-----------|
| `--level` | Nivel de severidade minimo a reportar |

## wippy add

Adiciona uma dependencia de modulo.

```bash
wippy add acme/http
wippy add acme/http@1.2.3
wippy add acme/http@latest
```

| Flag | Curta | Padrao | Descricao |
|------|-------|--------|-----------|
| `--lock-file` | `-l` | wippy.lock | Caminho do arquivo lock |
| `--registry` | | | URL do registro |

## wippy install

Instala dependencias do arquivo lock.

```bash
wippy install
wippy install --force
wippy install --repair
```

| Flag | Curta | Descricao |
|------|-------|-----------|
| `--lock-file` | `-l` | Caminho do arquivo lock |
| `--force` | | Ignora cache, sempre baixa |
| `--repair` | | Verifica hashes, re-baixa se divergir |
| `--registry` | | URL do registro |

## wippy update

Atualiza dependencias e regenera arquivo lock.

```bash
wippy update                      # Atualiza tudo
wippy update acme/http            # Atualiza modulo especifico
wippy update acme/http demo/sql   # Atualiza multiplos
```

| Flag | Curta | Padrao | Descricao |
|------|-------|--------|-----------|
| `--lock-file` | `-l` | wippy.lock | Caminho do arquivo lock |
| `--src-dir` | `-d` | . | Diretorio fonte |
| `--modules-dir` | | .wippy | Diretorio de modulos |
| `--registry` | | | URL do registro |

## wippy pack

Cria um pack de snapshot (arquivo .wapp).

```bash
wippy pack snapshot.wapp
wippy pack release.wapp --description "Release 1.0"
wippy pack app.wapp --embed app:assets --bytecode **
```

| Flag | Curta | Descricao |
|------|-------|-----------|
| `--lock-file` | `-l` | Caminho do arquivo lock |
| `--description` | `-d` | Descricao do pack |
| `--tags` | `-t` | Tags do pack (separadas por virgula) |
| `--meta` | | Metadados personalizados (chave=valor) |
| `--embed` | | Embute entradas fs.directory (padroes) |
| `--list` | | Lista entradas fs.directory (dry-run) |
| `--exclude-ns` | | Exclui namespaces (padroes) |
| `--exclude` | | Exclui entradas (padroes) |
| `--bytecode` | | Compila Lua para bytecode (** para todos) |

## wippy publish

Publica modulo no hub.

```bash
wippy publish
wippy publish --version 1.0.0
wippy publish --dry-run
```

Le de `wippy.yaml` no diretorio atual.

| Flag | Descricao |
|------|-----------|
| `--version` | Versao a publicar |
| `--dry-run` | Valida sem publicar |
| `--label` | Rotulo da versao |
| `--release-notes` | Notas de lancamento |
| `--protected` | Marca como protegido |
| `--registry` | URL do registro |

## wippy search

Busca modulos no hub.

```bash
wippy search http
wippy search "sql driver" --limit 20
wippy search auth --json
```

| Flag | Descricao |
|------|-----------|
| `--json` | Saida como JSON |
| `--limit` | Maximo de resultados |
| `--registry` | URL do registro |

## wippy auth

Gerencia autenticacao do registro.

### wippy auth login

```bash
wippy auth login
wippy auth login --token YOUR_TOKEN
```

| Flag | Descricao |
|------|-----------|
| `--token` | Token de API |
| `--registry` | URL do registro |
| `--local` | Armazena credenciais localmente |

### wippy auth logout

```bash
wippy auth logout
```

| Flag | Descricao |
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

| Flag | Curta | Descricao |
|------|-------|-----------|
| `--kind` | `-k` | Filtra por kind |
| `--ns` | `-n` | Filtra por namespace |
| `--name` | | Filtra por nome |
| `--meta` | | Filtra por metadados |
| `--json` | | Saida como JSON |
| `--yaml` | | Saida como YAML |
| `--lock-file` | `-l` | Caminho do arquivo lock |

### wippy registry show

```bash
wippy registry show app:http:handler
wippy registry show app:config --yaml
```

| Flag | Curta | Descricao |
|------|-------|-----------|
| `--field` | `-f` | Mostra campo especifico |
| `--json` | | Saida como JSON |
| `--yaml` | | Saida como YAML |
| `--raw` | | Saida bruta |
| `--lock-file` | `-l` | Caminho do arquivo lock |

## wippy version

Imprime informacoes de versao.

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

# Executa com saida de debug
wippy run -c -v

# Sobrescreve configuracao para dev local
wippy run -o app:db:host=localhost -o app:db:port=5432
```

### Deploy em Producao

```bash
# Cria pack de release com bytecode
wippy pack release.wapp --bytecode ** --exclude-ns test.**

# Executa a partir do pack com limite de memoria
wippy run release.wapp -m 2G
```

### Depuracao

```bash
# Executa processo unico
wippy run --exec app:processes/app:worker

# Com profiler habilitado
wippy run -p -v
# Depois: go tool pprof http://localhost:6060/debug/pprof/heap
```

### Gerenciamento de Dependencias

```bash
# Adiciona nova dependencia
wippy add acme/http@latest

# Repara modulos corrompidos
wippy install --repair

# Forca re-download
wippy install --force

# Atualiza modulo especifico
wippy update acme/http
```

### Publicacao

```bash
# Login no hub
wippy auth login

# Valida modulo
wippy publish --dry-run

# Publica
wippy publish --version 1.0.0 --release-notes "Release inicial"
```

## Arquivo de Configuracao

Crie `.wippy.yaml` para configuracoes persistentes:

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

## Veja Tambem

- [Configuracao](guide-configuration.md) - Referencia do arquivo de configuracao
- [Observabilidade](guide-observability.md) - Monitoramento e logging
