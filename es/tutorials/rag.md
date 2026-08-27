---
title: "Generación Aumentada por Recuperación (RAG)"
description: "Ingiere documentos, recupera fragmentos relevantes mediante búsqueda vectorial y genera respuestas fundamentadas en ese contexto."
---

# Generación Aumentada por Recuperación (RAG)

Construye un pipeline de generación aumentada por recuperación sobre tus propios documentos. El ejemplo usa `wippy/embeddings` para la búsqueda vectorial y el framework LLM para generar respuestas.

**Clasificación: receta de aplicación parcial.** El código de recuperación está completo, pero es una integración para la plantilla de aplicación Wippy, no una aplicación autónoma. La plantilla es responsable de la autenticación, la política de seguridad, la configuración del proveedor y los modelos, el bootloader y el cableado de migraciones.

## Lo que construirás

Una tubería RAG mínima:

1. Ingerir documentos Markdown dividiéndolos, generando embeddings y persistiendo los fragmentos.
2. Recuperar los fragmentos más relevantes para una consulta mediante búsqueda vectorial.
3. Generar una respuesta usando los fragmentos recuperados como contexto.

## Requisitos previos

- Una aplicación basada en la [plantilla de aplicación Wippy](https://github.com/wippyai/app), con `app:db`, `app:processes`, `app.env:store` y las dependencias de bootloader y migración ya presentes.
- SQLite del runtime (incluido `vec0`) o PostgreSQL con la extensión `pgvector` habilitada antes del arranque.
- `OPENAI_API_KEY` disponible mediante el almacenamiento de entorno LLM configurado por la aplicación.
- Entradas de modelo del registro llamadas `text-embedding-3-small` (capacidad `embed`, proveedor OpenAI) y `gpt-4o-mini` (capacidad `generate`, proveedor OpenAI). El paquete de embeddings llama directamente al primer nombre y solicita 512 dimensiones.

## Dependencias

Añade la dependencia `wippy/embeddings` a `src/app/deps/_index.yaml` y vincula su base de datos de destino:

```yaml
  - name: embeddings
    kind: ns.dependency
    component: wippy/embeddings
    version: "*"
    parameters:
      - name: target_db
        value: app:db

```

No vuelvas a declarar dependencias que ya proporciona la plantilla de aplicación. Comprueba que su dependencia `wippy/migration` existente vincula `app_db` a `app:db`, y que su dependencia `wippy/bootloader` existente vincula `application_host` a `app:processes` y `env_storage` a `app.env:store`.

`wippy/embeddings` proporciona la migración que crea `embeddings_512` (PostgreSQL `pgvector` o SQLite `vec0`). `wippy/migration` la descubre y el bootloader con inicio automático la aplica durante `wippy run -c`; esta receta no tiene un comando de esquema separado.

Después de editar las entradas de dependencias, resuelve e instala el grafo:

```bash
wippy update
wippy install
```

## Ingerir documentos

El módulo `text` divide los documentos, mientras la biblioteca `embeddings` genera y persiste sus vectores.

```lua
-- src/app/ingest.lua
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

Registra la función y sus imports en `src/app/_index.yaml`:

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

Los campos de ingesta controlan la agrupación y la recuperación:

- `origin_id` agrupa los chunks que pertenecen al mismo documento fuente. PostgreSQL almacena este campo como `UUID`; usa valores UUID para que el tutorial funcione tanto con PostgreSQL como con SQLite.
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
local hits = embeddings.find_by_origin(
    "refund policy",
    "91e6f640-2d18-4eb9-a868-1ec4a894ddf6",
    { limit = 3 }
)
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

Registra la función de respuesta en el mismo `src/app/_index.yaml`:

```yaml
- name: answer
  kind: function.lua
  source: file://answer.lua
  method: answer
  imports:
    embeddings: wippy.embeddings:embeddings
    llm: wippy.llm:llm
    prompt: wippy.llm:prompt
```

## Ejemplo de endpoint HTTP

Añade las siguientes entradas a `src/app/_index.yaml`. Las entradas `ingest` y `answer` ya se añadieron antes; no las dupliques ni tampoco la base de datos, el gateway y el router de la plantilla:

```yaml
  - name: ask
    kind: http.endpoint
    meta:
      router: app:api
    method: POST
    path: /ask
    func: app:answer_http

  - name: answer_http
    kind: function.lua
    source: file://answer_http.lua
    method: handler
    modules:
      - http
    imports:
      answer: app:answer
```

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

Inicia la aplicación para que el bootloader de migraciones cree la tabla vectorial:

```bash
wippy run -c
```

Alimenta el índice llamando a `app:ingest` desde una función de configuración autenticada o un proceso con nombre de tu aplicación. La superficie exacta de carga pertenece a la aplicación, por lo que esta receta parcial no expone un endpoint de escritura sin autenticar. Después de ingerir al menos un documento, consulta la API protegida por token de la plantilla con un bearer de sesión de aplicación:

```bash
curl -X POST http://localhost:8080/api/v1/ask \
    -H 'Authorization: Bearer <app-session-token>' \
    -H 'Content-Type: application/json' \
    -d '{"question":"how do I configure TLS?"}'
```

Una respuesta correcta tiene esta forma; el texto, los valores de similitud y el orden de resultados dependen del proveedor y del contenido indexado:

```json
{
  "answer": "...",
  "sources": [
    {
      "content": "...",
      "content_type": "doc_chunk",
      "origin_id": "91e6f640-2d18-4eb9-a868-1ec4a894ddf6",
      "context_id": "1",
      "similarity": 0.82,
      "meta": { "title": "TLS guide", "chunk": 1 }
    }
  ]
}
```

## Notas operativas

- **Tamaño de chunk** — `chunk_size` y `chunk_overlap` cuentan caracteres, no tokens (el splitter mide la longitud con `utf8.RuneCountInString`). Unos 2000–4000 caracteres son un buen punto de partida. Demasiado pequeño pierde contexto local; demasiado grande diluye las puntuaciones de similitud. Usa `chunk_overlap` (~10–20 % del tamaño del chunk) para preservar frases entre límites.
- **Tipos de contenido**: Usa valores `content_type` distintos (`doc_chunk`, `faq`, `code_snippet`) para que la búsqueda pueda filtrar por tipo.
- **Reindexado**: Elimina y reingiere por documento vía `embedding_repo.delete_by_origin(doc_id)` antes de agregar nuevos chunks.
- **Búsqueda híbrida**: Para coincidencia exacta de términos (nombres, IDs), combina la búsqueda vectorial con la búsqueda de texto completo sobre tu tabla fuente y re-rankea.
- **Elección de modelo** — `wippy/embeddings` está fijado a `text-embedding-3-small` con 512 dimensiones, y la tabla `embeddings_512` almacena `vector(512)`/`float[512]`. Un modelo o tamaño de vector distinto requiere cambiar las constantes de la biblioteca y la tabla de migración.

## Siguientes Pasos

- [Framework LLM](../framework/llm.md) — `llm.generate`, `llm.embed` y construcción de prompts
- [Agentes](../framework/agents.md) — Envuelve el retriever como herramienta de agente
- [Módulo SQL](../lua/storage/sql.md) — Acceso subyacente a base de datos
- [Módulo Text](../lua/text/text.md) — Splitters de texto basados en caracteres
