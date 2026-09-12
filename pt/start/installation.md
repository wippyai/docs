---
title: "Instalação"
description: "Instale o runtime Wippy"
---

# Instalação

## Instalar

```bash
curl -fsSL https://hub.wippy.ai/install.sh | bash
```

O script de instalação requer um shell POSIX. No Windows, baixe o runtime em [hub.wippy.ai/releases](https://hub.wippy.ai/releases), coloque `wippy.exe` no `PATH`.

## Verificar

```bash
wippy version
```

## Inicializar os metadados de dependências

```bash
# Create a project directory
mkdir myapp
cd myapp

# Create or update wippy.lock
wippy init
```

`wippy init` grava o lock de dependências e suas configurações de diretórios de código-fonte e módulos. Ele não cria arquivos de código-fonte da aplicação nem entradas de registro. Siga o tutorial [Hello World](tutorials/hello-world.md) para criar uma aplicação executável e depois inicie-a com `wippy run`.

O runtime inclui recursos de HTTP, SQL, armazenamento e hospedagem de processos. Adicione módulos do framework pelo Hub quando a aplicação precisar deles:

```bash
wippy add wippy/test
wippy install
```

## Visão geral dos comandos

| Comando | Descrição |
|---------|-----------|
| `wippy init` | Inicializa um novo projeto |
| `wippy run` | Inicia o runtime |
| `wippy test` | Executa o entrypoint de teste |
| `wippy lint` | Verifica o código em busca de erros |
| `wippy add` | Adiciona uma dependência |
| `wippy install` | Instala dependências |
| `wippy update` | Atualiza dependências |
| `wippy artifacts` | Materializa artefatos de sistema de arquivos em tempo de build |
| `wippy pack` | Cria um snapshot |
| `wippy publish` | Publica no hub |
| `wippy search` | Busca por módulos |
| `wippy readme` | Busca o README de um módulo no hub |
| `wippy registry` | Inspeciona entradas do registro carregadas |
| `wippy auth` | Gerencia autenticação |
| `wippy version` | Exibe informações de versão |

Consulte a [Referência da CLI](guides/cli.md) para obter a documentação completa.

## Solução de Problemas

Se `wippy version` não for encontrado após a instalação, reabra seu shell ou verifique se o diretório de instalação está no seu `PATH`.

## Próximos Passos

Se o shell não encontrar `wippy` após a instalação, reabra-o e confirme que o diretório de instalação está no `PATH`.

## Próximos passos

- [Hello World](../tutorials/hello-world.md) — Crie sua primeira aplicação
- [Estrutura do projeto](start/structure.md) — Entenda o layout do projeto
- [Referência da CLI](guides/cli.md) — Consulte todos os comandos e opções
