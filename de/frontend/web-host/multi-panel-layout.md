---
title: "Multi-Panel-Layout"
description: "Early-Access-Referenz zum Deklarieren und Steuern des verwalteten Multi-Panel-Layouts im Web Host."
---

# Multi-Panel-Layout

Diese Seite ist eine Early-Access-Konfigurations- und API-Referenz. Die YAML-
und TypeScript-Blöcke sind Teildeklarationen und Integrationsmuster, keine
eigenständig produktionsreife Shell.

> **Status: Draft-1-Vorschau — Early Access, nicht für den Produktionseinsatz.**
> Die Managed-Layout-API ist verfügbar, wurde aber noch nicht mit einem
> Produktionsanwender validiert. Feldnamen, Standardwerte und Validierungsregeln
> können sich zwischen Minor-Releases ändern. Fixieren Sie bis zur Aufhebung
> dieses Hinweises eine exakte CDN-Version. Verwenden Sie in Produktion den
> Standardmodus `compat`, sofern die Anwendung die Host-Chrome nicht selbst
> zusammensetzen muss.

Der Managed-Layout-Modus ersetzt die normale Wippy-Chrome durch einen
deklarativen Panelbaum. Benannte Panels werden im Backend-YAML definiert; der
Web Host baut und validiert das Layout beim Start und verwaltet es anschließend
reaktiv. Panels lassen sich ohne Neuladen der Seite skalieren, einklappen,
tauschen, hinzufügen und entfernen.

## Wann Managed Layout sinnvoll ist

Der Standardmodus `compat` ist der voreingestellte Produktionsmodus. Er stellt
die feste Wippy-Shell mit Navigationsleiste, Chatpanel, Seitenbereich und
rechtem Artefaktpanel bereit.

Aktivieren Sie `fe_mode = managed` (Early Access) nur, wenn Sie die Chrome selbst zusammensetzen müssen:

| Anforderung | Compat | Managed |
|---|---|---|
| Standard-Wippy-Chat und Navigation | Ja | Ersetzbar |
| Mehrere Seitenplätze nebeneinander | Nein | Ja |
| Eigene Sidebar- oder Koordinatorkomponente | Eingeschränkt | Ja — jede Panelart |
| Responsive Layouts je Breakpoint | Nein | Ja |
| Schwebende Overlay-Panels | Nein | Ja |
| Headless-Koordinatorkomponente | Nein | Ja (`coordinators`) |
| URL-bewusstes Routing je Panel | Nur Hauptpanel | Jedes Panel mit `kind: page` |
| Panelübergreifender Nachrichtenbus | Nein | Ja (`broadcast`/`send`/`on`) |

## Kompatibilität

Managed Layout umfasst Web Host, Facade und mehrere `@wippy-fe/*`-Pakete.
Verwenden Sie eine zusammengehörige Paketfamilie für den exakten Web-Host-
Release und prüfen Sie dessen ausgelieferte Import Map. Mischen Sie keine
Paketversionen aus verschiedenen Releases.

### Release-Übersicht

| Release | Ergänzungen für Managed Layout |
|---|---|
| Web Host `1.0.50`, Wippy FE `0.0.50` | Typisierte Compat-Intents, `@HOST/compat-coordinator`, Synchronisierung von Browser-URL sowie Zurück/Vorwärts, eingebaute Panel-Tabs, verankerte Floating Panels und `useSwapBuffer()`. |
| Web Host `1.0.51`, Wippy FE `0.0.51` | Reaktive und race-sichere Session-/Token-Steuerung für `<wippy-chat>`, optional thematisierte Splitter-Griffe, nur auf die Teilungsachse wirkende Größenbeschränkungen, Korrekturen an Drawer-Geometrie und -Stapelung sowie die paketierte Proxy Source Map. |
| Web Host `1.0.52`, Wippy FE `0.0.52` | Typisierte Sichtbarkeit beibehaltener Web Components und `useHostVisibilityRefresh()`, sofortige Seitenbereitschaft statt Warten auf den 14-Sekunden-Fallback, Ablehnung veralteter Renderer-Schlüssel, Aktualisierung von Komponenten-Props im bestehenden Element und isolierte Splitter-Ebene mit `--wippy-layout-splitter-z-index`. |
| Web Host `1.0.53`, Wippy FE `0.0.53` | Konfigurierte Theme-Tokens werden bei erzwungenem hellen oder dunklen Modus korrekt weitergegeben. |
| Web Host `1.0.54`, Wippy FE `0.0.54` | Vertrag für portable Oberflächen v1 für iframe- und Web-Fragment-Seiten, einschließlich Managed-Layout-Registrierung und reaktiver Größenänderungen. |
| Web Host `1.0.55`, Wippy FE `0.0.55` | Verträge für verwaltete Artefakte und eigenständigen Chat, Erhalt kalter Deep Links, stabiles Rendering verwalteter Artefakte und thematisierte Splitter-Griffe. |
| Web Host `1.0.56`, Wippy FE `0.0.56` | Korrekturen für verwaltete Artefakt-/Modal-Darstellung, veröffentlichte Gründe zum Öffnen von Artefakten sowie Korrekturen an Chat-Selektor und Slot-Lebenszyklus. |

Die Seitenfreigabe nach 14 Sekunden ist ein Fallback von Web Host `1.0.52`,
keine Funktion von 1.0.51 und keine Anwendungsverzögerung.

Die Sichtbarkeit beibehaltener direkter Web Components benötigt Web Host
`1.0.52` sowie `@wippy-fe/webcomponent-core`, `@wippy-fe/webcomponent-vue` und
`@wippy-fe/shared` `0.0.52`. Frühere Managed-Layout-Releases stellen weder den
typisierten Vertrag `data-wippy-visible` noch `useHostVisibilityRefresh()` bereit.

### Aktivität beibehaltener Web Components

Managed Layout hält Panels bei Buffer-Wechseln, Breakpoint-Änderungen und dem
Schließen oder Öffnen von Drawern gemountet. Der Host setzt vor dem Verbinden
eines direkten Custom Elements `data-wippy-visible="true" | "false"` und
aktualisiert den Wert bei einem Wechsel der logischen Zuständigkeit. Das ist
weder CSS-, Viewport- noch Dokumentsichtbarkeit und bedeutet nie einen Remount.

Vue-Komponenten lesen den Zustand mit `useHostVisibility()` oder verbinden
normales initiales Laden mit Aktualisierungen beim Einblenden über
`useHostVisibilityRefresh(task)`. Letzteres läuft nach dem Mount und danach nur
bei einem exakten Übergang `false -> true`. Verwenden Sie das Proxy-Thema
`@visibility` nicht in einer direkten Web Component; es ist der Nachrichtenkanal
für iframe/Web Fragment.

Fixieren Sie bis zum Ende von Draft 1 einen exakten CDN-Tag. Diese Referenz ist
gegen `https://web-host.wippy.ai/webcomponents-1.0.56` und die passende
`@wippy-fe/*`-Familie `0.0.56` validiert. Die Sichtbarkeit beibehaltener direkter
Web Components benötigt weiterhin mindestens 1.0.52/0.0.52.

## Managed Layout aktivieren

Aktivieren Sie den Managed-Einstieg in der Facade-Konfiguration und stellen Sie backendseitig eine `host_config.layout`-Deklaration bereit:

```yaml
host_config:
  layout:
    layouts:
      default:
        direction: horizontal
        children:
          - panel: nav
            size: 240px
          - panel: main
            size: 1fr
            main: true
    panels:
      nav:  { kind: builtin, id: '@HOST/nav-sidebar' }
      main: { kind: page,    id: home }
```

Ist der Managed-Einstieg ausgewählt, liefert die Facade `managed-layout.js`
anstelle von `module.js`. `fe_mode` ist ein aktueller Facade-Requirement-
Parameter (Standard `compat`, optional `managed`); er wird am Requirement
`wippy.facade` gesetzt und nicht im `AppConfig`-Payload übertragen. Es gibt kein
Feld `AppConfig.feature`: Das Managed Layout erreicht das Kind ausschließlich
über `AppConfig.hostConfig.layout`. Die Oberfläche der Proxy-API ist in beiden
Modi gleich, einige Befehle wirken jedoch nur in einem Modus; siehe
[Welche Funktionen in welchem Modus wirken](#funktionsumfang-nach-modus).

## Die `HostLayoutDeclaration`

Das gesamte Layout wird durch ein einzelnes Objekt `HostLayoutDeclaration`
beschrieben, das in der Facade-Konfiguration unter `host_config.layout` liegt
und frontendseitig nach `AppConfig.hostConfig.layout` projiziert wird. Der Host
validiert es vor dem Mount. Jeder `LayoutValidationError` erscheint mit
`{ kind, message, panelId? }` in der Browserkonsole.

| Feld | Typ | Beschreibung |
|---|---|---|
| `layouts` | `Record<string, PanelTree> & { default: PanelTree }` | Nach Breakpoint benannte Panelbäume; `default` ist erforderlich. |
| `breakpoints?` | `Record<string, number>` | Pixelbreiten, die nicht standardmäßige Layoutschlüssel aktivieren. |
| `panels` | `Record<string, HostPanelDef>` | Benannte Panel-Inhaltsdefinitionen. |
| `floating?` | `Record<string, HostFloatingDef>` | Beim Start vorhandene schwebende Overlay-Panels. |
| `modals?` | `Record<string, HostModalDef>` | Beim Start vorhandene Modaldefinitionen. |
| `coordinators?` | `Record<string, HostCoordinatorDef>` | Headless-Koordinatorkomponenten. |
| `services?` | `Record<string, HostCoordinatorDef>` | Veralteter Alias für `coordinators`; neue Deklarationen müssen `coordinators` verwenden. |
| `dragEnabled?` | boolean | Ermöglicht benutzergesteuertes Ziehen am Splitter. Standard `true`. |

## Panelarten

Jeder Eintrag in `panels`, `floating`, `modals` und `coordinators` ist über `kind` typisiert:

| Kind | Beschreibung | Erforderliche Felder |
|---|---|---|
| `page` | Wippy-Seitenmodul, das über die gewählte iframe- oder Web-Fragment-Engine gemountet wird | `id` (Registry-ID der Seite) |
| `artifact` | Wippy-Artefakt, das über den Artefakt-/Seitenresolver des Hosts gerendert wird | `id` (Artefakt-UUID) |
| `component` | Direkt im Host-DOM gemountete Web Component | `tagName` |
| `builtin` | Frameworkeigene Host-Komponente (siehe unten) | `id` |

Genau ein Panel im Layoutbaum muss `main: true` tragen. Die Zuständigkeit für
die Browser-URL erfordert weiterhin Routensynchronisierung über
`@HOST/compat-coordinator` oder eine gleichwertige Verbraucherkoordination.
Alle anderen Seitenpanels routen unabhängig in ihrem gewählten Seiten-Realm.

### Integrierte Panel-IDs

`kind: builtin` akzeptiert folgende `id`-Werte. Das Präfix `@HOST/` ist Framework-Panels vorbehalten:

| ID | Darstellung |
|---|---|
| `@HOST/nav-sidebar` | Standard-Wippy-Navigationsleiste (Sessions, Seiten, Einstellungen) |
| `@HOST/chat-wrapper` | Standard-Wippy-Chatpanel für die aktive Session |
| `@HOST/artifact-viewer` | Allgemeiner Artefaktbetrachter (mit Route `/:uuid`) |
| `@HOST/session-selector` | Sessionliste und -auswahl |
| `@HOST/compat-coordinator` | Headless-Koordinator für Compat-Intents und Hauptroute; unter `coordinators` deklarieren |
| `@HOST/panel-tab` | Rand-Tab zum Einblenden eines eingeklappten Panels; unter `floating` deklarieren |

Eine unbekannte ID `@HOST/<id>` verursacht beim Laden der Deklaration einen
`LayoutValidationError`, statt still einen leeren Platz zu rendern.

## Breakpoint-basierte Layouts

Das Feld `layouts` ordnet Breakpoint-Schlüssel Panelbäumen zu. `default` gilt
immer, sofern kein schmalerer Breakpoint passt. Pixelbreiten stehen unter `breakpoints`:

```yaml
host_config:
  layout:
    breakpoints:
      sm: 768
    layouts:
      default:
        direction: horizontal
        children:
          - panel: side
            size: 300px
          - panel: main
            size: 1fr
            main: true
      sm:
        direction: vertical
        children:
          - panel: main
            size: 1fr
            main: true
          - panel: side
            display: drawer-left
            drawerSize: { width: 320px }
    panels:
      side: { kind: page, id: app-sidebar, route: / }
      main: { kind: page, id: app-home,    route: / }
```

Wechselt der Breakpoint, behalten Panels mit derselben `id` einen stabilen
Content-Host, der dem aktiven Slot visuell folgt, ohne neu eingehängt zu werden.
Iframe-`contentWindow`, Web-Component- und Vue-Zustand sowie Scrollposition
bleiben erhalten. Teleport-basiertes Umhängen wird absichtlich vermieden, weil
das Entfernen und erneute Einfügen eines iframe diesen neu lädt.

### Drawer-Panels

Ein Panel-Slot kann mit `display: 'drawer-left' | 'drawer-right' | 'drawer-bottom'`
als einschiebbares Overlay statt als Flex-Element erscheinen. Drawer-Panels:

- nehmen nicht an der Track-Größenberechnung des Elterncontainers teil (`size` wird ignoriert),
- werden als absolut positionierte Overlays am benannten Rand dargestellt,
- besitzen einen Öffnen-/Schließen-Zustand für `host.layout.openDrawer(id)`, `closeDrawer(id)` und `toggleDrawer(id)`,
- zeigen geöffnet einen Hintergrund; ein Klick darauf schließt alle offenen Drawer.

Slots mit `main: true` dürfen keine Drawer sein; die Host-Validierung schlägt
sonst fehl. `drawerSize.width` steuert die Breite linker/rechter Drawer,
`drawerSize.height` die Höhe unterer Drawer. Standard ist `320px`.

## Floating Panels

Floating Panels sind frei positionierte Overlays unter `floating`. Sie gehören
nicht zum Flex-Layoutbaum und können zur Laufzeit hinzugefügt oder entfernt werden:

```yaml
floating:
  flap:
    kind: component
    tagName: my-right-flap
    position: { x: 0, y: 200 }
    size: { width: 48, height: 80 }
```

Verwaltung zur Laufzeit:

```typescript
// Add a floating panel
host.layout.addFloating('inspector', {
  kind: 'component',
  tagName: 'my-inspector',
  position: { x: 100, y: 100 },
  size: { width: 400, height: 300 },
})

// Remove it
host.layout.removeFloating('inspector')
```

## Headless-Koordinatoren

Koordinatoren werden in einem verborgenen Host gemountet. Sie haben keinen
sichtbaren Slot, erhalten aber die panelgebundene Host-API. Nutzen Sie sie für
Querschnittslogik, damit sichtbare Panels auf die Darstellung konzentriert
bleiben. Das ältere Feld `services` bleibt ein veralteter Kompatibilitätsalias.

```yaml
coordinators:
  coordinator:
    kind: component
    tagName: my-coordinator
```

Eine Koordinatorkomponente erhält den panelgebundenen Host-Wrapper und kann in `onMount` sofort Buskanäle abonnieren:

```typescript
import { WippyElement } from '@wippy-fe/webcomponent-core'

class MyCoordinator extends WippyElement {
  private offOpenChat: (() => void) | null = null

  protected onMount() {
    this.offOpenChat = this.host?.layout.on('open-chat', ({ payload }) => {
      this.host?.layout.updatePanel('right', { route: `/open-chat/${payload.token}` })
      this.host?.layout.expandPanel('right')
    }) ?? null
  }
  protected onUnmount() {
    this.offOpenChat?.()
    this.offOpenChat = null
  }
  static get wippyConfig() { return { propsSchema: { properties: {} } } }
}
customElements.define('my-coordinator', MyCoordinator)
```

### Ausgelieferter Compat-Koordinator

Ein Managed Layout enthält nur deklarierte Oberflächen. Aufrufe wie
`host.openArtifact()`, `host.startChat()`, `host.openSession()` und
`host.navigate()` veröffentlichen deshalb typisierte Intents auf dem reservierten
Kanal `@HOST/intent`. Deklarieren Sie den ausgelieferten Koordinator, damit er
diese verarbeitet und die Browser-URL an das Hauptpanel bindet:

```yaml
coordinators:
  compat:
    kind: builtin
    id: '@HOST/compat-coordinator'
    props:
      artifactPanel: right
      chatPanel: chat
      modalId: artifact-modal
      routeSync: true
      wsActions: true
```

Behalten Sie `routeSync: true` für den normalen Navigationsvertrag bei. Ohne
Koordinator oder gleichwertige Verbraucherlogik können Deep Links,
Zurück/Vorwärts und die Navigation von `@HOST/nav-sidebar` keine Panelroute
steuern. Während des Kindstarts erzeugte Intents landen bis zum ersten
Koordinator-Abonnement in einer begrenzten Warteschlange.

`@HOST/` ist in beide Richtungen reserviert: Gewöhnliche Panels dürfen keinen
Systemverkehr veröffentlichen, und nur Einträge unter `coordinators` empfangen
ihn über unterstützte Host-APIs. Diese Grenze wird für iframe-/Web-Fragment-
Panels durchgesetzt. Eine direkte Komponente im Host-Realm teilt das Host-DOM
und ist keine Sicherheitssandbox. Beim Start gibt der Host eine Paritätstabelle
aus, wenn Koordinatorverarbeitung, Modal-Zieloberfläche, URL-Bindung des
Hauptpanels oder ein deklarierter Koordinator-Tag fehlt; eine vollständige
Deklaration erzeugt keine Warnung.

## Broadcast-Bus innerhalb eines Tabs

Panels kommunizieren über einen auf den aktuellen Browser-Tab begrenzten Bus.
Er überschreitet keine Tab-Grenzen; für tabübergreifende Synchronisierung ist
ein eigenes WebSocket-Thema nötig.

| Methode | Beschreibung |
|---|---|
| `host.layout.broadcast(channel, payload)` | An alle Panels senden; Sender ausgenommen |
| `host.layout.send(targetPanelId, channel, payload)` | An genau ein Panel senden |
| `host.layout.on(channel, handler)` | Abonnieren; gibt eine `off()`-Funktion zurück |

Der Host setzt `sourcePanelId` empfangener Nachrichten anhand des sendenden
Fensters; der Wert kann nicht gefälscht werden. Kanalnamen sind einfache,
groß-/kleinschreibungssensitive Zeichenketten.

**Wichtig:** Komponenten, die `host` direkt aus `@wippy-fe/proxy` importieren,
umgehen die Panelbindung. Busaufrufe funktionieren, verlieren aber
`sourcePanelId`. Verwenden Sie stattdessen den panelgebundenen Wrapper:

```typescript
// raw HTMLElement
import { getWippyHost } from '@wippy-fe/webcomponent-core'
const host = getWippyHost(this)

// WippyElement subclass — this.host is already panel-scoped
this.host?.layout.broadcast('open-chat', { token: 'abc' })

// Vue component
import { useHost } from '@wippy-fe/webcomponent-vue'
// ProxyApiInstance is an ambient global type (from @wippy-fe/types-global-proxy) — reference it without an import.
const host = useHost<ProxyApiInstance['host']>()
host?.layout.broadcast('open-chat', { token: 'abc' })
```

## Referenz der Layout-API (`host.layout`)

| Methode | Beschreibung |
|---|---|
| `.snapshot` | Synchroner Getter für den vollständigen Layout-Snapshot, außerhalb des Managed-Layout-Modus `null` |
| `.resizePanel(id, size)` | Benanntes Panel im aktiven Breakpoint skalieren |
| `.collapsePanel(id)` | Ein mit `collapsible: true` deklariertes Panel einklappen |
| `.expandPanel(id)` | Eingeklapptes Panel ausklappen |
| `.openDrawer(id)` | Drawer-Panel öffnen |
| `.closeDrawer(id)` | Drawer-Panel schließen |
| `.toggleDrawer(id)` | Drawer-Panel umschalten |
| `.movePanel(id, target)` | Panel an eine neue Baumposition verschieben |
| `.removePanel(id)` | Panel aus allen Breakpoint-Layouts entfernen |
| `.updatePanel(id, def)` | Paneldefinition zur Laufzeit patchen; `props` wird flach zusammengeführt, Felder auf oberster Ebene werden ersetzt |
| `.addFloating(id, def)` | Floating Panel hinzufügen |
| `.removeFloating(id)` | Floating Panel entfernen |
| `.openModal(id, def)` | Modal öffnen. Die öffentliche TypeScript-API 0.0.56 verlangt `def`; der Host legt es über eine vorhandene Deklaration derselben ID. Standard ist natives `<dialog>.showModal()`; `useNativeDialog: false` wählt das alte div-Overlay. Erneutes Öffnen einer offenen ID ist wirkungslos. |
| `.closeModal(id)` | Offenes Modal schließen |
| `.broadcast(channel, payload)` | An alle Panels senden |
| `.send(target, channel, payload)` | An ein Panel senden |
| `.on(channel, handler)` | Buskanal abonnieren |

`openModal()` dokumentiert hostinterne Layout-Infrastruktur, kein Rezept für
Anwendungskomponenten. Ausgelieferte Vue-Produktoberflächen sollten PrimeVue
`Dialog` oder die Bestätigungs-API des Hosts verwenden, statt das Verhalten
nativer Dialoge mit eigenem Modal-Styling nachzubauen.

### Zusammenführungssemantik von `updatePanel`

`host.layout.updatePanel(id, def)` patcht eine vorhandene Paneldefinition und
ersetzt sie nicht. Das Objekt `props` wird **flach zusammengeführt**: angegebene
Schlüssel werden ergänzt oder überschrieben, ausgelassene bleiben erhalten.
Jedes **andere** Feld auf oberster Ebene (`route`, `kind`, `id`, `tagName`,
`title`, `icon`, …) **ersetzt** den bisherigen Wert vollständig.

Für ein Panel mit `{ artifactId: 'old', zoom: 2 }`:

```typescript
// props shallow-merges → { artifactId: 'abc', zoom: 2 }
host.layout.updatePanel('right', { props: { artifactId: 'abc' } })

// route replaces wholesale; props left untouched
host.layout.updatePanel('right', { route: '/x' })
```

Zwei Einschränkungen: Das Zusammenführen ist **flach**, ein verschachteltes
Objekt in `props` wird also vollständig ersetzt. Außerdem kann es keinen
Prop-Schlüssel löschen, sondern nur überschreiben.

## Vue-Composables — `@wippy-fe/vue-host`

Diese Composables hüllen die Proxy-Layout-API in reaktive Vue-3-Refs. Das
zugrunde liegende Abonnement ist modulweit und lebt für die gesamte Laufzeit
des iframe; beim Unmount einer Komponente ist keine Bereinigung nötig:

| Composable | Rückgabe |
|---|---|
| `useWippyLayout()` | Vollständiger Layoutzustand und Mutationsmethoden |
| `useWippyPanel(panelId)` | Live-Zustand des benannten Panels (`panelId` ist erforderlich: `string`, `Ref<string>` oder Getter) |
| `useWippyBreakpoint()` | Aktiver Breakpointname als reaktives Ref |
| `useWippyMainRoute()` | Reaktives Ref auf die aktuelle Route des Hauptpanels |

Die Composables geben nie `null` zurück, sondern Objekte/Refs, deren innerer
`.value` ohne Managed-Layout-Host degradiert: `useWippyLayout().snapshot.value`
ist `null` und `isManaged.value` ist `false` (Mutationen sind stille No-ops),
`useWippyBreakpoint().value` und `useWippyMainRoute().value` sind leere Strings,
`useWippyPanel(id).value` ist bei fehlender ID `null`. Prüfen Sie den Host über
`layout.isManaged.value` oder `layout.snapshot.value !== null`, nicht durch
einen `=== null`-Test auf dem Rückgabewert. So funktionieren die Composables
auch in eigenständigen Playgrounds und Unit-Tests ohne Managed-Layout-Host.

## Swap-Buffering ohne Remount

`useSwapBuffer()` aus `@wippy-fe/layout` hält die ausgehende Oberfläche
gemountet, bis der neue Inhalt Bereitschaft meldet, mit einer ausdrücklichen
Zeitobergrenze. Verwenden Sie den unveränderlichen `slot.index` als DOM-Schlüssel
und übergeben Sie Index und Inhaltsschlüssel an `markReady()` / `markFailed()`,
damit veraltete asynchrone Signale verworfen werden. Fehler bleiben je Buffer
isoliert. Die Inhaltsidentität gehört in `keyOf`; ein geänderter DOM-Schlüssel
würde den iframe neu einsetzen und den Zustand zerstören, den das Buffering
erhalten soll.

```typescript
const swap = useSwapBuffer<Surface>({
  keyOf: surface => surface.ownerId,
  buffers: 2,
  readyTimeoutMs: 8_000,
  loaderDelayMs: 250,
  loaderMinMs: 400,
})

const slot = swap.push(surface)
swap.markReady(slot.index, slot.key)
// or: swap.markFailed(slot.index, error, slot.key)
```

Die gezeigten Werte sind die Standards. Bei einem Bereitschafts-Timeout wird
der Inhalt standardmäßig freigegeben, statt alten Inhalt hinter einem Loader
zu lassen. Binden Sie Lade-UI an `swap.showLoader`, nicht direkt an die
Bereitschaft. Ein fehlgeschlagener Buffer bleibt vom anderen isoliert; rufen
Sie nach Fehlerbehandlung `clearError(index)` auf, um erneut zu versuchen.

### Seitenbereitschaft im Web Host

Der Web Host nutzt dieselbe schlüsselgebundene Bereitschaft für verwaltete
Seitenoberflächen mit einer endgültigen Freigabe nach 14 Sekunden. Seiten- und
direkte Web-Component-Renderer senden `load` / `error` über Vue-Event-Listener
und übermitteln den unveränderlichen Inhaltsschlüssel des Renderers. Gemalter
Inhalt wird sofort sichtbar; die Zeitobergrenze ist nur ein Fallback für
Inhalte ohne Signal. Ein verspätetes Ereignis eines verdrängten Renderers wird
abgelehnt, sobald dessen Bufferindex wiederverwendet wurde.

Verwenden Sie die 14-Sekunden-Grenze nicht als Anwendungsverzögerung und legen
Sie keinen zweiten Timer um die normale Seitenbereitschaft. Erreicht eine Seite
regelmäßig diese Grenze, ist ihr Bereitschafts- oder Lebenszykluspfad defekt.

### Stabile Komponentenaktualisierung und Panelgrößen

Bei `kind: component` aktualisieren oder entfernen geänderte `props` Attribute
am vorhandenen Custom Element. Nur ein geänderter `tagName` ersetzt das Element.
So bleibt elementeigener Zustand bei `updatePanel()` und Breakpoint-Wechseln erhalten.

`minSize` und `maxSize` begrenzen nur die aktive Teilungsachse: Breite in einem
horizontalen, Höhe in einem vertikalen Baum. Die Querachse bleibt unbegrenzt.
Drawer-Mounts folgen der animierten Drawer-Geometrie und werden nur im offenen
Zustand über Anker und Hintergrund gehoben, ohne ihren Inhalt neu zu mounten.

## Splitter- und Griffgestaltung

Der Trefferbereich des Splitters ist breiter als seine sichtbare Linie und
liegt in der isolierten Ebenenfolge des Pakets. `--wippy-layout-splitter-z-index`
ist standardmäßig `700`, unter Drawern und Modal-Hintergründen. Der runde Griff
ist optional:

| Variable | Standard | Zweck |
|---|---|---|
| `--wippy-layout-splitter-size` | `1px` | Sichtbare Linienstärke |
| `--wippy-layout-splitter-hit-size` | `10px` | Zeigertrefferbereich; `24px` bei groben Zeigern |
| `--wippy-layout-splitter-z-index` | `700` | Splitter- und Griffebene |
| `--wippy-layout-splitter-handle-size` | `0` | Griffdurchmesser; `0` deaktiviert ihn |
| `--wippy-layout-splitter-handle-bg` | `transparent` | Grifffüllung |
| `--wippy-layout-splitter-handle-border` | `0 solid transparent` | Rahmen-Kurzform |
| `--wippy-layout-splitter-handle-shadow` | `none` | Griffschatten |
| `--wippy-layout-splitter-handle-icon-color` | `transparent` | Theme-bewusste SVG-Farbe über `currentColor` |

Setzen Sie beim Aktivieren Größe, Füllung, Rahmen/Schatten und Symbolfarbe
gemeinsam. Bei vertikalen Splittern dreht sich das SVG um 90 Grad; bei
gesperrten Teilungen bleibt es verborgen.

## Welche Funktionen in welchem Modus wirken :id=funktionsumfang-nach-modus

Die Oberfläche der Proxy-API ist in Compat und Managed identisch; dieselben
Importe aus `@wippy-fe/proxy` werden aufgelöst. Zwei Bereiche unterscheiden
sich jedoch in ihrer **Wirkung**.

### `host.layout` wirkt nur im Managed-Modus

Der Host installiert den Layout-Empfänger **nur bei deklarierter Layoutkonfiguration**
(Managed-Einstieg, durch `hostConfig.layout` gesteuert). In Compat existiert
`host.layout`, doch `host.layout.snapshot` ist `null` und jede Mutation sowie
jeder Busaufruf ist ein **stiller No-op**. Prüfen Sie vor Mutationen den Snapshot:

```typescript
if (host.layout.snapshot) {
  host.layout.updatePanel('right', { route: '/details' })   // managed only
}
// Vue: const { isManaged } = useWippyLayout(); if (isManaged.value) { … }
```

Unabhängig davon sind `addPanel` und `setLayout` in keinem Modus über den Proxy
verfügbar; siehe [Bekannte Einschränkungen](#bekannte-einschränkungen).

### `host.*`-Befehle mit Annahmen über die Compat-Shell

Die Managed-Shell rendert **nur das deklarierte Layout**. Seit Web Host 1.0.50
veröffentlichen Befehle für die Compat-Chrome typisierte `@HOST/intent`-
Nachrichten. Deklarieren Sie `@HOST/compat-coordinator` oder implementieren Sie
einen gleichwertigen Koordinator:

| `host.*`-Befehl | Compat (Standard) | Managed |
|---|---|---|
| `setContext`, `toast`, `confirm`, `handleError`, `logout`, `bridge.*`, `state` / `ws` / `on` auf oberster Ebene | Funktioniert | Funktioniert direkt; Managed mountet globale Toast- und Bestätigungsoberflächen |
| `openArtifact(id, ...)` | Öffnet rechts oder in einem Modal | Veröffentlicht einen Intent; der Compat-Koordinator adressiert `artifactPanel` oder `modalId` |
| `startChat(token)` / `openSession(uuid)` | Öffnet und zeigt die Session | Veröffentlicht einen Intent; der Compat-Koordinator löst Start-Tokens auf und aktualisiert `chatPanel` |
| `navigate(url)` | Schreibt in den Compat-Root-Router | Veröffentlicht einen Intent; `routeSync` wendet ihn auf das Hauptpanel an und hält die Browserhistorie synchron |
| `onRouteChanged(route, navId?)` | Steuert die Browser-URL des Hosts | Aktualisiert den Panel-Routenzustand; `routeSync` projiziert die Hauptroute in die Browser-URL |

Ist noch kein Koordinator verfügbar, werden Start-Intents bis zum ersten
Abonnement begrenzt gepuffert. Eine Deklaration ohne Handler wird in der
Start-Paritätstabelle gemeldet. Reservierte Intents sind nur für
`coordinators` lesbar und können von gewöhnlichen Panels nicht gefälscht werden.

## Ansatz für Zustandsverwaltung

Drei Ebenen in bevorzugter Reihenfolge:

**Route** — Teilbarer oder als Lesezeichen sinnvoller Zustand gehört in die URL.
Jedes Panel mit `kind: page` betreibt seinen Router und reagiert auf `@history`.

**Layout-Snapshot** — Layoutform wie Größen, Einklappstatus und Komponenten-Props
gehört über `updatePanel` oder `resizePanel` in den Snapshot. Alle Abonnenten
sehen jede Änderung; Payloads sollten klein bleiben.

**Panel-lokal** — Formularentwürfe, Modalzustand und andere flüchtige UI bleiben
in den Pinia-Stores oder Refs des Panels.

## Kanonisches Koordinationsmuster

Empfohlen ist: Busereignis → Koordinatordienst → `updatePanel` → das Panel
reagiert über seinen Router.

```typescript
// In the coordinator service
this.host?.layout.on('open-chat', ({ payload }) => {
  this.host?.layout.updatePanel('right', { route: `/open-chat/${payload.token}` })
  this.host?.layout.expandPanel('right')
})

// In the right-panel app (a normal Vue page module)
const router = createAppRouter([...])
// createAppRouter already mirrors host history events into the router
// with an echo/current-route guard; add no manual routing subscription.
```

Halten Sie Koordinatoren schlank. Panels sollen ihre eigene UI besitzen.

## Bekannte Einschränkungen

In Draft 1 sind noch nicht implementiert:

- **`addPanel` / `setLayout` über den Proxy** — nicht ausgeliefert. Sie existieren nur im internen `LayoutManager` aus `@wippy-fe/layout`. `openModal`, `closeModal` und `movePanel` sind verfügbar.
- **UI zum Ziehen und Neuordnen von Panels** — Datenmodell und `movePanel()` funktionieren, die Benutzeroberfläche fehlt.
- **Container für allgemeine Tabs** — nicht implementiert. `@HOST/panel-tab` blendet ein eingeklapptes Panel am Rand ein und ist kein allgemeiner Tab-Container.
- **Grid-Kachelcontainer** — nicht implementiert.
- **Persistenz von Laufzeitmutationen** — Änderungen überstehen kein Neuladen. Bei Bedarf manuell persistieren:
  ```typescript
  on('@layout-change', () =>
    state.set('layout', host.layout.snapshot)
  )
  ```
- **Header-Erweiterungspunkte für `nav-sidebar`** — Positionen von Logo, App-Name und Umschaltknopf sind in diesem Draft fest.

## Siehe auch

- [Facade-Einstiegspunkt](./entry-point.md) — Laden des JS-Modul-Einstiegs und Ausliefern der Konfiguration
- [Bootstrap-Ablauf](./bootstrap.md) — Auswahl des Managed-Layout-Einstiegs beim Start
- [Pakete](./packages.md) — `@wippy-fe/layout`, `@wippy-fe/vue-host`, `@wippy-fe/webcomponent-core`, `@wippy-fe/webcomponent-vue`
