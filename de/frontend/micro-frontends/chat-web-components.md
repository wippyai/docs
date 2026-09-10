---
title: "Chat-Web-Components"
description: "Die Wippy-Chat-UI steht als Satz komponierbarer Custom Elements bereit, sodass jedes Micro-Frontend (oder jede Seite in einem Kindkontext) einen…"
---

# Chat-Web-Components

Die Wippy-Chat-UI steht als Satz **komponierbarer Custom Elements** bereit, sodass jedes Micro-Frontend (oder jede Seite, die in einem Kindkontext läuft) per Tag einen lebendigen Wippy-Chat einsetzen kann — kein Vue, keine Imports, keine Registrierung. Sie umhüllen dieselben Komponenten, die auch der Chat des Hosts verwendet (eine einzige Quelle der Wahrheit), gestützt auf dieselbe Datenschicht `ChatTransport` → `SessionManager`.

Das sind fertige Elemente, die Sie *konsumieren* — anders als eine [Web Component](./web-component.md), die Sie selbst bauen, verfassen oder registrieren Sie sie nicht. Der Host stellt sie in jedem Kind per Tag bereit (siehe [Wie sie geladen werden](#how-they-load)).

> Verwenden Sie diese, wenn Sie eine Chat-Oberfläche *innerhalb Ihrer eigenen Seite oder Ihres eigenen Panels* möchten. Um stattdessen imperativ das Chat-Panel des Hosts zu öffnen, verwenden Sie `host.startChat(token)` / `host.openSession(sessionUUID)` aus `@wippy-fe/proxy` (siehe [Proxy-API](./proxy-api.md)).

## Die Elemente

| Tag | Rendert | Wichtige Attribute | Events |
|-----|---------|----------------|--------|
| `<wippy-chat>` | Vollständiger Chat — Header + Nachrichten + Eingabe | `session-id`, `start-token`, `agent`, `show-selector`, `hide-header` | `session-started`, `error` |
| `<wippy-chat-messages>` | Nur Nachrichtenliste | `session-id` | — |
| `<wippy-chat-input>` | Nur Eingabefeld | `session-id` | — |
| `<wippy-session-selector>` | Sitzungsauswahl | `active-session-id` | `select` |

Jedes Element akzeptiert außerdem zwei Theming-Attribute pro Instanz — **`custom-css`** und **`css-variables`** — behandelt unter [Theming](#theming).

## Wie sie geladen werden

Die Chat-Elemente werden genauso ausgeliefert wie [`<wippy-loading>`](../web-host/packages.md#wippy-feloading): eine winzige Hülle, `@wippy-fe/chat.js` (~21 KB), registriert alle vier Tags automatisch und wird über das `scripts`-Array des Hosts (neben `loading.js` und `proxy.js`) in jeden Kindkontext injiziert. Die Tags sind daher in jedem Kind-Micro-Frontend namentlich verfügbar, mit **null Registrierung pro App** — Sie installieren kein Paket und rufen kein `customElements.define()` auf.

Die schweren Interna — der Vue-Baum plus PrimeVue, Shiki und der Markdown-Renderer (~2 MB) — werden per Code-Splitting in einen separaten Chunk `chat-internals.[hash].js` ausgelagert und **beim ersten Mount lazy geladen**. Während der Chunk lädt, zeigt das Element einen `<wippy-loading>`-Platzhalter; schlägt das Laden fehl, zeigt es `<wippy-error>`. Seiten, die nie ein Chat-Tag verwenden, bezahlen nie für die Interna.

## `<wippy-chat>`

Reaktive Sitzungssteuerung erfordert Web Host `1.0.51` oder neuer. Pinnen Sie die passende
Paketfamilie `@wippy-fe/*` `0.0.51+`; ältere injizierte Chat-Elemente unterstützen
nur den anfänglichen Mount zuverlässig.

Die vollständige Chat-Oberfläche: Header, scrollbare Nachrichtenliste und Eingabefeld.

| Attribut | Typ | Standard | Beschreibung |
|-----------|------|---------|-------------|
| `session-id` | string | — | Rendert diese bestehende Sitzung (eine Sitzungs-UUID). |
| `start-token` | string | — | Agent-Start-Token; startet beim Mount eine **neue** Sitzung, wenn keine `session-id` gesetzt ist. |
| `agent` | string | — | Agentenname (oder -titel), der im Leerzustand vorausgewählt wird, angezeigt wenn keine Sitzung offen ist. |
| `show-selector` | boolean | `false` | Rendert die eingebaute Sitzungsauswahl im Header. |
| `hide-header` | boolean | `false` | Blendet die Agenten-/Modell-Headerleiste aus (für kompakte Einbettungen). |

**Events** (werden als `CustomEvent`s auf dem Element ausgelöst; lesen Sie `event.detail`):

| Event | `detail` | Wann |
|-------|----------|------|
| `session-started` | `{ sessionId: string }` | Eine Sitzung wird gestartet — durch `start-token` beim Mount oder durch Benutzeraktion. |
| `error` | `{ message: string }` | Die Sitzungsinitialisierung schlägt fehl (z. B. ein ungültiges `start-token`). |

```html
<!-- Neue Sitzung aus einem Agent-Start-Token starten -->
<wippy-chat start-token="agent-start-token" agent="researcher"></wippy-chat>

<!-- Bestehende Sitzung pinnen -->
<wippy-chat session-id="019eb2ae-1234-5678-abcd-ef1234567890"></wippy-chat>

<!-- Eingebaute Auswahl, keine Headerleiste -->
<wippy-chat show-selector hide-header></wippy-chat>
```

```javascript
document.querySelector('wippy-chat')
  .addEventListener('session-started', (e) => {
    console.log('session:', e.detail.sessionId)
  })
```

### Reaktive Steuerung ohne Remount

Halten Sie ein `<wippy-chat>`-Element gemountet und aktualisieren Sie seine Attribute. Eine geänderte
`session-id` öffnet diese Sitzung an Ort und Stelle. `session-id=""` zu setzen oder ein
zuvor gesteuertes Attribut zu entfernen ist ein expliziter Übergang zu **New Chat**: Es
leert sowohl die gepinnte als auch die geteilte aktive Sitzung. Ein Element, das nie eine
`session-id` hatte, bleibt stattdessen auswahlgesteuert; ihr Fehlen beim ersten Mount ist kein
Löschbefehl.

Wenn ein `start-token` vorhanden ist, startet das Leeren von `session-id` erneut aus diesem Token.
Auch das Ändern des Tokens startet an Ort und Stelle. Das Element verbraucht ein Token
einmal pro Custom-Element-Host, sodass ein Wiederverbinden oder Verschieben desselben Elements
keinen laufenden Start wiederholt. Wenn ein neueres Token, eine gesteuerte Sitzung, eine manuelle Auswahl
oder ein Disconnect einen laufenden Start ablöst, kann das veraltete Ergebnis die aktuelle
Sitzung nicht ersetzen; eine verspätet erzeugte Sitzung wird geschlossen.

```javascript
const chat = document.querySelector('wippy-chat')

chat.setAttribute('session-id', existingSessionId)

// New Chat mit einem Agenten. Ein Elementaustausch ist nicht erforderlich.
chat.setAttribute('start-token', agentStartToken)
chat.removeAttribute('session-id')
```

Komponenten-Resolver für verwaltete Layouts aktualisieren und entfernen Props am bestehenden
Custom Element. Sie mounten nur dann neu, wenn sich `tagName` ändert, und bewahren so die Chat-Eingabe,
die Scrollposition und den elementeigenen Lifecycle-Zustand über Panel-Aktualisierungen hinweg.

## `<wippy-chat-messages>` und `<wippy-chat-input>`

Die Nachrichtenliste und das Eingabefeld als getrennte Elemente, sodass Sie sie selbst anordnen können. Jedes nimmt eine einzelne `session-id`; ohne explizite `session-id` folgen sie der [geteilten aktiven Sitzung](#composition--shared-session), die von einem `<wippy-session-selector>` gesetzt wird. Keines löst Events aus.

```html
<!-- Eigenes Layout: Nachrichten oben, Eingabefeld unten -->
<div style="display:flex; flex-direction:column; height:100%;">
  <wippy-chat-messages session-id="019eb2ae-…"></wippy-chat-messages>
  <wippy-chat-input    session-id="019eb2ae-…"></wippy-chat-input>
</div>
```

## `<wippy-session-selector>`

Eine Sitzungsauswahl. Sie steuert die geteilte aktive Sitzung, der andere Elemente folgen.

| Attribut | Typ | Standard | Beschreibung |
|-----------|------|---------|-------------|
| `active-session-id` | string | — | Hebt diese Sitzung als aktiv hervor. |

**Event:**

| Event | `detail` | Wann |
|-------|----------|------|
| `select` | `{ sessionId: string }` | Der Benutzer wählt eine Sitzung. Die gewählte Sitzung wird zur geteilten aktiven Sitzung. |

```html
<wippy-session-selector></wippy-session-selector>
```

```javascript
document.querySelector('wippy-session-selector')
  .addEventListener('select', (e) => {
    console.log('picked:', e.detail.sessionId)
  })
```

## Komposition & geteilte Sitzung

Elemente **ohne explizite `session-id`** folgen der Auswahl des `<wippy-session-selector>` über die geteilte `activeSessionId` des Managers. So bleiben eine Auswahl plus ein Chat (oder eine Auswahl plus getrennte Nachrichtenliste + Eingabefeld) auf einer Seite synchron — wählen Sie eine Sitzung in der Auswahl, und die anderen aktualisieren sich. Elemente, die **doch** eine explizite `session-id` (oder ein `start-token`) tragen, sind gepinnt und ignorieren die Auswahl.

```html
<!-- Auswahl + Chat: der Chat folgt der gewählten Sitzung -->
<wippy-session-selector></wippy-session-selector>
<wippy-chat></wippy-chat>

<!-- Auswahl + getrennte Nachrichtenliste / Eingabefeld, alle folgen der Auswahl -->
<wippy-session-selector></wippy-session-selector>
<wippy-chat-messages></wippy-chat-messages>
<wippy-chat-input></wippy-chat-input>

<!-- Gepinnter Chat neben einem auswahlgesteuerten -->
<wippy-chat session-id="019eb2ae-…"></wippy-chat>  <!-- ignoriert die Auswahl -->
<wippy-chat></wippy-chat>                            <!-- folgt der Auswahl -->
```

## Theming

Jedes Element rendert in einem Shadow Root, sodass Styles der Host-Seite weder hinein noch hinaus lecken. Zwei Mechanismen wenden das Theme an:

- **Vererbte CSS-Variablen.** Custom Properties des Themes (`--p-primary-*`, `--p-text-color`, …) werden über die Shadow-Grenze hinweg vom Host-Theme vererbt, sodass der Chat die aktive Palette und den Hell-/Dunkelmodus kostenlos übernimmt. Selektorbasierte Styles (PrimeVue, Markdown, Tailwind) sind in ein `chat-elements.css`-Stylesheet gebündelt und werden in den Shadow Root injiziert. `PrimeVuePlugin` leitet das Standard-Portal-Ziel body/null auf eine fest verankerte Overlay-Ebene innerhalb des zugehörigen Shadow Root um. Setzen Sie `appendTo: 'self'` nicht routinemäßig: Das ist eine explizite Entscheidung für Inline-Platzierung und kann in scrollenden Dialog- oder Drawer-Inhalten abgeschnitten werden. Toasts werden über den Proxy an den **nativen Toast des Hosts** delegiert, statt im Shadow gerendert zu werden.
- **Overrides pro Instanz.** Jedes Element akzeptiert zwei Attribute:

| Attribut | Typ | Wirkung |
|-----------|------|--------|
| `custom-css` | string | Rohes CSS, das **zuletzt** in den Shadow Root des Elements angehängt wird und daher durch die Reihenfolge gewinnt. |
| `css-variables` | object (JSON) | Overrides für CSS-Variablen pro Instanz, angewandt auf `:host`. Schlüssel dürfen das führende `--` weglassen. |

```html
<wippy-chat
  session-id="019eb2ae-…"
  custom-css=".message-item { max-width: 80%; }"
></wippy-chat>
```

`css-variables` wegzulassen ist der normale Weg, der die Facade respektiert. Farb-Overrides pro Instanz dienen der bewussten Isolation beim Einbetten, nicht dem routinemäßigen Umgestalten.

Für das vollständige Theming-Modell — semantische Variablen, Umschalten zwischen Hell und Dunkel und wie der Host Shadow-DOM-CSS injiziert — siehe [Theming: Web Components](./web-component-theming.md).

## Laufzeitverdrahtung

Innerhalb eines Web-Host-Kindes benötigen die Elemente kein Setup. Auth und Konfiguration kommen aus den Proxy-Globals, die der Host ohnehin injiziert (`window.__WIPPY_APP_CONFIG__` / `window.__WIPPY_APP_API__`); REST und WebSocket verwenden die Umgebungs-URLs der Konfiguration. Ein Chat-Tag auf die Seite zu setzen genügt — die Hülle registriert es, die Interna laden lazy nach, und der Chat verbindet sich mit der bestehenden Sitzung des Kindes.

## Siehe auch

- [Web Component (`view.component`)](./web-component.md) — ein eigenes Custom Element bauen
- [@wippy-fe-Pakete](../web-host/packages.md) — die Import-Map des Hosts und die injizierten Element-Hüllen (`@wippy-fe/chat`, `@wippy-fe/loading`)
- [Theming: Web Components](./web-component-theming.md) — Shadow-DOM-CSS und semantische Variablen
- [Proxy-API](./proxy-api.md) — `host.startChat` / `host.openSession` und der Rest von `@wippy-fe/proxy`
- [Proxy & Isolation](../web-host/proxy-isolation.md) — wie der Host Skripte und Konfiguration in Kinder injiziert
