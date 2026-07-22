---
title: "Instalação"
description: "Instalação Rápida"
---

# Instalação

## Instalação Rápida

```bash
curl -fsSL https://hub.wippy.ai/install.sh | bash
```

Ou baixe diretamente de [hub.wippy.ai/releases](https://hub.wippy.ai/releases).

## Verificar

```bash
wippy version
```

## Início Rápido

```bash
# Criar um novo projeto
mkdir myapp && cd myapp
wippy init

# Executar
wippy run
```

HTTP, SQL, storage e hospedagem de processos são nativos do runtime — um projeto novo executa sem nenhuma dependência. Módulos do framework são adicionados do hub conforme necessário:

```bash
wippy add wippy/test
wippy install
```

## Visão Geral dos Comandos

| Comando | Descrição |
|---------|-----------|
| `wippy init` | Inicializa um novo projeto |
| `wippy run` | Inicia o runtime |
| `wippy test` | Executa o entrypoint de teste |
| `wippy lint` | Verifica o código em busca de erros |
| `wippy add` | Adiciona uma dependência |
| `wippy install` | Instala dependências |
| `wippy update` | Atualiza dependências |
| `wippy pack` | Cria um snapshot |
| `wippy publish` | Publica no hub |
| `wippy search` | Busca por módulos |
| `wippy auth` | Gerencia autenticação |
| `wippy version` | Exibe informações de versão |

Consulte a [Referência do CLI](guides/cli.md) para documentação completa.

## Próximos Passos

- [Hello World](tutorials/hello-world.md) - Crie seu primeiro projeto
- [Estrutura do Projeto](start/structure.md) - Entenda o layout
- [Referência do CLI](guides/cli.md) - Todos os comandos e opções
