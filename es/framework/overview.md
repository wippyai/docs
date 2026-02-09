# Framework

Wippy proporciona modulos oficiales del framework a traves del hub. Estos modulos se mantienen bajo la organizacion `wippy` y pueden agregarse a cualquier proyecto.

## Agregar Modulos del Framework

```bash
wippy add wippy/test
wippy install
```

Esto agrega el modulo a tu archivo lock y lo descarga a `.wippy/vendor/`.

## Declarar Dependencias en el Codigo Fuente

Los modulos del framework tambien pueden declararse como dependencias en tu `_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dependency.test
    kind: ns.dependency
    component: wippy/test
    version: "^0.3.0"
```

Luego resuelve e instala:

```bash
wippy update
```

## Importar Bibliotecas del Framework

Una vez instaladas, importa las bibliotecas del framework en tus entradas:

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

El import mapea `wippy.test:test` (la entrada `test` del namespace `wippy.test`) al nombre local `test`, que luego usas con `require("test")` en Lua.

## Modulos Disponibles

| Module | Description |
|--------|-------------|
| `wippy/test` | Framework de testing estilo BDD con aserciones y mocking |
| `wippy/terminal` | Componentes de interfaz de terminal |

Hay mas modulos disponibles y se publican regularmente. Busca en el hub:

```bash
wippy search wippy
```

## Ver Tambien

- [Gestion de Dependencias](guides/dependency-management.md) - Archivo lock y restricciones de version
- [Publicacion](guides/publishing.md) - Publicar tus propios modulos
- [Referencia CLI](guides/cli.md) - Comandos CLI
