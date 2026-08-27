---
title: "Web Components (view.component)"
description: "Referenz zum Deklarieren, Ausliefern und Registrieren eines wiederverwendbaren Custom Elements vom Typ view.component im Web Host."
---

# Web Components (view.component)

Ein `view.component`-Eintrag beschreibt ein wiederverwendbares Custom Element, das der Web Host finden, injizieren und automatisch registrieren kann. Anders als eine Seite besitzt eine Komponente keinen eigenen iframe. Sie ist ein benutzerdefiniertes HTML-Tag, das überall erscheinen kann, wo eine Seite oder Hostvorlage es platziert.

Hinweise zur Implementierung finden Sie unter [Web Component](../micro-frontends/web-component.md).

## Frontend-Felder (Block wippy in package.json)

Diese Felder erstellt der Frontend-Entwickler im Block `wippy` von `package.json`. Das Vite-Plugin schreibt sie zur Buildzeit in `wippy-meta.json`; `wippy/views` liest sie dort als Standardwerte.

> **YAML kann `tagName`, `props` und `events` über `meta.tag_name`, `meta.props` und `meta.events` überschreiben.** Die Buildkonfiguration wählt `wippyComponentPlugin()`. Das optionale Paketfeld `type` ist ein Metadatum, das das ausgewählte Plugin validiert, wenn es vorhanden ist; es besitzt keine separate YAML-Überschreibung.

| Feld | Typ | Standardwert | Beschreibung |
|------|-----|--------------|--------------|
| `type` | string | `"widget"` im Laufzeitdeskriptor | Optional; falls vorhanden, muss es `"component"` oder `"widget"` sein. Die Buildkonfiguration, nicht dieses Feld, wählt das Vite-Plugin |
| `tagName` | string | — | Name des Custom Elements. Plugin 0.0.56 verlangt einen kleingeschriebenen ASCII-Namen, der mit einem Buchstaben beginnt, einen Bindestrich enthält, nur Buchstaben/Ziffern/Bindestriche verwendet und kein reservierter HTML-Custom-Element-Name ist |
| `props` | object | — | JSON Schema der akzeptierten Attribute |
| `events` | object | — | JSON Schema der ausgegebenen benutzerdefinierten DOM-Ereignisse |

### `wippy.type` in `package.json`

Web-Component-Pakete dürfen in ihrem Block `wippy` `"type": "widget"` oder `"type": "component"` setzen, nicht `"page"`. Das Anwendungstemplate verwendet `"widget"`; das Komponenten-Plugin akzeptiert beide Werte oder ein weggelassenes Feld und weist Page-Metadaten zurück.

```json
{
  "specification": "wippy-component-1.0",
  "wippy": {
    "tagName": "example-reaction-bar",
    "type": "widget",
    "props": {
      "type": "object",
      "properties": {}
    },
    "events": {
      "type": "object",
      "properties": {}
    }
  }
}
```

Beim Deployment ist `meta.tag_name` in der Betreiber-YAML maßgeblich und überschreibt den gebündelten Wert. `wippy.tagName`, das aus `package.json` in `wippy-meta.json` geschrieben wurde, ist der Fallback, wenn der YAML-Eintrag `tag_name` weglässt. Die Auflösungsreihenfolge lautet YAML `meta.tag_name` → gebündeltes `wippy.tagName`. Halten Sie beide Werte synchron; bei Abweichungen gewinnt YAML.

### Props-Schema

Der Schlüssel `wippy.props` in `package.json` ist ein JSON-Schemaobjekt, das die akzeptierten Attribute der Komponente beschreibt. Das Vite-Plugin nimmt es in `wippy-meta.json` auf. Der Web Host verwendet es, wenn er Komponentenmetadaten für Konsumenten wie den Chat-Artefakt-Renderer und den Tag-Sanitizer bereitstellt; dieser muss zulässige Attribute kennen, damit er sie nicht entfernt.

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

Attributnamen in `properties` folgen der HTML-Attributkonvention in Kebab Case. Die `default`-Werte des Schemas werden vom Web-Component-Props-Parser auch zur Laufzeit verwendet, wenn ein Attribut fehlt.

### Ereignisschema

Der Schlüssel `wippy.events` spiegelt die Props-Form, beschreibt jedoch benutzerdefinierte DOM-Ereignisse, die die Komponente mit `useEvents()` ausgibt. Jeder Schlüssel ist ein Ereignisname; sein Wert ist ein JSON Schema für den Detail-Payload des Ereignisses.

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

Der Chat-Message-Sanitizer des Web Hosts setzt Komponentenattribute aus `wippy.props.properties` des projizierten Deskriptors auf die Allowlist. Registry-`meta.props` überschreibt den gebündelten Wert `wippy.props`, bevor der Deskriptor den Host erreicht. Ereignisschemas dokumentieren ausgegebene benutzerdefinierte Ereignisse für Werkzeuge und Konsumenten; sie erlauben keine DOM-Event-Listener-Attribute in bereinigten Chatinhalten.

## Betreiberkonfiguration (_index.yaml)

Diese Felder setzt der Betreiber im Block `meta` des Registry-Eintrags in `_index.yaml`. Die meisten sind reine Deployment-Richtlinien für Routing, Zugriffskontrolle und Auslieferung, die nur zur Deploymentzeit sinnvoll sind und keine Autorenschnittstelle in `package.json` besitzen: `announced`, `secure`, `url`, `auto_register`. Zwei Felder unterscheiden sich: `tag_name` und `entry_point` werden im Frontend in `package.json` erstellt und in `wippy-meta.json` geschrieben; ihre YAML-Schlüssel sind nur optionale Deployment-Überschreibungen dieser gebündelten Werte.

| Feld | Typ | Standardwert | Beschreibung |
|------|-----|--------------|--------------|
| `tag_name` | string | `wippy.tagName` | Im Frontend als `wippy.tagName` in `package.json` erstellt und vom Vite-Plugin verlangt; YAML überschreibt den gebündelten Wert. Halten Sie die Überschreibung browsergültig und mit dem Plugin-sicheren Autorennamen synchron |
| `announced` | boolean | `false` | Muss `true` sein, damit die Komponente in `/api/public/components/list` erscheint. Fällt auf `meta.public` zurück, wenn dieses gesetzt ist |
| `auto_register` | boolean | `false` | `true` → Web Host lädt und registriert die Komponente beim Start automatisch |
| `secure` | boolean | `false` | Erfordert Authentifizierung |
| `url` | string | — | Statischer Mountpfad des gebauten Komponenten-Bundles |
| `base_path` | string | `""` | Optionaler Unterpfad, der an `url` angehängt wird, um den Projekt-Root zu bilden; die Bundle-URL lautet `<url>/<base_path>/<entry_point>`. Wird wie bei Seiten berücksichtigt, obwohl aktuelle Komponenten des Anwendungstemplates ihn weglassen |
| `entry_point` | string | `wippy.browser` → `index.js` | Im Frontend als oberstes Feld `browser` in `package.json` erstellt und in `wippy-meta.json` geschrieben; YAML überschreibt den gebündelten Wert, Fallback ist `index.js`. Der Host injiziert dieses Entry-Modul als `<script type="module">` |

Minimaler Eintrag:

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

## Die drei Voraussetzungen für Autoload

Damit der Web Host eine Komponente automatisch lädt, müssen alle drei Bedingungen gleichzeitig erfüllt sein:

1. **`announced: true`** — `wippy/views` filtert serverseitig in `list_components.lua` nach diesem Flag. Es gibt keinen Query-Parameter, der dies umgeht. Eine Komponente mit `announced: false` erscheint unabhängig von anderen Einstellungen nie in `/api/public/components/list`.
2. **`auto_register: true`** — die Hostfunktion `loadGlobalAutoloadWidgets` fragt den Listenendpunkt mit `?auto_register=true` ab. Komponenten ohne dieses Flag fehlen in der gefilterten Antwort.
3. **Das Tag ist noch nicht registriert** — vor dem Injizieren des Scripts prüft der Host `customElements.get(tagName)`. Ist das Tag bereits definiert, etwa durch eine vorherige Navigation, überspringt der Host die Injektion, um keine doppelte Definition zu erzeugen.

Fehlt eine Voraussetzung, bleibt die Komponente stillschweigend aus. Prüfen Sie mit `curl /api/public/components/list?auto_register=true`; Ihr Tag muss in der Antwort erscheinen.

## Autoload-Ablauf

Während der Laufzeitinitialisierung des Web Hosts führt jeder Kontext, der globales Autoload besitzt, diesen Ablauf einmal aus. Er wird nicht nach jedem Page-Mount ausgelöst:

1. `GET /api/public/components/list?auto_register=true` ruft alle angekündigten, automatisch registrierten Komponenten ab.
2. Für jede Komponente, deren `customElements.get(tagName)` `undefined` ist, hängt der Host Folgendes an `document.head` an:

   ```html
   <script type="module" src="/app/wc/reaction-bar/index.js?declare-tag=example-reaction-bar"></script>
   ```

   Der Query-Parameter `?declare-tag=` teilt dem Entry-Chunk mit, unter welchem Custom-Element-Namen er registrieren soll.
3. Der Entry-Chunk ruft `define(import.meta.url, ElementClass)` auf. Komponentenautoren importieren `define` aus `@wippy-fe/webcomponent-vue` oder `@wippy-fe/webcomponent-core`; beide re-exportieren `define` des Proxys. Zur Laufzeit löst die Import Map es zur einzigen Instanz von `@wippy-fe/proxy` auf. Der Helper liest `new URL(import.meta.url).searchParams.get('declare-tag')` und ruft `customElements.define(tagName, ElementClass)` auf.
4. Vue oder ein anderes Framework rendert `<example-reaction-bar>`. Der Browser aktualisiert das Element, `connectedCallback` wird ausgeführt und `WippyVueElement` mountet seine Vue-Anwendung in einem Shadow Root.

## Wann `auto_register: false` sinnvoll ist

`auto_register: false` schließt die Komponente vom globalen Autoload-Durchlauf aus. Das ist sinnvoll, wenn:

- die Komponente groß ist und nur auf Seiten geladen werden soll, die sie ausdrücklich benötigen;
- die Komponente am Aufrufort programmatisch über `loadByTagName('example-heavy-chart')` aus `@wippy-fe/proxy` registriert wird;
- sie ein interner Baustein ist, der nur innerhalb eines anderen Bundles und nicht als eigenständiges Custom Element verwendet wird.

```ts
import { loadByTagName } from '@wippy-fe/proxy'

await loadByTagName('example-heavy-chart')
```

Lazy Registration hält den ersten Seitenaufruf schlank. Die Komponente benötigt für die Auflösung durch `loadByTagName()` dennoch `announced: true`; der Endpunkt `GET /components/by-tag/{tag}` gibt bei `false` den Fehler `404 "Component is not announced"` zurück.
