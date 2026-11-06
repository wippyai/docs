---
title: "Session Forms"
description: "Ask the user structured questions from an agent with the ask_user tool (choices) or the ask_user_fields tool (choices, text, numbers, email addresses, dates and checkboxes), and read the answer back as a self-contained record."
---

# Session Forms

Session forms let an agent ask the user one or more structured questions and
get a structured answer back, without leaving a tool call waiting on human
input. The `wippy/session` module owns the feature. It provides two traits,
and each adds a tool that asks a form plus the `read_form` tool. It also
provides an artifact that renders in the chat as a question card or as a form
of labelled fields, and an HTTP endpoint that accepts the answer and delivers
it to the session as an ordinary user message.

A question is a field of one of seven types. A `choice` field offers options
for a single or multiple selection, with an optional free-text "Other"
answer. The standard fields are `text`, `textarea`, `number`, `email`, `date`
and `checkbox`. The `ask_user` tool asks choice questions only, and the
`ask_user_fields` tool asks questions of all seven types (see
[Enabling a trait](#enabling-a-trait)). A form made only of choice fields is a
version 1 form and renders as a question card. A form with at least one
standard field is a version 2 form and renders as one form of labelled controls
with a single Submit button (see [Form versions](#form-versions)). A renderer
that does not know a form version or a field type shows a notice and never
drops a question silently.

For the `wippy-form` and `wippy-form-answers` components and the browser side
of the HTTP contract, see
[Session Forms (frontend)](../frontend/micro-frontends/session-forms.md). The
Web Host version that the question card and the form of fields need is listed
under [Host requirement](../frontend/micro-frontends/session-forms.md#host-requirement).

## Enabling a trait

Add one of the two Session Forms traits to an agent's `traits`. The traits
differ only in the field types that their form tool accepts.

| Trait | Tool | Field types |
| --- | --- | --- |
| `wippy.session.forms:ask_user` | `ask_user` | `choice` |
| `wippy.session.forms:ask_user_fields` | `ask_user_fields` | `choice`, `text`, `textarea`, `number`, `email`, `date` and `checkbox` |

Both traits also add the `read_form` tool. The following agent asks choice
questions:

```yaml
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      title: Assistant
    prompt: |
      When you need the user to choose between concrete options before you
      can continue, ask them with the ask_user tool instead of asking in
      plain text.
    model: gpt-4o
    max_tokens: 4096
    traits:
      - id: wippy.session.forms:ask_user
```

The trait ships with Session Forms, so the app needs a `wippy/session` release
that includes them.
<!-- TODO: name the Session version here when the release PR exists. -->

To let the agent also ask for text, numbers, email addresses, dates and
checkboxes, give it the `ask_user_fields` trait in place of `ask_user`:

```yaml
    traits:
      - id: wippy.session.forms:ask_user_fields
```

Each tool's input schema lists only its own field types. The server applies
the same limit, so when a model ignores the schema and sends a standard field
to `ask_user`, the call fails with `unsupported_type` and the message
`Supported types: choice.`, and no form is created. Upgrading the
`wippy/session` module does not give an agent that has `ask_user` the standard
fields. To use them, switch the agent to `ask_user_fields`.

Attach one of the two traits. The two tools have different names because the
agent compiler keeps only the last tool of a given name. With one shared name,
an agent with both traits would get whichever tool the compiler read last.
With the different names, an agent with both traits gets both tools and both
prompts. It works, but the prompt repeats most of its instructions.

A trait needs a `wippy/session` release that ships it, and `ask_user_fields`
ships only in the releases that support the standard fields. With an older
release, an agent that references the trait fails to resolve at lint time.

Each trait contributes its form tool, `read_form` and a block of prompt text.
Both prompts tell the model the following, and the `ask_user_fields` prompt
also tells it how to define fields.

- How to ask:
  - Use the form tool when it needs input from the user before it can
    continue. For `ask_user` the input is a decision between concrete options,
    and for `ask_user_fields` it is a decision or specific details. Ask at most
    one form per turn, with all the questions it needs in it.
  - Set `answered_message` to a short sentence in the user's voice. It becomes
    the user's chat message when they answer.
- How to define fields, in the `ask_user_fields` prompt only:
  - A default only prefills a field and is not the user's answer. A checkbox
    never starts checked, so a required checkbox is the way to ask for consent.
  - Keep the form to the questions it needs, because the text fields of one
    form hold at most 16,000 characters together.
- How to read answers:
  - Treat an answer with `"late": true` as context only, and confirm with the
    user before acting on the earlier request.
  - Call `read_form` with a `form_id` to see an earlier form, and never write a
    `<wippy-form-answers>` element by hand, because the element carries meaning
    only in the exact format the server writes.

An agent without either trait cannot call `ask_user` or `ask_user_fields`, but
its prompt still includes the form index described below, and it can read a
submitted answer like any other user message.

## The `ask_user` and `ask_user_fields` tools

The two tools take the same definition and differ only in the field types they
accept. Each tool validates and normalizes the definition, then asks the
session to create the form. An invalid definition is a tool error. The call
returns no result and a message that describes what to fix, nothing is stored,
and the agent can retry in the same turn.

| Key | Contract |
| --- | --- |
| `title` | Required plain text, 1 to 160 characters |
| `description` | Optional plain text, at most 1,000 characters |
| `submit_label` | Optional plain text, at most 40 characters |
| `answered_message` | Optional plain text, at most 200 characters. The user's chat message once they answer, written in the user's own voice by the agent that asks (see [What the agent receives](#what-the-agent-receives)). Never shown on the form. A form asked without it falls back to `Answered “<title>”.` |
| `fields` | 1 to 20 entries |
| `fields[].id` | Unique key matching `^[a-z][a-z0-9_]{0,39}$` |
| `fields[].type` | `"choice"` for `ask_user`. `"choice"`, `"text"`, `"textarea"`, `"number"`, `"email"`, `"date"` or `"checkbox"` for `ask_user_fields` (see [Field types](#field-types)) |
| `fields[].label` | The question, 1 to 240 characters |
| `fields[].description` | Optional help text, at most 1,000 characters |
| `fields[].required` | Boolean, default `false` |
| `fields[].options` | `choice` only, and required there. 1 to 20 distinct choices. A plain string is both the value and the label. Use `{ "value", "label", "description"? }` when the stored value should differ from the shown text. Value and label are at most 240 characters, and `description` is at most 1,000 |
| `fields[].multiple` | `choice` only. Boolean, default `false`. Allows selecting several options |
| `fields[].allow_other` | `choice` only. Boolean, default `false`. Offers a free-text "Other" answer |

The keys that only some types take (lengths, `pattern`, `min`, `max`, `step`,
`integer`, `placeholder` and `default`) are listed per type under
[Field types](#field-types), and only `ask_user_fields` takes them. Its input
schema is flat, so a model sees the keys of every type in one object. The
server decides which keys each type takes and rejects any other with
`unknown_key`. For example, `placeholder` belongs to `text` and `textarea`
only, and the server rejects it on `number`, `email` and every other type.

The normalized definition is bounded to 32 KiB. The size is measured after
normalization, where a plain string option expands to `{"value": .., "label":
..}`, so a definition with many short string options can be well over the
limit even when it looks compact. In that case the tool error reports the
actual normalized size. Labels and descriptions are never parsed as Markdown or
HTML. The question card shows text in backticks as inline code, and the form of
fields shows all of it as plain text. Control characters other than tabs and
newlines (in multi-line fields) are rejected.

A successful call of either tool ends the agent's turn and returns the text
below. Both trait prompts tell the agent not to add a follow-up, because the
form is already visible.

```text
Form "Delivery preference" was created as <artifact-id>. Its answer will arrive as a user message.
```

### One form per turn

At most one form can be created per agent turn. A second call of either tool
in the same turn is rejected before anything is written:

```text
This turn already asked the user with a form. No second form was created; wait for the answer to the first one.
```

A session can hold up to 100 unresolved (unanswered) forms at once. Above
that, a call of either tool is rejected with `too_many_forms` until the user
answers older forms. Nothing is deleted automatically.

A form's definition is immutable once created. There is no edit operation, and
an attempt to update a form artifact through the general artifact-update path
is rejected with `session_form: Session forms cannot be edited. Ask a new form
instead.` To change a question, ask a new form.

## Field types

Every field has an `id`, a `type` and a `label`, and optionally a
`description` and `required`, as listed in the table above. Each type then
adds its own keys, which are listed in this section. `ask_user` takes only the
`choice` type, and `ask_user_fields` takes every type in this section. A key that a type does
not take is rejected with `unknown_key`, for example `min_length` on a
`number` or `default` on a `choice`. A form can mix types in any order.
Lengths count characters (Unicode code points), not bytes.

### `choice`

Takes `options`, `multiple` and `allow_other` as described in the table
above, and no other keys. A choice has no `default`.

### `text`

One line of text.

| Key | Default | Rule |
| --- | --- | --- |
| `min_length` | `0` | Whole number from 0 to 2,000, not above `max_length` |
| `max_length` | `500` | Whole number from 1 to 2,000 |
| `pattern` | none | A regular expression that the whole answer must match, at most 200 characters (see [Patterns](#patterns)) |
| `placeholder` | none | Plain text of at most 200 characters with no control character or line break, shown in the empty box and never submitted |
| `default` | none | A string that is a valid answer for the field (see [Defaults](#defaults)) |

### `textarea`

Several lines of text. A textarea takes the same keys as `text`, except
`pattern`, with larger limits.

| Key | Default | Rule |
| --- | --- | --- |
| `min_length` | `0` | Whole number from 0 to 8,000, not above `max_length` |
| `max_length` | `8000` | Whole number from 1 to 8,000 |
| `placeholder` | none | Plain text of at most 200 characters with no control character or line break |
| `default` | none | A string that is a valid answer for the field |

### `number`

A finite number. The server checks `step` with exact decimal arithmetic and
never with floating point arithmetic.

| Key | Default | Rule |
| --- | --- | --- |
| `min` | none | The smallest allowed value, from -1,000,000,000,000 to 1,000,000,000,000 with at most 6 decimals |
| `max` | none | The largest allowed value, with the same limits as `min` and not below it |
| `step` | none | A number above 0 and at most 1,000,000,000,000, with at most 6 decimals. The allowed values are `min` (or 0 when there is no `min`) plus whole multiples of `step` |
| `integer` | `false` | Boolean. When `true` only whole numbers are accepted, `step` must be a whole number, and so must `min` when there is a `step`. At least one whole number must lie between `min` and `max` |
| `default` | none | A number that is a valid answer for the field |

### `email`

An email address. An email takes no keys besides `default`. Its limits are
fixed at 254 characters in all and 64 before the `@`.

| Key | Default | Rule |
| --- | --- | --- |
| `default` | none | A valid address, stored without surrounding whitespace |

### `date`

A calendar date written `YYYY-MM-DD`, with no time and no time zone. The bounds
are fixed dates, and values such as `today` are not supported.

| Key | Default | Rule |
| --- | --- | --- |
| `min` | none | The earliest allowed date, inclusive. A real calendar day from `0001-01-01` to `9999-12-31` |
| `max` | none | The latest allowed date, inclusive, with the same limits and not before `min` |
| `default` | none | A date that is a valid answer for the field |

### `checkbox`

A box the user ticks. Use `required: true` for consent, which makes the user
tick the box before the form can be submitted.

| Key | Default | Rule |
| --- | --- | --- |
| `default` | none | Only `false` |

### Defaults

A `default` is the value a control starts with. The server validates it when
the form is created, as an answer to the same field with `required` ignored,
so a default that breaks `min_length`, `pattern`, `min`, `max`, `step` or any
other rule of the field is rejected with `invalid_default`. The message
names the rule that failed and never repeats the value. A blank default is
rejected as well, because it would not be an answer. The definition stores
the default in normalized form, so an `email` default is trimmed and a whole
`number` default becomes an integer.

A default only prefills the control. The server never submits it for the
user, so an answer exists only when the user submits the form, and a
question whose prefilled value the user clears is unanswered. Because a default
must never agree to something on the user's behalf, a `checkbox` can only have
the default `false`. A default of `true` is rejected with
`default_not_allowed`, and a `choice` field with a `default` is rejected with
`unknown_key`.

### Patterns

A `pattern` on a `text` field is a regular expression that the whole answer
must match. The server compiles it as `^(?:pattern)$`, so an alternation such
as `a|b` applies to the whole answer and the pattern needs no anchors, although
`^` and `$` are accepted. For example, `[A-Z]{2}\d{6}` accepts `AB123456`.
The server checks the pattern when the form is created and checks every
answer against it when the form is submitted. The browser never evaluates
it, so a mismatch is reported on the field after the user submits.

The server runs patterns with RE2, which takes time proportional to the length
of the answer. The accepted syntax is a small part of the RE2 syntax, small
enough that the input schema of the `ask_user_fields` tool lists it in full.

- Literal characters, `.`, `^` and `$`. Outside a class, a literal `{`, `}` or
  `]` needs a backslash (`\{`, `\}` or `\]`), and the server rejects an
  unescaped one.
- Classes `[abc]`, `[^abc]` and ranges such as `[a-z]`. Inside a class, put `-`
  first or last or write `\-`, and write `[` as `\[`. POSIX classes such as
  `[[:alpha:]]` are not accepted.
- The escapes `\d` (ASCII digits) and `\w` (ASCII letters, digits and
  underscore), which cannot start or end a range, and a backslash before one
  of `^ $ \ . * + ? ( ) [ ] { } | /`, and also before `-` inside a class. A
  backslash before any other character is rejected.
- Groups `( )` and `(?: )`, and alternation with `|`. Groups nest at most 3
  deep.
- The repeats `*`, `+`, `?`, `{n}`, `{n,}` and `{n,m}`, each with an optional
  lazy `?` after it, as in `a{2,5}?`. A repeat count is at most 100 and is
  written without a leading zero, so `{1}` is a repeat and `{01}` is rejected,
  because RE2 reads `{01}` as the text "{01}". A count of zero is `{0}`. A
  repeat cannot be repeated again, as in `a**`, and a group that repeats
  without end (`*`, `+` or `{n,}`) cannot hold a repeat without end, as in
  `(a+)+`.

A pattern also counts at most 100 with every repeat written out. A literal, a
class, `.`, `^`, `$` and an empty group count 1. `a{n}` and `a{m,n}` count n
times what they repeat, `a{m,}` counts m + 1 times, and `*`, `+`, `?` and a
repeat of zero count what they repeat once, so `(ab){0}` counts 2. Nested
repeats multiply, and items in a row and alternatives add up, so `(ab){5}`
counts 10 and `(a{5}){3}` counts 15. The limit keeps the check short, because
the server runs it while it holds the lock that accepts the answer.

Anything else is rejected when the form is created, including lookahead and
lookbehind, backreferences, named groups, flags such as `(?i)`, the escapes
`\s`, `\S`, `\D`, `\W`, `\b`, `\B`, `\p` and `\x`, and every other backslash
letter such as `\n` or `\t`. A pattern is at most 200 characters. A malformed
pattern is rejected with `invalid_pattern`, for example an empty pattern, an
unclosed group, class or repeat, a repeat with nothing to repeat or a repeat
that is repeated again, a range out of order, a repeat count with a leading
zero, a literal `{`, `}` or `]` without a backslash, or a control character. A
well-formed pattern outside the accepted syntax or bounds is rejected with
`unsupported_pattern`. The message says what to change.

### Text budget

The `text`, `textarea` and `email` fields of one form can hold at most 16,000
characters together. Each field counts at the most it allows, so a field
without `max_length` counts its default (500 for `text`, 8,000 for
`textarea`), and an `email` counts 254. A definition over the budget is
rejected with `text_budget_exceeded` at the path `fields`, and the message
gives the total. The budget keeps the text, textarea and email answers of one
form, written as UTF-8 the way a browser writes them, inside the 64 KiB request
body limit. It does not count the Other text and the notes of choice fields,
which have their own limits. A client that writes non-ASCII text as JSON escape
sequences can also use up to 12 bytes for a character and not 4. For example,
two textareas that keep their default use the whole budget, so a third text
field cannot be added without lowering their `max_length`.

## Answer values

A client sends one JSON value for each answered question, keyed by field id,
and the server normalizes it before storing it. A question that the user
leaves unanswered is left out, and a value of `null` counts as not sent.

| Type | Sent as | Stored and recorded as |
| --- | --- | --- |
| `choice` | An option value, `{ "value", "note" }`, `{ "other" }`, or a list of those for `multiple` | Unchanged from version 1 (see [Record shape](#record-shape)) |
| `text`, `textarea` | A string | The string exactly as sent |
| `email` | A string | The string without surrounding whitespace, in the case it was typed |
| `number` | A JSON number | An integer when the value is whole (`3.0` becomes `3`), otherwise the shortest decimal that reads back as the same number, written without an exponent (`0.0000001`) |
| `date` | A string `YYYY-MM-DD` | The same string |
| `checkbox` | `true` or `false` | The same boolean |

### Rules by type

An answer that breaks a rule is refused with the code in the right column, and
the whole submission is then rejected with a 422 response and nothing is
stored. The rules of a type run in the order of its rows, and the first
failure is the one reported for the question. One check for `text` and
`textarea` runs before all the others: a value of more than four bytes for each
character that `max_length` allows is refused with `too_long` before the server
reads it as UTF-8 or looks for control characters. An oversized value that also
holds a control character gets `too_long`, not `invalid_text`.

| Type | Rule | Code |
| --- | --- | --- |
| `text`, `textarea` | The value is a string | `invalid_type` |
| `text`, `textarea` | The value is valid UTF-8 and has no control character. A `text` answer allows no tab or line break. A `textarea` answer allows tabs and line feeds (`\n`) and refuses carriage returns. This check comes after the size check in the next row | `invalid_text` |
| `text`, `textarea` | At most `max_length` characters, counted as sent. A value of more than `max_length` times 4 bytes is refused with this code first, before the row above is checked | `too_long` |
| `text`, `textarea` | At least `min_length` characters, checked only when the question is answered | `too_short` |
| `text` | The whole value matches `pattern` | `pattern_mismatch` |
| `email` | The value is a string | `invalid_type` |
| `email` | The value is a valid address (see below), at most 254 characters in all and 64 before the `@` | `invalid_email` |
| `number` | The value is a JSON number. A numeric string such as `"3"` is refused | `invalid_type` |
| `number` | The value is between -1,000,000,000,000 and 1,000,000,000,000 | `invalid_number` |
| `number` | The value is whole when `integer` is `true` | `not_integer` |
| `number` | The value is not below `min` | `below_min` |
| `number` | The value is not above `max` | `above_max` |
| `number` | The value is on the `step` grid | `not_on_step` |
| `date` | The value is a string | `invalid_type` |
| `date` | The value is a real date written exactly `YYYY-MM-DD` in ASCII digits, from year 0001 to 9999. A space, a one digit month or a time is refused | `invalid_date` |
| `date` | The value is not before `min` | `below_min` |
| `date` | The value is not after `max` | `above_max` |
| `checkbox` | The value is `true` or `false`. The text `"true"`, `1` and `"on"` are refused | `invalid_type` |
| `checkbox` | The value is `true` when the field is `required` | `required` |

Text is never trimmed, so an answer keeps its leading and trailing spaces, and
in a `textarea` its blank lines. A control character is an ASCII control
character or DEL, a C1 control (U+0080 to U+009F), a bidirectional override or
isolate (U+202A to U+202E and U+2066 to U+2069), or the line and paragraph
separators U+2028 and U+2029.

An `email` answer is trimmed first. A valid address is ASCII only, and the part
before the `@` is made of letters, digits and ``! # $ % & ' * + / = ? ^ _ ` { | } ~ -``
in groups separated by single dots, with no leading, trailing or doubled dot.
The domain has at least two labels separated by dots, and each label is
letters, digits and hyphens, does not start or end with a hyphen, and has at
most 63 characters. Quoted local parts, comments, address literals, display
names, several addresses and non-ASCII characters are refused, and so is a
control character or line break anywhere. The check says nothing about whether
the mailbox exists.

The `step` check works on the decimal digits of the numbers, with no floating
point arithmetic and no tolerance. With a `step` of 0.1 the value 0.3 is
accepted and 0.25 is refused, and with `min` 0.5 and `step` 0.25 the value
0.75 is accepted. A value cannot have more decimals than its `step` and `min`
allow.

### Unanswered and required questions

An optional `text`, `textarea`, `email` or `date` question is unanswered when
its value is missing, `null`, empty or only whitespace. Whitespace here is
what JavaScript's `String.prototype.trim` removes, which includes the
no-break space and the ideographic space but not the zero width space, so a
value made only of zero width spaces is content. An optional `number` or
`checkbox` is unanswered when its value is missing or `null`. A `false`
checkbox is an answer, and so is the number 0.

A required question that is unanswered fails with `required`. A required
`checkbox` that is `false` fails with `required` as well, because consent
means the box is ticked. A control character in a `text` value is reported
before the value is judged blank, so a value that is only a line break is
`invalid_text` and not `required`.

## Form versions

A form's version follows its definition. A form whose fields are all `choice`
is version 1, and a form with any other field is version 2, whether or not it
also holds choices. The version is stored with the form, returned as
`form_version` by the state API, and written into the answer record. A
version 1 form is stored, answered and recorded exactly as it was before the
standard fields existed, so existing forms are unchanged.

The version does not depend on the tool that asked the form. `ask_user` always
creates a version 1 form, because it takes only choice fields. `ask_user_fields`
creates a version 1 form when every field is a choice, and a version 2 form
otherwise. The Host, the `wippy-form` component and the answer record work the
same way for forms from both tools.

A submission names the version of the form it answers. Sending
`form_version: 1` for a version 2 form, or `form_version: 2` for a version 1
form, is rejected with 400 `invalid_request` before any answer is validated.

| Reader | Version 1 form | Version 2 form |
| --- | --- | --- |
| Current Session and current `wippy-form` | Question card | Form of fields |
| `wippy-form` from a release before version 2 | Question card | The notice "This form needs a newer version of the app." No fields and no Submit button |
| `wippy/session` release before version 2 | Works as before | `GET` and `POST` of the state API answer 400 `not_a_form` ("Unsupported form version"), and `read_form` returns the tool error "Not a form: Unsupported form version" |

A version 2 form needs no Web Host release beyond the one that version 1
needs, because the controls ship inside the `wippy-form` bundle. The bundle is
part of the `wippy/session` module, so rolling the module back to a release
from before version 2 brings back an older component and an older state API
together (see [Disabling and rolling back](#disabling-and-rolling-back)).

A current Session serves a current `wippy-form` bundle, so an older component
can meet a current Session only through a stale cached bundle, for example in a
browser or a Host that still holds the earlier file. It then shows the notice
for a version 2 form until the bundle is fetched again.

## What the agent receives

The user answers on a question card or a form of fields. The accepted answer
becomes one ordinary user message, built entirely on the server, and the
browser never supplies its text. The message has exactly one visible line,
followed by an invisible carrier element that holds the full answer as JSON:

```text
Answered questions about the delivery of your order.

<wippy-form-answers record='{"form_id":"<artifact-id>","form_version":1,"title":"Order details","late":false,"answers":{"delivery":{"question":"How should the parcel be delivered?","answer":{"value":"courier","label":"Courier","note":"Buzzer 12, back entrance"}},"extras":{"question":"Any extras for this order?","answer":[{"value":"gift_wrap","label":"Gift wrap"},{"other":"Remove the price tag"}]},"when":{"question":"When works best for delivery?","answer":null}}}'>
</wippy-form-answers>
```

The user sees only the first line, which is the `answered_message` the agent
supplied when it called `ask_user` or `ask_user_fields` (or the
`Answered “<title>”.` fallback).
The `wippy-form-answers` element renders nothing, so the record never appears
in the chat. The agent reads the raw message text, including the record
attribute, on its next turn.

### Record shape

The record is self-contained, so an agent can act on it without the original
tool call, which a checkpoint may have summarized away. For each
question id, `answers[id]` has a `question` (the field's label) and an
`answer`:

| Answer shape | When |
| --- | --- |
| `{"value": "courier", "label": "Courier"}` | A chosen option |
| `{"value": "courier", "label": "Courier", "note": "…"}` | A chosen option with the user's own note, at most 1,000 characters |
| `{"other": "…"}` | The user's own free-text answer, at most 2,000 characters |
| `[ ...one of the above... ]` | A multiple-selection question, in definition order, with an "Other" entry (if any) last |
| `"Ann Lee"` | A `text`, `textarea`, `email` or `date` answer, as the stored string. Line breaks in a textarea are the JSON escape `\n` |
| `3`, `0.5` | A `number` answer, as the stored number. An integer when the value is whole, and never written with an exponent |
| `true`, `false` | A `checkbox` answer. An unchecked optional box that the form sent as `false` is `false`, not `null` |
| `null` | The question was left unanswered (only possible when not required) |

The record also carries `form_id`, `form_version` (1 for a form of choices
only and 2 for a form with a standard field), `title` and `late`. The `late`
value is `false` unless the answer was late (see below). A late answer has
`"late": true` and adds a `late_notice`.

The stored submission keeps only the normalized answer values. The record is
derived from those values and the immutable definition on every read, so the
record in the answer message and the one `read_form` returns for the same form
always agree.

The following record is for a version 2 form that asked a text, an email, a
number, a date and a checkbox question, where the user left the date
unanswered:

```json
{
  "form_id": "<artifact-id>",
  "form_version": 2,
  "title": "Delivery details",
  "late": false,
  "answers": {
    "name": { "question": "Your name", "answer": "Ann Lee" },
    "email": { "question": "Email", "answer": "ann@example.org" },
    "parcels": { "question": "Parcels", "answer": 3 },
    "ready": { "question": "Ready on", "answer": null },
    "terms": { "question": "I agree", "answer": true }
  }
}
```

In the message the record is written on one line inside the `record`
attribute, as shown above.

## Late answers and the fresh-confirmation rule

A form's staleness and its late flag serve different purposes and are tracked
separately.

While a form is unanswered, it is stale when a different real user input (a
typed message, or a submission to another form) was durably accepted after the
form was created. Staleness is evaluated live, every time the form state is
read. Assistant text, system events, tool results, and validation failures
never make a form stale.

Once a form is answered, the acceptance transaction evaluates staleness one
final time against the same rule and freezes the result as the submission's
late flag. The flag does not change afterward, no matter what the conversation
does later. A late answer's record carries `"late": true` and:

```text
late_notice: "The conversation moved on before this answer. Use it as context and ask for fresh confirmation before acting on the earlier request."
```

A form submission is never an authorization token for the action it was
originally asked about. The agent must still get explicit confirmation before
acting on a late answer, and any action tool that needs authorization must
enforce that itself, because the forms feature only records what the user
chose.

## `read_form` and the form index

`read_form` takes a `form_id` (from the form index or an answer message) and
returns the state of one form belonging to the calling session. A form from
another session is not visible. The result depends on the form's state:

| `status` | Result |
| --- | --- |
| `unanswered` | `{ status, form_id, title, questions }`, where each question carries its options, and in a version 2 form also its `type`, limits and default, so an agent that lost the original tool result can restate them |
| `answer_pending` | `{ status, form_id, title, note }`. The user answered, but the answer has not been admitted into the session's history yet (see below). No answer values are returned, and the `note` tells the agent to wait for the answer to arrive as a user message |
| `answered` | `{ status, answered_at, form }`, where `form` is the self-contained record described above |

The questions of an unanswered version 2 form name each question's type and
the limits an answer must meet. A choice-only form keeps its version 1
description, without `type`. Each question lists `required`, then the limits of
its type. A `text` or `textarea` always lists `min_length` and `max_length`, a
`number` always lists `integer`, and every other key appears only when the
definition sets it:

```json
{
  "status": "unanswered",
  "form_id": "<artifact-id>",
  "title": "Delivery details",
  "questions": {
    "name": { "question": "Your name", "type": "text", "required": true, "min_length": 0, "max_length": 40, "pattern": "[A-Za-z ]+", "default": "Ann" },
    "parcels": { "question": "Parcels", "type": "number", "required": false, "integer": true, "min": 1, "max": 10, "step": 1, "default": 2 },
    "ready": { "question": "Ready on", "type": "date", "required": false, "min": "2026-01-01", "max": "2026-12-31" },
    "terms": { "question": "I agree", "type": "checkbox", "required": true, "default": false }
  }
}
```

Every agent, with or without a Session Forms trait, also gets a bounded,
deterministic index of the session's forms in its prompt. The index is rebuilt
from the stored forms on every prompt build, so it cannot drift from them, and
it does not depend on a checkpoint having kept any form ids or values.

```text
Session forms (index; exact answers are in the answer messages and can be read with read_form when available):
- unanswered: "Delivery preference" form_id=... asked=...
- answer pending (arrives as a later user message): "Extras" form_id=... asked=...
- answered: "Order details" form_id=... answered=... late=false answer_message_id=...
(2 more unanswered and 1 more answered forms not listed)
```

The index lists up to 8 unanswered or pending forms (newest first) and up to 4
answered forms (most recently answered first), bounded to 8 KiB, and it
reports how many were omitted.

## How answers are admitted

Submitting an answer commits it together with the user message in one
transaction, so the stored row, and not the wake-up of the session process,
makes delivery durable. A form answer is never steered into a running turn,
whatever the steering setting. Typed input follows the session's steering
setting.

| When the answer is accepted | What happens |
| --- | --- |
| The session is idle | The answer is admitted at once, and a new turn starts |
| A turn is running | The answer is pending, and `read_form` reports `answer_pending`. It is admitted when the turn ends, in acceptance order together with any typed input the session held during the turn |
| The user pressed Stop | Stop cancels the turn's in-flight model and tool calls. The answer is admitted into the history and no turn starts. The same happens when the session plugin has to cancel or terminate a session that does not stop in time |
| The session is finishing, or its process is not running | The answer stays pending until the process starts again. The session plugin starts stopped sessions that hold pending answers |

Once admitted, the answer's message is dated at the moment of admission, so
its place in the visible history follows admission order. The `submitted_at`
value that the artifact-state API returns keeps the original acceptance time.

## Security notes

The server builds the answer message from the immutable definition and the
validated, normalized answers. The browser sends only answers keyed by field
id, never message text. User text (an "Other" answer, a note, or the value of a
`text`, `textarea` or `email` field) is JSON-escaped data inside the record,
and the server escapes `'`, `<`, `>`, and `&` in the record, so user text
cannot end the attribute, close the tag, or add markup. The checks that the
state endpoint applies to every request are listed in
[The artifact-state HTTP API](../frontend/micro-frontends/session-forms.md#the-artifact-state-http-api).

## Upgrading

The `wippy/session` release that adds Session Forms has these breaking changes.
<!-- TODO: name the Session version here when the release PR exists. -->

- **New `ui_server` requirement.** The module serves the form components from
  an HTTP server. The requirement `wippy.session.forms.ui:ui_server` defaults
  to `app:gateway`. If your app's HTTP server has another name, set the
  requirement to that name. If you do not, the static routes of the form
  component break.
- **Minimum Web Host.** The question card needs Wippy Web Host 1.0.65 or
  newer. See
  [Host requirement](../frontend/micro-frontends/session-forms.md#host-requirement).
- **Foreign artifacts return 404.** Reading an artifact that belongs to
  another user now returns 404, as for a missing artifact. It used to return
  403.
- **Stop settles the session idle.** When an enforced Stop ends a turn, the
  session is stored idle and `can_send` is true.
- **A stored `running` status reads as idle.** If no session process is
  alive, a session stored as `running` is reported as idle.
- **Dates are stored and returned in UTC.**
- **`reader:list_pending_inputs` is removed.** The `reader` library no longer
  has this method. Code that calls it must use another way to read pending
  inputs.

## Disabling and rolling back

To stop new forms, remove `wippy.session.forms:ask_user` or
`wippy.session.forms:ask_user_fields` from an agent's `traits` list. To stop
new forms with standard fields and keep choice questions, replace
`ask_user_fields` with `ask_user`.

- Open (unanswered) forms stay answerable. The state API's read and write
  checks are session-ownership checks and not trait checks, so a form asked
  before the trait was removed can still be submitted afterward.
- Answered forms stay readable, with or without the trait on any agent. An
  answered form is an ordinary artifact plus an ordinary user chat message,
  and `read_form` and the form index work the same for every agent.
- Do not downgrade `wippy/session` below the release that shipped Session
  Forms while form artifacts exist. The module registers the `wippy-form` and
  `wippy-form-answers` components, and an older module can fail to start with
  `failed to load state: unresolved dependencies after retry: …`.
- Rolling back to a release from before version 2 makes every version 2 form
  unusable. The earlier release accepts only form version 1, and it compares
  the stored version exactly. The state API answers 400 `not_a_form` for a
  version 2 form on `GET` and on `POST`, `read_form` returns an error for it,
  and the older component shows "This form needs a newer version of the app."
  in place of the form. An open version 2 form therefore cannot be answered
  until the module is upgraded again. Version 1 forms keep working. Answers
  that were already accepted stay in the chat as ordinary messages, and the
  prompt's form index keeps listing every form by title, because it reads only
  titles and ids. The rollback does not convert version 2 forms. Before a
  rollback, have users answer the open version 2 forms, and switch every agent
  with `ask_user_fields` to `ask_user` or remove the trait. A release from
  before version 2 has no `ask_user_fields` trait, so an agent that still
  references it fails to resolve at lint time.

## Error codes

Every rejection carries a stable `code`, the path of the key or the id of the
question, and a plain `message`. A message about an answer never repeats the
answer, although `unknown_field` names the key that the client sent. A message
about a definition can name the key, the field id or the option that is at
fault, as `duplicate_id`, `duplicate_option` and `unknown_key` do.

### Definition errors

`ask_user` and `ask_user_fields` return the problems of a definition as a tool
error with one line for each, in the form `path: code: message`. Array positions in a path start
at 0, and a problem with the whole definition has the path `(definition)`.
Nothing is stored when any problem is found.

```text
Invalid form definition:
fields[1].pattern: unsupported_pattern: Lookaround, named groups and flags are not supported. Only (?: ) groups are.
fields[2].step: invalid_step: Must be more than zero.
```

| Code | When |
| --- | --- |
| `required` | A required key is missing: `title`, `fields`, or a field's `id`, `type` or `label`, or the `options` of a `choice` field |
| `invalid_type` | A value has the wrong JSON type, including a length key that is not a whole number |
| `unknown_key` | A key the form or the field's type does not take |
| `unsupported_type` | `type` is not one of the seven names, or the tool does not take it, because `ask_user` takes only `choice`. Names are case sensitive. The message lists the types that the tool takes: `Supported types: choice.` from `ask_user`, for a standard field or a name that is not a type at all, and all seven names from `ask_user_fields`. This is the only error reported for the type of that field, so a field of an unknown type is not also told that it needs `options` |
| `invalid_id`, `duplicate_id` | A field id breaks the id rule, or is used twice |
| `blank` | A required text, `submit_label` or `answered_message` has no visible character |
| `control_characters`, `invalid_text` | Definition text has a control character (only descriptions may hold tabs and line feeds), or is not valid UTF-8 |
| `too_long` | Definition text is over its limit |
| `too_few`, `too_many`, `duplicate_option` | `fields` or `options` is an empty list (a missing list is `required`), a list is over 20, or an option is repeated |
| `too_large` | The normalized definition is over 32 KiB |
| `invalid_range` | A limit is outside its allowed range: a length, a `min_length` above `max_length`, a `min` or `max` over 1,000,000,000,000 or with more than 6 decimals, a `min` above `max`, an `integer` number with no whole number between `min` and `max`, or a date bound that is not a real date |
| `invalid_step` | A `step` that is not above 0, is over 1,000,000,000,000, has more than 6 decimals, or is not whole on an `integer` number (the same when `min` is not whole) |
| `invalid_pattern` | A malformed `pattern`, including a literal `{`, `}` or `]` without a backslash and a repeat count with a leading zero |
| `unsupported_pattern` | A well-formed `pattern` outside the accepted syntax or bounds |
| `invalid_default` | A `default` that is not a valid answer for its field |
| `default_not_allowed` | A `checkbox` with the default `true` |
| `text_budget_exceeded` | The text fields of the form can hold more than 16,000 characters together |

### Answer errors

Answer codes are returned in the 422 response of the state API. The codes and
the response shape are listed with the
[artifact-state HTTP API](../frontend/micro-frontends/session-forms.md#validation-errors-422).
The rules that produce each code are in [Rules by type](#rules-by-type).

## Verifying

Create or use an agent with the `wippy.session.forms:ask_user` trait, start a
session, and prompt it to ask a question that needs a decision. The question
card should appear in the chat. Answering it should produce a chat message
with exactly one visible sentence, and the agent's next turn should reference
the answer correctly, for example by calling `read_form` or by acting on the
choice.

To check late-answer handling, send a plain chat message after the form is
created and before answering it, and then answer. The record should carry
`"late": true`, and the agent should ask for confirmation before acting on the
original request.

To check that `ask_user` stays limited to choices, prompt the same agent to ask
for an email address. It can ask with a choice question or in plain text, but
no form of fields should appear. If the agent sends a standard field anyway,
the tool error names `unsupported_type` and `Supported types: choice.`.

To check the standard fields, give an agent the
`wippy.session.forms:ask_user_fields` trait, and prompt it for a form with a
name (`text` with a `pattern`), an email address, a whole number with a minimum
and a maximum, a date with a range, a `textarea`, and a required `checkbox`.
Then confirm each of the following.

1. The form of fields appears with one control for each question and one
   Submit button. Submitting it empty names the required questions and focuses
   the first one.
2. An invalid email address, a number above the maximum, a date outside the
   range and an unticked required checkbox each show an error on their own
   question when the user submits, and nothing is accepted.
3. A value that does not match the `pattern` shows its error only after the
   request returns, because the server is the only place that checks patterns.
4. After a valid submission the form switches to its read-only view, the chat
   shows one visible sentence, and the agent's next turn uses the answers.
   When the agent calls `read_form` with the form's id, the result holds
   `"form_version":2` and the answers as strings, numbers and `true` or
   `false`, with `null` for a question the user skipped.
5. After a page reload the read-only view shows the same values: a number as
   digits, a date as `YYYY-MM-DD`, a checkbox as Yes or No, and "Skipped" for
   an unanswered question.

## See also

- [Session Forms (frontend)](../frontend/micro-frontends/session-forms.md): the `wippy-form` and `wippy-form-answers` components, the artifact-state HTTP API, and the `artifactState` proxy client
- [Agents](agents.md): traits, tools, and agent definitions in general
