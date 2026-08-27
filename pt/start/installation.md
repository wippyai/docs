---
title: "Instalação"
description: "Instale o runtime do Wippy e verifique se o comando está disponível."
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

`wippy init` grava o lock de dependências e suas configurações de diretórios de código-fonte e módulos. Ele não cria arquivos de código-fonte da aplicação nem entradas de registro. Siga o tutorial [Hello World](../tutorials/hello-world.md) para criar uma aplicação executável e depois inicie-a com `wippy run`.

O runtime inclui recursos de HTTP, SQL, armazenamento e hospedagem de processos. Adicione módulos do framework pelo Hub quando a aplicação precisar deles:

```bash
wippy add wippy/test
wippy install
```

## Visão geral dos comandos

| Comando | Descrição |
| --------- | ------------- |
| `wippy init` | Criar ou atualizar `wippy.lock` |
| `wippy run` | Iniciar o runtime |
| `wippy test` | Executar o entrypoint de teste |
| `wippy lint` | Verificar erros no código |
| `wippy add` | Adicionar uma dependência |
| `wippy install` | Instalar dependências |
| `wippy update` | Atualizar dependências |
| `wippy pack` | Criar um snapshot |
| `wippy publish` | Publicar no Hub |
| `wippy search` | Pesquisar módulos |
| `wippy readme` | Buscar o README de um módulo no Hub |
| `wippy registry` | Inspecionar as entradas de registro carregadas |
| `wippy auth` | Gerenciar autenticação |
| `wippy version` | Exibir informações da versão |

Consulte a [Referência da CLI](../guides/cli.md) para obter a documentação completa.

## Solução de problemas

Se o shell não encontrar `wippy` após a instalação, reabra-o e confirme que o diretório de instalação está no `PATH`.

## Próximos passos

- [Hello World](../tutorials/hello-world.md) — Crie sua primeira aplicação
- [Estrutura do projeto](./structure.md) — Entenda o layout do projeto
- [Referência da CLI](../guides/cli.md) — Consulte todos os comandos e opções
