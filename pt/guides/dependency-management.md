---
title: "Gerenciamento de Dependências"
description: "Declare, resolva, instale, atualize, substitua e verifique dependências de módulos Wippy com um arquivo de lock."
---

# Gerenciamento de Dependências

O Wippy resolve dependências de módulos a partir das declarações no código-fonte e registra versões exatas em `wippy.lock`. Os módulos publicados são baixados do Hub para o diretório de módulos do projeto.

Os nomes de módulos `acme/*`, versões, hashes e caminhos locais abaixo são ilustrativos. Substitua-os por módulos e digests verificados do seu projeto ou do Hub.

## Arquivos do Projeto

### wippy.lock

O arquivo de lock rastreia a estrutura de diretorios do seu projeto e dependencias fixadas:

```yaml
directories:
  modules: .wippy
  src: ./src
modules:
  - name: acme/http
    version: v1.2.0
    hash: 4ea816fe84ca58a1f0869e5ca6afa93d6ddd72fa09e1162d9e600a7fbf39f0a2
  - name: acme/sql
    version: v2.0.1
    hash: b3f9c8e12a456d7890abcdef1234567890abcdef1234567890abcdef12345678
```

| Campo | Descricao |
|-------|-----------|
| `directories.modules` | Onde os modulos baixados sao armazenados (padrao: `.wippy`) |
| `directories.src` | Onde seu codigo-fonte reside (padrao: `./src`) |
| `modules[].name` | Identificador do modulo no formato `org/module` |
| `modules[].version` | Versao semantica fixada |
| `modules[].hash` | Hash de conteudo para verificacao de integridade |

### wippy.yaml

Metadados do modulo para publicacao. Necessario apenas quando voce publica seu proprio modulo:

```yaml
organization: acme
module: http
version: 1.2.0
description: HTTP utilities for Wippy
license: MIT
repository: https://github.com/acme/wippy-http
keywords:
  - http
  - web
```

| Campo | Obrigatorio | Descricao |
|-------|-------------|-----------|
| `organization` | Sim | Minusculo, alfanumerico com hifens |
| `module` | Sim | Minusculo, alfanumerico com hifens |
| `version` | Nao | Versao semantica (definida no momento da publicacao) |
| `description` | Nao | Descricao do modulo |
| `license` | Nao | Identificador de licenca SPDX |
| `repository` | Nao | URL do repositorio de codigo-fonte |
| `homepage` | Nao | Pagina inicial do projeto |
| `keywords` | Nao | Palavras-chave para descoberta |
| `authors` | Nao | Lista de autores |

## Declarando Dependencias

Adicione entradas `ns.dependency` no seu `_index.yaml`:

```yaml
version: "1.0"
namespace: app
entries:
  - name: dependency.http
    kind: ns.dependency
    component: acme/http
    version: "^1.0.0"

  - name: dependency.sql
    kind: ns.dependency
    component: acme/sql
    version: ">=2.0.0"
```

### Restricoes de Versao

| Restricao | Exemplo | Correspondencia |
|-----------|---------|-----------------|
| Exata | `1.2.3` | Apenas 1.2.3 |
| Circunflexo | `^1.2.0` | >=1.2.0, <2.0.0 |
| Til | `~1.2.0` | >=1.2.0, <1.3.0 |
| Faixa | `>=1.0.0` | 1.0.0 e acima |
| Curinga | `*` | Qualquer versao (seleciona a mais alta) |
| Combinada | `>=1.0.0 <2.0.0` | Entre 1.0.0 e 2.0.0 |

### Regras de Resolucao

- Cada modulo resolve contra a **intersecao de todas as faixas declaradas** no grafo de dependencias. Faixas incompativeis (conflitos de diamante) falham a resolucao com um erro explicito em vez de escolher silenciosamente um dos lados.
- Dependencias sao resolvidas a partir de suas faixas declaradas, nao de pins resolvidos anteriormente.
- **Declaracoes raiz vencem as transitivas**: quando sua aplicacao e uma dependencia puxam o mesmo modulo ou requirement, sua declaracao tem precedencia. Uma entrada de dependencia carregando `meta.module` e transitiva a menos que explicitamente marcada como raiz — aplicacoes publicadas mantem suas dependencias declaradas no codigo-fonte como raizes.
- O mesmo componente pode ser declarado como dependencia raiz apenas uma vez — uma declaracao duplicada e rejeitada com um erro de conflito. Atualize a dependencia existente em vez disso.

O runtime persiste cada grafo resolvido no historico do seu registro e o reproduz no boot em vez de resolver de novo, entao uma aplicacao implantada inicia exatamente com as versoes que foram resolvidas quando a mudanca de dependencia foi aplicada. O `wippy.lock` continua sendo o snapshot portavel para projetos de codigo-fonte.

## Fluxo de Trabalho

### Iniciando um Novo Projeto

```bash
wippy init
```

Cria um `wippy.lock` com diretorios padrao.

### Adicionando Dependencias

```bash
wippy add acme/http               # Latest version
wippy add acme/http@1.2.3         # Exact version
wippy add acme/http@latest         # Latest label
```

Isso atualiza o arquivo de lock. Em seguida, instale:

```bash
wippy install
```

### Resolvendo a Partir do Codigo-Fonte

Se seu codigo-fonte ja declara entradas `ns.dependency`:

```bash
wippy update
```

Isso escaneia seu diretorio de codigo-fonte, resolve todas as restricoes de dependencias, atualiza o arquivo de lock e instala os modulos.

### Atualizando Dependencias

```bash
wippy update                       # Re-resolve all dependencies
wippy update acme/http             # Update only acme/http
wippy update acme/http acme/sql    # Update specific modules
```

Ao atualizar modulos especificos, os demais modulos permanecem fixados em suas versoes atuais. Se a atualizacao exigir alteracao de modulos que nao sao alvo, uma confirmacao e solicitada.

### Instalando a Partir do Arquivo de Lock

```bash
wippy install                      # Install all from lock
wippy install --refresh            # Re-fetch every module (--force and --repair are aliases)
```

## Armazenamento de Modulos

Os modulos baixados sao armazenados no diretorio `.wippy/vendor/`:

```
project/
  wippy.lock
  src/
    _index.yaml
  .wippy/
    vendor/
      acme/
        http-v1.2.0.wapp
        sql-v2.0.1.wapp
```

Por padrao, os modulos sao mantidos como arquivos `.wapp`. Para extrai-los em diretorios:

```yaml
# wippy.lock
options:
  unpack_modules: true
```

Com a extracao habilitada:

```
.wippy/
  vendor/
    acme/
      http/
        wippy.yaml
        src/
          _index.yaml
          ...
```

## Desenvolvimento Local com Substituicoes

Substitua modulos do hub por diretorios locais para desenvolvimento. Substituicoes sao declaradas na secao `workspace` de um arquivo de configuracao do runtime — tipicamente um arquivo privado, ignorado pelo git, composto sobre `.wippy.yaml`:

```yaml
# .wippy.workspace.yaml
version: "1.0"
workspace:
  replacements:
    acme/http: ../local-http
    acme/sql: ../local-sql
```

```bash
wippy run --config .wippy.yaml --config .wippy.workspace.yaml
```

As chaves sao `org/module`, os valores sao diretorios (caminhos relativos resolvem contra o diretorio do primeiro arquivo `--config`; o caminho deve existir e ser um diretorio). Definir uma substituicao como `null` desativa uma herdada de uma camada de configuracao ou profile anterior. Substituicoes tambem podem viver dentro de um [profile](guides/configuration.md#profiles) para ativarem apenas com `--profile workspace`.

Substituicoes de workspace afetam o grafo de carga no boot e nunca sao gravadas no `wippy.lock`. Mudancas no codigo-fonte local sao reconciliadas diretamente, sem contatar o hub. Os globs `exclude:` do `wippy.yaml` do modulo aplicam-se tambem a diretorios de substituicao, tanto ao carregar entradas quanto ao calcular o hash do conteudo.

Uma secao `replacements:` no `wippy.lock` esta obsoleta: ela ainda carrega, mas imprime um aviso. Mova essas entradas para `workspace.replacements` em um arquivo de configuracao.

## Ordem de Carregamento

Na inicializacao, o Wippy carrega entradas dos diretorios nesta ordem:

1. Diretorio de codigo-fonte (`src`)
2. Diretorios de substituicao
3. Diretorios de modulos vendorizados

Modulos com substituicoes ativas ignoram seu caminho de vendor.

## Verificacao de Integridade

O hash de conteúdo de uma entrada do lock é opcional até que a instalação o preencha. Quando existe um digest esperado, a instalação verifica os módulos em cache e baixados em relação a ele. Um módulo em cache com hash divergente interrompe a instalação; execute `wippy install --refresh` para baixar e verificar uma cópia nova. Um módulo recém-baixado que falhar na verificação é removido, e a instalação falha.

## Veja Tambem

- [Construindo Componentes](guides/components.md) — Declare requirements e forneça valores por meio de `parameters`
- [CLI](guides/cli.md) — Referência de comandos
- [Publicação](guides/publishing.md) — Publique módulos no Hub
- [Estrutura do Projeto](start/structure.md) — Layout do projeto
