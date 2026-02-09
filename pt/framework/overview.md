# Framework

O Wippy fornece modulos oficiais de framework atraves do hub. Esses modulos sao mantidos sob a organizacao `wippy` e podem ser adicionados a qualquer projeto.

## Adicionando Modulos do Framework

```bash
wippy add wippy/test
wippy install
```

Isso adiciona o modulo ao seu lock file e o baixa para `.wippy/vendor/`.

## Declarando Dependencias no Codigo

Modulos do framework tambem podem ser declarados como dependencias no seu `_index.yaml`:

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

Uma vez instalado, importe bibliotecas do framework nas suas entradas:

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

O import mapeia `wippy.test:test` (a entrada `test` do namespace `wippy.test`) para o nome local `test`, que voce entao usa com `require("test")` em Lua.

## Modulos Disponiveis

| Modulo | Descricao |
|--------|-----------|
| `wippy/test` | Framework de testes estilo BDD com assercoes e mocking |
| `wippy/terminal` | Componentes de UI para terminal |

Mais modulos estao disponiveis e sendo publicados regularmente. Pesquise no hub:

```bash
wippy search wippy
```

## Veja Tambem

- [Gerenciamento de Dependencias](guides/dependency-management.md) - Lock file e restricoes de versao
- [Publicacao](guides/publishing.md) - Publicando seus proprios modulos
- [Referencia CLI](guides/cli.md) - Comandos CLI
