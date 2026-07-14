---
title: "Dataflow: Base de Conocimiento Local"
description: "Construye una base de conocimiento en tu propia máquina — crea el vector store, luego divide en chunks e ingiere documentos en él. Este es el…"
---

# Dataflow: Base de Conocimiento Local

Construye una base de conocimiento en tu propia máquina — crea el vector store, luego divide en chunks e
ingiere documentos en él. Este es el complemento de creación de datos del
[tutorial RAG](tutorials/rag.md): aquí levantas y llenas una KB local; allí
recuperas de ella y generas respuestas. Ambos usan el módulo `wippy/embeddings` respaldado por
un vector store SQLite local.

## Lo que construirás

1. Una app local cuya base de datos contiene un vector store de 512 dimensiones.
2. La migración que crea la tabla `embeddings_512` al arrancar.
3. Una función de ingesta que divide markdown en chunks y escribe los embeddings en el store.

## Requisitos previos

- Un proyecto Wippy (clona [app-template](https://github.com/wippyai/app-template), o
  `wippy init`).
- Un proveedor LLM con un modelo de embeddings configurado (por ejemplo, `text-embedding-3-small`) —
  consulta [Framework LLM](framework/llm.md). El vector store se crea localmente sin él,
  pero la ingesta (que llama a `llm.embed`) necesita un proveedor configurado.

Instala las dependencias:

```bash
wippy add wippy/embeddings
wippy add wippy/migration
wippy add wippy/bootloader
wippy add wippy/llm
wippy install
```

## Crear el store

La KB vive en una base de datos SQLite local. `wippy/embeddings` incluye una migración que
crea la tabla vectorial; el bootloader la ejecuta al arrancar. Conecta las piezas:

```yaml
version: "1.0"
namespace: app

entries:
  - name: db
    kind: db.sql.sqlite
    file: ./data/app.db
    lifecycle:
      auto_start: true

  - name: processes
    kind: process.host
    host:
      max_processes: 1000
      workers: 8

  - name: embeddings
    kind: ns.dependency
    component: wippy/embeddings
    parameters:
      - name: target_db
        value: app:db

  - name: migration
    kind: ns.dependency
    component: wippy/migration
    parameters:
      - name: app_db
        value: app:db

  - name: bootloader
    kind: ns.dependency
    component: wippy/bootloader
    parameters:
      - name: application_host
        value: app:processes
      - name: app_db
        value: app:db
      - name: env_storage
        value: app.env:store
```

El bootloader necesita un store de entorno; añade el estándar en su propio namespace:

```yaml
# src/env/_index.yaml
version: "1.0"
namespace: app.env

entries:
  - name: file
    kind: env.storage.file
    auto_create: true
    file_path: .env
    lifecycle:
      auto_start: true

  - name: os
    kind: env.storage.os
    lifecycle:
      auto_start: true

  - name: store
    kind: env.storage.router
    lifecycle:
      auto_start: true
    storages:
      - app.env:file
      - app.env:os
```

Crea el directorio de datos e inicia la app:

```bash
mkdir -p data
wippy run
```

Al arrancar, la migración se ejecuta y el store aparece en `data/app.db`:

```
$ sqlite3 data/app.db ".tables"
_migrations            embeddings_512         embeddings_512_chunks
embeddings_512_info    embeddings_512_rowids  embeddings_512_vector_chunks00
...
```

`embeddings_512` es una tabla virtual `vec0` de SQLite; las tablas sombra `embeddings_512_*`
contienen sus chunks, row ids y metadatos. (En PostgreSQL la misma migración usa
`pgvector` en su lugar.)

## Ingerir documentos

La ingesta consta de dos pasos: dividir el texto en chunks con el módulo `text`, luego escribirlos
con `embeddings.add_batch`, que embebe y persiste cada chunk.

```lua
-- src/ingest.lua
local text = require("text")
local embeddings = require("embeddings")

local function ingest(doc_id, title, markdown)
    local splitter, err = text.splitter.markdown({
        chunk_size = 800,
        chunk_overlap = 100,
        heading_hierarchy = true,
        code_blocks = true,
    })
    if err then return nil, err end

    local chunks, split_err = splitter:split_text(markdown)
    if split_err then return nil, split_err end

    local batch = {}
    for i, chunk in ipairs(chunks) do
        table.insert(batch, {
            content = chunk,
            content_type = "doc_chunk",
            origin_id = doc_id,
            context_id = tostring(i),
            meta = { title = title, chunk = i },
        })
    end

    return embeddings.add_batch(batch)
end

return { ingest = ingest }
```

Registra la función:

```yaml
- name: ingest
  kind: function.lua
  source: file://ingest.lua
  method: ingest
  modules:
    - text
  imports:
    embeddings: wippy.embeddings:embeddings
```

Puntos clave:

- `origin_id` agrupa todos los chunks de un documento fuente — elimina y reingiere por
  documento con `embedding_repo.delete_by_origin(doc_id)`.
- `content_type` te permite mantener corpus distintos (`doc_chunk`, `faq`, `code_snippet`) en
  un solo store y filtrar en tiempo de consulta.
- `add_batch` divide automáticamente cuando el batch supera el límite de 8000 tokens por solicitud.

## Verificar el contenido

Una vez ingeridos los documentos, confirma que las filas se guardaron y ejecuta una búsqueda por similitud:

```lua
local embeddings = require("embeddings")

local results, err = embeddings.search("how do I configure TLS?", {
    content_type = "doc_chunk",
    limit = 5,
})
-- results[i].content, .similarity, .meta, .origin_id, .context_id
```

A partir de ahí, el [tutorial RAG](tutorials/rag.md) muestra cómo alimentar estos resultados a un
LLM para obtener respuestas fundamentadas.

## Notas operativas

- **Tamaño de chunk**: 500–1000 tokens es un buen valor por defecto. Usa `chunk_overlap` (~10–20 % del
  tamaño del chunk) para que las frases no se corten a través de los límites.
- **Dimensiones**: `text-embedding-3-small` a 512 dimensiones es rentable y
  coincide con la tabla `embeddings_512`. Vectores más grandes significan mayor almacenamiento y búsqueda
  más lenta.
- **Local vs. compartido**: SQLite (`vec0`) mantiene toda la KB en un solo archivo local — ideal para
  desarrollo y apps de un solo nodo. Apunta `target_db` a un `db.sql.postgres` con
  `pgvector` para un store compartido y de producción; el código de ingesta no cambia.

## Siguientes Pasos

- [RAG](tutorials/rag.md) — recupera de este store y genera respuestas fundamentadas
- [Framework LLM](framework/llm.md) — `llm.embed`, modelos de embeddings, proveedores
- [Módulo Text](lua/text/text.md) — splitters y tokenización
