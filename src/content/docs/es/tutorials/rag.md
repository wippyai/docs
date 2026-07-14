---
title: "Generación Aumentada por Recuperación (RAG)"
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
- Un proveedor LLM configurado con un modelo de embeddings (por ejemplo, `text-embedding-3-small`) — consulta [Framework LLM](framework/llm.md).
- Proyecto Wippy inicializado (`wippy init`, `wippy add wippy/embeddings`).

## Dependencias

Declara la dependencia `wippy/embeddings` y apúntala a tu base de datos. El parámetro `target_db` es el Registry ID de la entrada de base de datos en la que vivirá la tabla de embeddings:

```yaml
version: "1.0"
namespace: app

entries:
  - name: db
    kind: db.sql.sqlite
    file: ./data/app.db
    lifecycle:
      auto_start: true

  - name: embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"
    parameters:
      - name: target_db
        value: app:db
```

`wippy/embeddings` incorpora `wippy/llm` y la migración que crea la tabla `embeddings_512` (PostgreSQL `pgvector` o tabla virtual SQLite `vec0`).

## Ingerir documentos

La división es manejada por el módulo `text`; el embedding y la persistencia por la biblioteca `embeddings`.

```lua
-- app/ingest.lua
local text = require("text")
local embeddings = require("embeddings")
local uuid = require("uuid")

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

Registra la función y sus importaciones:

```yaml
- name: ingest
  kind: function.lua
  source: file://app/ingest.lua
  method: ingest
  modules:
    - text
    - uuid
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
-- app/answer.lua
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

local function answer(question)
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

Uniéndolo todo detrás de un endpoint HTTP:

```yaml
version: "1.0"
namespace: app

entries:
  - name: db
    kind: db.sql.sqlite
    file: ./data/app.db
    lifecycle:
      auto_start: true

  - name: embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"
    parameters:
      - name: target_db
        value: app:db

  - name: ingest
    kind: function.lua
    source: file://app/ingest.lua
    method: ingest
    modules:
      - text
      - uuid
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

  - name: gateway
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true

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

```lua
-- app/answer_http.lua
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

    local result, ans_err = answer.answer(body.question)
    if ans_err then
        res:set_status(http.STATUS.INTERNAL_ERROR)
        res:write_json({ error = ans_err })
        return
    end

    res:write_json(result)
end

return { handler = handler }
```

Alimenta el índice llamando a `ingest` desde un proceso de configuración o un comando CLI (`process.lua` con `meta.command`), luego consulta:

```bash
curl -X POST http://localhost:8080/api/ask \
    -H 'Content-Type: application/json' \
    -d '{"question":"how do I configure TLS?"}'
```

## Notas operativas

- **Tamaño de chunk**: 500–1000 tokens es un buen punto de partida. Demasiado pequeño pierde contexto local; demasiado grande diluye las puntuaciones de similitud. Usa `chunk_overlap` (~10–20 % del tamaño del chunk) para preservar frases a través de los límites.
- **Tipos de contenido**: Usa valores `content_type` distintos (`doc_chunk`, `faq`, `code_snippet`) para que la búsqueda pueda filtrar por tipo.
- **Reindexado**: Elimina y reingiere por documento vía `embedding_repo.delete_by_origin(doc_id)` antes de agregar nuevos chunks.
- **Búsqueda híbrida**: Para coincidencia exacta de términos (nombres, IDs), combina la búsqueda vectorial con la búsqueda de texto completo sobre tu tabla fuente y re-rankea.
- **Elección de modelo**: El modelo por defecto de 512 dimensiones `text-embedding-3-small` es rentable. Actualiza a 1024 o 3072 dimensiones solo si el recall es insuficiente — vectores más grandes significan mayor almacenamiento y búsqueda más lenta.

## Siguientes Pasos

- [Framework LLM](framework/llm.md) — `llm.generate`, `llm.embed`, construcción de prompts
- [Agentes](framework/agents.md) — envuelve el retriever como herramienta de agente
- [Módulo SQL](lua/storage/sql.md) — acceso subyacente a base de datos
- [Módulo Text](lua/text/text.md) — splitters y tokenización
