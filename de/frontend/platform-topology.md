---
title: "Plattform-Topologie"
description: "Wie Wippy-Frontend-Quellcode zu einer gerouteten Seite oder Web Component wird und Laufzeitkontext sowie CSS erhält."
---

# Plattform-Topologie

## Auslieferungskette

| Stufe | Zuständig | Verifikation |
|---|---|---|
| Quellcode und Paket-Build | Frontend-Modul | Der Paket-Build gibt die erwartete Einstiegsdatei aus. |
| Ort des Artefakts | Deployment-Build-Target | Der Build-Befehl erhält `--outDir`; Vite kodiert ihn nicht fest. |
| Registry-Eintrag | Backend-Modul | `view.page` oder `view.component` zeigt auf die ausgegebene Einstiegsdatei. |
| Ausgelieferte URL | Filesystem- und HTTP-Registry-Einträge | Eine direkte Asset-Anfrage liefert das gebaute JavaScript oder HTML. |
| Laufzeit-Container | Web Host | Eine Seite nutzt `about:srcdoc`; eine Komponente nutzt ein Custom Element, üblicherweise mit Shadow DOM. |
| Kontext | AppConfig und Wippy-Pakete | Routing, API-Zugriff und Theme-Daten treffen über unterstützte Pakete ein. |

Das Vorhandensein von Quellcode, ein erfolgreicher Build oder ein gültiger Registry-Eintrag beweist die nächste Stufe nicht. Verifizieren Sie jede Grenze.

## Seiten

Eine `view.page` läuft in einem `about:srcdoc`-iframe. Die iframe-URL ist nicht die Host-Route. Prüfen Sie nicht `window.location`, `window.parent.location` oder Query-Parameter, um Host-Zustand zu ermitteln. Verwenden Sie AppConfig und `@wippy-fe/router`; das Paket erledigt die Integration in Wippy-Routen.

Die `iframe`-CSS-Injektion liefert derzeit das standardmäßige themengerechte Scrollbar-Styling. Ihr Name ist historisch und weiter gefasst als ihr gegenwärtiger Zweck. Lassen Sie sie für die Scrollbar-Konsistenz aktiviert; beschreiben Sie sie nicht als Layout-Reset.

## Web Components

Eine `view.component` läuft im Host-Dokument und besitzt üblicherweise einen Shadow Root. CSS-Selektoren kaskadieren nicht durch eine Shadow-Grenze. Der Web Host kann freigegebene Stylesheets und Facade-CSS je nach Komponentenkonfiguration in diesen Root ausliefern.

Vererbung von CSS-Variablen und Stylesheet-Injektion sind verschiedene Mechanismen:

- Öffentliche vererbte Variablen können die Grenze vom Host zum Shadow überschreiten.
- Selektorregeln wirken in einem Shadow Root nur, wenn sie in diesen Root ausgeliefert werden.
- Die Auslieferung macht einen beliebigen Selektor nicht zu einer portablen API.

## Theme und Overlays

Die Facade liefert das PrimeVue-Theme. Geteilte `.p-*`-Regeln im Facade-`custom_css` sind gültige Theme-Implementierung und dürfen global sein, wenn sie für Host und Kinder gedacht sind. Verwenden Sie `.wippy-host-app` nur für host-spezifisches Chrome.

Der Theme-Modus ist AppConfig-Zustand, keine CSS-Klassen-API. Anwendungen, Komponenten,
Fixtures und Browsertests wechseln den Modus mit
`host.setThemeMode('auto' | 'light' | 'dark')` aus `@wippy-fe/proxy`, warten dann
auf `@theme` und prüfen `host.getThemeMode()`. Die AppConfig trägt die Änderung
über den Transport vom Host zum Kind. Der Host aktualisiert sein Dokument,
sendet die AppConfig erneut an aktive `about:srcdoc`-iframes und spiegelt den Modus in die
Roots von Web Components. Erzwingen Sie niemals direkt `w-theme-dark`- oder `w-theme-light`-Klassen.

Erzwingen Sie niemals direkt `w-theme-dark`- oder `w-theme-light`-Klassen.

PrimeVue-Overlays können teleportiert werden. Prüfen Sie den tatsächlichen Overlay-Root im obersten Dokument, in iframe-Dokumenten und in rekursiv gefundenen Shadow Roots. Nehmen Sie keine generische PrimeVue-Platzierung an.

## Reihenfolge beim Laufzeit-Debugging

1. Bestätigen Sie, dass das Backend lauscht.
2. Prüfen Sie die Backend-Logs auf unerwartete 5xx-Antworten.
3. Bestätigen Sie den Registry-Eigentümer und die URL des ausgelieferten Assets.
4. Bestätigen Sie, dass genau dieser Paket-Build dieses Asset ausgegeben hat.
5. Laden Sie den Host-Root, bevor Sie durch die SPA navigieren, wenn direkte Deep Links nicht unterstützt werden.
6. Prüfen Sie Konsolen- und Netzwerkfehler nach Navigation und Interaktion.
7. Rufen Sie in Theme-Szenarien die öffentliche Proxy-Theme-Methode auf, beobachten Sie `@theme`
   und prüfen Sie `host.getThemeMode()`, bevor Sie einen Screenshot akzeptieren.
