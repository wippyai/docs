---
title: "Registry-Einträge"
description: "Wie Registry-YAML, Paketmetadaten und wippy-meta.json Frontend-Seiten und Web Components für den Web Host deklarieren."
---

# Registry-Einträge

Ein Registry-Eintrag deklariert ein Frontend-Artefakt beim Wippy-Backend, damit der Web Host es finden und ausliefern kann. Das Artefakt kann eine Micro-Frontend-Anwendung oder eine wiederverwendbare Web Component sein. Seine Deklaration erstreckt sich über `_index.yaml` des Moduls, den Block `wippy` in `package.json` und die generierte Datei `wippy-meta.json`.

Die Einrichtung des Moduls `wippy/views`, das diese Einträge zur Laufzeit verarbeitet, beschreibt [Views](../../framework/views.md).

## Was ein Registry-Eintrag ist

Jedes Frontend-Artefakt wird als `registry.entry` in `_index.yaml` des Moduls deklariert. Die Kennzeichnung `kind: registry.entry` teilt der Wippy-Registry mit, dass dieser Eintrag von anderen Modulen konsumierte Metadaten trägt, statt direkt eine Lua-Komponente zu definieren.

> **Häufige Falle:** `view.page` und `view.component` sind **keine** Werte für `kind`. Schreiben Sie stets `kind: registry.entry` und setzen Sie den Typ des Frontend-Artefakts in `meta.type`. `kind: view.page` und `kind: view.component` sind ungültige Formen.

Minimale korrekte Form:

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
```

```yaml
version: "1.0"
namespace: app.views

entries:
  - name: main
    kind: registry.entry
    meta:
      type: view.page
      name: main
      title: Admin Panel
      icon: tabler:layout-dashboard
      order: 0
      announced: true
      secure: false
      url: /app
      base_path: app/main
      entry_point: app.html
      mountRoute: /home/:part(.*)*
```

Der Block `meta` wird von `wippy/views` gelesen. Das Feld `meta.type` unterscheidet zwischen den beiden unterstützten Artefakttypen.

## Der Diskriminator `meta.type`

| Wert | Bedeutung |
|------|-----------|
| `view.page` | Eine Micro-Frontend-Anwendung (vollständige SPA), die über die ausgewählte iframe- oder Web-Fragment-Engine der Seite gerendert wird |
| `view.component` | Eine Web Component (Custom Element), die beliebig in eine Seite eingebettet werden kann |

Jedes andere Feld in `meta` wird im Kontext dieses Typs interpretiert. Felder, die nur für einen Typ gelten, beschreiben die Referenzseiten [view.page](./view-page.md) und [view.component](./view-component.md).

## Die Kennzeichnung `specification`

Frontend-Pakete sollten auf der obersten Ebene von `package.json` `"specification": "wippy-component-1.0"` deklarieren. Die Kennzeichnung identifiziert Paketmetadaten und API-Antwortform. `@wippy-fe/vite-plugin` validiert den Wert, wenn er vorhanden ist.

```json
{
  "name": "@wippy/example-widget",
  "version": "1.0.0",
  "specification": "wippy-component-1.0",
  "browser": "dist/index.js",
  "wippy": {
    "type": "component",
    "tagName": "example-widget"
  }
}
```

Die Kennzeichnung verändert das Renderverhalten nicht. `wippy/views` übernimmt den gebündelten Wert in Seiten- und Komponentendeskriptoren oder setzt für Legacy-Bundles ohne Angabe `wippy-component-1.0`; die Validierung der Registry-YAML hängt nicht von diesem Feld ab.

## Der Vertrag `wippy-meta.json`

`@wippy-fe/vite-plugin` gibt neben dem gebauten Bundle eine Datei `wippy-meta.json` aus. Sie ist die kanonische Quelle der vom Artefaktautor festgelegten Laufzeitmetadaten: Props-Schema, Ereignisschema, Titel, Icon und Proxy-Injektionseinstellungen.

Verantwortlichkeiten der Metadaten:

- **Ausgegeben von:** `wippyPagePlugin()` für `view.page`-Anwendungen und `wippyComponentPlugin()` für Web Components des Typs `view.component`.
- **Generiert aus:** `package.json`; erstellen Sie `wippy-meta.json` nicht manuell.
- **Konsumiert von:** `wippy/views`, das die Datei beim Erstellen von Seiten-/Komponentendeskriptoren und API-Antworten aus dem ausgelieferten Bundle-Root liest.
- **Überschrieben durch:** `_index.yaml`, das für Deployment-Richtlinien und jedes ausdrücklich deklarierte Feld maßgeblich bleibt.

Beim Laden eines `registry.entry` liest `wippy/views` für Seiten und Komponenten `wippy-meta.json` aus dem ausgelieferten Bundle-Root des Artefakts (`url + base_path`). YAML gewinnt stets: `_index.yaml` hat für jedes dort deklarierte Feld Vorrang. `wippy-meta.json` liefert Standardwerte, wenn für ein Feld keine YAML-Überschreibung vorhanden ist. Deployment-Richtlinienfelder — `announced`, `secure`, `url`, `mountRoute` und `base_path` — müssen in `_index.yaml` gesetzt werden, weil sie Betreiberentscheidungen statt Artefaktautorschaft ausdrücken; in `package.json`/`wippy-meta.json` gibt es dafür keine Autorenschnittstelle. (`base_path` wird für Seiten und Komponenten berücksichtigt; die aktuellen Komponenteneinträge des Anwendungstemplates lassen es lediglich weg.)

`entry_point` wird dagegen vom Frontend erstellt *und* kann durch YAML überschrieben werden. Für Seiten stammt es aus `wippy.path`, das `@wippy-fe/vite-plugin` **verlangt**; ohne dieses Feld löst das Plugin `wippy.path is required for a page package` aus. Für Komponenten stammt es aus dem obersten Feld `browser`; `wippy.tagName` deklariert separat den Namen des Custom Elements. `meta.entry_point` in `_index.yaml` ist eine optionale Deployment-Überschreibung des erstellten Standardwerts, kein reines YAML-Feld.

Ein Komponentenautor schreibt Anzeigemetadaten einmal in den Block `wippy` von `package.json`; das Vite-Plugin zeichnet sie in `wippy-meta.json` als Autorenstandardwerte auf. Der Betreiber setzt Routing- und Zugriffsrichtlinien in YAML und kann dort auch Anzeigefelder überschreiben.

## Gemeinsame Felder

Diese Felder erscheinen im Block `meta` von `view.page`- und `view.component`-Einträgen.

| Feld | Typ | Standardwert | Beschreibung |
|------|-----|--------------|--------------|
| `type` | string | — | `view.page` oder `view.component` (erforderlich) |
| `name` | string | Eintragsname | In API-Antworten verwendeter Bezeichner |
| `title` | string | — | Menschenlesbarer Anzeigename |
| `icon` | string | — | Iconify-Referenz, zum Beispiel `tabler:layout-dashboard` |
| `announced` | boolean | — | Steuert die Sichtbarkeit in Listing-APIs; die Semantik ist je Typ unterschiedlich |
| `secure` | boolean | `false` | Zugriff erfordert Authentifizierung |
| `url` | string | — | Basis-URL-Präfix für statische Auslieferung (CDN-Origin oder lokaler Mountpfad) |
| `entry_point` | string | `index.html` / `index.js` | Name der Entry-Datei im statischen Verzeichnis |

### Semantik von `announced` nach Typ

Das Flag `announced` hat je nach `meta.type` unterschiedliche Folgen:

- **`view.page`**: Steuert, ob die Seite in der Navigationsseitenleiste (`GET /api/public/pages/list`) erscheint. `announced: false` verbirgt sie in der Navigation, sie wird bei direktem Zugriff aber weiterhin geladen. Dies ist ein gültiges Muster für eingebettete oder ergänzende Seiten.
- **`view.component`**: Steuert die Aufnahme in `GET /api/public/components/list`. Bei `announced: false` fehlt die Komponente vollständig in diesem Endpunkt; der Web Host injiziert daher nie ihr Script-Tag und `customElements.get(tagName)` bleibt undefined. Komponenten, die automatisch geladen werden sollen, benötigen `announced: true`; Details unter [view.component](./view-component.md).

## Zusammensetzung der Auslieferungsfelder

Bei Micro-Frontend-Anwendungen ergeben die drei Felder zusammen die HTML-URL, die der Web Host lädt:

```
<url>/<base_path>/<entry_point>
```

Mit `url: /app`, `base_path: app/main` und `entry_point: app.html` ruft der Host beispielsweise `/app/app/main/app.html` ab.

Die Trennung von `base_path` und `entry_point` ist beabsichtigt. Der Web Host injiziert `<url>/<base_path>/` als HTML-Tag `<base>` in die geladene Seite; dieser bestimmt, wie der Browser alle relativen URLs innerhalb der Seite auflöst. Die Entry-Datei darf in einem Unterverzeichnis der Basis liegen. Entscheidend ist, dass die Basis auf den gemeinsamen Root zeigt, von dem aus alle Ressourcen relativ erreichbar sind.

Beispiel für ein Bundle-Layout:

```
static/
  shared/
    vendor.js
  app/
    index.html    ← entry_point: app/index.html
    app.js
```

Wenn `index.html` auf `../shared/vendor.js` verweist, muss `base_path` auf `static/` zeigen, also auf das Verzeichnis, das sowohl `app/` als auch `shared/` enthält, nicht auf `app/`. Mit `base_path: app` würde `../shared/vendor.js` außerhalb des ausgelieferten Verzeichnisses aufgelöst und 404 zurückgeben.

Im üblichen Fall liegen alle Assets neben der Entry-Datei. Dann befinden sich `base_path` und das Verzeichnis von `entry_point` auf derselben Ebene und die Unterscheidung ist unsichtbar. Relevant wird sie erst, wenn ein Bundle Ressourcen über benachbarte Verzeichnisse hinweg teilt.

Für Web Components setzt der Host die ausgelieferte URL auf dieselbe Weise zusammen:

```
<url>/<base_path>/<entry_point>
```

Die aktuellen Komponenteneinträge des Anwendungstemplates lassen `base_path` weg. Es wird jedoch unterstützt und ebenso als `<url>/<base_path>/<entry_point>` zusammengesetzt; in diesen Einträgen reduziert sich die URL daher auf `<url>/<entry_point>`. Anders als eine Seite wird eine Komponente als `<script type="module">` injiziert und erhält kein eigenes injiziertes HTML-Tag `<base>`.
