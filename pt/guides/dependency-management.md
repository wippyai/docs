# Gerenciamento de Dependencias

O Wippy utiliza um sistema de dependencias baseado em arquivo de lock. Modulos sao publicados no hub, declarados como dependencias no seu codigo-fonte e resolvidos em um arquivo `wippy.lock` que rastreia versoes exatas.

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

## Fluxo de Trabalho

### Iniciando um Novo Projeto

```bash
wippy init
```

Cria um `wippy.lock` com diretorios padrao.

### Adicionando Dependencias

```bash
wippy add acme/http               # Versao mais recente
wippy add acme/http@1.2.3         # Versao exata
wippy add acme/http@latest         # Label latest
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
wippy update                       # Resolve novamente todas as dependencias
wippy update acme/http             # Atualiza apenas acme/http
wippy update acme/http acme/sql    # Atualiza modulos especificos
```

Ao atualizar modulos especificos, os demais modulos permanecem fixados em suas versoes atuais. Se a atualizacao exigir alteracao de modulos que nao sao alvo, uma confirmacao e solicitada.

### Instalando a Partir do Arquivo de Lock

```bash
wippy install                      # Instala tudo a partir do lock
wippy install --force              # Ignora cache, baixa novamente
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

Substitua modulos do hub por diretorios locais para desenvolvimento:

```yaml
# wippy.lock
directories:
  modules: .wippy
  src: ./src
modules:
  - name: acme/http
    version: v1.2.0
    hash: ...
replacements:
  - from: acme/http
    to: ../local-http
```

O caminho de substituicao e relativo ao arquivo de lock. Quando uma substituicao esta ativa, o diretorio local e usado em vez do modulo vendorizado. Substituicoes sao preservadas entre operacoes de `wippy update`.

## Ordem de Carregamento

Na inicializacao, o Wippy carrega entradas dos diretorios nesta ordem:

1. Diretorio de codigo-fonte (`src`)
2. Diretorios de substituicao
3. Diretorios de modulos vendorizados

Modulos com substituicoes ativas ignoram seu caminho de vendor.

## Verificacao de Integridade

Cada modulo no arquivo de lock possui um hash de conteudo. Durante a instalacao, os modulos baixados sao verificados em relacao aos hashes esperados. Modulos incompativeis sao rejeitados e baixados novamente do registro.

## Veja Tambem

- [CLI](guides/cli.md) - Referencia de comandos
- [Publicacao](guides/publishing.md) - Publicando modulos no hub
- [Estrutura do Projeto](start/structure.md) - Layout do projeto
