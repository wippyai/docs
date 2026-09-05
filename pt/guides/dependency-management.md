---
title: "Gerenciamento de Dependencias"
description: "O Wippy utiliza um sistema de dependencias baseado em arquivo de lock. Modulos sao publicados no hub, declarados como dependencias no seu codigo-fonte…"
---

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
| `modules[].hash` | Digest do artefato que o pack baixado deve corresponder; um valor hex puro e lido como `sha256` |
| `modules[].root` | Marca a raiz de deployment selecionada; no maximo um modulo pode carrega-la |
| `options.unpack_modules` | Extrair packs em diretorios em vez de carrega-los como arquivos `.wapp` (padrao: `false`) |

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
- **Declaracoes raiz vencem as transitivas**: quando sua aplicacao e uma dependencia puxam o mesmo modulo ou requirement, sua declaracao tem precedencia.
- O mesmo componente pode ser declarado como dependencia raiz apenas uma vez — uma declaracao duplicada e rejeitada com um erro de conflito. Atualize a dependencia existente em vez disso.

Duas falhas de resolucao sao reportadas de forma distinta. Uma expressao de restricao que nunca podera ser satisfeita por nenhum release — a intersecao das faixas vigentes e vazia — e um conflito, e o erro nomeia o modulo e todo solicitante que contribuiu com uma faixa. Um conjunto de faixas valido para o qual o hub atualmente nao publica nenhuma versao correspondente e, em vez disso, uma falha de disponibilidade: um release posterior pode torna-lo resolvivel sem nenhuma mudanca nas declaracoes.

O runtime persiste cada grafo resolvido no historico do seu registro e o reproduz no boot em vez de resolver de novo, entao uma aplicacao implantada inicia exatamente com as versoes que foram resolvidas quando a mudanca de dependencia foi aplicada. O `wippy.lock` continua sendo o snapshot portavel para projetos de codigo-fonte.

### Proveniencia de entradas

A proveniencia pertence ao registry, nao aos metadados da entrada. Quando as entradas sao carregadas, o registry marca cada uma com a fonte de deployment que a forneceu:

| Campo | Descricao |
|-------|-----------|
| `registry.owner` | Nome do modulo (`org/module`) que forneceu a entrada; vazio para codigo-fonte da aplicacao |
| `registry.root` | Definido em entradas `ns.dependency` fornecidas pela raiz de deployment, marcando-as como declaracoes raiz |

Autores de entradas nunca escrevem esses campos; eles sao atribuidos durante o carregamento e nao podem ser forjados a partir de um `_index.yaml`. Inspecione-os com `wippy registry list --registry-meta --json`.

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
wippy install --refresh            # Rebaixar cada módulo (--force e --repair são aliases)
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
      http-v1.2.0.wapp
      http/
        wippy.yaml
        src/
          _index.yaml
          ...
```

A extracao nunca descarta o pack. O `.wapp` canonico verificado permanece ao lado do diretorio extraido porque e a unica evidencia enderecada por conteudo do modulo, e a materializacao de artefatos e o reparo leem recursos de volta a partir dele. O `.wapp` e o que a instalacao verifica: um diretorio cujo pack esta ausente conta como nao instalado, e o modulo e baixado novamente. Cada instalacao extrai o diretorio de novo a partir do arquivo verificado, entao edicoes manuais em um diretorio vendorizado nao sobrevivem.

Modulos resolvidos a partir de uma [substituicao de workspace](#local-development-with-replacements) nunca sao baixados nem vendorizados; eles carregam a partir do caminho local.

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

As chaves sao `org/module`, os valores sao diretorios (caminhos relativos resolvem contra o diretorio do primeiro arquivo `--config`). Definir uma substituicao como `null` desativa uma herdada de uma camada de configuracao ou profile anterior. Substituicoes tambem podem viver dentro de um [profile](guides/configuration.md#profiles) para ativarem apenas com `--profile workspace`.

O caminho e obrigado a existir, e a ser um diretorio, apenas para um modulo que o grafo do lock realmente seleciona. Uma substituicao declarada para um modulo do qual nada depende e uma entrada de resolucao, nao uma entrada de boot: ela pode apontar para um diretorio que nao esta presente nesta maquina sem falhar a validacao.

Uma substituicao muda de onde vem o codigo-fonte de um modulo, nao qual release foi escolhido. O caminho de carga mantem a versao e o digest que o lock selecionou para aquele modulo e e marcado como uma substituicao; entradas carregadas dele sombreiam as vendorizadas com o mesmo ID. Quando uma substituicao e declarada para um modulo para o qual o lock nao fixa uma versao, a resolucao pede ao hub uma versao de release, e ate que uma evidencia mais forte selecione uma, ela mantem uma versao zero apenas local.

Substituicoes de workspace afetam o grafo de carga no boot e nunca sao gravadas no `wippy.lock`. Mudancas no codigo-fonte local sao reconciliadas diretamente, sem contatar o hub. Os globs `exclude:` do `wippy.yaml` do modulo aplicam-se tambem a diretorios de substituicao, tanto ao carregar entradas quanto ao calcular o hash do conteudo.

Uma secao `replacements:` no `wippy.lock` esta obsoleta: ela ainda carrega, mas imprime um aviso. Mova essas entradas para `workspace.replacements` em um arquivo de configuracao.

## Ordem de Carregamento

Na inicializacao, o Wippy carrega entradas dos diretorios nesta ordem:

1. Diretorio de codigo-fonte (`src`)
2. Diretorios de substituicao
3. Diretorios de modulos vendorizados

Modulos com substituicoes ativas ignoram seu caminho de vendor.

## Verificacao de Integridade

Todo modulo no arquivo de lock carrega um digest de artefato, e um modulo sem ele nao pode ser instalado de forma alguma.

Downloads sao preparados em etapas: o pack e escrito em um arquivo temporario ao lado de seu local final, verificado contra o digest fixado no `wippy.lock` e contra o digest que o hub serviu com a URL de download (mais o tamanho servido), e so entao renomeado para o lugar. Um arquivo preparado que falha na verificacao e apagado.

Uma divergencia de digest e uma falha dura e nao retentavel — `PermissionDenied`, "module integrity verification failed" — e e levantada da mesma forma no momento da instalacao e no boot, onde packs ja vendorizados sao reverificados antes de as entradas serem carregadas. Nada tenta de novo, rebaixa por cima da divergencia, nem recorre ao conteudo servido.

A mesma verificacao protege a resolucao. Quando o hub serve um manifesto cujo digest difere daquele fixado no lock, o cache de manifestos e atualizado uma vez e recomparado; se ainda divergir, a resolucao falha nomeando ambos os digests.

Diretorios extraidos carregam seu proprio digest, tamanho e digest de arvore registrados, e sao reverificados contra os valores registrados, entao uma arvore vendorizada modificada e detectada em vez de carregada.

Fontes de substituicao tambem sao enderecadas por conteudo. O runtime calcula o digest da arvore de substituicao e a rejeita quando o grafo resolvido ja fixa um digest ou tamanho diferente para aquele modulo, entao uma substituicao nao pode silenciosamente ocupar o lugar de um conteudo que nao corresponde.

## Artefatos de Build

Um modulo pode entregar um recurso de sistema de arquivos marcado com `meta.artifact.format` que os consumidores materializam em disco em vez de ler em tempo de execucao. `wippy install` e `wippy update` completos e direcionados, o cold boot e as operacoes de dependencia em tempo de execucao reconciliam essas saidas como parte da mesma transacao que altera o grafo de modulos; `artifact.materialization_root` define a raiz de saida. Veja [Artefatos de build](guides/artifacts.md).

## Veja Tambem

- [Artefatos de build](guides/artifacts.md) - Declarando, materializando e reconciliando recursos de artefato
- [Construindo Componentes](guides/components.md) - O lado do autor: `ns.requirement` e fornecimento de valores via `parameters`
- [CLI](guides/cli.md) - Referencia de comandos
- [Publicacao](guides/publishing.md) - Publicando modulos no hub
- [Estrutura do Projeto](start/structure.md) - Layout do projeto
