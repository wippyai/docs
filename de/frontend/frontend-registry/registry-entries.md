---
title: "Registry-Einträge"
description: "Ein Registry-Eintrag ist die Art, wie das Wippy-Backend ein Frontend-Artefakt deklariert — entweder eine Micro-Frontend-App oder eine wiederverwendbare Web Component — damit der Web Host es…"
---

# Registry-Einträge

Ein Registry-Eintrag ist die Art, wie das Wippy-Backend ein Frontend-Artefakt deklariert — entweder eine Micro-Frontend-App oder eine wiederverwendbare Web Component — damit der Web Host es finden und ausliefern kann. Dieses Dokument erklärt den Vertrag zwischen der `_index.yaml` eines Moduls, dem `wippy`-Block seiner `package.json` und der Datei `wippy-meta.json`, die beide verbindet.

Zum Setup des Moduls `wippy/views`, das diese Einträge zur Laufzeit verarbeitet, siehe [Views](../../framework/views.md).

## Was ein Registry-Eintrag ist

Jedes Frontend-Artefakt wird als `registry.entry` in der `_index.yaml` des Moduls deklariert. Der Marker `kind: registry.entry` teilt der Wippy-Registry mit, dass dieser Eintrag Metadaten trägt, die von anderen Modulen konsumiert werden, statt direkt eine Lua-Komponente zu definieren.

> **Häufige Falle:** `view.page` und `view.component` sind **keine** `kind`-Werte. Schreiben Sie immer `kind: registry.entry` und tragen Sie den Typ des Frontend-Artefakts in `meta.type` ein. `kind: view.page` und `kind: view.component` sind ungültige Formen.

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

Der `meta`-Block ist das, was `wippy/views` liest. Das Feld `meta.type` unterscheidet zwischen den beiden unterstützten Artefakt-Arten.

## Der Diskriminator `meta.type`

| Wert | Bedeutung |
|---|---|
| `view.page` | Eine Micro-Frontend-App (vollständige SPA), die in einem iframe innerhalb des Web Host gerendert wird |
| `view.component` | Eine Web Component (Custom Element), die sich überall in einer Seite einbetten lässt |

Jedes andere Feld in `meta` wird im Kontext dieses Typs interpretiert. Felder, die für einen Typ gelten und für den anderen nicht, sind auf den typspezifischen Referenzseiten beschrieben ([view.page](./view-page.md), [view.component](./view-component.md)).

## Der Marker `specification`

Jedes Frontend-Paket, das an der Registry teilnimmt, deklariert `"specification": "wippy-component-1.0"` auf oberster Ebene seiner `package.json`. Dieser String ist der Handshake, der Wippy (und dem Tooling) mitteilt, dass dieses Paket dem wippy-component-Vertrag folgt — es hat einen `wippy`-Block mit bekannter Form und wurde mit `@wippy-fe/vite-plugin` gebaut.

```json
{
  "name": "@wippy/app-main",
  "version": "1.0.0",
  "specification": "wippy-component-1.0",
  "wippy": { ... }
}
```

Das Vorhandensein von `specification` ändert das Laufzeitverhalten nicht, aber `wippy/views` verwendet es bei der Validierung von Einträgen, die aus der Registry geladen werden.

## Der Vertrag `wippy-meta.json`

`@wippy-fe/vite-plugin` gibt neben dem gebauten Bundle eine Datei `wippy-meta.json` aus. Diese Datei ist die kanonische Quelle der Wahrheit für die Laufzeit-Metadaten des Artefakts: sein Props-Schema, sein Events-Schema, Titel, Icon und die Einstellungen zur Proxy-Injektion.

Kurzfassung für Agenten und Tooling:

- **Wer sie ausgibt:** `wippyPagePlugin()` für `view.page`-Apps und `wippyComponentPlugin()` für `view.component`-Web-Components.
- **Wer sie verfasst:** niemand schreibt `wippy-meta.json` von Hand; das Vite-Plugin generiert sie aus der `package.json`.
- **Wer sie konsumiert:** `wippy/views` liest sie aus dem Bundle-Root der Auslieferung, wenn Seiten-/Komponenten-Deskriptoren und API-Antworten gebaut werden.
- **Was YAML tut:** `_index.yaml` bleibt maßgeblich für Deployment-Policy und für jedes Feld, das sie explizit überschreibt.

Wenn `wippy/views` einen `registry.entry` lädt, liest es `wippy-meta.json` aus dem Bundle-Root der Auslieferung des Artefakts. Bei Seiten ist dieser Root `url + base_path` der Seite; bei Web Components liefern die aktuellen Einträge die Komponente direkt aus `url` aus. YAML gewinnt immer: `_index.yaml` hat Vorrang für jedes Feld, das sie deklariert. `wippy-meta.json` liefert die Standardwerte, die `wippy/views` liest, wenn für ein Feld kein YAML-Override vorliegt. Felder der Deployment-Policy — `announced`, `secure`, `url`, `mountRoute` und `base_path` — müssen in `_index.yaml` gesetzt werden, weil sie Entscheidungen des Betreibers ausdrücken statt der Autorenschaft an der Komponente; es gibt für sie keine Autorenfläche in `package.json`/`wippy-meta.json`. (`base_path` wird sowohl für Seiten als auch für Komponenten berücksichtigt; die aktuellen Komponenteneinträge des App-Templates lassen es lediglich weg.)

Im Gegensatz dazu wird `entry_point` FE-seitig verfasst *und* ist per YAML überschreibbar. Es wird aus dem `wippy`-Block des Pakets in `wippy-meta.json` eingebacken — `wippy.path` für Seiten (was `@wippy-fe/vite-plugin` **voraussetzt**; wird es weggelassen, wirft das Plugin `wippy.path is required for a page package`) oder `wippy.tagName`/`browser` für Komponenten. Das Feld `meta.entry_point` in `_index.yaml` ist ein optionaler Override pro Deployment über diesem verfassten Standardwert; es ist kein reines YAML-Feld.

Diese Aufteilung bedeutet, dass ein Komponenten-Autor Anzeige-Metadaten einmal im `wippy`-Block der `package.json` schreibt und das Vite-Plugin sie zur Build-Zeit als Autoren-Standardwerte in `wippy-meta.json` einbackt. Der Betreiber, der die Komponente ausliefert, setzt Routing und Zugriffs-Policy in YAML und kann dort auch jedes Feld auf Anzeigeebene überschreiben.

## Gemeinsame Felder

Diese Felder erscheinen im `meta`-Block sowohl für `view.page`- als auch für `view.component`-Einträge.

| Feld | Typ | Standard | Beschreibung |
|---|---|---|---|
| `type` | string | — | `view.page` oder `view.component` (erforderlich) |
| `name` | string | Eintragsname | Bezeichner, der in API-Antworten verwendet wird |
| `title` | string | — | Menschenlesbarer Anzeigename |
| `icon` | string | — | Iconify-Referenz, z. B. `tabler:layout-dashboard` |
| `announced` | boolean | — | Steuert die Sichtbarkeit in Listing-APIs; die Semantik unterscheidet sich je nach Typ (siehe unten) |
| `secure` | boolean | `false` | Erfordert Authentifizierung für den Zugriff |
| `url` | string | — | Basis-URL-Präfix für die Auslieferung statischer Dateien (CDN-Origin oder lokaler Mount-Pfad) |
| `entry_point` | string | `index.html` / `index.js` | Name der Einstiegsdatei innerhalb des statischen Verzeichnisses |

### Semantik von `announced` je Typ

Das Flag `announced` hat je nach `meta.type` unterschiedliche Konsequenzen:

- **`view.page`**: steuert, ob die Seite in der Navigations-Sidebar erscheint (`GET /api/public/pages/list`). `announced: false` blendet die Seite aus der Navigation aus, aber die Seite lädt weiterhin, wenn sie direkt aufgerufen wird. Das ist ein legitimes Muster für eingebettete oder ergänzende Seiten.

- **`view.component`**: steuert die Aufnahme in `GET /api/public/components/list`. Bei `announced: false` wird die Komponente vollständig von diesem Endpunkt ausgeschlossen, was bedeutet, dass der Web Host niemals ihr Script-Tag injiziert und `customElements.get(tagName)` undefined bleibt. Für Komponenten, die Autoload benötigen, ist `announced: true` erforderlich — Details siehe [view.component](./view-component.md).

## Wie sich die Auslieferungsfelder zusammensetzen

Für Micro-Frontend-Apps setzen sich die drei Felder zu der HTML-URL zusammen, die der Web Host lädt:

```
<url>/<base_path>/<entry_point>
```

Zum Beispiel holt der Host mit `url: /app`, `base_path: app/main`, `entry_point: app.html` die Datei `/app/app/main/app.html`.

Die Trennung zwischen `base_path` und `entry_point` ist Absicht. Der Web Host injiziert `<url>/<base_path>/` als HTML-`<base>`-Tag in die geladene Seite, was steuert, wie der Browser alle relativen URLs innerhalb dieser Seite auflöst. Die Einstiegsdatei darf in einem Unterverzeichnis der Basis liegen — entscheidend ist, dass die Basis auf den gemeinsamen Root zeigt, von dem aus alle Ressourcen relativ erreichbar sind.

Wenn ein Bundle beispielsweise dieses Layout hat:

```
static/
  shared/
    vendor.js
  app/
    index.html    ← entry_point: app/index.html
    app.js
```

und `index.html` auf `../shared/vendor.js` verweist, dann muss `base_path` auf `static/` zeigen (das Verzeichnis, das sowohl `app/` als auch `shared/` enthält), nicht auf `app/`. Mit `base_path: app` würde `../shared/vendor.js` außerhalb des ausgelieferten Verzeichnisses aufgelöst und einen 404 erzeugen.

Im üblichen Fall, in dem alle Assets neben der Einstiegsdatei liegen, befinden sich `base_path` und das Verzeichnis mit `entry_point` auf derselben Ebene, sodass der Unterschied unsichtbar bleibt. Er zählt nur, wenn ein Bundle Ressourcen über Geschwisterverzeichnisse hinweg teilt.

Für Web Components setzt der Host die ausgelieferte URL auf dieselbe Weise zusammen:

```
<url>/<base_path>/<entry_point>
```

Die aktuellen Komponenteneinträge des App-Templates lassen `base_path` weg, aber es wird unterstützt und setzt sich genauso zusammen (`<url>/<base_path>/<entry_point>`) — in diesen Einträgen fällt die URL also auf `<url>/<entry_point>` zusammen. Der Unterschied zu Seiten ist, dass eine Komponente als `<script type="module">` injiziert wird, statt ein eigenes injiziertes HTML-`<base>`-Tag zu erhalten.
