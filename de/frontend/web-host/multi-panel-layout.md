---
title: "Multi-Panel-Layout"
description: "Der Managed-Layout-Modus ersetzt die Standard-Wippy-Chrome durch einen vollständig deklarativen Panel-Baum. Statt der festen Chat-und-Seitenleisten-Shell…"
---

# Multi-Panel-Layout

> **Status: Draft 1 (Vorschau) — Early Access, nicht für den Produktivbetrieb.** Die Managed-Layout-API ist ausgeliefert, aber noch nicht bei einem Produktivkonsumenten erprobt. Feldnamen, Defaults und Validierungsregeln können sich zwischen Minor-Releases noch ändern. Pinnen Sie auf eine exakte CDN-Version, bis dieser Hinweis entfernt ist. **Für nahezu alle Anwendungen ist der Standardmodus `compat` der empfohlene Produktivmodus** — greifen Sie nur dann zum Managed Layout, wenn Sie die Chrome wirklich selbst komponieren müssen.

Der Managed-Layout-Modus ersetzt die Standard-Wippy-Chrome durch einen vollständig deklarativen Panel-Baum. Statt der festen Chat-und-Seitenleisten-Shell beschreiben Sie einen Baum benannter Panels in Ihrem Backend-YAML. Der Web Host baut das Layout beim Start zusammen, validiert es und hält es zur Laufzeit reaktiv. Panels lassen sich ohne Neuladen der Seite in der Größe ändern, einklappen, tauschen, hinzufügen und entfernen.

## Wann Managed Layout verwenden

Der Standardmodus `compat` (der Default) liefert Ihnen das feste Wippy-Produkt: Navigations-Seitenleiste, Chat-Panel, Page-Bereich und ein rechtes Artefakt-Panel. Er ist der aktuelle, meistgenutzte Produktivmodus und für nahezu alle Anwendungen ausreichend.

Wählen Sie `fe_mode = managed` (Early Access) nur, wenn Sie die Chrome selbst komponieren müssen:

| Bedarf | Compat | Managed |
|------|--------|---------|
| Standard-Wippy-Chat + Navigation | Ja | Ersetzbar |
| Mehrere Page-Slots nebeneinander | Nein | Ja |
| Eigene Seitenleiste oder Koordinator-Komponente | Eingeschränkt | Ja — jede Panel-Art |
| Responsive Layouts je Breakpoint | Nein | Ja |
| Schwebende Overlay-Panels | Nein | Ja |
| Headless-Koordinator-Komponente | Nein | Ja (`coordinators`) |
| URL-bewusstes Routing pro Panel | Nur Haupt-Panel | Jedes `kind: page`-Panel |
| Panelübergreifender Nachrichtenbus | Nein | Ja (`broadcast`/`send`/`on`) |

## Kompatibilität

Das Managed Layout erstreckt sich über den Web Host, die Facade und mehrere `@wippy-fe/*`-Packages. Verwenden Sie eine kompatible Package-Familie für exakt das Ziel-Web-Host-Release und prüfen Sie dessen ausgelieferte Import Map; mischen Sie keine Package-Versionen aus zusammenhanglosen Releases.

### Release-Übersicht

| Release | Ergänzungen zum Managed Layout |
|---|---|
| Web Host `1.0.50`, Wippy FE `0.0.50` | Typisierte Compat-Intents, `@HOST/compat-coordinator`, Synchronisation von Browser-URL und Vor/Zurück, eingebaute Panel-Tabs, verankerte schwebende Panels und `useSwapBuffer()`. |
| Web Host `1.0.51`, Wippy FE `0.0.51` | Reaktive und race-sichere Session-/Token-Steuerung von `<wippy-chat>`, optionale gethemte Splitter-Griffe, Größenbeschränkungen nur auf der Split-Achse, Korrekturen an Drawer-Geometrie und -Stapelung sowie die mitgelieferte Proxy-Source-Map. |
| Web Host `1.0.52`, Wippy FE `0.0.52` | Typisierte Sichtbarkeit beibehaltener WCs und `useHostVisibilityRefresh()`, sofortige Page-Bereitschaft statt Warten auf den 14-Sekunden-Fallback, Zurückweisung veralteter Renderer-Keys, In-place-Updates von Komponenten-Props und die isolierte Splitter-Schicht mit `--wippy-layout-splitter-z-index`. |

Die 14-Sekunden-Page-Einblendung ist ein Fallback von Web Host `1.0.52`, kein
Feature von 1.0.51 und keine Ladeverzögerung der Anwendung. Split-Achsen-Sizing
und reaktiver Chat kamen in 1.0.51; beibehaltene Sichtbarkeit, keyed Readiness
und Splitter-Schichtung kamen in 1.0.52.

Beibehaltene Sichtbarkeit direkter Web Components erfordert Web Host `1.0.52`
sowie `@wippy-fe/webcomponent-core`, `@wippy-fe/webcomponent-vue` und
`@wippy-fe/shared` `0.0.52`. Frühere Managed-Layout-Releases bieten weder den
typisierten `data-wippy-visible`-Vertrag noch `useHostVisibilityRefresh()`.

### Beibehaltene Aktivität von Web Components

Managed Layouts halten Panels über Buffer-Swaps, Breakpoint-Wechsel und
Drawer-Schließ-/Öffnungszyklen hinweg gemountet. Der Host setzt
`data-wippy-visible="true" | "false"`, bevor er ein direktes Custom Element
verbindet, und aktualisiert es an Ort und Stelle, wenn die logische Zuständigkeit
wechselt. Das ist weder CSS- noch Viewport- noch Dokument-Sichtbarkeit, und es
bedeutet nie ein Remount.

Vue-Komponenten lesen den Zustand mit `useHostVisibility()` oder kombinieren
gewöhnliches initiales Laden mit Refreshes bei Einblendung über
`useHostVisibilityRefresh(task)`. Letzteres läuft nach dem Mounten und danach nur
bei exakt `false -> true`. Verwenden Sie in einer direkten WC nicht das
Proxy-Topic `@visibility`; das ist der Nachrichtenkanal für iframes/Web
Fragments.

Pinnen Sie auf ein exaktes CDN-Tag — mindestens `https://web-host.wippy.ai/webcomponents-1.0.52` —, bis der Draft-1-Hinweis entfernt ist.

## Managed Layout aktivieren

Aktivieren Sie den Managed-Einstieg in Ihrer Facade-Konfiguration und liefern Sie eine Backend-Deklaration `host_config.layout`:

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

Ist der Managed-Einstieg gewählt, liefert die Facade `managed-layout.js` statt `module.js` aus. `fe_mode` ist aktuell ein Anforderungsparameter der Facade (Default `compat`, optional `managed`); er wird auf der `wippy.facade`-Anforderung gesetzt und nicht in der `AppConfig`-Payload transportiert. Es gibt kein Feld `AppConfig.feature` — das Managed Layout wird dem Child ausschließlich über `AppConfig.hostConfig.layout` mitgeteilt. Die *Oberfläche* der Proxy-API ist in beiden Modi identisch, aber manche Kommandos wirken nur in einem Modus — siehe [What works in which mode](#what-works-in-which-mode).

## Die `HostLayoutDeclaration`

Das gesamte Layout wird durch ein einziges `HostLayoutDeclaration`-Objekt beschrieben, das im Backend unter `host_config.layout` Ihrer Facade-Konfiguration verschachtelt ist und ins Frontend nach `AppConfig.hostConfig.layout` projiziert wird. Der Host validiert es vor dem Mounten — jeder `LayoutValidationError` erscheint in der Browser-Konsole mit `{ kind, message, panelId? }`.

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `layouts` | `Record<string, PanelTree> & { default: PanelTree }` | Panel-Bäume, nach Breakpoint indiziert. Der Key `default` ist erforderlich. |
| `breakpoints?` | `Record<string, number>` | Pixelbreiten, die Nicht-Default-Layout-Keys aktivieren. |
| `panels` | `Record<string, HostPanelDef>` | Benannte Definitionen von Panel-Inhalten. |
| `floating?` | `Record<string, HostFloatingDef>` | Schwebende Overlay-Panels zur Boot-Zeit. |
| `modals?` | `Record<string, HostModalDef>` | Modal-Definitionen zur Boot-Zeit. |
| `coordinators?` | `Record<string, HostCoordinatorDef>` | Headless-Koordinator-Komponenten. |
| `services?` | `Record<string, HostCoordinatorDef>` | Veralteter Alias für `coordinators`; neue Deklarationen müssen `coordinators` verwenden. |
| `dragEnabled?` | boolean | Erlaubt benutzergesteuertes Ziehen des Splitters. Default `true`. |

## Panel-Arten

Jeder Eintrag in `panels`, `floating`, `modals` und `coordinators` ist eine über `kind` getaggte Union:

| Art | Beschreibung | Erforderliche Felder |
|------|-------------|-----------------|
| `page` | Ein Wippy-Page-Modul, gemountet in einem srcdoc-iframe | `id` (Page-Registry-ID) |
| `artifact` | Ein Wippy-Artefakt, gemountet in einem srcdoc-iframe | `id` (Artefakt-UUID) |
| `component` | Eine Web Component, direkt im Host-DOM gemountet | `tagName` |
| `builtin` | Eine framework-eigene Host-Komponente (siehe unten) | `id` |

Genau ein Panel im Layout-Baum muss `main: true` tragen. Die Zuständigkeit für die Browser-URL erfordert weiterhin Routen-Synchronisation über `@HOST/compat-coordinator` oder eine äquivalente Koordination beim Konsumenten. Alle anderen Panels routen unabhängig innerhalb ihrer iframes.

### Eingebaute Panel-IDs

`kind: builtin` akzeptiert die folgenden `id`-Werte. Das Präfix `@HOST/` ist für framework-eigene Panels reserviert:

| ID | Was sie rendert |
|----|-----------------|
| `@HOST/nav-sidebar` | Standard-Wippy-Navigations-Seitenleiste (Sessions, Pages, Einstellungen) |
| `@HOST/chat-wrapper` | Standard-Wippy-Chat-Panel für die aktive Session |
| `@HOST/artifact-viewer` | Generischer Artefakt-Viewer (mit Route `/:uuid` kombinieren) |
| `@HOST/session-selector` | Session-Liste und -Auswahl |
| `@HOST/compat-coordinator` | Headless-Koordinator für Compat-Intents und Hauptroute; unter `coordinators` deklarieren |
| `@HOST/panel-tab` | Rand-Tab, um ein eingeklapptes Panel wieder einzublenden; unter `floating` deklarieren |

Ein unbekanntes `@HOST/<id>` verursacht beim Laden der Deklaration einen `LayoutValidationError`, statt stillschweigend einen leeren Slot zu rendern.

## Layouts nach Breakpoint

Das Feld `layouts` bildet Breakpoint-Keys auf Panel-Bäume ab. `default` wird immer verwendet, sofern kein schmalerer Breakpoint greift. Die Pixelbreiten der Breakpoints werden unter `breakpoints` definiert:

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

Wechselt der Breakpoint, behalten Panels mit derselben `id` einen stabilen Content-Host, der dem aktiven Slot visuell folgt, ohne umgehängt zu werden. Der `contentWindow` des iframes, der Zustand der Web Component, der Vue-Zustand und die Scroll-Position überstehen den Übergang; Umhängen per Teleport wird bewusst vermieden, weil das Entfernen und Wiedereinfügen eines iframes ihn neu lädt.

### Panels im Drawer-Modus

Ein Panel-Slot kann `display: 'drawer-left' | 'drawer-right' | 'drawer-bottom'` deklarieren, um als eingleitendes Overlay statt als Inline-Flex-Element zu rendern. Drawer-Panels:

- Nehmen nicht an der Track-Größenbestimmung ihres Parent-Containers teil (`size` wird ignoriert)
- Rendern als absolut positionierte Overlays, verankert an der benannten Kante
- Haben einen Offen/Geschlossen-Zustand, umschaltbar über `host.layout.openDrawer(id)` / `closeDrawer(id)` / `toggleDrawer(id)`
- Zeigen im geöffneten Zustand ein Backdrop; ein Klick auf das Backdrop schließt alle offenen Drawer

Slots mit `main: true` können nicht im Drawer-Modus laufen — die Host-Validierung wirft einen Fehler. Das Feld `drawerSize.width` steuert die Breite für linke/rechte Drawer, `drawerSize.height` die Höhe für untere Drawer. Der Default ist `320px`.

## Schwebende Panels

Schwebende Panels sind frei positionierte Overlays, deklariert unter `floating`. Sie nehmen nicht am Flex-Layout-Baum teil und können zur Laufzeit hinzugefügt oder entfernt werden:

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
// Ein schwebendes Panel hinzufügen
host.layout.addFloating('inspector', {
  kind: 'component',
  tagName: 'my-inspector',
  position: { x: 100, y: 100 },
  size: { width: 400, height: 300 },
})

// Es entfernen
host.layout.removeFloating('inspector')
```

## Headless-Koordinatoren

Koordinatoren sind Komponenten, die in einem versteckten Host gemountet werden. Sie haben keinen sichtbaren Slot, erhalten aber die panelbezogene Host-API. Verwenden Sie sie für übergreifende Logik, damit Anzeige-Panels sich aufs Rendern konzentrieren. Das ältere Feld `services` bleibt ein veralteter Kompatibilitäts-Alias.

```yaml
coordinators:
  coordinator:
    kind: component
    tagName: my-coordinator
```

Eine Koordinator-Komponente erhält den panelbezogenen Host-Wrapper und kann Bus-Kanäle sofort in `onMount` abonnieren:

```typescript
import { WippyElement } from '@wippy-fe/webcomponent-core'

class MyCoordinator extends WippyElement {
  protected onMount() {
    this.host?.layout.on('open-chat', ({ payload }) => {
      this.host?.layout.updatePanel('right', { route: `/open-chat/${payload.token}` })
      this.host?.layout.expandPanel('right')
    })
  }
  protected onUnmount() {}
  static get wippyConfig() { return { propsSchema: { properties: {} } } }
}
customElements.define('my-coordinator', MyCoordinator)
```

### Mitgelieferter Compat-Koordinator

Ein Managed Layout enthält nur deklarierte Oberflächen. Aufrufe wie
`host.openArtifact()`, `host.startChat()`, `host.openSession()` und
`host.navigate()` veröffentlichen daher typisierte Intents auf dem reservierten
Kanal `@HOST/intent`. Deklarieren Sie den mitgelieferten Koordinator, damit sie
verarbeitet werden und die Browser-URL an das Haupt-Panel gebunden wird:

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

Belassen Sie `routeSync: true`, wenn Sie den Standard-Navigationsvertrag
verwenden. Ohne einen Koordinator oder äquivalente Logik beim Konsumenten haben
Deep Links, Vor/Zurück und die Navigation über `@HOST/nav-sidebar` keine
Panel-Route, die sie steuern könnten. Intents, die während des Child-Boots
ausgelöst werden, werden in einer begrenzten Warteschlange gehalten, bis der
erste Koordinator sie abonniert.

`@HOST/` ist in beide Richtungen reserviert: Gewöhnliche Panels können keinen
System-Verkehr veröffentlichen, und nur Einträge unter `coordinators` empfangen
ihn über unterstützte Host-APIs. Diese Grenze wird für iframe-/Web-Fragment-Panels
durchgesetzt. Eine direkte Komponente, die im Host-Realm gemountet ist, teilt das
Host-DOM und ist keine Sicherheits-Sandbox. Beim Start gibt der Host eine
Paritätstabelle aus, wenn die Behandlung durch einen Koordinator, eine
Zieloberfläche für Modals, die URL-Bindung des Haupt-Panels oder ein deklariertes
Koordinator-Tag fehlt; eine vollständige Deklaration erzeugt keine Warnung.

## Der In-Tab-Broadcast-Bus

Panels kommunizieren über einen Bus, der auf den aktuellen Browser-Tab beschränkt ist. Der Bus überschreitet nie die Grenze zu anderen Tabs — verwenden Sie ein eigenes WebSocket-Topic, wenn Sie tab-übergreifende Synchronisation brauchen.

| Methode | Beschreibung |
|--------|-------------|
| `host.layout.broadcast(channel, payload)` | An alle Panels veröffentlichen; der Sender ist ausgenommen |
| `host.layout.send(targetPanelId, channel, payload)` | An genau ein Panel veröffentlichen |
| `host.layout.on(channel, handler)` | Abonnieren; gibt eine `off()`-Funktion zum Abbestellen zurück |

Die `sourcePanelId` empfangener Nachrichten wird vom Host aus dem veröffentlichenden Window gesetzt und kann nicht gefälscht werden. Kanalnamen sind einfache, groß-/kleinschreibungssensitive Strings.

**Wichtig:** Komponenten, die `host` direkt aus `@wippy-fe/proxy` importieren, umgehen das Panel-Scoping — Bus-Aufrufe gehen zwar durch, verlieren aber die `sourcePanelId`. Verwenden Sie stattdessen immer den panelbezogenen Wrapper:

```typescript
// rohes HTMLElement
import { getWippyHost } from '@wippy-fe/webcomponent-core'
const host = getWippyHost(this)

// WippyElement-Subklasse — this.host ist bereits panelbezogen
this.host?.layout.broadcast('open-chat', { token: 'abc' })

// Vue-Komponente
import { useHost } from '@wippy-fe/webcomponent-vue'
// ProxyApiInstance ist ein ambienter globaler Typ (aus @wippy-fe/types-global-proxy) — ohne Import referenzieren.
const host = useHost<ProxyApiInstance['host']>()
host?.layout.broadcast('open-chat', { token: 'abc' })
```

## Referenz der Layout-API (`host.layout`)

| Methode | Beschreibung |
|--------|-------------|
| `.snapshot` | Synchroner Getter, der den vollständigen Layout-Snapshot liefert, oder `null` außerhalb des Managed-Layout-Modus |
| `.resizePanel(id, size)` | Größe des benannten Panels im aktiven Breakpoint ändern |
| `.collapsePanel(id)` | Ein als `collapsible: true` deklariertes Panel einklappen |
| `.expandPanel(id)` | Ein eingeklapptes Panel ausklappen |
| `.openDrawer(id)` | Ein Panel im Drawer-Modus öffnen |
| `.closeDrawer(id)` | Ein Panel im Drawer-Modus schließen |
| `.toggleDrawer(id)` | Ein Panel im Drawer-Modus umschalten |
| `.movePanel(id, target)` | Panel an eine neue Position im Baum verschieben |
| `.removePanel(id)` | Panel aus allen Breakpoint-Layouts entfernen |
| `.updatePanel(id, def)` | Panel-Definition zur Laufzeit patchen; `props` wird flach gemischt, Top-Level-Felder werden ersetzt |
| `.addFloating(id, def)` | Ein schwebendes Panel hinzufügen |
| `.removeFloating(id)` | Ein schwebendes Panel entfernen |
| `.openModal(id, def?)` | Ein deklariertes Modal per ID öffnen, optional mit überschriebener Definition. Reine Laufzeit-Modals benötigen `def`. Natives `<dialog>.showModal()` ist der Default; übergeben Sie `useNativeDialog: false` für das alte div-Overlay. Das erneute Öffnen einer bereits offenen ID ist ein stiller No-op. |
| `.closeModal(id)` | Ein offenes Modal schließen |
| `.broadcast(channel, payload)` | An alle Panels veröffentlichen |
| `.send(target, channel, payload)` | An ein Panel veröffentlichen |
| `.on(channel, handler)` | Einen Bus-Kanal abonnieren |

`openModal()` dokumentiert host-interne Layout-Infrastruktur, kein Rezept für Anwendungskomponenten. Ausgelieferte Vue-Produkt-UI sollte PrimeVue `Dialog` oder die Bestätigungs-API des Hosts verwenden, statt dieses Native-Dialog-Verhalten mit eigenem Modal-Styling nachzubauen.

### Merge-Semantik von `updatePanel`

`host.layout.updatePanel(id, def)` patcht eine bestehende Panel-Definition — es ersetzt sie nicht. Das `props`-Objekt wird **flach** in die aktuellen Props des Panels gemischt: übergebene Keys werden hinzugefügt oder überschrieben, weggelassene Keys bleiben erhalten. Jedes **andere** Top-Level-Feld von `def` (`route`, `kind`, `id`, `tagName`, `title`, `icon`, …) **ersetzt** den aktuellen Wert vollständig.

Bei einem Panel, dessen aktuelle Props `{ artifactId: 'old', zoom: 2 }` sind:

```typescript
// props wird flach gemischt → { artifactId: 'abc', zoom: 2 }
host.layout.updatePanel('right', { props: { artifactId: 'abc' } })

// route wird vollständig ersetzt; props bleiben unberührt
host.layout.updatePanel('right', { route: '/x' })
```

Zwei Vorbehalte: Der Props-Merge ist **flach** — ein verschachteltes Objekt innerhalb von `props` wird vollständig ersetzt, nicht tief gemischt — und ein flacher Merge kann keinen Prop-Key löschen (Sie können ihn nur überschreiben).

## Vue-Composables — `@wippy-fe/vue-host`

Diese Composables wickeln die Proxy-Layout-API in reaktive Vue-3-Refs. Die zugrunde liegende Subscription ist modulweit und lebt für die Lebensdauer des iframes, es gibt also kein Aufräumen pro Komponente beim Unmount:

| Composable | Liefert |
|------------|---------|
| `useWippyLayout()` | Vollständigen Layout-Zustand und Mutationsmethoden |
| `useWippyPanel(panelId)` | Live-Zustand des benannten Panels (`panelId` ist erforderlich — `string`, `Ref<string>` oder Getter) |
| `useWippyBreakpoint()` | Name des aktiven Breakpoints als reaktive Ref |
| `useWippyMainRoute()` | Reaktive Ref auf die aktuelle Route des Haupt-Panels |

Die Composables liefern nie `null` — sie geben immer Objekte/Refs zurück, deren inneres `.value` degradiert, wenn kein Managed-Layout-Host vorhanden ist: `useWippyLayout().snapshot.value` ist `null` (und `isManaged.value` ist `false`, Mutationen sind also stille No-ops), `useWippyBreakpoint().value` und `useWippyMainRoute().value` sind leere Strings, und `useWippyPanel(id).value` ist `null`, wenn die ID fehlt. Prüfen Sie die Anwesenheit des Hosts mit `layout.isManaged.value` (oder `layout.snapshot.value !== null`) statt mit einer `=== null`-Prüfung auf den Rückgabewert. Das hält die Composables in eigenständigen Playgrounds und Unit-Tests nutzbar, wo kein Managed-Layout-Host vorhanden ist.

## Swap-Buffering ohne Remounts

`useSwapBuffer()` aus `@wippy-fe/layout` hält die abgehende Oberfläche gemountet,
bis der eingehende Inhalt Bereitschaft meldet, mit einer expliziten
Timeout-Obergrenze. Verwenden Sie den unveränderlichen `slot.index` als DOM-Key,
übergeben Sie sowohl Index als auch Content-Key an `markReady()` /
`markFailed()`, damit veraltete asynchrone Signale zurückgewiesen werden, und
halten Sie Fehler je Buffer isoliert. Die Inhaltsidentität gehört in `keyOf`; ein
geänderter DOM-Key würde einen iframe neu einfügen und genau den Zustand
zerstören, den das Buffering bewahren soll.

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
// oder: swap.markFailed(slot.index, error, slot.key)
```

Die gezeigten Werte sind die Defaults. Ein Bereitschafts-Timeout blendet den
Inhalt standardmäßig ein, statt veralteten Inhalt hinter einem Loader zu
belassen. Binden Sie Lade-UI an `swap.showLoader`, nicht direkt an die
Bereitschaft. Ein fehlgeschlagener Buffer bleibt von seinem Geschwister isoliert;
rufen Sie nach der Fehlerbehandlung `clearError(index)` auf, um es erneut zu
versuchen.

### Page-Bereitschaft im Web Host

Der Web Host verwendet für Managed-Page-Oberflächen dieselbe keyed
Readiness-Disziplin, mit einer finalen Einblende-Obergrenze von 14 Sekunden.
Iframe- und direkte Web-Component-Renderer geben `load` / `error` über
Vue-Event-Listener aus und enthalten den unveränderlichen Content-Key, der diesem
Renderer gehört. Gezeichneter Inhalt wird daher sofort eingeblendet; die
Obergrenze ist nur ein Fallback für Inhalte, die nie melden. Ein spätes Event
eines verdrängten Renderers wird zurückgewiesen, wenn sein Buffer-Index bereits
wiederverwendet wurde.

Verwenden Sie die 14-Sekunden-Obergrenze des Hosts nicht als Ladeverzögerung der
Anwendung und legen Sie keinen zweiten Timer um die normale Page-Bereitschaft.
Eine Page, die regelmäßig die Obergrenze erreicht, hat einen kaputten
Bereitschafts- oder Lifecycle-Pfad, der bei ihrem Eigentümer repariert gehört.

### Stabile Komponenten-Updates und Panel-Größen

Bei `kind: component` aktualisiert oder entfernt eine Änderung der Panel-`props`
Attribute am bestehenden Custom Element. Der Host ersetzt das Element nur, wenn
sich `tagName` ändert. Das bewahrt den elementeigenen Zustand während
`updatePanel()`-Aufrufen und Breakpoint-Übergängen.

`minSize` und `maxSize` beschränken nur die aktive Split-Achse: Breite in einem
horizontalen Baum, Höhe in einem vertikalen. Sie begrenzen die Querachse nicht,
sodass Navigation, Chat und andere Mounts über die volle Höhe ihren Track füllen
können. Drawer-Mounts folgen der animierten Drawer-Geometrie und werden nur im
geöffneten Zustand über ihren Anker und ihr Backdrop gehoben, ohne ihren Inhalt
neu zu mounten.

## Styling von Splitter und Griff

Die Trefferfläche des Splitters ist breiter als seine sichtbare Linie und liegt im
isolierten Schichtenstapel des Packages. `--wippy-layout-splitter-z-index` hat den
Default `700`, unterhalb von Drawern und Modal-Backdrops. Der runde Griff ist
optional:

| Variable | Default | Zweck |
|---|---|---|
| `--wippy-layout-splitter-size` | `1px` | Dicke der sichtbaren Splitter-Linie |
| `--wippy-layout-splitter-hit-size` | `10px` | Trefferfläche für den Zeiger rund um die Linie; `24px` bei groben Zeigern |
| `--wippy-layout-splitter-z-index` | `700` | Schicht von Splitter und Griff |
| `--wippy-layout-splitter-handle-size` | `0` | Durchmesser des Griffs; `0` deaktiviert ihn |
| `--wippy-layout-splitter-handle-bg` | `transparent` | Füllung des Griffs |
| `--wippy-layout-splitter-handle-border` | `0 solid transparent` | Border-Kurzschreibweise |
| `--wippy-layout-splitter-handle-shadow` | `none` | Schatten des Griffs |
| `--wippy-layout-splitter-handle-icon-color` | `transparent` | Theme-bewusste SVG-Farbe über `currentColor` |

Setzen Sie Größe, Füllung, Border/Schatten und Icon-Farbe gemeinsam, wenn Sie den
Griff aktivieren. Das SVG dreht sich für vertikale Splitter um 90 Grad und bleibt
bei gesperrten Splits verborgen.

## Was in welchem Modus funktioniert

Die *Oberfläche* der Proxy-API ist im Compat- und im Managed-Modus identisch — dieselben `@wippy-fe/proxy`-Imports lösen in beiden auf —, aber zwei Teile davon sind in ihrer **Wirkung modusspezifisch**. Diese Diskrepanz ist das Wichtigste, worauf man beim Umzug einer App auf das Managed Layout achten muss (und ein Grund, warum Managed noch Early Access ist).

### `host.layout` wirkt nur im Managed-Modus

Der Host installiert den Layout-Empfänger **nur, wenn ein Layout deklariert ist** (der Managed-Einstieg, abhängig von `hostConfig.layout`). Im Compat-Modus existiert `host.layout` zwar, aber `host.layout.snapshot` ist `null`, und jede Mutation und jeder Bus-Aufruf (`resizePanel`, `updatePanel`, `movePanel`, `openModal`, `addFloating`, `broadcast`, `send`, `on`, …) ist ein **stiller No-op** — die Nachricht wird gesendet, aber auf Host-Seite hört niemand zu. Prüfen Sie den Snapshot, bevor Sie mutieren:

```typescript
if (host.layout.snapshot) {
  host.layout.updatePanel('right', { route: '/details' })   // nur Managed
}
// Vue: const { isManaged } = useWippyLayout(); if (isManaged.value) { … }
```

(Davon getrennt — eine andere Achse — sind `addPanel` und `setLayout` über den Proxy in *keinem* Modus verfügbar; siehe [Known Limitations](#known-limitations).)

### `host.*`-Kommandos, die die Compat-Shell voraussetzen

Die Managed-Shell rendert **nur Ihr deklariertes Layout**. Ab Web Host 1.0.50 veröffentlichen Kommandos, die normalerweise auf die Compat-Chrome zielen, typisierte `@HOST/intent`-Nachrichten, statt still fehlzuschlagen. Deklarieren Sie `@HOST/compat-coordinator` oder implementieren Sie einen äquivalenten Koordinator, um diese Intents auf Ihre Panels abzubilden:

| `host.*`-Kommando | Compat (Default) | Managed |
|---|---|---|
| `setContext`, `toast`, `confirm`, `handleError`, `logout`, `bridge.*`, Top-Level `state` / `ws` / `on` | Funktioniert | Funktioniert direkt; Managed mountet die globalen Toast- und Bestätigungsoberflächen |
| `openArtifact(id, ...)` | Öffnet im rechten Panel oder in einem Modal | Veröffentlicht einen Intent; der Compat-Koordinator zielt auf `artifactPanel` oder `modalId` |
| `startChat(token)` / `openSession(uuid)` | Öffnet und zeigt die Session | Veröffentlicht einen Intent; der Compat-Koordinator löst Start-Tokens auf und aktualisiert das deklarierte `chatPanel` |
| `navigate(url)` | Pusht den Compat-Root-Router | Veröffentlicht einen Intent; `routeSync` wendet ihn auf das Haupt-Panel an und hält die Browser-History im Gleichklang |
| `onRouteChanged(route, navId?)` | Steuert die Browser-URL des Hosts | Aktualisiert den Routenzustand des Panels; `routeSync` projiziert die Route des Haupt-Panels auf die Browser-URL |

Ist noch kein Koordinator verfügbar, werden Boot-Zeit-Intents in einer begrenzten Warteschlange für die erste Koordinator-Subscription gehalten. Eine Deklaration ohne Handler wird von der Boot-Paritätstabelle gemeldet. Reservierte Intents sind nur für `coordinators`-Einträge lesbar und können von gewöhnlichen Panels nicht gefälscht werden.

## Ansatz für State Management

Drei Stufen, in der Reihenfolge der Präferenz:

**Route** — Wenn der Nutzer den Zustand sinnvoll als Lesezeichen speichern oder teilen könnte, legen Sie ihn in die URL. Jedes `kind: page`-Panel betreibt seinen eigenen Router und reagiert auf `@history`-Events. Das ist entkoppelt, deep-linkbar und history-bewusst.

**Layout-Snapshot** — Wenn es die Layoutform betrifft (Größen, Einklapp-Flags, Komponenten-Props), legen Sie es über `updatePanel` oder `resizePanel` in den Snapshot. Jedes abonnierte Panel sieht jede Snapshot-Änderung, halten Sie Payloads also klein.

**Panel-lokal** — Alles Übrige (Formularentwürfe, Modal-Zustand, transiente UI) bleibt in den eigenen Pinia-Stores oder Refs des Panels und verlässt das Panel nie.

## Kanonisches Koordinationsmuster

Das empfohlene Muster für panelübergreifende Interaktion lautet: Bus-Event → Koordinator-Service → `updatePanel` → Panel reagiert über seinen eigenen Router.

```typescript
// Im Koordinator-Service
this.host?.layout.on('open-chat', ({ payload }) => {
  this.host?.layout.updatePanel('right', { route: `/open-chat/${payload.token}` })
  this.host?.layout.expandPanel('right')
})

// In der App des rechten Panels (ein normales Vue-Page-Modul)
const router = createAppRouter([...])
// createAppRouter spiegelt Host-History-Events bereits in den Router,
// mit Echo-/Aktuelle-Route-Schutz; ergänzen Sie keine manuelle Routing-Subscription.
```

Halten Sie Koordinatoren dünn. Lassen Sie Panels ihre eigene UI besitzen.

## Bekannte Einschränkungen

Stand Draft 1 sind folgende Punkte noch nicht implementiert:

- **`addPanel` / `setLayout` über den Proxy** — nicht ausgeliefert. Diese existieren nur auf dem internen `LayoutManager` von `@wippy-fe/layout` und sind über die iframe-Proxy-Grenze nicht verfügbar. (`openModal`, `closeModal` und `movePanel` sind ausgeliefert — siehe die Referenz der Layout-API.)
- **UI zum Umsortieren von Panels per Drag** — Datenmodell und `movePanel()`-API funktionieren; das benutzerseitige Ziehen ist noch nicht implementiert.
- **Tab-Primitive** — noch nicht implementiert.
- **Grid-Kachel-Container** — für später vorgemerkt.
- **Persistenz von Laufzeit-Mutationen** — Mutationen werden über Reloads hinweg nicht persistiert. Bei Bedarf manuell persistieren:
  ```typescript
  on('@layout-change', () =>
    state.set('layout', host.layout.snapshot)
  )
  ```
- **Erweiterungspunkte im Header-Slot von `nav-sidebar`** — Positionen von Logo, App-Name und Umschalt-Button sind in diesem Draft fest.

## Siehe auch

- [Facade Entry Point](./entry-point.md) — wie die Facade den JS-Modul-Einstieg lädt und die Konfiguration liefert
- [Bootstrap Sequence](./bootstrap.md) — wie der Host beim Start zum Managed-Layout-Einstieg verzweigt
- [Packages](./packages.md) — `@wippy-fe/layout`, `@wippy-fe/vue-host`, `@wippy-fe/webcomponent-core`, `@wippy-fe/webcomponent-vue`
