---
title: "Chat Web Components"
description: "Referenz zum Einbetten der vom Host bereitgestellten Custom Elements für Chat, Nachrichtenliste, Composer und Sessionauswahl."
---

# Chat Web Components

**Klassifizierung: API-Referenz mit Teilbeispielen.** Die HTML- und JavaScript-
Blöcke setzen ein gehostetes Kind mit verfügbarer Chat-Shell, eine gültige
Session-UUID oder ein Agent-Start-Token sowie anwendungseigenes Mounting und
Teardown voraus.

Die Wippy-Chat-UI steht in Kontexten, in denen der Host die Chat-Shell injiziert,
als **zusammensetzbare Custom Elements** bereit. Ein srcdoc-iframe kann Live-
Chat ohne Vue-Import oder Registrierung per Tag einbetten. Die Elemente nutzen
dieselben Chatkomponenten und dieselbe Datenebene `ChatTransport` →
`SessionManager` wie der Host.

Diese Elemente werden vom Host bereitgestellt; anders als eine selbst gebaute
[Web Component](./web-component.md) werden sie weder verfasst noch registriert.
Der srcdoc-Injektor stellt die Tags bereit. Das Web-Fragment-Gateway des
fixierten Framework-Releases lässt `chat.js` bewusst aus. Fragmentseiten dürfen
die Tags daher nicht voraussetzen und nutzen stattdessen die Host-Chatsteuerung;
siehe [Laden](#laden).

> Verwenden Sie die Elemente für eine Chatoberfläche **in der eigenen Seite oder
> im eigenen Panel**. Zum imperativen Öffnen des Host-Chatpanels dienen
> `host.startChat(token)` und `host.openSession(sessionUUID)` aus
> `@wippy-fe/proxy`; siehe [Proxy-API](./proxy-api.md).

## Elemente

| Tag | Darstellung | Wichtige Attribute | Ereignisse |
|---|---|---|---|
| `<wippy-chat>` | Vollständiger Chat: Header, Nachrichten, Eingabe | `session-id`, `start-token`, `agent`, `show-selector`, `hide-header` | `session-started`, `error` |
| `<wippy-chat-messages>` | Nur Nachrichtenliste | `session-id` | — |
| `<wippy-chat-input>` | Nur Composer | `session-id` | — |
| `<wippy-session-selector>` | Sessionauswahl | `active-session-id` | `select` |

Alle akzeptieren außerdem `custom-css` und `css-variables`; siehe [Theming](#theming).

## Laden

Wie bei [`<wippy-loading>`](../web-host/packages.md#wippy-feloading) registriert
eine kleine Shell `@wippy-fe/chat.js` alle vier Tags. Der srcdoc-Injektor nimmt
sie neben `loading.js` und `proxy.js` in das Host-Array `scripts` auf. iframe-
Seiten installieren kein Paket und rufen kein `customElements.define()` auf.

Das Web-Fragment-Gateway injiziert `loading.js` und `proxy-fragment.js`, nicht
aber `chat.js`. Fragmentseiten verwenden `host.startChat()` oder
`host.openSession()`, bis ein späterer Vertrag einen Opt-in vorsieht. Direkt im
Hostdokument gemountete Web Components dürfen ebenfalls nicht davon ausgehen,
dass ein anderer Kind-Realm die Tags registriert hat.

Die Implementierungsabhängigkeiten liegen in `chat-internals.[hash].js` und
werden **beim ersten Mount lazy geladen**. Währenddessen erscheint
`<wippy-loading>`, bei Fehler `<wippy-error>`. Seiten ohne Chat-Tag laden die
Interna nicht.

## `<wippy-chat>`

Reaktive Sessionsteuerung benötigt Web Host `1.0.51` oder neuer. Die Shell ist
ein Hostasset, kein öffentliches Paket `@wippy-fe/chat`; ältere Hosts
unterstützen zuverlässig nur den ersten Mount.

| Attribut | Typ | Standard | Beschreibung |
|---|---|---|---|
| `session-id` | string | — | Vorhandene Session-UUID rendern. |
| `start-token` | string | — | Agent-Start-Token; startet beim Mount ohne `session-id` eine neue Session. |
| `agent` | string | — | Agentenname/-titel für den Leerzustand. |
| `show-selector` | boolean | `false` | Eingebaute Sessionauswahl im Header zeigen. |
| `hide-header` | boolean | `false` | Agent-/Modellheader für kompakte Einbettung verbergen. |

Ereignisse sind `CustomEvent`s; Daten stehen in `event.detail`:

| Ereignis | `detail` | Zeitpunkt |
|---|---|---|
| `session-started` | `{ sessionId: string }` | Session durch Start-Token oder Benutzeraktion gestartet. |
| `error` | `{ message: string }` | Sessioninitialisierung fehlgeschlagen. |

```html
<!-- Start a new session from an agent start token -->
<wippy-chat start-token="agent-start-token" agent="researcher"></wippy-chat>

<!-- Pin an existing session -->
<wippy-chat session-id="019eb2ae-1234-5678-abcd-ef1234567890"></wippy-chat>

<!-- Built-in selector, no header bar -->
<wippy-chat show-selector hide-header></wippy-chat>
```

```javascript
document.querySelector('wippy-chat')
  .addEventListener('session-started', (e) => {
    console.log('session:', e.detail.sessionId)
  })
```

### Reaktive Steuerung ohne Remount

Halten Sie ein Element gemountet und ändern Sie seine Attribute. Eine geänderte
`session-id` öffnet die Session im bestehenden Element. `session-id=""` oder
das Entfernen eines zuvor gesteuerten Attributs ist ein ausdrücklicher
**Neuer-Chat**-Übergang und löscht gepinnte sowie gemeinsame aktive Session.
Ein Element, das nie `session-id` hatte, bleibt selectorgetrieben; anfängliche
Abwesenheit ist kein Löschbefehl.

Ist ein `start-token` vorhanden, startet das Löschen von `session-id` erneut
aus diesem Token. Auch ein geändertes Token startet im bestehenden Element.
Ein Token wird je Custom-Element-Host einmal verbraucht; Reconnect oder
Verschieben desselben Elements spielt ihn nicht erneut ab. Wird ein laufender
Start durch neueres Token, gesteuerte Session, manuelle Auswahl oder Disconnect
überholt, kann sein Ergebnis den aktuellen Zustand nicht ersetzen; eine spät
erzeugte Session wird geschlossen.

```javascript
const chat = document.querySelector('wippy-chat')

chat.setAttribute('session-id', existingSessionId)

// New Chat with an agent. No element replacement is required.
chat.setAttribute('start-token', agentStartToken)
chat.removeAttribute('session-id')
```

Managed-Layout-Resolver aktualisieren oder entfernen Props am vorhandenen
Element und remounten nur bei geändertem `tagName`. Eingabe, Scrollposition und
elementeigener Lebenszyklus bleiben erhalten.

## `<wippy-chat-messages>` und `<wippy-chat-input>`

Nachrichtenliste und Composer lassen sich getrennt anordnen. Beide verwenden
eine einzelne `session-id`; ohne ausdrückliche ID folgen sie der
[gemeinsamen aktiven Session](#komposition-und-gemeinsame-session) eines
`<wippy-session-selector>`. Sie senden keine Ereignisse.

```html
<!-- Custom layout: messages above, composer below -->
<div style="display:flex; flex-direction:column; height:100%;">
  <wippy-chat-messages session-id="019eb2ae-…"></wippy-chat-messages>
  <wippy-chat-input    session-id="019eb2ae-…"></wippy-chat-input>
</div>
```

## `<wippy-session-selector>`

Die Auswahl steuert die gemeinsame aktive Session.

| Attribut | Typ | Standard | Beschreibung |
|---|---|---|---|
| `active-session-id` | string | — | Diese Session als aktiv hervorheben. |

| Ereignis | `detail` | Zeitpunkt |
|---|---|---|
| `select` | `{ sessionId: string }` | Benutzer wählt eine Session; sie wird gemeinsam aktiv. |

```html
<wippy-session-selector></wippy-session-selector>
```

```javascript
document.querySelector('wippy-session-selector')
  .addEventListener('select', (e) => {
    console.log('picked:', e.detail.sessionId)
  })
```

## Komposition und gemeinsame Session

Elemente **ohne ausdrückliche `session-id`** folgen der Auswahl über
`activeSessionId` des Managers. Elemente **mit** `session-id` oder `start-token`
sind gepinnt und ignorieren den Selektor.

```html
<!-- Selector + chat: the chat follows the picked session -->
<wippy-session-selector></wippy-session-selector>
<wippy-chat></wippy-chat>

<!-- Selector + split message list / composer, all following the selector -->
<wippy-session-selector></wippy-session-selector>
<wippy-chat-messages></wippy-chat-messages>
<wippy-chat-input></wippy-chat-input>

<!-- Pinned chat alongside a selector-driven one -->
<wippy-chat session-id="019eb2ae-…"></wippy-chat>  <!-- ignores the selector -->
<wippy-chat></wippy-chat>                            <!-- follows the selector -->
```

## Theming

Jedes Element rendert in einem Shadow Root. Zwei Mechanismen gelten:

- **Geerbte CSS-Variablen.** `--p-*`-Variablen überschreiten die Shadow-Grenze. PrimeVue-, Markdown- und Tailwind-Selektorstyles werden als `chat-elements.css` injiziert. `PrimeVuePlugin` leitet das Standard-Portalziel in eine feste Overlay-Ebene des Shadow Roots. Routinemäßiges `appendTo: 'self'` ist Inline-Platzierung und kann in scrollenden Dialogen/Drawern clippen. Toasts werden über den Proxy an den nativen Host-Toast delegiert.
- **Überschreibungen je Instanz:**

| Attribut | Typ | Wirkung |
|---|---|---|
| `custom-css` | string | Rohes CSS, zuletzt in den Shadow Root eingefügt. |
| `css-variables` | JSON-Objekt | CSS-Variablen je Instanz auf `:host`; führendes `--` optional. |

Behandeln Sie beide als vertrauenswürdige Anwendungskonfiguration. Ungeprüfte
Benutzereingaben dürfen nicht in CSS oder Variablen gelangen; CSS kann UI
verdecken und externe Ressourcen anfordern.

```html
<wippy-chat
  session-id="019eb2ae-…"
  custom-css=".message-item { max-width: 80%; }"
></wippy-chat>
```

Das Weglassen von `css-variables` respektiert normal das Facade-Theme. Farb-
Overrides je Instanz dienen bewusster Isolierung, nicht routinemäßigem Restyling.

Das vollständige Theming-Modell mit semantischen Variablen, Hell-/Dunkelumschaltung und Shadow-DOM-CSS-Injektion des Hosts beschreibt [Theming für Web Components](./web-component-theming.md).

## Runtime-Verkabelung

In einem srcdoc-iframe ist keine weitere Einrichtung nötig. Auth und
Konfiguration stammen aus dem Proxy; REST und WebSocket nutzen die Environment-
URLs. Beim Mount lädt die registrierte Shell ihre Interna und verbindet sich
mit der vorhandenen Session. Für Web Fragment und direkte Hostkontexte gelten
die unter [Laden](#laden) genannten Verfügbarkeitsgrenzen.

## Siehe auch

- [Web-Component-Rezept](./web-component.md)
- [@wippy-fe-Pakete](../web-host/packages.md)
- [Theming für Web Components](./web-component-theming.md)
- [Proxy-API](./proxy-api.md)
- [Proxy und Isolation](../web-host/proxy-isolation.md)
