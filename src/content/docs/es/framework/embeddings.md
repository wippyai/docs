---
title: "Embeddings"
description: "El modulo wippy/embeddings proporciona almacenamiento de embeddings vectoriales y busqueda por similitud tanto para PostgreSQL (pgvector) como para…"
---

# Embeddings

El modulo `wippy/embeddings` proporciona almacenamiento de embeddings vectoriales y busqueda por similitud tanto para PostgreSQL (pgvector) como para SQLite (sqlite-vec). Envuelve `wippy/llm` para generar embeddings y los persiste en una base de datos de la aplicacion.

## Configuracion

Agrega el modulo a tu proyecto:

```bash
wippy add wippy/embeddings
wippy install
```

Declara la dependencia y apunta el requisito `target_db` a tu base de datos de aplicacion:

```yaml
version: "1.0"
namespace: app

entries:
  - name: app_db
    kind: db.sql.sqlite
    path: ./data/app.db

  - name: dep.embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"

  - name: target_db
    kind: registry.entry
    meta:
      wippy.embeddings.target_db: app:app_db
```

Al iniciar, `wippy/migration` toma la migracion `01_create_embeddings_table` y crea la tabla `embeddings` con el indice vectorial apropiado para tu driver de base de datos.

## Constantes de Configuracion

La configuracion por defecto esta incrustada en el modulo:

| Constante | Valor por defecto | Descripcion |
|-----------|-------------------|-------------|
| `EMBEDDING_MODEL` | `text-embedding-3-small` | Modelo LLM usado para generar vectores |
| `EMBEDDING_DIMENSIONS` | `512` | Tamano del vector pasado al modelo |
| `MAX_TOKENS_PER_REQUEST` | `8000` | Presupuesto de tokens por llamada; los lotes grandes se dividen |
| `DEFAULT_SEARCH_LIMIT` | `10` | Numero por defecto de resultados retornados por `search` |

Los tokens se estiman como `#text / 4`. Los lotes que exceden el presupuesto se dividen automaticamente.

## Importacion

```yaml
entries:
  - name: my_app
    kind: library.lua
    source: file://my_app.lua
    imports:
      embeddings: wippy.embeddings:embeddings
```

```lua
local embeddings = require("embeddings")
```

## API de Alto Nivel (`wippy.embeddings:embeddings`)

### add

```lua
local result, err = embeddings.add(content, content_type, origin_id, context_id, meta)
```

Genera un embedding para `content` y lo persiste.

| Parametro | Tipo | Requerido | Descripcion |
|-----------|------|-----------|-------------|
| `content` | string | si | Texto a incrustar |
| `content_type` | string | si | Etiqueta libre, por ejemplo `"document_chunk"`, `"question"` |
| `origin_id` | string | si | Identificador del documento o registro de origen |
| `context_id` | string | no | Clave de ambito adicional (seccion, chat, tenant) |
| `meta` | table | no | Metadatos arbitrarios serializables a JSON |

Retorna `{ id, content, content_type, origin_id, context_id, meta }` o `nil, err`.

### add_batch

```lua
local result, err = embeddings.add_batch({
    { content = "...", content_type = "chunk", origin_id = "doc-1" },
    { content = "...", content_type = "chunk", origin_id = "doc-1", context_id = "s1" },
})
```

Incrusta y almacena muchos elementos en una sola llamada. Si el recuento total estimado de tokens excede `MAX_TOKENS_PER_REQUEST`, el lote se divide y se procesa en fragmentos. Retorna `{ count, items = { ... } }`.

### search

```lua
local hits, err = embeddings.search("how do migrations work?", {
    content_type = "document_chunk",
    origin_id    = "doc-1",
    context_id   = "section-2",
    limit        = 10,
})
```

Incrusta la cadena de consulta y realiza una busqueda por similitud contra los vectores almacenados. Todos los filtros son opcionales; los registros coincidentes se ordenan por similitud.

### find_by_type

```lua
local hits, err = embeddings.find_by_type(query, content_type, { limit = 10 })
```

Envoltorio de conveniencia para `search` limitado a un solo `content_type`.

### find_by_origin

```lua
local hits, err = embeddings.find_by_origin(query, origin_id, {
    content_type = "document_chunk",
    context_id   = "section-2",
    limit        = 5,
})
```

Envoltorio de conveniencia limitado a un solo `origin_id`, opcionalmente acotado aun mas.

## API del Repositorio (`wippy.embeddings:embedding_repo`)

Usa el repositorio directamente cuando ya tengas un vector y quieras omitir la generacion del embedding:

| Funcion | Descripcion |
|---------|-------------|
| `embedding_repo.add(content, content_type, origin_id, context_id, meta, embedding)` | Insertar un vector precomputado |
| `embedding_repo.add_batch(batch)` | Insertar muchos vectores precomputados en una sola sentencia |
| `embedding_repo.get_by_origin(origin_id)` | Listar todos los registros para un origen dado |
| `embedding_repo.delete_by_origin(origin_id)` | Eliminar todos los registros para un origen dado |
| `embedding_repo.delete_by_entry(entry_id)` | Eliminar un solo registro por su id de fila |
| `embedding_repo.search_by_embedding(vector, options)` | Busqueda por similitud contra un vector crudo |

`search_by_embedding` acepta `{ content_type, origin_id, context_id, limit }`.

## Soporte de Bases de Datos

La migracion crea el esquema apropiado para el driver de base de datos en `target_db`:

- **PostgreSQL** - Tabla `embeddings` con una columna `vector(512)` y un indice IVFFlat. Requiere la extension `pgvector`.
- **SQLite** - Tabla `embeddings` con el vector almacenado como texto mas una tabla virtual `sqlite-vec` companera para busqueda KNN.

Los vectores siempre se transportan como un array JSON plano en la capa de API.

## Ver Tambien

- [LLM](framework/llm.md) - `llm.embed(...)` para generacion de embeddings cruda
- [Migraciones](framework/migration.md) - Runner de migraciones que provisiona la tabla
- [Vision General del Framework](framework/overview.md) - Uso de modulos del framework
