---
title: "Framework"
description: "O Wippy fornece módulos oficiais de framework através do hub. Esses módulos são mantidos sob a organização wippy e podem ser adicionados a qualquer projeto."
---

# Framework

O Wippy fornece módulos oficiais de framework através do hub. Esses módulos são mantidos sob a organização `wippy` e podem ser adicionados a qualquer projeto.

## Adicionando Módulos do Framework

```bash
wippy add wippy/test
wippy install
```

Isso adiciona o módulo ao seu lock file e o baixa para `.wippy/vendor/`.

## Declarando Dependências no Código-Fonte

Módulos do framework também podem ser declarados como dependências no seu `_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dependency.test
    kind: ns.dependency
    component: wippy/test
    version: "^0.3.0"
```

Depois resolva e instale:

```bash
wippy update
```

## Importando Bibliotecas do Framework

Uma vez instalados, importe as bibliotecas do framework nas suas entradas:

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

O import mapeia `wippy.test:test` (a entrada `test` do namespace `wippy.test`) para o nome local `test`, que você então usa com `require("test")` em Lua.

## Módulos Disponíveis

| Módulo | Descrição |
|--------|-------------|
| `wippy/llm` | Interface unificada de LLM com geração, streaming, chamada de ferramentas e saída estruturada |
| `wippy/agent` | Framework de agentes com ferramentas, delegates, traits e memória |
| `wippy/embeddings` | Armazenamento de embeddings vetoriais e busca por similaridade |
| `wippy/test` | Framework de testes no estilo BDD com asserções e mocking |
| `wippy/dataflow` | Orquestração de workflows com execução de nós baseada em DAG |
| `wippy/relay` | Relay WebSocket com hubs por usuário e roteamento de plugins |
| `wippy/views` | Sistema virtual de páginas/componentes com renderização de templates |
| `wippy/facade` | Configuração de host de frontend, tematização e endpoint de config |
| `wippy/terminal` | Componentes de UI de terminal |
| `wippy/migration` | Migrações de schema de banco de dados |
| `wippy/security` | Escopos de ator, bundles de policy e helpers de segurança |
| `wippy/usage` | Contabilização de tokens e custos para chamadas de LLM |

Mais módulos estão disponíveis e são publicados regularmente. Pesquise no hub:

```bash
wippy search wippy
```

## Veja Também

- [Dependency Management](guides/dependency-management.md) - Lock file e restrições de versão
- [Publishing](guides/publishing.md) - Publicando seus próprios módulos
- [CLI Reference](guides/cli.md) - Comandos da CLI
