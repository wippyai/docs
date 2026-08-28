---
title: "Plattformtopologie"
description: "Wie Wippy-Frontend-Quellcode zu einer gerouteten Seite oder Web Component wird und Laufzeitkontext sowie CSS erhält."
---

# Plattformtopologie

Diese Seite ist eine Architektur- und Diagnosereferenz. Auslieferungskette und Diagramme beschreiben Systemgrenzen; sie stellen kein ausführbares Projekt bereit.

## Auslieferungskette

| Stufe | Verantwortlich | Prüfung |
|-------|----------------|---------|
| Quellcode und Paket-Build | Frontend-Modul | Der Paket-Build gibt die erwartete Entry-Datei aus. |
| Artefaktort | Deployment-Build-Target | Der Buildbefehl erhält `--outDir`; Vite codiert ihn nicht fest. |
| Registry-Eintrag | Backend-Modul | `view.page` oder `view.component` verweist auf den ausgegebenen Entry. |
| Ausgelieferte URL | Dateisystem- und HTTP-Registry-Einträge | Eine direkte Asset-Anfrage gibt das gebaute JavaScript oder HTML zurück. |
| Laufzeitcontainer | Web Host | Eine Seite verwendet die konfigurierte Page Engine: einen älteren `about:srcdoc`-iframe oder ein Web Fragment. Eine Komponente verwendet ein Custom Element, normalerweise mit Shadow DOM. |
| Kontext | AppConfig und Wippy-Pakete | Routing, API-Zugriff und Theme-Daten kommen über unterstützte Pakete an. |

Das Vorhandensein von Quellcode, ein erfolgreicher Build oder ein gültiger Registry-Eintrag beweist nicht die nächste Stufe. Prüfen Sie jede Grenze.

## Seiten

Eine `view.page` läuft über eine von zwei Engines: einen älteren `about:srcdoc`-iframe oder ein Web Fragment. Die globale Einstellung `hostConfig.renderEngine` legt die Basis fest; `wippy.renderEngine` einer Seite kann ihr folgen, mit `iframe` aussteigen oder `fragment` anfordern, wenn das Deployment dies unterstützt. Anwendungscode bleibt Engine-unabhängig. In keiner Engine ist die Browser-Location der unterstützte Vertrag für Kindrouten. Verwenden Sie AppConfig und `@wippy-fe/router`; das Paket übernimmt die Wippy-Routenintegration.

Die CSS-Injektion `iframe` stellt derzeit standardmäßiges Theme-Scrollbar-Styling bereit. Ihr Name ist historisch und umfassender als ihr heutiger Zweck. Lassen Sie sie für konsistente Scrollbars aktiviert; beschreiben Sie sie nicht als Layout-Reset.

## Web Components

Eine `view.component` läuft im Host-Dokument und besitzt normalerweise einen Shadow Root. CSS-Selektoren kaskadieren nicht durch eine Shadow-Grenze. Der Web Host kann freigegebene Stylesheets und Facade-CSS entsprechend der Komponentenkonfiguration in diesen Root ausliefern.

Vererbung von CSS-Variablen und Stylesheet-Injektion sind unterschiedliche Mechanismen:

- Öffentliche vererbte Variablen können die Grenze vom Host zum Shadow Root überschreiten.
- Selektorregeln wirken nur auf einen Shadow Root, wenn sie in diesen Root ausgeliefert werden.
- Die Auslieferung macht einen beliebigen Selektor nicht zu einer portablen API.

## Theme und Overlays

Die Facade stellt das PrimeVue-Theme bereit. Gemeinsame `.p-*`-Regeln in `custom_css` der Facade sind eine gültige Theme-Implementierung und dürfen global sein, wenn sie für Host und Kinder bestimmt sind. Verwenden Sie `.wippy-host-app` nur für Host-spezifisches Chrome.

Der Theme-Modus ist AppConfig-Zustand, keine CSS-Klassen-API. Anwendungen, Komponenten, Fixtures und Browsertests wechseln den Modus mit `host.setThemeMode('auto' | 'light' | 'dark')` aus `@wippy-fe/proxy`, warten dann auf `@theme` und prüfen `host.getThemeMode()`. AppConfig transportiert die Änderung vom Host zum Kind. Der Host aktualisiert sein Dokument, sendet AppConfig erneut an laufende iframe- und Web-Fragment-Seitenrealms und spiegelt den Modus in Web-Component-Roots. Erzwingen Sie niemals direkt die Klassen `w-theme-dark` oder `w-theme-light`.

PrimeVue-Overlays können teleportiert werden. Prüfen Sie den tatsächlichen Overlay-Root im obersten Dokument, in iframe-Dokumenten und in rekursiv gefundenen Shadow Roots. Setzen Sie keine allgemeine PrimeVue-Platzierung voraus.

## Reihenfolge der Laufzeitdiagnose

1. Bestätigen Sie, dass das Backend lauscht.
2. Prüfen Sie die Backend-Logs auf unerwartete 5xx-Antworten.
3. Bestätigen Sie Registry-Verantwortlichen und ausgelieferte Asset-URL.
4. Bestätigen Sie, dass der Build des genauen Pakets dieses Asset ausgegeben hat.
5. Laden Sie den Host-Root, bevor Sie über die SPA navigieren, wenn direkte Deep Links nicht unterstützt werden.
6. Prüfen Sie nach Navigation und Interaktion Konsolen- und Netzwerkfehler.
7. Rufen Sie für Theme-Szenarien die öffentliche Proxy-Theme-Methode auf, beobachten Sie `@theme` und prüfen Sie `host.getThemeMode()`, bevor Sie einen Screenshot akzeptieren.
