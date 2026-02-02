# HTML-Bereinigung
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Bereinigen Sie nicht vertrauenswurdiges HTML, um XSS-Angriffe zu verhindern. Basiert auf [bluemonday](https://github.com/microcosm-cc/bluemonday).

Bereinigung funktioniert durch Parsen von HTML und Filtern durch eine Whitelist-Richtlinie. Elemente und Attribute, die nicht explizit erlaubt sind, werden entfernt. Die Ausgabe ist immer wohlgeformtes HTML.

## Laden

```lua
local html = require("html")
```

## Vordefinierte Richtlinien

Drei eingebaute Richtlinien für haufige Anwendungsfalle:

| Richtlinie | Anwendungsfall | Erlaubt |
|--------|----------|--------|
| `new_policy` | Benutzerdefinierte Bereinigung | Nichts (von Grund auf aufbauen) |
| `ugc_policy` | Benutzerkommentare, Foren | Gangige Formatierung (`p`, `b`, `i`, `a`, Listen, etc.) |
| `strict_policy` | Reintext-Extraktion | Nichts (entfernt alles HTML) |

### Leere Richtlinie

Erstellt eine Richtlinie, die nichts erlaubt. Verwenden Sie dies, um eine benutzerdefinierte Whitelist von Grund auf aufzubauen.

```lua
local policy, err = html.sanitize.new_policy()

policy:allow_elements("p", "strong", "em")
policy:allow_attrs("class"):globally()

local clean = policy:sanitize(user_input)
```

**Gibt zurück:** `Policy, error`

### Benutzerinhalt-Richtlinie

Vorkonfiguriert für benutzergenerierten Inhalt. Erlaubt gangige Formatierungselemente.

```lua
local policy = html.sanitize.ugc_policy()

local safe = policy:sanitize('<p>Hello <strong>world</strong></p>')
-- '<p>Hello <strong>world</strong></p>'

local xss = policy:sanitize('<p>Hello <script>alert("xss")</script></p>')
-- '<p>Hello </p>'
```

**Gibt zurück:** `Policy, error`

### Strikte Richtlinie

Entfernt alles HTML, gibt nur Reintext zurück.

```lua
local policy = html.sanitize.strict_policy()

local text = policy:sanitize('<p>Hello <b>world</b>!</p>')
-- 'Hello world!'
```

**Gibt zurück:** `Policy, error`

## Element-Kontrolle

### Elemente erlauben

Bestimmte HTML-Elemente auf Whitelist setzen.

```lua
local policy = html.sanitize.new_policy()
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
-- Nur Hex-Farben in style erlauben
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
| `pattern` | string | Regex-Muster |

**Gibt zurück:** `AttrBuilder, error`

## URL-Sicherheit

### Standard-URLs

URL-Behandlung mit Sicherheitsstandards aktivieren.

```lua
policy:allow_elements("a")
policy:allow_attrs("href"):on_elements("a")
policy:allow_standard_urls()
```

**Gibt zurück:** `Policy`

### URL-Schemata

Einschranken, welche URL-Schemata erlaubt sind.

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

### Nofollow-Links

`rel="nofollow"` zu allen Links hinzufügen. Verhindert SEO-Spam.

```lua
policy:allow_attrs("href", "rel"):on_elements("a")
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
policy:add_target_blank_to_fully_qualified_links(true)

policy:sanitize('<a href="https://example.com">Link</a>')
-- '<a href="https://example.com" target="_blank">Link</a>'
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `add` | boolean | Target blank hinzufügen |

**Gibt zurück:** `Policy`

## Komfortmethoden

### Bilder erlauben

`<img>` mit Standardattributen erlauben.

```lua
policy:allow_images()

policy:sanitize('<img src="photo.jpg" alt="Photo">')
-- '<img src="photo.jpg" alt="Photo">'
```

**Gibt zurück:** `Policy`

### Data-URI-Bilder erlauben

Base64-eingebettete Bilder erlauben.

```lua
policy:allow_elements("img")
policy:allow_attrs("src"):on_elements("img")
policy:allow_data_uri_images()

policy:sanitize('<img src="data:image/png;base64,iVBORw...">')
-- '<img src="data:image/png;base64,iVBORw...">'
```

**Gibt zurück:** `Policy`

### Listen erlauben

Listenelemente erlauben: `ul`, `ol`, `li`, `dl`, `dt`, `dd`.

```lua
policy:allow_lists()

policy:sanitize('<ul><li>Item 1</li><li>Item 2</li></ul>')
-- '<ul><li>Item 1</li><li>Item 2</li></ul>'
```

**Gibt zurück:** `Policy`

### Tabellen erlauben

Tabellenelemente erlauben: `table`, `thead`, `tbody`, `tfoot`, `tr`, `td`, `th`, `caption`.

```lua
policy:allow_tables()

policy:sanitize('<table><tr><td>Cell</td></tr></table>')
-- '<table><tr><td>Cell</td></tr></table>'
```

**Gibt zurück:** `Policy`

### Standardattribute erlauben

Gangige Attribute erlauben: `id`, `class`, `title`, `dir`, `lang`.

```lua
policy:allow_elements("p")
policy:allow_standard_attributes()

policy:sanitize('<p id="intro" class="text" title="Introduction">Hello</p>')
-- '<p id="intro" class="text" title="Introduction">Hello</p>'
```

**Gibt zurück:** `Policy`

## Bereinigen

Richtlinie auf HTML-String anwenden.

```lua
local policy = html.sanitize.ugc_policy()
policy:require_nofollow_on_links(true)

local dirty = '<p>Hello</p><script>alert("xss")</script>'
local clean = policy:sanitize(dirty)
-- '<p>Hello</p>'
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `html` | string | Zu bereinigendes HTML |

**Gibt zurück:** `string`

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Ungultiges Regex-Muster | `errors.INVALID` | nein |

Siehe [Fehlerbehandlung](lua-errors.md) für die Arbeit mit Fehlern.
