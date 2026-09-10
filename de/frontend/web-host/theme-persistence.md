---
title: "Theme-Persistenz"
description: "Standardmäßig löst der Web Host hell/dunkel aus thememode auf (dem Facade-Standard) und hält es im Speicher — die explizite Wahl eines Benutzers geht also beim…"
---

# Theme-Persistenz

Standardmäßig löst der Web Host hell/dunkel aus `theme_mode` auf (dem Facade-Standard) und hält es
im Speicher — die explizite Wahl eines Benutzers geht also beim nächsten Neuladen verloren. Die Theme-Persistenz lässt diese
Wahl Neuladen überdauern, indem sie sie in einem **Cookie** oder in **localStorage** speichert, und lädt sie so früh
wie möglich, sodass es kein Aufblitzen des falschen Themes gibt.

Die Persistenz liegt vollständig in der Facade. Der Web Host bleibt speicheragnostisch: Er gibt lediglich ein
`themeChanged`-Event aus, das die Facade (oder ein beliebiger Einbetter) zum Persistieren der Wahl verwendet.

> **Opt-in.** `theme_persist` steht standardmäßig auf **`none`** — Persistenz ist **aus**, sofern ein Deployment
> sie nicht ausdrücklich auf `cookie` oder `localStorage` setzt. Mit dem Standardwert ist das Verhalten genau wie zuvor
> (das Theme kommt immer aus `theme_mode` und wird über Neuladen hinweg nicht gemerkt). Es wird nichts gespeichert,
> kein Cookie geschrieben, und das generierte Skript ist ein No-Op, bis Sie es aktivieren.

## Konfiguration

Zwei Facade-Parameter steuern es (siehe [Frontend-Facade](../../framework/facade.md)):

| Parameter | Standard | Werte | Beschreibung |
|-----------|---------|--------|-------------|
| `theme_persist` | `none` | `none` \| `cookie` \| `localStorage` | Wo der gewählte Modus gespeichert wird. `none` = bisheriges Verhalten. |
| `theme_storage_key` | `@wippy-theme-mode` | string | Cookie-/localStorage-Schlüssel. |

Beide liefert der öffentliche Konfigurationsendpunkt als `themePersist` und `themeStorageKey` zurück, sodass Seiten,
die außerhalb des Web Host ausgeliefert werden, sie ebenfalls lesen können.

```yaml
# in den Parametern Ihrer Facade-Abhängigkeit
- name: theme_persist
  value: cookie
- name: theme_storage_key
  value: "@wippy-theme-mode"
```

### cookie vs. localStorage

- **`cookie`** — die per Jet gerenderte Host-Hülle liest das Cookie **serverseitig** und schreibt die
  `w-theme-*`-Klasse auf `<html>`, bevor die Antwort gesendet wird, sodass bereits der allererste Bildaufbau
  thematisiert ist. **Kein Aufblitzen.** Der beste Standard.
- **`localStorage`** — der Server kann localStorage nicht lesen, daher wird der gespeicherte Wert von einem
  synchronen Inline-Skript so früh wie möglich angewandt. Ein kurzes Aufblitzen ist technisch möglich, aber minimiert.

## Das generierte Skript

Bei aktivierter Persistenz **generiert und liefert** die Facade ein kleines Skript unter:

```
GET /api/public/facade/theme-persist.js
```

Der konfigurierte Schlüssel und Modus sind eingebacken — auf der Seite ist nichts zu konfigurieren. Binden Sie es
einmal, so früh wie möglich im `<head>`, ein:

```html
<script src="/api/public/facade/theme-persist.js"></script>
```

Beim Laden liest es den gespeicherten Wert und wendet die `w-theme-*`-Klasse an, dann stellt es eine kleine API bereit:

```js
window.wippyThemePersist = {
  mode,            // 'none' | 'cookie' | 'localStorage'
  key,             // der Speicherschlüssel
  read(),          // -> 'auto' | 'light' | 'dark' | null
  write(mode),     // einen Modus persistieren (No-Op, wenn mode === 'none')
  apply(mode),     // die w-theme-*-Klasse auf <html> umschalten
}
```

Die Host-Hülle (`index.html` / das Jet-`index.jet`) bindet dieses Skript bereits ein, überträgt den gespeicherten
Wert in die App und persistiert Änderungen — Sie müssen daran nichts anfassen. Die folgenden Abschnitte gelten für
**andere** Seiten.

## Wie es zusammenpasst (Host-Hülle)

1. **Erster Bildaufbau** — Cookie-Modus: Der Server hat `<html class="w-theme-dark">` gesetzt. localStorage-Modus:
   Das Früh-Anwendungs-Skript hat es gesetzt. So oder so ist die Seite thematisiert, bevor das Bundle lädt.
2. **Bootstrap** — die Hülle überträgt den persistierten Wert in den Host:
   `themeMode: window.wippyThemePersist.read() ?? cfg.themeMode`, sodass der Host denselben Modus anwendet.
3. **Bei Änderung** — der Host gibt `themeChanged(mode)` aus; die Hülle persistiert es:
   `events.on('themeChanged', window.wippyThemePersist.write)`.

### Das Host-Event `themeChanged`

`globalEvents` — der von `window.initWippyApp(...)` zurückgegebene Emitter — löst `themeChanged(mode)`
(`'auto' | 'light' | 'dark'`) bei der Initialisierung und bei jeder Theme-Änderung aus. Es ist persistenzagnostisch: Der Host
berührt den Speicher nie; Einbetter entscheiden, was damit geschieht.

```js
const events = window.initWippyApp(config, '#app')
events.on('themeChanged', (mode) => {
  // z. B. persistieren oder ein Parent-Fenster benachrichtigen
})
```

## Seiten, die nicht von Wippy gehostet werden

Ein Dokument außerhalb des portablen Modulvertrags von Wippy kann dasselbe Theme
respektieren und persistieren. Die nativen Schaltflächen unten sind nur für ein solches
externes statisches Dokument angemessen. Eine Wippy-Seite oder -Komponente mit diesen Steuerelementen muss
gemäß dem [Portablen UI-Vertrag](../portable-ui-contract.md) PrimeVue verwenden.
Binden Sie das generierte Skript ein und rufen Sie `write()` aus Ihrem eigenen Umschalter auf:

```html
<head>
  <!-- so früh wie möglich: wendet das gespeicherte Theme an + stellt window.wippyThemePersist bereit -->
  <script src="/api/public/facade/theme-persist.js"></script>
  <!-- optional: auch das Markenthema der Facade wiederverwenden -->
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
        window.wippyThemePersist.apply(mode)   // <html> jetzt aktualisieren
        window.wippyThemePersist.write(mode)   // für das nächste Laden / den Host persistieren
      })
    })
  </script>
</body>
```

Weil Schlüssel und Speichermodus geteilt werden (das Skript wird aus derselben Facade-Konfiguration generiert),
überträgt sich eine auf der Login-Seite getroffene Wahl direkt in den Web Host und umgekehrt.

> Wenn Sie das Skript lieber nicht laden möchten, können Sie `/api/public/facade/config` abrufen,
> `themePersist` / `themeStorageKey` lesen und Lesen/Schreiben selbst implementieren — aber das generierte Skript
> hält die Speicherlogik an einem Ort.

## Serverseitiges Cookie-Rendering (kein Aufblitzen)

Für eine eigene serverseitig gerenderte Seite (z. B. ein Jet-Login-Template) können Sie das Theme serverseitig anwenden,
genau wie es die Host-Hülle tut: Lesen Sie das von `theme_storage_key` benannte Cookie aus der Anfrage und
geben Sie die passende Klasse auf `<html>` aus:

```html
<html lang="en"{{ if hasTheme }} class="{{ themeClass }}" style="color-scheme: {{ colorScheme }};"{{ end }}>
```

wobei der Handler `themeClass` anhand des Cookies auf `w-theme-dark` / `w-theme-light` gesetzt hat (und `colorScheme` auf
`dark` / `light`). Binden Sie weiterhin `theme-persist.js` ein, damit die Seite Änderungen zurückschreiben kann.
