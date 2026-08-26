---
title: "HTML Sanitization"
description: "Sanitize untrusted HTML with preset or custom element, attribute, and URL policies."
---

# HTML Sanitization
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

The `html` module sanitizes untrusted HTML with policies based on [bluemonday](https://github.com/microcosm-cc/bluemonday).

Sanitization parses HTML and filters it through an allowlist policy. Elements and attributes that the policy does not allow are removed. The output is well-formed HTML.

## Loading

```lua
local html = require("html")
```

## Preset Policies

The module provides three preset policy constructors:

| Policy | Use Case | Allows |
|--------|----------|--------|
| `new_policy` | Custom sanitization | Nothing (build from scratch) |
| `ugc_policy` | User comments, forums | Common formatting (`p`, `b`, `i`, `a`, lists, etc.) |
| `strict_policy` | Plain text extraction | Nothing (strips all HTML) |

### Empty Policy

Create an empty policy, then add the elements and attributes it should allow:

```lua
local policy, err = html.sanitize.new_policy()

policy:allow_elements("p", "strong", "em")
policy:allow_attrs("class"):globally()

local clean = policy:sanitize(user_input)
```

**Returns:** `Policy, error`

### User Content Policy

Create a policy configured for common user-generated formatting:

```lua
local policy = html.sanitize.ugc_policy()

local safe = policy:sanitize('<p>Hello <strong>world</strong></p>')
-- '<p>Hello <strong>world</strong></p>'

local xss = policy:sanitize('<p>Hello <script>alert("xss")</script></p>')
-- '<p>Hello </p>'
```

**Returns:** `Policy, error`

### Strict Policy

Create a strict policy that removes HTML and returns plain text:

```lua
local policy = html.sanitize.strict_policy()

local text = policy:sanitize('<p>Hello <b>world</b>!</p>')
-- 'Hello world!'
```

**Returns:** `Policy, error`

## Element Control

### Allow Elements

Allow specific HTML elements:

```lua
local policy = html.sanitize.new_policy()
policy:allow_elements("p", "strong", "em", "br")
policy:allow_elements("h1", "h2", "h3")
policy:allow_elements("a", "img")

local result = policy:sanitize('<p>Hello <strong>world</strong></p>')
-- '<p>Hello <strong>world</strong></p>'
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `...` | string | Element tag names |

**Returns:** `Policy`

## Attribute Control

### Allow Attributes

Start an attribute rule, then apply it with `on_elements()` or `globally()`:

```lua
policy:allow_attrs("href"):on_elements("a")
policy:allow_attrs("src", "alt"):on_elements("img")
policy:allow_attrs("class", "id"):globally()
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `...` | string | Attribute names |

**Returns:** `AttrBuilder`

### On Specific Elements

Allow attributes only on specified elements:

```lua
policy:allow_elements("a", "img")
policy:allow_attrs("href", "target"):on_elements("a")
policy:allow_attrs("src", "alt", "width", "height"):on_elements("img")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `...` | string | Element tag names |

**Returns:** `Policy`

### On All Elements

Allow attributes on every permitted element:

```lua
policy:allow_attrs("class"):globally()
policy:allow_attrs("id"):globally()
```

**Returns:** `Policy`

### With Pattern Matching

Require attribute values to match a regular expression:

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

| Parameter | Type | Description |
|-----------|------|-------------|
| `pattern` | string | Regex pattern |

**Returns:** `AttrBuilder, error`

## URL Security

### Standard URLs

Enable the standard URL-handling policy:

```lua
policy:allow_elements("a")
policy:allow_attrs("href"):on_elements("a")
policy:allow_standard_urls()
```

**Returns:** `Policy`

### URL Schemes

Restrict the allowed URL schemes:

```lua
policy:allow_url_schemes("https", "mailto")

policy:sanitize('<a href="https://example.com">OK</a>')
-- '<a href="https://example.com">OK</a>'

policy:sanitize('<a href="javascript:alert(1)">XSS</a>')
-- '<a>XSS</a>'
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `...` | string | Allowed schemes |

**Returns:** `Policy`

### Relative URLs

Configure whether relative URLs are allowed:

```lua
policy:allow_relative_urls(true)

policy:sanitize('<a href="/page">Link</a>')
-- '<a href="/page">Link</a>'
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `allow` | boolean | Allow relative URLs |

**Returns:** `Policy`

### Require Parseable URLs

Reject URLs that fail to parse cleanly. With `true`, attribute URLs that the HTML sanitizer cannot parse are stripped instead of passed through.

```lua
policy:require_parseable_urls(true)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `require` | boolean | Require URLs to be parseable |

**Returns:** `Policy`

### Nofollow Links

Add `rel="nofollow"` to links:

```lua
policy:allow_attrs("href", "rel"):on_elements("a")
policy:require_nofollow_on_links(true)

policy:sanitize('<a href="https://example.com">Link</a>')
-- '<a href="https://example.com" rel="nofollow">Link</a>'
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `require` | boolean | Add nofollow |

**Returns:** `Policy`

### Noreferrer Links

Add `rel="noreferrer"` to links:

```lua
policy:require_noreferrer_on_links(true)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `require` | boolean | Add noreferrer |

**Returns:** `Policy`

### External Links in New Tab

Add `target="_blank"` to fully qualified URLs:

```lua
policy:allow_attrs("href", "target"):on_elements("a")
policy:add_target_blank_to_fully_qualified_links(true)

policy:sanitize('<a href="https://example.com">Link</a>')
-- '<a href="https://example.com" target="_blank">Link</a>'
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `add` | boolean | Add target blank |

**Returns:** `Policy`

## Convenience Methods

### Allow Images

Permit `<img>` with standard attributes.

```lua
policy:allow_images()

policy:sanitize('<img src="photo.jpg" alt="Photo">')
-- '<img src="photo.jpg" alt="Photo">'
```

**Returns:** `Policy`

### Allow Data URI Images

Permit Base64-encoded data URI images:

```lua
policy:allow_elements("img")
policy:allow_attrs("src"):on_elements("img")
policy:allow_data_uri_images()

policy:sanitize('<img src="data:image/png;base64,iVBORw...">')
-- '<img src="data:image/png;base64,iVBORw...">'
```

**Returns:** `Policy`

### Allow Lists

Permit list elements: `ul`, `ol`, `li`, `dl`, `dt`, `dd`.

```lua
policy:allow_lists()

policy:sanitize('<ul><li>Item 1</li><li>Item 2</li></ul>')
-- '<ul><li>Item 1</li><li>Item 2</li></ul>'
```

**Returns:** `Policy`

### Allow Tables

Permit table elements: `table`, `thead`, `tbody`, `tfoot`, `tr`, `td`, `th`, `caption`.

```lua
policy:allow_tables()

policy:sanitize('<table><tr><td>Cell</td></tr></table>')
-- '<table><tr><td>Cell</td></tr></table>'
```

**Returns:** `Policy`

### Allow Standard Attributes

Permit common attributes: `id`, `class`, `title`, `dir`, `lang`.

```lua
policy:allow_elements("p")
policy:allow_standard_attributes()

policy:sanitize('<p id="intro" class="text" title="Introduction">Hello</p>')
-- '<p id="intro" class="text" title="Introduction">Hello</p>'
```

**Returns:** `Policy`

## Sanitize

Apply a policy to an HTML string:

```lua
local policy = html.sanitize.ugc_policy()
policy:require_nofollow_on_links(true)

local dirty = '<p>Hello</p><script>alert("xss")</script>'
local clean = policy:sanitize(dirty)
-- '<p>Hello</p>'
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `html` | string | HTML to sanitize |

**Returns:** `string`

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Invalid regex pattern | `errors.INVALID` | no |

See [Error Handling](lua/core/errors.md) for working with errors.
