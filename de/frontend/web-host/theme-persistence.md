---
title: "Theme-Persistenz"
description: "Die Facade so konfigurieren, dass sie den hellen, dunklen oder automatischen Theme-Modus in einem Cookie oder localStorage speichert."
---

# Theme-Persistenz

Diese Seite ist ein Konfigurationsleitfaden für die Facade. Der HTML-Block für externe Seiten ist ein unvollständiges Integrationsbeispiel und setzt vorhandene Facade-Endpunkte voraus.

Standardmäßig ermittelt der Web Host den hellen oder dunklen Modus aus `theme_mode`, dem Facade-Standardwert, und hält die Auswahl im Arbeitsspeicher. Eine ausdrückliche Benutzerauswahl geht beim Neuladen verloren. Theme-Persistenz speichert sie in einem **Cookie** oder in **localStorage** und lädt sie früh, damit das falsche Theme nicht aufblitzt.

Die Persistenz liegt vollständig in der Facade. Der Web Host bleibt speicherunabhängig und gibt nur ein Ereignis `themeChanged` aus, das die Facade oder ein anderer Embedder zum Speichern der Auswahl verwendet.

> **Opt-in.** Standardwert von `theme_persist` ist **`none`** — Persistenz ist **aus**, sofern ein Deployment nicht ausdrücklich `cookie` oder `localStorage` setzt. Beim Standardwert stammt das Theme aus `theme_mode` und wird zwischen Neuladungen nicht gespeichert. Es wird nichts gespeichert, kein Cookie geschrieben und das generierte Script tut nichts.

## Konfiguration

Zwei Facade-Parameter steuern die Persistenz; siehe [Frontend Facade](../../framework/facade.md):

| Parameter | Standardwert | Werte | Beschreibung |
|-----------|--------------|-------|--------------|
| `theme_persist` | `none` | `none` \| `cookie` \| `localStorage` | Speicherort des gewählten Modus. `none` entspricht dem aktuellen Verhalten. |
| `theme_storage_key` | `@wippy-theme-mode` | string | Schlüssel für Cookie / localStorage. |

Der öffentliche Konfigurationsendpunkt gibt beide als `themePersist` und `themeStorageKey` zurück, sodass auch außerhalb des Web Hosts ausgelieferte Seiten sie lesen können.

```yaml
# in your facade dependency parameters
- name: theme_persist
  value: cookie
- name: theme_storage_key
  value: "@wippy-theme-mode"
```

### Cookie gegenüber localStorage

- **`cookie`** — die mit Jet gerenderte Host-Shell liest das Cookie **serverseitig** und schreibt vor dem Senden der Antwort die Klasse `w-theme-*` auf `<html>`. Dadurch verwendet bereits der erste Paint das Theme. Dies verhindert Theme-Flashes und wird empfohlen, wenn die Konsistenz des ersten Paints wichtig ist.
- **`localStorage`** — der Server kann localStorage nicht lesen. Die ausgelieferte Shell lädt daher `theme-persist.js` synchron als erstes Script in `<head>`. Es setzt die gespeicherte Klasse, bevor Brand-Stylesheet, Ladeoberfläche oder Web-Host-Bundle rendern.

## Das generierte Script

Bei aktivierter Persistenz **generiert und liefert** die Facade ein kleines Script unter folgendem Pfad:

```
GET /api/public/facade/theme-persist.js
```

Konfigurierter Schlüssel und Modus sind eingebaut; auf der Seite muss nichts konfiguriert werden. Binden Sie das Script einmal möglichst früh in `<head>` ein:

```html
<script src="/api/public/facade/theme-persist.js"></script>
```

Beim Laden liest es den gespeicherten Wert, setzt die Klasse `w-theme-*` und stellt anschließend eine kleine API bereit:

```js
window.wippyThemePersist = {
  mode,            // 'none' | 'cookie' | 'localStorage'
  key,             // the storage key
  read(),          // -> 'auto' | 'light' | 'dark' | null
  write(mode),     // persist a mode (no-op when mode === 'none')
  apply(mode),     // toggle the w-theme-* class on <html>
}
```

Die Host-Shell (`index.html` beziehungsweise Jet-`index.jet`) bindet dieses Script bereits ein, speist den gespeicherten Wert in die Anwendung ein und speichert Änderungen. Die folgenden Abschnitte gelten für **andere** Seiten.

## Zusammenspiel in der Host-Shell

1. **Erster Paint** — Cookie-Modus: Der Server setzte `<html class="w-theme-dark">`. localStorage-Modus: Das Early-Apply-Script setzte die Klasse. In beiden Fällen ist die Seite vor dem Laden des Bundles thematisiert.
2. **Bootstrap** — die Shell speist den gespeicherten Wert in den Host ein: `themeMode: window.wippyThemePersist.read() ?? cfg.themeMode`, sodass der Host denselben Modus anwendet.
3. **Bei Änderung** — der Host gibt `themeChanged(mode)` aus; die Shell speichert ihn mit `events.on('themeChanged', window.wippyThemePersist.write)`.

### Hostereignis `themeChanged`

`globalEvents`, der von `window.initWippyApp(...)` zurückgegebene Emitter, löst bei der Initialisierung und jeder Theme-Änderung `themeChanged(mode)` mit `'auto' | 'light' | 'dark'` aus. Das Ereignis kennt keine Persistenz: Der Host greift nie auf Speicher zu; Embedder entscheiden über die Behandlung.

```js
const events = window.initWippyApp(config, '#app')
events.on('themeChanged', (mode) => {
  // e.g. persist, or notify a parent window
})
```

## Nicht von Wippy gehostete Seiten

Ein Dokument außerhalb des Vertrags für portable Wippy-Module kann dasselbe Theme verwenden und speichern. Die folgenden nativen Buttons sind nur für ein solches externes statisches Dokument geeignet. Eine Wippy-Seite oder -Komponente mit diesen Steuerelementen muss nach dem [Vertrag für portable Oberflächen](../portable-ui-contract.md) PrimeVue verwenden. Binden Sie das generierte Script ein und rufen Sie `write()` aus Ihrem eigenen Umschalter auf:

```html
<head>
  <!-- as early as possible: applies the stored theme + exposes window.wippyThemePersist -->
  <script src="/api/public/facade/theme-persist.js"></script>
  <!-- optional: reuse the facade brand theme too -->
  <link rel="stylesheet" href="/api/public/facade/variables.css">
</head>
<body>
  <button type="button" data-mode="auto">Auto</button>
  <button type="button" data-mode="light">Light</button>
  <button type="button" data-mode="dark">Dark</button>

  <script>
    document.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode
        window.wippyThemePersist.apply(mode)   // update <html> now
        window.wippyThemePersist.write(mode)   // persist for next load / the host
      })
    })
  </script>
</body>
```

Da Schlüssel und Speichermodus geteilt werden, wird eine auf der Loginseite getroffene Auswahl in den Web Host übernommen und umgekehrt. Das Script erhält beide Werte aus derselben Facade-Konfiguration.

> Alternativ können Sie `/api/public/facade/config` abrufen, `themePersist` und `themeStorageKey` lesen und den Speicher direkt implementieren. Das generierte Script hält diese Logik an einer Stelle.

## Serverseitiges Cookie-Rendering ohne Flash

Bei einer benutzerdefinierten serverseitig gerenderten Seite, etwa einem Jet-Login-Template, können Sie das Theme genauso wie die Host-Shell serverseitig anwenden: Lesen Sie aus der Anfrage das durch `theme_storage_key` benannte Cookie und geben Sie die passende Klasse auf `<html>` aus:

```html
<html lang="en"{{ if hasTheme }} class="{{ themeClass }}" style="color-scheme: {{ colorScheme }};"{{ end }}>
```

Der Handler setzt `themeClass` anhand des Cookies auf `w-theme-dark` beziehungsweise `w-theme-light` und `colorScheme` auf `dark` beziehungsweise `light`. Binden Sie `theme-persist.js` weiterhin ein, damit die Seite Änderungen zurückschreiben kann.
