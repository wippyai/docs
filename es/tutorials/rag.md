---
title: "Generación Aumentada por Recuperación (RAG)"
description: "Construye una base de conocimiento que responda preguntas a partir de tus propios documentos. Este tutorial utiliza el módulo wippy/embeddings para…"
---

# Generación Aumentada por Recuperación (RAG)

Construye una base de conocimiento que responda preguntas a partir de tus propios documentos. Este tutorial utiliza el módulo `wippy/embeddings` para búsqueda vectorial y el framework LLM para generación.

## Lo que construirás

Una tubería RAG mínima:

1. Ingerir documentos markdown — dividir en chunks, embeber, persistir.
2. Recuperar — la búsqueda vectorial devuelve los chunks más relevantes para una consulta.
3. Generar — una llamada a LLM usa los chunks recuperados como contexto de grounding.

## Requisitos previos

- Una base de datos: `db.sql.sqlite` (incluye soporte `vec0`) o `db.sql.postgres` con la extensión `pgvector`.
- `OPENAI_API_KEY` en el entorno — las llamadas de embedding y de generación pasan por ella.

Crea el proyecto e instala los módulos:

```bash
mkdir rag && cd rag
mkdir -p src/app data
wippy init
wippy add wippy/embeddings
wippy add wippy/migration
wippy add wippy/bootloader
wippy add wippy/security
wippy install
```

```
rag/
├── wippy.lock
├── data/
└── src/
    ├── _index.yaml
    ├── env/
    │   └── _index.yaml
    └── app/
        ├── ingest.lua
        ├── answer.lua
        ├── answer_http.lua
        └── seed.lua
```

## Dependencias

Declara la dependencia `wippy/embeddings` y apúntala a tu base de datos. El parámetro `target_db` es el Registry ID de la entrada de base de datos en la que vivirá la tabla de embeddings. `wippy/embeddings` incorpora `wippy/llm` y la migración que crea la tabla `embeddings_512`, así que `wippy/migration` y `wippy/bootloader` también necesitan cableado — el bootloader ejecuta la migración al arrancar, y tanto él como el módulo LLM ejecutan procesos bajo el grupo de políticas `wippy.security:process` que provee `wippy/security`:

```yaml
# src/_index.yaml
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
    lifecycle:
      auto_start: true

  - name: embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"
    parameters:
      - name: target_db
        value: app:db

  - name: migration
    kind: ns.dependency
    component: wippy/migration
    version: "*"
    parameters:
      - name: app_db
        value: app:db

  - name: bootloader
    kind: ns.dependency
    component: wippy/bootloader
    version: "*"
    parameters:
      - name: application_host
        value: app:processes
      - name: env_storage
        value: app.env:store

  - name: security
    kind: ns.dependency
    component: wippy/security
    version: "*"
```

El bootloader persiste una `ENCRYPTION_KEY` generada, por lo que necesita un almacén de entorno escribible:

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

## Modelos

`wippy/embeddings` llama a `llm.embed` con `text-embedding-3-small`, y la generación de más abajo usa `gpt-4o-mini`. Ambos se resuelven desde el registro, así que decláralos también en `src/_index.yaml`:

```yaml
  - name: text-embedding-3-small
    kind: registry.entry
    meta:
      name: text-embedding-3-small
      type: llm.model
      title: Text Embedding 3 Small
      capabilities:
        - embed
    dimensions: 512
    max_tokens: 8191
    pricing:
      input: 0.02
      output: 0
    providers:
      - id: wippy.llm.openai:provider
        provider_model: text-embedding-3-small

  - name: gpt-4o-mini
    kind: registry.entry
    meta:
      name: gpt-4o-mini
      type: llm.model
      title: GPT-4o mini
      capabilities:
        - generate
    max_tokens: 128000
    output_tokens: 16384
    pricing:
      input: 0.15
      output: 0.6
    providers:
      - id: wippy.llm.openai:provider
        provider_model: gpt-4o-mini
```

El proveedor de OpenAI lee `OPENAI_API_KEY` del entorno del sistema operativo por defecto. Consulta [Framework LLM](framework/llm.md) para otros proveedores y campos de modelo.

## Ingerir documentos

La división es manejada por el módulo `text`; el embedding y la persistencia por la biblioteca `embeddings`.

```lua
-- src/app/ingest.lua
local text = require("text")
local embeddings = require("embeddings")

local function ingest(doc_id: string, title: string, markdown: string)
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

Registra la función y sus importaciones:

```yaml
- name: ingest
  kind: function.lua
  source: file://app/ingest.lua
  method: ingest
  modules:
    - text
  imports:
    embeddings: wippy.embeddings:embeddings
```

Puntos clave:

- `origin_id` agrupa los chunks que pertenecen al mismo documento fuente.
- `context_id` es una subclave opcional (sección, página, índice de chunk).
- `add_batch` divide automáticamente si el total de tokens supera el límite de 8000 tokens por solicitud.

## Recuperar

La búsqueda vectorial devuelve los chunks más similares a la consulta, junto con puntuaciones de similitud:

```lua
local embeddings = require("embeddings")

local results, err = embeddings.search("how do I configure TLS?", {
    content_type = "doc_chunk",
    limit = 5,
})

-- results[i].content, .similarity, .meta, .origin_id, .context_id
```

Filtra por origen cuando quieras fundamentar la respuesta en un documento específico:

```lua
local hits = embeddings.find_by_origin("refund policy", "doc-42", { limit = 3 })
```

## Generar una respuesta

Compón los chunks recuperados en un prompt y llama al LLM. Aquí el texto recuperado se añade al prompt del sistema; la pregunta del usuario se convierte en el turno de usuario:

```lua
-- src/app/answer.lua
local embeddings = require("embeddings")
local llm = require("llm")
local prompt = require("prompt")

local SYSTEM = [[
Answer using only the provided context. If the context does not contain
the answer, say you don't know. Cite the chunk title for each claim.
]]

local function format_context(hits)
    local parts = {}
    for i, h in ipairs(hits) do
        local title = h.meta and h.meta.title or h.origin_id
        table.insert(parts,
            string.format("[%d] %s\n%s", i, title, h.content))
    end
    return table.concat(parts, "\n\n")
end

local function answer(question: string)
    local hits, err = embeddings.search(question, { limit = 4 })
    if err then return nil, err end

    local p = prompt.new()
    p:add_system(SYSTEM)
    p:add_system("Context:\n\n" .. format_context(hits))
    p:add_user(question)

    local response, gen_err = llm.generate(p, { model = "gpt-4o-mini" })
    if gen_err then return nil, gen_err end

    return {
        answer = response.result,
        sources = hits,
    }
end

return { answer = answer }
```

```yaml
- name: answer
  kind: function.lua
  source: file://app/answer.lua
  method: answer
  imports:
    embeddings: wippy.embeddings:embeddings
    llm: wippy.llm:llm
    prompt: wippy.llm:prompt
```

## Ejemplo de extremo a extremo

Uniéndolo todo detrás de un endpoint HTTP. Añade estas entradas a `src/_index.yaml`:

```yaml
  - name: ingest
    kind: function.lua
    source: file://app/ingest.lua
    method: ingest
    modules:
      - text
    imports:
      embeddings: wippy.embeddings:embeddings

  - name: answer
    kind: function.lua
    source: file://app/answer.lua
    method: answer
    imports:
      embeddings: wippy.embeddings:embeddings
      llm: wippy.llm:llm
      prompt: wippy.llm:prompt

  - name: seed
    kind: process.lua
    meta:
      command:
        name: seed
        short: Ingest the sample document
        security:
          groups:
            - wippy.security:process
    source: file://app/seed.lua
    method: main
    modules:
      - funcs
      - io

  - name: gateway
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true
      security:
        actor:
          id: gateway
        groups:
          - wippy.security:process

  - name: api
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api

  - name: ask
    kind: http.endpoint
    meta:
      router: app:api
    method: POST
    path: /ask
    func: app:answer_http

  - name: answer_http
    kind: function.lua
    source: file://app/answer_http.lua
    method: handler
    modules:
      - http
    imports:
      answer: app:answer
```

El servidor declara un contexto de seguridad porque la recuperación resuelve el modelo de embeddings desde el registro, y una petición sin actor ni ámbito no lee ninguna entrada — la resolución del modelo falla entonces con `Model or class not found`.

```lua
-- src/app/answer_http.lua
local http = require("http")
local answer = require("answer")

local function handler()
    local req = http.request()
    local res = http.response()

    local body, err = req:body_json()
    if err or not body or not body.question then
        res:set_status(http.STATUS.BAD_REQUEST)
        res:write_json({ error = "question is required" })
        return
    end

    local result, ans_err = answer.answer(tostring(body.question))
    if ans_err then
        res:set_status(http.STATUS.INTERNAL_ERROR)
        res:write_json({ error = ans_err })
        return
    end

    res:write_json(result)
end

return { handler = handler }
```

Alimenta el índice desde un comando CLI. `meta.command` hace que el proceso sea ejecutable como `wippy run seed`, y su bloque `security` le da el ámbito necesario para llamar a `app:ingest`:

```lua
-- src/app/seed.lua
local funcs = require("funcs")
local io = require("io")

local DOC = [[
# TLS Configuration

Wippy servers terminate TLS when the `tls` block is present on the
`http.service` entry. Set `cert_file` and `key_file` to PEM paths.

## Refund Policy

Refunds are issued within 14 days of purchase.
]]

local function main()
    local res, err = funcs.call("app:ingest", "doc-42", "Handbook", DOC)
    if err then
        io.print("ingest failed: " .. tostring(err))
        return
    end
    io.print("ingested " .. tostring(res.count) .. " chunks")
end

return { main = main }
```

El primer `wippy run` crea `data/app.db` y aplica la migración de embeddings. Alimenta el índice, luego inicia el servidor y consúltalo:

```bash
wippy run seed
# ingested 2 chunks

wippy run
```

```bash
curl -X POST http://localhost:8080/api/ask \
    -H 'Content-Type: application/json' \
    -d '{"question":"how do I configure TLS?"}'
```

```json
{
  "answer": "You can configure TLS by adding a `tls` block to the `http.service` entry. Set `cert_file` and `key_file` to the paths of your PEM files. (See: Handbook, TLS Configuration)",
  "sources": [
    {
      "entry_id": "52fafcc0-2d18-40d9-8a6e-7662ef9d9bea",
      "origin_id": "doc-42",
      "context_id": "1",
      "content_type": "doc_chunk",
      "content": "# TLS Configuration\nWippy servers terminate TLS when the `tls` block is present on the\n`http.service` entry. Set `cert_file` and `key_file` to PEM paths.",
      "meta": { "title": "Handbook", "chunk": 1 },
      "similarity": 0.0736
    }
  ]
}
```

## Notas operativas

- **Tamaño de chunk**: `chunk_size` y `chunk_overlap` cuentan caracteres, no tokens (el splitter mide la longitud con `utf8.RuneCountInString`). Aproximadamente 2000–4000 caracteres es un buen punto de partida. Demasiado pequeño pierde contexto local; demasiado grande diluye las puntuaciones de similitud. Usa `chunk_overlap` (~10–20 % del tamaño del chunk) para preservar frases a través de los límites.
- **Tipos de contenido**: Usa valores `content_type` distintos (`doc_chunk`, `faq`, `code_snippet`) para que la búsqueda pueda filtrar por tipo.
- **Reindexado**: Elimina y reingiere por documento vía `embedding_repo.delete_by_origin(doc_id)` antes de agregar nuevos chunks. El repositorio es una biblioteca aparte — impórtala como `embedding_repo: wippy.embeddings:embedding_repo`.
- **Búsqueda híbrida**: Para coincidencia exacta de términos (nombres, IDs), combina la búsqueda vectorial con la búsqueda de texto completo sobre tu tabla fuente y re-rankea.
- **Elección de modelo**: `wippy/embeddings` está fijado a `text-embedding-3-small` con 512 dimensiones, y la tabla `embeddings_512` almacena `vector(512)`/`float[512]`. Un modelo o tamaño de vector distinto implica cambiar las constantes de la biblioteca y la tabla de migración.

## Siguientes Pasos

- [Framework LLM](framework/llm.md) — `llm.generate`, `llm.embed`, construcción de prompts
- [Agentes](framework/agents.md) — envuelve el retriever como herramienta de agente
- [Módulo SQL](lua/storage/sql.md) — acceso subyacente a base de datos
- [Módulo Text](lua/text/text.md) — splitters y tokenización
