---
title: "HTML-Bereinigung"
description: "Nicht vertrauenswürdiges HTML mit vordefinierten oder eigenen Element-, Attribut- und URL-Richtlinien bereinigen."
---

# HTML-Bereinigung
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Das Modul `html` bereinigt nicht vertrauenswürdiges HTML anhand von Richtlinien, die auf [bluemonday](https://github.com/microcosm-cc/bluemonday) beruhen.

Die Bereinigung parst ein HTML-Fragment und filtert es anhand einer Allowlist. Nicht erlaubte Elemente und Attribute werden entfernt; das verbleibende Fragment wird bei der Serialisierung normalisiert.

Diese Seite ist eine API-Referenz. Konstruktorblöcke sind eigenständige Richtlinienbeispiele; spätere Methodenblöcke sind partielle Konfigurationsausschnitte, die ein bereits erzeugtes `policy` voraussetzen. Die bereinigte Ausgabe eignet sich nur als Inhalt eines HTML-Elements. Für die Interpolation in JavaScript, CSS, URLs oder HTML-Attribute ist sie nicht sicher; verwenden Sie einen Encoder für den tatsächlichen Ausgabekontext.

## Laden

```lua
local html = require("html")
```

## Vordefinierte Richtlinien

Drei eingebaute Richtlinien für häufige Anwendungsfälle:

| Richtlinie | Anwendungsfall | Erlaubt |
|--------|----------|--------|
| `new_policy` | Benutzerdefinierte Bereinigung | Nichts (von Grund auf aufbauen) |
| `ugc_policy` | Benutzerkommentare, Foren | Gängige Formatierung (`p`, `b`, `i`, `a`, Listen, etc.) |
| `strict_policy` | Reintext-Extraktion | Nichts (entfernt alles HTML) |

Alle drei Konstruktoren liefern `Policy, nil`; die Richtlinienerzeugung schlägt derzeit nicht fehl.

### Leere Richtlinie

Erstellt eine Richtlinie, die nichts erlaubt. Verwenden Sie dies, um eine benutzerdefinierte Whitelist von Grund auf aufzubauen.

```lua
local policy, err = html.sanitize.new_policy()
if err then return nil, err end

policy:allow_elements("p", "strong", "em")
policy:allow_attrs("class"):globally()

local clean = policy:sanitize(user_input)
```

**Gibt zurück:** `Policy, error`

### Benutzerinhalt-Richtlinie

Vorkonfiguriert für benutzergenerierten Inhalt. Erlaubt gängige Formatierungselemente.

```lua
local policy, err = html.sanitize.ugc_policy()
if err then return nil, err end

local safe = policy:sanitize('<p>Hello <strong>world</strong></p>')
-- '<p>Hello <strong>world</strong></p>'

local xss = policy:sanitize('<p>Hello <script>alert("xss")</script></p>')
-- '<p>Hello </p>'
```

**Gibt zurück:** `Policy, error`

### Strikte Richtlinie

Entfernt alles HTML, gibt nur Reintext zurück.

```lua
local policy, err = html.sanitize.strict_policy()
if err then return nil, err end

local text = policy:sanitize('<p>Hello <b>world</b>!</p>')
-- 'Hello world!'
```

**Gibt zurück:** `Policy, error`

## Element-Kontrolle

### Elemente erlauben

Bestimmte HTML-Elemente auf Whitelist setzen.

```lua
local policy, err = html.sanitize.new_policy()
if err then return nil, err end
policy:allow_elements("p", "strong", "em", "br")
policy:allow_elements("h1", "h2", "h3")
policy:allow_elements("a", "img")

local result = policy:sanitize('<p>Hello <strong>world</strong></p>')
-- '<p>Hello <strong>world</strong></p>'
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `...` | string | Element-Tag-Namen |

**Gibt zurück:** `Policy`

## Attribut-Kontrolle

### Attribute erlauben

Attribut-Berechtigung starten. Mit `on_elements()` oder `globally()` verketten.

```lua
policy:allow_attrs("href"):on_elements("a")
policy:allow_attrs("src", "alt"):on_elements("img")
policy:allow_attrs("class", "id"):globally()
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `...` | string | Attributnamen |

**Gibt zurück:** `AttrBuilder`

### Auf bestimmten Elementen

Attribute nur auf bestimmten Elementen erlauben.

```lua
policy:allow_elements("a", "img")
policy:allow_attrs("href", "target"):on_elements("a")
policy:allow_attrs("src", "alt", "width", "height"):on_elements("img")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `...` | string | Element-Tag-Namen |

**Gibt zurück:** `Policy`

### Auf allen Elementen

Attribute global auf jedem erlaubten Element erlauben.

```lua
policy:allow_attrs("class"):globally()
policy:allow_attrs("id"):globally()
```

**Gibt zurück:** `Policy`

### Mit Musterabgleich

Attributwerte gegen Regex-Muster validieren.

```lua
-- Only allow hex colors in style
local builder, err = policy:allow_attrs("style"):matching("^color:#[0-9a-fA-F]{6}$")
if err then
    return nil, err
end
builder:on_elements("span")

policy:sanitize('<span style="color:#ff0000">Red</span>')
-- '<span style="color:#ff0000">Red</span>'

policy:sanitize('<span style="background:red">Bad</span>')
-- '<span>Bad</span>'
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `pattern` | string | Mit Go RE2 kompatibler regulärer Ausdruck |

**Gibt zurück:** `AttrBuilder, error`

## URL-Sicherheit

### Standard-URLs

Aktiviert die Standardrichtlinie für URLs. Sie verlangt parsebare URLs, erlaubt relative URLs sowie `mailto`, `http` und `https` und ergänzt erlaubte Linkelemente um `rel="nofollow"`.

```lua
policy:allow_elements("a")
policy:allow_attrs("href"):on_elements("a")
policy:allow_standard_urls()
```

**Gibt zurück:** `Policy`

### URL-Schemata

Einschränken, welche URL-Schemata erlaubt sind.

```lua
policy:allow_url_schemes("https", "mailto")

policy:sanitize('<a href="https://example.com">OK</a>')
-- '<a href="https://example.com">OK</a>'

policy:sanitize('<a href="javascript:alert(1)">XSS</a>')
-- '<a>XSS</a>'
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `...` | string | Erlaubte Schemata |

**Gibt zurück:** `Policy`

### Relative URLs

Relative URLs erlauben oder verbieten.

```lua
policy:allow_relative_urls(true)

policy:sanitize('<a href="/page">Link</a>')
-- '<a href="/page">Link</a>'
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `allow` | boolean | Relative URLs erlauben |

**Gibt zurück:** `Policy`

### Parsbare URLs erfordern

URLs ablehnen, die nicht sauber geparst werden können. Mit `true` werden Attribut-URLs, die der HTML-Sanitizer nicht parsen kann, entfernt anstatt durchgereicht.

```lua
policy:require_parseable_urls(true)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `require` | boolean | URLs müssen parsbar sein |

**Gibt zurück:** `Policy`

### Nofollow-Links

`rel="nofollow"` zu allen Links hinzufügen. Verhindert SEO-Spam.

```lua
policy:allow_attrs("href", "rel"):on_elements("a")
policy:allow_url_schemes("https")
policy:require_parseable_urls(true)
policy:require_nofollow_on_links(true)

policy:sanitize('<a href="https://example.com">Link</a>')
-- '<a href="https://example.com" rel="nofollow">Link</a>'
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `require` | boolean | Nofollow hinzufügen |

**Gibt zurück:** `Policy`

### Noreferrer-Links

`rel="noreferrer"` zu allen Links hinzufügen. Verhindert Referrer-Lecks.

```lua
policy:require_noreferrer_on_links(true)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `require` | boolean | Noreferrer hinzufügen |

**Gibt zurück:** `Policy`

### Externe Links in neuem Tab

`target="_blank"` zu vollqualifizierten URLs hinzufügen.

```lua
policy:allow_attrs("href", "target"):on_elements("a")
policy:allow_url_schemes("https")
policy:require_parseable_urls(true)
policy:add_target_blank_to_fully_qualified_links(true)

policy:sanitize('<a href="https://example.com">Link</a>')
-- '<a href="https://example.com" target="_blank">Link</a>'
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `add` | boolean | Target blank hinzufügen |

**Gibt zurück:** `Policy`

Wenn nicht vertrauenswürdige Links in einem neuen Tab geöffnet werden, aktivieren Sie zusätzlich `require_noreferrer_on_links(true)`, um Referrer-Leaks und den Zugriff über `opener` zu mindern.

## Komfortmethoden

### Bilder erlauben

Erlaubt `<img>` mit `align`, `alt`, `height`, `width` und `src`. Der Helper aktiviert außerdem die Standard-URL-Richtlinie, erlaubt aber keine Data-URI-Bilder.

```lua
policy:allow_images()

policy:sanitize('<img src="photo.jpg" alt="Photo">')
-- '<img src="photo.jpg" alt="Photo">'
```

**Gibt zurück:** `Policy`

### Data-URI-Bilder erlauben

Erlaubt syntaktisch gültige Base64-kodierte Data-URI-Bilder der Typen `gif`, `jpeg`, `png`, `svg+xml` oder `webp`. Der Sanitizer prüft Medientyp und Base64-Kodierung, nicht den dekodierten Bildinhalt. Data-URIs können aktiven Inhalt transportieren; erlauben Sie sie nur, wenn Sie den Bilddaten vertrauen.

```lua
policy:allow_elements("img")
policy:allow_attrs("src"):on_elements("img")
policy:allow_data_uri_images()

local input = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2O9sAAAAASUVORK5CYII=">'
policy:sanitize(input)
-- The data URI is preserved.
```

**Gibt zurück:** `Policy`

### Listen erlauben

Erlaubt `ul`, `ol`, `li`, `dl`, `dt` und `dd`. Der Helper erlaubt außerdem validierte Attribute `type` auf `ul`, `ol` und `li` sowie ein ganzzahliges Attribut `value` auf `li`.

```lua
policy:allow_lists()

policy:sanitize('<ul><li>Item 1</li><li>Item 2</li></ul>')
-- '<ul><li>Item 1</li><li>Item 2</li></ul>'
```

**Gibt zurück:** `Policy`

### Tabellen erlauben

Erlaubt `table`, `caption`, `col`, `colgroup`, `thead`, `tbody`, `tfoot`, `tr`, `td` und `th` sowie die vom Helper validierten Attribute für Dimensionen, Ausrichtung, Spans, Header, Scope und verwandte Präsentationseigenschaften.

```lua
policy:allow_tables()

policy:sanitize('<table><tr><td>Cell</td></tr></table>')
-- '<table><tr><td>Cell</td></tr></table>'
```

**Gibt zurück:** `Policy`

### Standardattribute erlauben

Erlaubt global die Standardattribute `dir`, `id`, `lang` und `title`. Werte sind eingeschränkt: `dir` ist `ltr` oder `rtl`, `lang` umfasst 2 bis 20 ASCII-Buchstaben, und `id` sowie `title` müssen den sicheren Zeichenmustern des Sanitizers entsprechen. Dieser Helper erlaubt `class` nicht.

```lua
policy:allow_elements("p")
policy:allow_standard_attributes()

policy:sanitize('<p id="intro" class="text" title="Introduction">Hello</p>')
-- '<p id="intro" title="Introduction">Hello</p>'
```

**Gibt zurück:** `Policy`

## Bereinigen

Richtlinie auf HTML-String anwenden.

```lua
local policy, err = html.sanitize.ugc_policy()
if err then return nil, err end
policy:require_nofollow_on_links(true)

local dirty = '<p>Hello</p><script>alert("xss")</script>'
local clean = policy:sanitize(dirty)
-- '<p>Hello</p>'
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `html` | string | Zu bereinigendes HTML |

**Gibt zurück:** `string`

`sanitize` liefert ausschließlich eine Zeichenkette. In Runtime `v0.3.32a` kann der zugrunde liegende Fragmentparser fehlerhafte, nicht parsebare Eingaben in eine leere Zeichenkette umwandeln; der Lua-Wrapper kann dies nicht von gültiger Eingabe unterscheiden, deren Inhalt die Richtlinie vollständig entfernt hat. Behandeln Sie die Bereinigung als Ausgabefilter, nicht als Eingabevalidierung. Prüfen Sie erforderlichen Inhalt separat, wenn ein leeres Ergebnis relevant ist.

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Ungültiges Regex-Muster | `errors.INVALID` | nein |

Siehe [Fehlerbehandlung](lua/core/errors.md) für die Arbeit mit Fehlern.
Fügen Sie `html` zur Liste `modules:` des ausführbaren Eintrags hinzu, bevor Sie es per `require` laden.
