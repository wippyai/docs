---
title: "Web Components (view.component)"
description: "Ein view.component-Eintrag beschreibt ein wiederverwendbares Custom Element (Web Component), das der Web Host automatisch entdecken, injizieren und registrieren kann. Anders als eine…"
---

# Web Components (view.component)

Ein `view.component`-Eintrag beschreibt ein wiederverwendbares Custom Element (Web Component), das der Web Host automatisch entdecken, injizieren und registrieren kann. Anders als eine Page hat eine Komponente keinen eigenen iframe — sie ist ein eigenes HTML-Tag, das überall dort erscheinen kann, wo das Template einer Page oder des Hosts es platziert.

Hinweise zum Schreiben der Komponentenimplementierung finden Sie unter [Web Component](../micro-frontends/web-component.md).

## Frontend-Felder (wippy-Block in package.json)

Diese Felder werden von der FE-Entwicklung im `wippy`-Block der `package.json` gepflegt. Das Vite-Plugin backt sie zur Build-Zeit in `wippy-meta.json`, und `wippy/views` liest sie von dort als Defaults.

> **Alle Felder in diesem Abschnitt können vom Betreiber in `_index.yaml` überschrieben werden. YAML hat immer Vorrang.**

| Feld | Typ | Default | Beschreibung |
|---|---|---|---|
| `type` | string | — | Muss `"component"` oder `"widget"` sein; `"widget"` ist die Template-Konvention |
| `tagName` | string | — | Name des Custom Elements; muss laut HTML-Spezifikation einen Bindestrich enthalten |
| `props` | object | — | JSON Schema, das die von der Komponente akzeptierten Attribute beschreibt |
| `events` | object | — | JSON Schema, das die von der Komponente ausgelösten Custom-DOM-Events beschreibt |

### `wippy.type` in `package.json`

Web-Component-Packages setzen `"type": "widget"` oder `"type": "component"` (nicht `"page"`) in ihrem `wippy`-Block. Das App-Template verwendet derzeit `"widget"`, und das Vite-Plugin akzeptiert für diesen Runtime-Vertrag beide Komponentennamen.

```json
{
  "specification": "wippy-component-1.0",
  "wippy": {
    "tagName": "example-reaction-bar",
    "type": "widget",
    "props": { ... },
    "events": { ... }
  }
}
```

Zur Deploy-Zeit ist das YAML-`meta.tag_name` des Betreibers maßgeblich und überschreibt den mitgelieferten Wert; `wippy.tagName` (aus `package.json` in `wippy-meta.json` gebacken) ist nur der Fallback, den `wippy/views` verwendet, wenn der YAML-Eintrag `tag_name` weglässt (Auflösungsreihenfolge: YAML `meta.tag_name` → mitgeliefertes `wippy.tagName`). Halten Sie beide synchron, um Überraschungen zu vermeiden, aber bei Abweichung gewinnt das YAML.

### Props-Schema

Der Key `wippy.props` in `package.json` ist ein JSON-Schema-Objekt, das die von der Komponente akzeptierten Attribute beschreibt. Das Vite-Plugin nimmt es in `wippy-meta.json` auf, und der Web Host nutzt es, wenn er Komponenten-Metadaten an Konsumenten wie den Chat-Artifact-Renderer und den Tag-Sanitizer weitergibt (der wissen muss, welche Attribute legitim sind, damit er sie nicht entfernt).

```json
{
  "wippy": {
    "props": {
      "type": "object",
      "properties": {
        "reactions": {
          "type": "array",
          "items": { "type": "string" },
          "default": ["👍", "👎", "❤️", "🎉", "🤔"],
          "description": "Array of emoji reactions to display"
        },
        "allow-multiple": {
          "type": "boolean",
          "default": false,
          "description": "Whether multiple reactions can be active simultaneously"
        }
      }
    }
  }
}
```

Attributnamen in `properties` folgen der HTML-Attributkonvention (kebab-case). Die `default`-Werte des Schemas werden zur Laufzeit auch vom Prop-Parser der Web Component angewendet, wenn ein Attribut fehlt.

### Events-Schema

Der Key `wippy.events` spiegelt die Form von props, beschreibt aber Custom-DOM-Events, die die Komponente über `useEvents()` auslöst. Jeder Key ist ein Event-Name; der Wert ist ein JSON Schema für die Detail-Payload des Events.

```json
{
  "wippy": {
    "events": {
      "type": "object",
      "properties": {
        "reaction": {
          "type": "object",
          "properties": {
            "emoji": { "type": "string" },
            "count": { "type": "number" },
            "active": { "type": "boolean" }
          },
          "description": "Fired when a reaction is toggled"
        }
      }
    }
  }
}
```

Der Chat-Message-Sanitizer des Web Hosts setzt Komponentenattribute aus `props.properties` in `wippy-meta.json` auf die Allowlist. Event-Schemas dokumentieren ausgelöste Custom Events für Tooling und Konsumenten; sie werden nicht dazu verwendet, Attribute für DOM-Event-Listener durch sanitisierte Chat-Inhalte zu lassen.

## Betreiber-Konfiguration (_index.yaml)

Diese Felder setzt der Betreiber im `meta`-Block des `_index.yaml`-Registry-Eintrags. Die meisten sind reine Deployment-Policy — Routing, Zugriffskontrolle und Auslieferung —, die nur zur Deploy-Zeit sinnvoll ist und keine Autorenfläche in `package.json` hat (`announced`, `secure`, `url`, `auto_register`). Zwei Felder, `tag_name` und `entry_point`, sind anders: Sie werden **von der FE-Entwicklung** in `package.json` gepflegt (und in `wippy-meta.json` gebacken), und die YAML-Keys sind nur **optionale Overrides pro Deployment** für diese mitgelieferten Werte.

> **`announced`, `secure`, `url` und `auto_register` sind reine Deployment-Policy und können nicht in package.json gesetzt werden — sie werden vom Betreiber für jede Umgebung gesetzt. `tag_name` und `entry_point` sind von der FE-Entwicklung gepflegte Defaults, die der Betreiber im YAML überschreiben darf.**

| Feld | Typ | Default | Beschreibung |
|---|---|---|---|
| `tag_name` | string | `wippy.tagName` | Von der FE-Entwicklung als `wippy.tagName` in `package.json` gepflegt (vom Vite-Plugin verlangt); der YAML-Key überschreibt den mitgelieferten Wert. Name des Custom Elements; muss laut HTML-Spezifikation einen Bindestrich enthalten |
| `announced` | boolean | `false` | Muss `true` sein, damit die Komponente in `/api/public/components/list` erscheint. Fällt auf `meta.public` zurück, falls gesetzt. |
| `auto_register` | boolean | `false` | `true` → Web Host lädt die Komponente beim Start automatisch und registriert sie |
| `secure` | boolean | `false` | Erfordert Authentifizierung |
| `url` | string | — | Statischer Mount-Pfad für das gebaute Bundle der Komponente |
| `base_path` | string | `""` | Optionaler Unterpfad, der an `url` angehängt wird, um das Projekt-Root zu bilden; die aufgelöste Bundle-URL setzt sich als `<url>/<base_path>/<entry_point>` zusammen. Wird identisch zu Pages berücksichtigt, auch wenn aktuelle Komponenteneinträge des App-Templates es weglassen |
| `entry_point` | string | `wippy.browser` → `index.js` | Von der FE-Entwicklung als Top-Level-Feld `browser` in `package.json` gepflegt (in `wippy-meta.json` gebacken); der YAML-Key überschreibt den mitgelieferten Wert, mit Fallback auf `index.js`. Entry-Modul-Datei; der Host injiziert sie als `<script type="module">` |

Ein minimaler Eintrag sieht so aus:

```yaml
- name: reaction-bar
  kind: registry.entry
  meta:
    type: view.component
    name: reaction-bar
    tag_name: example-reaction-bar
    announced: true
    secure: false
    auto_register: true
    url: /app/wc/reaction-bar
    entry_point: index.js
```

## Die drei Tore für den Autoload

Damit der Web Host eine Komponente automatisch lädt, müssen alle drei Bedingungen gleichzeitig gelten:

1. **`announced: true`** — `wippy/views` filtert serverseitig in `list_components.lua` nach diesem Flag. Es gibt keinen Query-Parameter, um das zu umgehen. Eine Komponente mit `announced: false` erscheint unabhängig von jeder anderen Einstellung nie in `/api/public/components/list`.

2. **`auto_register: true`** — die Host-Funktion `loadGlobalAutoloadWidgets` fragt den List-Endpoint mit `?auto_register=true` ab. Komponenten ohne dieses Flag sind aus dieser gefilterten Antwort ausgeschlossen.

3. **Das Tag ist noch nicht registriert** — bevor der Host das Skript injiziert, prüft er `customElements.get(tagName)`. Ist das Tag bereits definiert (z. B. von einer vorherigen Navigation), überspringt der Host die Injection, um eine doppelte Definition zu vermeiden.

Fehlt eines der Tore, ist die Komponente stillschweigend abwesend. Zur Überprüfung: `curl /api/public/components/list?auto_register=true` — Ihr Tag muss in der Antwort erscheinen.

## Die Autoload-Sequenz

Wenn eine Page innerhalb des Web Hosts fertig gemountet ist, führt der Host folgende Sequenz aus:

1. `GET /api/public/components/list?auto_register=true` — holt alle angekündigten, sich automatisch registrierenden Komponenten.

2. Für jede Komponente, deren `customElements.get(tagName)` `undefined` ist, hängt der Host an `document.head` an:

   ```html
   <script type="module" src="/app/wc/reaction-bar/index.js?declare-tag=example-reaction-bar"></script>
   ```

   Der Query-Parameter `?declare-tag=` ist der Kanal, der dem Entry-Chunk mitteilt, unter welchem Custom-Element-Namen er sich registrieren soll.

3. Der Entry-Chunk ruft `define(import.meta.url, ElementClass)` auf. Komponentenautoren importieren `define` aus `@wippy-fe/webcomponent-vue` (oder `@wippy-fe/webcomponent-core`), die das `define` des Proxys re-exportieren; zur Laufzeit löst die Import Map es auf die eine `@wippy-fe/proxy`-Instanz auf. Der Helfer `define` liest `new URL(import.meta.url).searchParams.get('declare-tag')` und ruft `customElements.define(tagName, ElementClass)` auf.

4. Vue (oder ein beliebiges Framework) rendert ein `<example-reaction-bar>`-Element. Der Browser upgradet das Element, `connectedCallback` feuert, und `WippyVueElement` mountet seine Vue-App in einem Shadow Root.

## Warum `auto_register: false` nützlich ist

`auto_register: false` schließt die Komponente vom globalen Autoload-Durchlauf aus. Das ist angebracht, wenn:

- Die Komponente groß ist und nur auf Pages laden soll, die sie ausdrücklich benötigen.
- Die Komponente programmatisch über `loadByTagName('example-heavy-chart')` (importiert aus `@wippy-fe/proxy`) an der Aufrufstelle registriert wird.
- Die Komponente ein internes Bauteil ist, das nur innerhalb eines anderen Bundles genutzt wird und nicht als eigenständiges Custom Element.

```ts
import { loadByTagName } from '@wippy-fe/proxy'

await loadByTagName('example-heavy-chart')
```

Verzögerte Registrierung hält das initiale Laden der Seite leichtgewichtig. Die Komponente braucht weiterhin `announced: true`, damit `loadByTagName()` sie über die API auflösen kann — der Endpoint `GET /components/by-tag/{tag}` liefert `404 "Component is not announced"`, wenn das Flag `false` ist.
