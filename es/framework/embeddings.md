---
title: "Embeddings"
description: "Genera, almacena y busca embeddings vectoriales con PostgreSQL pgvector o SQLite sqlite-vec."
---

# Embeddings

El módulo `wippy/embeddings` genera embeddings mediante `wippy/llm`, los almacena en una base de datos de la aplicación y realiza búsquedas vectoriales por similitud. Admite PostgreSQL con pgvector y SQLite con sqlite-vec.

Esta página es una introducción a la API con fragmentos de referencia, no un tutorial independiente. Los fragmentos suponen un proyecto Wippy existente, una base de datos configurada y el modelo de embeddings, provider y credenciales descritos a continuación. Las llamadas remotas de embeddings pueden generar cargos del provider. Para una aplicación completa que indexa y busca contenido, siga [Construir un pipeline RAG](../tutorials/rag.md).

## Configuracion

Agrega el modulo a tu proyecto:

```bash
wippy add wippy/embeddings
wippy install
```

### Modelo y provider requeridos

Antes de llamar a la API de embeddings, registre un `llm.model` cuyo `meta.name` sea `text-embedding-3-small`, cuyas capacidades incluyan `embed` y cuyo mapping de provider resuelva a un provider de embeddings. Configure las credenciales del provider, como `OPENAI_API_KEY`, mediante el almacenamiento de entorno usado por `wippy/llm`. Consulte la [configuración de modelos LLM](./llm.md#model-configuration).

### Dependencia de base de datos

Declare la dependencia y establezca su parámetro `target_db` en la base de datos de la aplicación:

```yaml
version: "1.0"
namespace: app

entries:
  - name: app_db
    kind: db.sql.sqlite
    file: ./data/app.db

  - name: dep.embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"
    parameters:
      - name: target_db
        value: app:app_db
```

Al iniciar, `wippy/migration` toma la migración `01_create_embeddings_table` y crea la tabla `embeddings_512` para el driver de base de datos configurado.

Si usa la ruta relativa de SQLite mostrada arriba, cree el directorio `data` antes de iniciar la aplicación.

## Constantes fijas actuales

El módulo define actualmente estas constantes privadas; no son parámetros de la dependencia:

| Constante | Valor por defecto | Descripcion |
|-----------|-------------------|-------------|
| `EMBEDDING_MODEL` | `text-embedding-3-small` | Modelo LLM usado para generar vectores |
| `EMBEDDING_DIMENSIONS` | `512` | Tamano del vector pasado al modelo |
| `MAX_TOKENS_PER_REQUEST` | `8000` | Presupuesto de tokens por llamada; los lotes grandes se dividen |
| `DEFAULT_SEARCH_LIMIT` | `10` | Numero por defecto de resultados retornados por `search` |

Los tokens se estiman como `ceil(#text / 4)`. Los lotes demasiado grandes se dividen entre elementos. Un elemento individual mayor que el presupuesto no se divide y hace que ese sublote falle antes de la llamada LLM.

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
| `content_type` | string | si | Etiqueta como `"document_chunk"` o `"question"`; PostgreSQL la limita a 32 caracteres |
| `origin_id` | string | si | Identificador del documento o registro de origen; debe ser un UUID cuando `target_db` es PostgreSQL |
| `context_id` | string | no | Clave de ambito adicional (seccion, chat, tenant) |
| `meta` | table | no | Metadatos arbitrarios serializables a JSON |

Retorna `{ entry_id, origin_id, content_type, context_id }` o `nil, err`.

<warning>
En la baseline fijada del framework, el helper de un solo elemento pasa al repositorio el resultado anidado de `llm.embed()` en lugar de su primer vector, por lo que `embeddings.add()` no puede persistir correctamente. Use `embeddings.add_batch()` con un elemento, o llame a `llm.embed()` y pase `response.result[1]` a `embedding_repo.add()`, hasta que se corrija la implementación del framework.
</warning>

### add_batch

El ejemplo siguiente usa ID de aplicación compatibles con SQLite. Para PostgreSQL, sustituya `doc-1` por un UUID porque el esquema PostgreSQL almacena `origin_id` como `UUID`.

```lua
local result, err = embeddings.add_batch({
    { content = "...", content_type = "chunk", origin_id = "doc-1" },
    { content = "...", content_type = "chunk", origin_id = "doc-1", context_id = "s1" },
})
```

Genera y almacena embeddings para varios elementos en una sola llamada. Si el recuento total estimado de tokens supera `MAX_TOKENS_PER_REQUEST`, el método divide el lote en fragmentos. Cada fragmento del repositorio es transaccional, pero un lote de alto nivel dividido no es atómico entre fragmentos: los anteriores permanecen almacenados si falla uno posterior. Retorna `{ count, items = { ... } }`.

Para eliminar registros creados durante las pruebas, use el método `delete_by_origin(origin_id)` de la API del repositorio para cada origen de ejemplo.

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

`origin_id` puede ser un string o un array no vacío de strings. Cada resultado contiene `entry_id`, `origin_id`, `content_type`, `context_id`, `content`, `meta` decodificado, timestamps y `similarity`.

### find_by_type

```lua
local hits, err = embeddings.find_by_type(
    "how do migrations work?",
    "document_chunk",
    { limit = 10 }
)
```

Llama a `search` con un único `content_type`. El límite predeterminado es `10`.

### find_by_origin

```lua
local hits, err = embeddings.find_by_origin("how do migrations work?", "doc-1", {
    content_type = "document_chunk",
    context_id   = "section-2",
    limit        = 5,
})
```

Llama a `search` con un único `origin_id` y filtros opcionales de `content_type` y `context_id`. El límite predeterminado es `5`.

## API del Repositorio (`wippy.embeddings:embedding_repo`)

Use el repositorio directamente cuando ya tenga un vector y quiera omitir la generación del embedding. Los embeddings raw deben contener exactamente 512 valores numéricos:

| Funcion | Descripcion |
|---------|-------------|
| `embedding_repo.add(content, content_type, origin_id, context_id, meta, embedding)` | Insertar un vector precomputado |
| `embedding_repo.add_batch(batch)` | Insertar muchos vectores precomputados en una sola transacción |
| `embedding_repo.get_by_origin(origin_id)` | Listar todos los registros para un origen dado |
| `embedding_repo.delete_by_origin(origin_id)` | Eliminar todos los registros para un origen dado |
| `embedding_repo.delete_by_entry(entry_id)` | Eliminar un solo registro por su id de fila |
| `embedding_repo.search_by_embedding(vector, options)` | Busqueda por similitud contra un vector crudo |

`search_by_embedding` acepta `{ content_type, origin_id, context_id, limit }`.

## Soporte de Bases de Datos

La migracion crea el esquema apropiado para el driver de base de datos en `target_db`:

- **PostgreSQL** — Tabla `embeddings_512` con una columna `vector(512)` y un índice IVFFlat de coseno. La migración intenta instalar la extensión `vector`, por lo que el role de base de datos debe poder crearla o la extensión debe existir ya. PostgreSQL almacena `origin_id` como `UUID`.
- **SQLite** — Tabla virtual `vec0` `embeddings_512` con la columna vectorial `embedding float[512]` junto a las columnas de metadatos y contenido para búsqueda KNN.

## Ver Tambien

- [LLM](./llm.md) — `llm.embed(...)` para generación raw de embeddings
- [Migraciones](./migration.md) — Runner de migraciones que provisiona la tabla
- [Visión general del framework](./overview.md) — Uso de módulos del framework
