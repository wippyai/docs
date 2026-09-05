---
title: "Frontend-Contract: Hier starten"
description: "Der Einstiegspunkt für portable Wippy-Seiten, Web-Komponenten, Builds, Routing und Theme-Integration."
---

# Frontend-Contract: Hier starten

Wippy-Frontend-Module sind standardmäßig portabel. Ein Modul muss weiterhin funktionieren, wenn es in ein anderes Wippy-Projekt importiert wird, dessen Facade ein anderes konformes PrimeVue-Theme liefert und kein projektinternes CSS bereitstellt.

## Den richtigen Weg wählen

1. Verwende eine `view.page` für eine Anwendung, die in einem `about:srcdoc`-Iframe gerendert wird.
2. Verwende eine `view.component` für ein Custom Element, das im Host-Dokument gerendert wird, normalerweise mit einem Shadow Root.
3. Wenn die UI einen Button, ein Eingabefeld, ein Formularfeld, ein Menü, ein Overlay oder ein anderes PrimeVue-artiges Steuerelement rendert, verwende PrimeVue, sofern es die erforderliche Semantik und Bedienbarkeit nicht liefern kann.
4. Eine reine Inhaltskomponente, etwa eine Chart.js-Visualisierung ohne Steuerelemente, darf auf PrimeVue und Tailwind verzichten.
5. Ist ein eigenes Steuerelement notwendig, folge dem [Portable-UI-Contract](./portable-ui-contract.md) und [Eigene Composites](./micro-frontends/custom-composites.md).

PrimeVue ist das gemeinsame Komponenten-Vokabular. Das Wippy-Tailwind-Preset ist ein unterstütztes Vokabular zur Build-Zeit. Nur Utilities, die als laufzeitgestützt dokumentiert sind, reagieren nach der Kompilierung weiterhin auf Theme-Wechsel der Facade.

## Zuständigkeitskarte

```text
module source
  -> build command
  -> emitted artifact
  -> registry owner
  -> served URL
  -> Web Host
  -> page srcdoc iframe or component shadow root
  -> AppConfig / router / theme delivery
```

Leite keine Stufe aus einer anderen ab. Bevor du ein fehlendes Asset debuggst, identifiziere das Quellpaket, das Build-Ziel, die emittierte Datei, den Registry-Eintrag, den Dateisystem-Mount und die ausgelieferte URL.

## Contract-Seiten

- [Plattform-Topologie](./platform-topology.md): Laufzeitgrenzen, Routing, CSS-Auslieferung, Overlays und Zuständigkeiten.
- [Portable-UI-Contract](./portable-ui-contract.md): normative Regeln für Komponenten und Styling.
- [Theme-Authoring](./micro-frontends/theming.md): was in `custom_css` der Facade, in das PrimeVue-Theme-CSS oder in ein Modul gehört.
- [Tailwind-Contract](./micro-frontends/tailwind-contract.md): laufzeitgestützte Utilities gegenüber kompilierten Konstanten.
- [Token-Katalog](./micro-frontends/token-catalogue.md): generierte Token-Referenz und Herkunft.
- [Die Design-Schicht](./design-layer.md): wohin etwas gehört, wenn mehrere deiner eigenen Module es benötigen und das Theme keine passende Komponente hat.
- [Rezept für Seiten](./micro-frontends/micro-frontend-app.md) und [Rezept für Web-Komponenten](./micro-frontends/web-component.md).
- [Build- und Abhängigkeits-Contract](./micro-frontends/build-system.md).
- [Konfiguration und Schreibweise](./micro-frontends/configuration-casing.md).
- [Index der Compliance-Regeln](./micro-frontends/compliance-checklist.md).

## Nicht verhandelbare Prüfungen

- Erfinde niemals eine PrimeVue-Prop, eine Komponenten-API, eine CSS-Variable oder eine semantische Tailwind-Utility. Verifiziere sie in der Quelle des gewählten Pakets und im generierten Katalog.
- Konstruiere niemals einen `--p-*`-Token-Namen per Analogie.
- Fordere aus einem portablen Modul niemals eine beliebige Facade-Klasse ein.
- Leite den Routing-Kontext des Hosts niemals aus der Browser-Location ab. Seiten erhalten den Host-Kontext über AppConfig und verwenden `@wippy-fe/router`.
- Baue vor der Browser-Verifikation genau das zuständige Paket in die ausgelieferte Ausgabe neu.
- Prüfe die Browser-Konsole nach Navigation und relevanter Interaktion.

Projektgebundene Module liegen außerhalb des portablen Contracts. Sie sind ausschließlich auf der Seite [Nicht unterstützte projektgebundene Module](./micro-frontends/unsupported-project-bound.md) dokumentiert; die Standard-Compliance liefert `UNSUPPORTED` und die Standard-CI schlägt fehl.
