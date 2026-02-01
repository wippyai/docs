# Instalacao

## Instalacao Rapida

```bash
curl -fsSL https://hub.wippy.ai/install.sh | bash
```

Ou baixe diretamente de [hub.wippy.ai/releases](https://hub.wippy.ai/releases).

## Verificar

```bash
wippy version
```

## Inicio Rapido

```bash
# Criar um novo projeto
mkdir myapp && cd myapp
wippy init

# Adicionar dependencias
wippy add wippy/http
wippy install

# Executar
wippy run
```

## Visao Geral dos Comandos

| Comando | Descricao |
|---------|-----------|
| `wippy init` | Inicializa um novo projeto |
| `wippy run` | Inicia o runtime |
| `wippy lint` | Verifica o codigo em busca de erros |
| `wippy add` | Adiciona uma dependencia |
| `wippy install` | Instala dependencias |
| `wippy update` | Atualiza dependencias |
| `wippy pack` | Cria um snapshot |
| `wippy publish` | Publica no hub |
| `wippy search` | Busca por modulos |
| `wippy auth` | Gerencia autenticacao |
| `wippy version` | Exibe informacoes de versao |

Consulte a [Referencia do CLI](guides/cli.md) para documentacao completa.

## Proximos Passos

- [Hello World](tutorials/hello-world.md) - Crie seu primeiro projeto
- [Estrutura do Projeto](start/structure.md) - Entenda o layout
- [Referencia do CLI](guides/cli.md) - Todos os comandos e opcoes
