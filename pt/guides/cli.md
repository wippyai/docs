---
title: "Referência da CLI"
description: "Interface de linha de comando para o runtime do Wippy."
---

# Referência da CLI

Interface de linha de comando para o runtime do Wippy.

## Flags Globais

Disponíveis em todos os comandos:

| Flag | Curta | Descrição |
|------|-------|-----------|
| `--config` | | Arquivo de configuração, repetível; arquivos posteriores sobrescrevem os anteriores (padrão: .wippy.yaml) |
| `--verbose` | `-v` | Ativar logs de depuração |
| `--very-verbose` | | Depuração com stack traces |
| `--console` | `-c` | Logs coloridos no console |
| `--silent` | `-s` | Desativar logs no console |
| `--event-streams` | `-e` | Transmitir logs para o barramento de eventos |
| `--profiler` | `-p` | Ativar pprof em localhost:6060 |
| `--memory-limit` | `-m` | Limite de memória (ex: 1G, 512M) |

Prioridade do limite de memória: flag `--memory-limit` > variável de ambiente `GOMEMLIMIT` > padrão de 1GB.

`--config` pode ser passado múltiplas vezes para compor arquivos de configuração. Os arquivos mesclam da esquerda para a direita: arquivos posteriores sobrescrevem valores correspondentes e mantêm todo o resto. Todo arquivo nomeado explicitamente deve existir; sem `--config`, o `.wippy.yaml` padrão é opcional. O primeiro arquivo ancora o diretório usado para resolver caminhos relativos. A configuração aplica-se em ordem: composição de arquivos, depois seleções de `--profile`, depois overrides de `--set`. Veja [Configuração](guides/configuration.md#config-composition).

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
wippy run                                   # Iniciar o runtime
wippy run list                              # Listar comandos disponíveis
wippy run migrate                           # Executar um comando personalizado nomeado
wippy run snapshot.wapp                     # Executar a partir de arquivo pack
wippy run acme/http                         # Executar módulo do hub
wippy run acme/http@1.2.3                   # Executar versão específica
wippy run --exec app:worker                 # Iniciar runtime e executar um único processo
```

| Flag | Curta | Descrição |
|------|-------|-----------|
| `--override` | `-o` | Sobrescrever valores de entrada (`namespace:entry:field=value`); `field` pode ser `kind` para alterar o tipo da entrada |
| `--set` | | Sobrescrever um valor de configuração (`section.path=value`, repetível, tem precedência sobre o arquivo de configuração) |
| `--exec` | `-x` | Executar processo e encerrar (`namespace:entry`) |
| `--host` | | ID do host de terminal para `--exec` (detectado automaticamente se existir apenas um `terminal.host`) |
| `--registry` | | URL do registry para módulos do hub |
| `--profile` | | Aplicar um profile de runtime do `.wippy.yaml` ou dos metadados de runtime empacotados (repetível, aplicado em ordem) |

Executar um módulo do hub (`wippy run org/module`) o resolve uma vez, registra-o no `wippy.lock` e vendoriza localmente os packs verificados. Execuções subsequentes da mesma referência partem do lock — sem necessidade de rede. Um seletor de versão que não corresponde mais ao lock é rejeitado com uma dica para executar `wippy update`.

`--set` escreve qualquer valor de configuração do runtime pela linha de comando, mesclado sobre `.wippy.yaml` por folha:

```bash
wippy run --set cluster.enabled=true \
          --set cluster.membership.join_addrs=node-2:7946,node-3:7946 \
          --set cluster.raft.bootstrap_expect=3
```

Os valores são convertidos pelo formato: `true`/`false` para bool, inteiros e floats para números, o restante permanece string (durações como `5s` são analisadas onde a opção espera uma).

## wippy test

Executar o entrypoint de teste: a entrada de processo que declara o use case `test`. O runtime inicia, executa essa entrada e encerra. `wippy run` não executa automaticamente entrypoints de teste; testes sempre passam por `wippy test`.

```bash
wippy test                     # Executar testes do projeto local
wippy test snapshot.wapp       # Executar testes de um arquivo pack
wippy test acme/module@1.2.3   # Executar testes de um módulo do hub
```

| Flag | Curta | Descrição |
|------|-------|-----------|
| `--override` | `-o` | Sobrescrever valores de entrada (`namespace:entry:field=value`) |
| `--host` | | ID do host de terminal (detectado automaticamente se existir apenas um `terminal.host`) |
| `--registry` | | URL do registry para módulos do hub |
| `--set` | | Sobrescrever um valor de configuração (`section.path=value`, repetível) |
| `--profile` | | Aplicar um profile de runtime (repetível, aplicado em ordem) |

## wippy lint

Verificar erros de tipo e avisos no código Lua.

```bash
wippy lint
wippy lint --level warning
wippy lint --json
wippy lint --rules
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
| `--profile` | | | Aplicar um profile de workspace da configuração de runtime mesclada (repetível) |
| `--set` | | | Sobrescrever um valor da configuração de runtime mesclada (`section.path=value`, repetível) |

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
wippy install acme/http                  # Instalar módulo específico
wippy install --refresh acme/http        # Re-baixar um módulo específico
```

| Flag | Curta | Padrão | Descrição |
|------|-------|--------|-----------|
| `--lock-file` | `-l` | wippy.lock | Caminho do arquivo de lock |
| `--refresh` | | false | Re-baixar cada módulo, ignorando o cache |
| `--force` | | false | Alias de `--refresh` |
| `--repair` | | false | Alias de `--refresh` |
| `--registry` | | | URL do registry |
| `--profile` | | | Aplicar um profile de workspace da configuração de runtime mesclada (repetível) |
| `--set` | | | Sobrescrever um valor da configuração de runtime mesclada (`section.path=value`, repetível) |

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
| `--profile` | | | Aplicar um profile de workspace da configuração de runtime mesclada (repetível) |
| `--set` | | | Sobrescrever um valor da configuração de runtime mesclada (`section.path=value`, repetível) |

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
| `--embed-all` | | Incorporar todas as entradas fs.directory (não pode combinar com `--embed`) |
| `--list` | | Listar entradas fs.directory (simulação) |
| `--exclude-ns` | | Excluir namespaces (padrões) |
| `--exclude` | | Excluir entradas (padrões) |
| `--bytecode` | | Compilar Lua para bytecode (** para todos) |
| `--profile` | | Aplicar um profile de runtime do `.wippy.yaml` antes de empacotar (repetível, aplicado em ordem) |

Sem `--embed` nem `--embed-all`, os padrões de incorporação recorrem à seção `embed:` do manifesto de módulo `wippy.yaml`. Empacotar uma aplicação também carrega os recursos incorporados dos packs de suas dependências, e apenas os comandos do módulo principal são expostos pelo pack resultante.

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
| `--create` | Criar o módulo no registry se ainda não existir |
| `--module-visibility` | Visibilidade para módulos recém-criados (`--create` apenas): `public` ou `private` (padrão: private) |
| `--module-type` | Tipo do módulo: `library`, `application`, `agent` ou `plugin` (sobrescreve `type:` no wippy.yaml) |
| `--module-display-name` | Nome de exibição para módulos recém-criados (`--create` apenas) |

O tipo do módulo normalmente é declarado como `type:` no `wippy.yaml` (veja [Publicação](guides/publishing.md#wippy-yaml)); `--module-type` o sobrescreve para uma única publicação. Quando nenhum dos dois está definido, módulos recém-criados assumem `application` com um aviso de obsolescência.

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

| Flag | Descrição |
|------|-----------|
| `--json` | Saída em JSON |

## wippy readme

Obter o README de um módulo a partir do hub.

```bash
wippy readme wippy/terminal
wippy readme wippy/terminal@1.2.3
wippy readme --json wippy/terminal@latest
```

| Flag | Descrição |
|------|-----------|
| `--json` | Saída em JSON |
| `--registry` | URL do registry (padrão: das credenciais) |

## wippy registry

Consultar e inspecionar entradas do registry. Ambos os subcomandos aceitam `--profile` e `--set` para moldar a configuração de runtime mesclada sob a qual as entradas são carregadas.

### wippy registry list

```bash
wippy registry list
wippy registry list --kind "function.lua.*"
wippy registry list --ns "app.*" --json
wippy registry list --meta "type=api" --meta "enabled=true"
```

| Flag | Curta | Descrição |
|------|-------|-----------|
| `--kind` | `-k` | Filtrar por tipo (padrão glob) |
| `--ns` | `-n` | Filtrar por namespace (padrão glob) |
| `--name` | | Filtrar por nome (padrão glob) |
| `--meta` | | Filtrar por metadados (repetível) |
| `--json` | | Saída em JSON |
| `--yaml` | | Saída em YAML |
| `--lock-file` | `-l` | Caminho do arquivo de lock |

Operadores de metadados para `--meta`:

| Operador | Significado |
|----------|-------------|
| `field=value` | Correspondência exata |
| `field~regex` | Correspondência por regex |
| `field*substr` | Contém substring |
| `field^prefix` | Começa com prefixo |
| `field$suffix` | Termina com sufixo |

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
  - name: migrate_runner
    kind: process.lua
    meta:
      command:
        name: migrate
        short: Run database migrations
    source: file://runner.lua
    method: main
    modules:
      - io
      - registry
      - funcs
```

Execute com:

```bash
wippy run migrate
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
| `main` | Não | Marca esta entrada como comando padrão (selecionado automaticamente por packs e módulos do hub que entregam um único comando) |
| `use_case` | Não | Categoria de entrypoint, padrão `run`. A entrada que declara `use_case: test` é a que `wippy test` executa |

Qualquer tipo de entrada de processo funciona (`process.lua`, `process.wasm`). O nome do comando deve ser único entre todas as entradas carregadas. Argumentos após o nome do comando são passados para o processo como payloads de string.

## Exemplos

### Fluxo de Desenvolvimento

```bash
# Inicializar projeto
wippy init
wippy add wippy/test wippy/llm
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

## Variáveis de Ambiente

| Variável | Efeito |
|----------|--------|
| `WIPPY_TOKEN` | Token de autenticação do registry; sobrescreve credenciais armazenadas (um token enviado via `hub.auth.authenticate` tem precedência ainda maior) |
| `WIPPY_REGISTRY` | URL padrão do registry (sobrescrita por `--registry`) |
| `WIPPY_CACHE_DIR` | Diretório de cache para módulos do hub executados via `wippy run org/module` (padrão: `~/.wippy/cache`) |
| `GOMEMLIMIT` | Fallback do limite de memória quando `--memory-limit` não está definido |

Valores no `.wippy.yaml` podem referenciar variáveis de ambiente do SO com `${env:NAME}`, resolvidas no carregamento do arquivo; uma variável ausente falha o carregamento da configuração. Referências `${name}` simples resolvem a partir da seção `vars:` da configuração.

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
