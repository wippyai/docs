---
title: "Framework"
description: "Instale, declare e importe módulos oficiais do framework Wippy publicados pelo Hub."
---

# Framework

Os módulos oficiais do framework são publicados no Wippy Hub pela organização `wippy`.

Esta página é uma referência de gerenciamento de módulos para um projeto Wippy existente. Os comandos podem ser executados na raiz do projeto; os blocos YAML e de importação são exemplos de referência independentes, e não uma aplicação completa.

## Adicionando módulos do framework

```bash
wippy add wippy/test
wippy install
```

Isso adiciona o módulo ao arquivo de lock e o baixa para `.wippy/vendor/`.

## Declarando dependências no código-fonte

Os módulos do framework também podem ser declarados como dependências no `_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dependency.test
    kind: ns.dependency
    component: wippy/test
    version: "*"
```

Depois, resolva e instale as dependências:

```bash
wippy update
```

## Importando bibliotecas do framework

Depois da instalação, importe as bibliotecas do framework nas suas entradas:

```yaml
entries:
  - name: my_test
    kind: function.lua
    meta:
      type: test
      suite: my-suite
    source: file://my_test.lua
    method: run
    imports:
      test: wippy.test:test
```

Essa importação mapeia `wippy.test:test` (a entrada `test` do namespace `wippy.test`) para o nome local `test`, que pode então ser carregado com `require("test")` no Lua.

## Módulos disponíveis

| Módulo | Descrição |
|--------|-------------|
| `wippy/llm` | Interface unificada para LLMs com geração, streaming, chamadas de ferramentas e saída estruturada |
| `wippy/agent` | Framework de agentes com ferramentas, delegados, traits e memória |
| `wippy/embeddings` | Armazenamento de embeddings vetoriais e busca por similaridade |
| `wippy/test` | Framework de testes em estilo BDD com asserções e mocks |
| `wippy/dataflow` | Orquestração de workflows com execução de nós baseada em DAG |
| `wippy/relay` | Relay WebSocket com hubs por usuário e roteamento de plugins |
| `wippy/views` | Sistema virtual de páginas e componentes com renderização de templates |
| `wippy/facade` | Configuração do host de frontend, temas e endpoint de configuração |
| `wippy/terminal` | Componentes de interface para terminal |
| `wippy/migration` | Migrações de esquema de banco de dados |
| `wippy/security` | Escopos de atores, pacotes de políticas e utilitários de segurança |
| `wippy/usage` | Contabilização de tokens e custos de chamadas a LLMs |

Pesquise no Hub para consultar o catálogo atual de módulos:

```bash
wippy search wippy
```

## Consulte também

- [Gerenciamento de dependências](../guides/dependency-management.md) — Arquivos de lock e restrições de versão
- [Publicação](../guides/publishing.md) — Como publicar um módulo
- [Referência da CLI](../guides/cli.md) — Comandos de gerenciamento de módulos
