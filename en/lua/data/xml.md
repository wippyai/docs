---
title: "XML"
description: "Parse, select, transform and write XML with bounded memory: whole documents, record streams and a forward-only cursor."
---

# XML
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

The `xml` module reads and writes namespace-aware XML 1.0. One parser serves three ways of working:

| You have | Use | Memory |
|----------|-----|--------|
| A small document | `xml.decode` | The whole tree |
| A large document made of repeated elements | `reader:select` | One batch of records |
| Anything else, or very large values | The cursor: `reader:next` | A small read-ahead window (64 KiB) |

The writer mirrors the reader, so a read-transform-write pipeline runs in constant memory.

## Loading

```lua
local xml = require("xml")
```

Add `xml` to the executable entry's `modules:` list before requiring it.

## Elements

Every tree the module produces or accepts is built from one plain table shape. Elements carry no metatable, so they pass through messages, payloads and `json.encode` unchanged.

```lua
type Element = {
    name: string,                    -- local name
    ns: string?,                     -- namespace URI; absent = no namespace
    attrs: {[string]: string}?,      -- attribute values
    xmlns: {[string]: string}?,      -- namespace declarations: prefix -> URI, "" = default
    text: string?,                   -- content, when it is text only
    children: {string | Element}?,   -- content, when it holds at least one element
}
```

```lua
local doc, err = xml.decode('<order id="7"><total>12.50</total><note>rush</note></order>')
if err then return nil, err end

doc.name                  -- "order"
doc.attrs.id              -- "7"
doc.children[1].name      -- "total"
doc.children[1].text      -- "12.50"
```

Rules that always hold:

- An element has `text`, or `children`, or neither. Never both.
- `children` lists text and elements in document order. Adjacent text is one string.
- `<a/>` and `<a></a>` are the same element.
- All values are strings. Numbers and booleans are never inferred.
- Comments and processing instructions are not part of a tree.

Walking mixed content means telling text from elements:

```lua
local function visit(el: xml.Element)
    for _, child in ipairs(el.children or {}) do
        if type(child) == "table" then
            visit(child)
        else
            print(child)
        end
    end
end
```

### Namespaces

Names are resolved while parsing. `name` is the local name and `ns` is the namespace URI; the prefixes a document happens to use are not part of the data.

```lua
local doc = xml.decode('<s:item xmlns:s="urn:shop" xmlns:x="urn:ext" id="7" x:rev="2"/>')

doc.name                      -- "item"
doc.ns                        -- "urn:shop"
doc.attrs.id                  -- "7"
doc.attrs["{urn:ext}rev"]     -- "2"
xml.attr(doc, "rev", "urn:ext")  -- "2"
doc.xmlns                     -- {s = "urn:shop", x = "urn:ext"}
```

- An unqualified attribute is keyed by its local name. A qualified attribute is keyed `{uri}local`.
- Unprefixed attributes have no namespace; the default namespace applies to elements only.
- `xmlns` holds the declarations written on that element. They never appear in `attrs`.
- The root of a tree returned by `decode`, `reader:node` or `records:read` carries all bindings in scope, so a record cut out of a large document still resolves prefixed values. Elements reached through `child`, `children` or `find` carry only their own declarations.

```lua
-- <s:item xsi:type="s:Book"> ... </s:item>
local name, ns = xml.resolve(item, item.attrs["{http://www.w3.org/2001/XMLSchema-instance}type"])
-- "Book", "urn:shop"
```

## Decoding and Encoding

### `decode`

Parse one complete document:

```lua
local doc, err = xml.decode(body, {whitespace = "strip"})
if err then return nil, err end
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | string | XML document |
| `options` | table? | [Reader options](#reader-options) |

**Returns:** `Element, error`

The document is bounded by `max_node_bytes` (8 MiB by default). Use a reader for anything larger.

### `encode`

Serialize an element as UTF-8:

```lua
local out, err = xml.encode({
    name = "order",
    attrs = {id = "7"},
    children = {
        {name = "total", text = "12.50"},
        {name = "note", text = "rush"},
    },
}, {indent = "  ", declaration = true})
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<order id="7">
  <total>12.50</total>
  <note>rush</note>
</order>
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `element` | Element | Tree to serialize |
| `options` | table? | [Writer options](#writer-options) |

**Returns:** `string, error`

Output is deterministic: namespace declarations come first in prefix order, then attributes ordered by namespace and name. Prefixes come from the `xmlns` tables and the `ns` option. An element whose namespace has no binding declares it as the default namespace; a qualified attribute gets a generated prefix (`ns1`, `ns2`, ...).

The element must follow the rules above: an empty `text`, an empty `attrs`, `xmlns` or `children` table, or a gap in `children` is an error with code `element`. Unknown fields are ignored.

## Helpers

Helpers work on element tables. A missing node is `nil` or an empty list, never an error.

| Function | Returns | Description |
|----------|---------|-------------|
| `xml.text(element, options?)` | string | Text of the element and all descendants |
| `xml.attr(element, name, ns?)` | string? | Attribute by local name and namespace |
| `xml.child(element, name, ns?)` | Element? | First child element with that name |
| `xml.children(element, name?, ns?)` | {Element} | Child elements, optionally filtered |
| `xml.find(element, path, options?)` | {Element}?, error | Descendants matching a [path](#paths); `options.ns` binds path prefixes |
| `xml.resolve(element, qname)` | string, string?, error | Local name and namespace of a prefixed value |

```lua
local total = xml.child(doc, "total")
local amount = total and total.text

local lines, err = xml.find(doc, "lines/line")
if err then return nil, err end
for _, line in ipairs(lines) do
    print(xml.attr(line, "sku"), xml.text(line))
end
```

For `child` and `children`, omitting `ns` matches any namespace and `ns = ""` matches elements without one.

`text` and `find` walk the whole subtree and stop at a content budget, `max_node_bytes` (8 MiB by default, 4 units per element and 1 per byte of text) and `max_depth` (256). A tree returned by `decode` under default limits always fits. Pass `{max_node_bytes = n}` for a larger tree. Past the budget `find` returns a `limit` error and `text` raises one, which is also how a table that contains itself is reported.

## Paths

Paths select elements by resolved name. `xml.find` and `reader:select` use them.

| Step | Matches |
|------|---------|
| `item` | `item` without a namespace |
| `s:item` | `item` in the namespace bound to `s` in the `ns` option |
| `*:item` | `item` in any namespace |
| `s:*` | Any element in the namespace bound to `s` |
| `*` | Any element |

Prefixes in a path come from the `ns` option you pass (`{ns = {s = "urn:shop"}}`), not from the document. An unbound prefix is an error. In `reader:select` the first step matches the document root; in `xml.find` it matches children of the given element.

## Reading Large Documents

### `reader`

Create a reader over a string or any readable stream object, such as a stream or an open file:

```lua
local reader, err = xml.reader(stream, {whitespace = "strip"})
if err then return nil, err end
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `source` | string \| Stream \| File | Document, readable stream or open file |
| `options` | table? | [Reader options](#reader-options) |

**Returns:** `Reader, error`

The reader reads ahead. Until it is closed, nothing else may read the stream. Closing the reader leaves the stream open.

### Records

Most large documents are a wrapper around many repeated elements. `select` delivers those elements whole, in batches, and keeps nothing else:

```lua
local records, err = reader:select("s:catalog/s:item", {ns = {s = "urn:shop"}})
if err then return nil, err end

while true do
    local batch, err = records:read(100)
    if err then return nil, err end
    if not batch then break end

    for _, item in ipairs(batch) do
        import_item(item.attrs and item.attrs.id, xml.child(item, "title", "urn:shop"))
    end
end

records:close()
```

| Method | Returns | Description |
|--------|---------|-------------|
| `reader:select(paths, options?)` | Records, error | `paths` is one path or a list; `options.ns` binds path prefixes |
| `records:read(n?)` | {Element}?, error | Up to `n` records (default 64); `nil` at the end of the document |
| `records:close()` | boolean | Release the selection and its reader |

- Records arrive in document order across all paths.
- Matches do not nest: an element inside a delivered record is not delivered again.
- A batch also ends once its records span `max_node_bytes` of source.
- An error is sticky: every later `read` returns it.

### Cursor

The cursor visits the document one event at a time. Use it for irregular documents, for values too large to hold, and for transforms.

```lua
while true do
    local kind, err = reader:next()
    if err then return nil, err end
    if not kind then break end

    if kind == "start" and reader:name() == "item" then
        if reader:attr("status") == "active" then
            local item, err = reader:node()
            if err then return nil, err end
            handle(item)
        else
            reader:skip()
        end
    end
end
reader:close()
```

| Method | Returns | Description |
|--------|---------|-------------|
| `reader:next()` | string?, error | `"start"`, `"end"`, `"text"`, `"comment"` or `"pi"`; `nil` at the end |
| `reader:kind()` | string? | Current event kind |
| `reader:name()` | string? | Local name on `start`/`end`; target on `pi` |
| `reader:ns()` | string? | Namespace URI on `start`/`end` |
| `reader:attr(name, ns?)` | string? | One attribute of the current `start` |
| `reader:attrs()` | table | All attributes, keyed as in `Element.attrs` |
| `reader:text()` | string? | Content on `text`, `comment` and `pi` |
| `reader:depth()` | integer | Open elements, counting the current `start` |
| `reader:pos()` | table | `{line, column, offset}` of the current event |
| `reader:node()` | Element, error | On `start`: build the element, land on its `end` |
| `reader:skip()` | boolean, error | On `start`: discard the element, land on its `end` |
| `reader:copy(writer)` | boolean, error | On `start`: write the element to a writer, land on its `end` |
| `reader:close()` | boolean | Release the reader |

Text longer than `max_token_bytes` arrives as consecutive `text` events split on character boundaries, so a multi-gigabyte value never has to fit in memory. `comment` and `pi` events appear only when the `comments` and `instructions` options are set.

Stopping before the end does not validate the rest of the document.

## Writing

### `writer`

Create a writer over a writable stream or open file, or in memory when no destination is given:

```lua
local w, err = xml.writer(out, {indent = "  "})
if err then return nil, err end

w:start_element("items", {generated = "2026-01-01"})
w:element("item", {id = "1"}, "first")
w:node({name = "item", attrs = {id = "2"}, text = "second"})
w:end_element()

local _, err = w:finish()
```

| Method | Returns | Description |
|--------|---------|-------------|
| `w:start_element(name, attrs?, ns?)` | boolean, error | Open an element |
| `w:end_element()` | boolean, error | Close the innermost open element |
| `w:text(data)` | boolean, error | Write escaped text |
| `w:element(name, attrs?, text?, ns?)` | boolean, error | Write a complete element |
| `w:node(element)` | boolean, error | Write a whole tree |
| `w:comment(data)` | boolean, error | Write a comment |
| `w:flush()` | boolean, error | Send buffered output to the stream |
| `w:finish()` | string?, error | Complete the document; returns it for an in-memory writer |
| `w:close()` | boolean | Release the writer; the stream stays open |

`finish` fails if elements are still open or no root element was written, and can be called once. `flush` on an in-memory writer does nothing. `close` never completes an unfinished document. A failed write is final: output already sent is not replayed, and every later call returns the same error.

### Transforming without loading

`reader:copy` moves an element from a reader to a writer without building it, re-declaring the namespaces it inherits:

```lua
local reader = xml.reader(input)
local w = xml.writer(output)

w:start_element("active")
while true do
    local kind, err = reader:next()
    if err then return nil, err end
    if not kind then break end

    if kind == "start" and reader:depth() == 2 then
        if reader:attr("status") == "active" then
            local _, err = reader:copy(w)
            if err then return nil, err end
        else
            reader:skip()
        end
    end
end
w:end_element()
w:finish()
```

## Options

### Reader options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `whitespace` | string | `"preserve"` | `"strip"` drops whitespace-only text between markup |
| `comments` | boolean | false | Report `comment` events |
| `instructions` | boolean | false | Report `pi` events |
| `max_depth` | integer | 256 | Open elements |
| `max_attrs` | integer | 256 | Attributes and declarations on one element |
| `max_namespaces` | integer | 1024 | Namespace declarations in scope at once, shadowed ones included |
| `max_tag_bytes` | integer | 1 MiB | One start tag, comment or processing instruction |
| `max_token_bytes` | integer | 1 MiB | Largest text chunk in one cursor event |
| `max_node_bytes` | integer | 8 MiB | Source bytes of one element built as a tree |
| `max_bytes` | integer | 0 | Whole document; 0 = unlimited |

Limits must be at least 1; `max_bytes` may be 0.

`whitespace = "strip"` suits data documents. It removes a run of text only when the whole run is literal whitespace between two pieces of markup (tags, comments, processing instructions) and no longer than `max_token_bytes`. Whitespace next to other text, inside CDATA, written as a character reference, or under `xml:space="preserve"` is kept.

### Writer options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `indent` | string | none | Spaces or tabs per level |
| `declaration` | boolean | false | Emit the XML declaration |
| `ns` | table | none | Preferred prefix -> URI bindings, declared on the root |
| `max_depth` | integer | 256 | Open elements |
| `max_attrs` | integer | 256 | Attributes and declarations on one element |
| `max_namespaces` | integer | 1024 | Namespace declarations in scope at once |
| `max_tag_bytes` | integer | 1 MiB | One start tag with its attributes, or one comment |
| `max_node_bytes` | integer | 8 MiB | Serialized size of one tree written by `encode`, `w:node` or `w:element` |

The limits mirror the reader's. Raise `max_node_bytes` to encode a larger tree in one call, or write it incrementally with `start_element` to avoid the per-tree `max_node_bytes` limit. `reader:copy` also streams without that per-tree limit. The depth, attribute, namespace and tag limits still apply to streamed output.

Indentation is meant for data documents. An element written as a whole tree is indented inside only when all of its children are elements. When writing incrementally, a line break precedes a child element or closing tag until text is written into the parent.

## What Is Accepted

The parser is strict and fetches nothing:

- XML 1.0 with namespaces; one root element.
- A document type declaration is an error. Only `&lt; &gt; &amp; &apos; &quot;` and character references are expanded.
- Duplicate attributes, unbound prefixes and invalid characters are errors.
- Line endings are normalized to `\n`.
- Encodings: UTF-8, UTF-16, ISO-8859-1, windows-1252, US-ASCII. Malformed input is an error, never replaced.

HTML is not XML. Only well-formed XHTML parses.

## Errors

| Condition | Kind | `details.code` |
|-----------|------|----------------|
| Wrong argument type or option | `errors.INVALID` | `argument` |
| Malformed document | `errors.INVALID` | `syntax` |
| Namespace error | `errors.INVALID` | `namespace` |
| Unsupported or malformed encoding | `errors.INVALID` | `encoding` |
| Limit exceeded | `errors.INVALID` | `limit` |
| Element table outside the rules above | `errors.INVALID` | `element` |
| Method not valid in the current state | `errors.INVALID` | `state` |
| Stream read or write failed | `errors.INTERNAL` | `io` |
| XML dispatcher queue is full | `errors.UNAVAILABLE` | `io` |
| XML dispatcher has stopped | `errors.UNAVAILABLE` | `state` |
| Operation canceled | `errors.CANCELED` | `canceled` |

Parsing, limit and stream I/O failures are final: later operations on that reader, records or writer return the stored error, and the reader's accessors return `nil`. Calling a cursor method on the wrong event, such as `node` on a `text` event, is a `state` error that does not end the reader. Dispatcher admission errors reject a command before it executes; they are distinct from a parsing or stream I/O failure.

Parse errors carry the position and the open elements:

```lua
local doc, err = xml.decode(body)
if err then
    local d = err:details()
    -- d.code, d.line, d.column, d.offset, d.path; d.limit names the option for limit errors
    return nil, err
end
```

See [Error Handling](lua/core/errors.md) for working with errors.
