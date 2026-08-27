---
title: "Frontend-Vertrag: Einstieg"
description: "Der Einstiegspunkt für portable Wippy-Seiten, Web Components, Builds, Routing und Theme-Integration."
---

# Frontend-Vertrag: Einstieg

Diese Seite dient als Orientierung und Navigationsreferenz. Sie benennt die Verträge, denen ein Frontend-Modul folgen muss; sie ist weder ein Build-Tutorial noch ein vollständiges Anwendungsbeispiel.

Wippy-Frontend-Module sind standardmäßig portabel. Ein Modul muss weiterhin funktionieren, wenn es in ein anderes Wippy-Projekt importiert wird, dessen Facade ein anderes konformes PrimeVue-Theme und kein projektprivates CSS bereitstellt.

## Den richtigen Pfad wählen

1. Verwenden Sie `view.page` für eine Anwendung, die von der konfigurierten Page Engine gerendert wird: einem älteren `about:srcdoc`-iframe oder einem Web Fragment.
2. Verwenden Sie `view.component` für ein Custom Element, das im Host-Dokument gerendert wird, normalerweise mit Shadow Root.
3. Wenn die Oberfläche einen Button, ein Eingabefeld, ein Formularfeld, ein Menü, ein Overlay oder ein anderes PrimeVue-artiges Steuerelement rendert, verwenden Sie PrimeVue, sofern es die erforderliche Semantik und Affordance bereitstellen kann.
4. Eine reine Inhaltskomponente, etwa eine Chart.js-Visualisierung ohne Steuerelemente, darf PrimeVue und Tailwind weglassen.
5. Wenn ein benutzerdefiniertes Steuerelement erforderlich ist, folgen Sie dem [Vertrag für portable Oberflächen](./portable-ui-contract.md) und [benutzerdefinierten Kompositionen](./micro-frontends/custom-composites.md).

PrimeVue ist das gemeinsame Komponentenvokabular. Das Wippy-Tailwind-Preset ist ein unterstütztes Buildzeit-Vokabular. Nur als laufzeitgestützt dokumentierte Utilities reagieren nach der Kompilierung weiterhin auf Theme-Änderungen der Facade.

## Verantwortungsübersicht

```text
module source
  -> build command
  -> emitted artifact
  -> registry owner
  -> served URL
  -> Web Host
  -> page surface (srcdoc iframe or Web Fragment) or component shadow root
  -> AppConfig / router / theme delivery
```

Leiten Sie keine Stufe aus einer anderen ab. Bevor Sie ein fehlendes Asset untersuchen, bestimmen Sie Quellpaket, Build-Target, ausgegebene Datei, Registry-Eintrag, Dateisystem-Mount und ausgelieferte URL.

## Vertragsseiten

- [Plattformtopologie](./platform-topology.md): Laufzeitgrenzen, Routing, CSS-Auslieferung, Overlays und Verantwortlichkeiten.
- [Vertrag für portable Oberflächen](./portable-ui-contract.md): normative Komponenten- und Stylingregeln.
- [Theme-Erstellung](./micro-frontends/theming.md): Was in `custom_css` der Facade, PrimeVue-Theme-CSS oder ein Modul gehört.
- [Tailwind-Vertrag](./micro-frontends/tailwind-contract.md): laufzeitgestützte Utilities gegenüber kompilierten Konstanten.
- [Token-Katalog](./micro-frontends/token-catalogue.md): generierte Token-Referenz und Herkunft.
- [Die Designschicht](./design-layer.md): Wo etwas hingehört, wenn mehrere eigene Module es benötigen und das Theme keine Komponente dafür besitzt.
- [Seitenrezept](./micro-frontends/micro-frontend-app.md) und [Web-Component-Rezept](./micro-frontends/web-component.md).
- [Build- und Abhängigkeitsvertrag](./micro-frontends/build-system.md).
- [Konfiguration und Schreibweise](./micro-frontends/configuration-casing.md).
- [Index der Konformitätsregeln](./micro-frontends/compliance-checklist.md).

## Nicht verhandelbare Prüfungen

- Erfinden Sie niemals eine PrimeVue-Property, Komponenten-API, CSS-Variable oder semantische Tailwind-Utility. Prüfen Sie sie in der ausgewählten Paketquelle und im generierten Katalog.
- Leiten Sie niemals einen `--p-*`-Token-Namen durch Analogie ab.
- Verlangen Sie aus einem portablen Modul niemals eine beliebige Facade-Klasse.
- Leiten Sie den Host-Routenkontext niemals aus der Browser-Location ab. Seiten erhalten Hostkontext über AppConfig und verwenden `@wippy-fe/router`.
- Bauen Sie vor der Browserprüfung exakt das verantwortliche Paket in die ausgelieferte Ausgabe neu.
- Prüfen Sie nach Navigation und relevanter Interaktion die Browserkonsole.

Projektgebundene Module liegen außerhalb des portablen Vertrags. Sie sind ausschließlich auf der Seite [Nicht unterstützte projektgebundene Module](./micro-frontends/unsupported-project-bound.md) dokumentiert; die Standard-Konformitätsprüfung gibt `UNSUPPORTED` zurück und die Standard-CI schlägt fehl.
