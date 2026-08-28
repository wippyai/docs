---
title: "Warum Wippy Lua verwendet"
description: "Die Laufzeitanforderungen, Abwägungen und sich ergänzenden Rollen von Lua und WebAssembly in Wippy."
---

# Warum Wippy Lua verwendet

Wippy verwendet Lua als primäre Laufzeitsprache, weil es die Anforderungen der Plattform an Prozessisolation und Einbettung erfüllt. Diese Seite erläutert diese Designentscheidung und ihre Abwägungen; sie ist keine allgemeine Rangliste von Programmiersprachen.

Dies ist eine konzeptionelle Designnotiz und kein ausführbares Tutorial. Sie beschreibt Laufzeiteigenschaften und verweist auf die Referenzseiten, die die konkreten APIs definieren.

## Anforderungen an die Laufzeit

Wippy führt benutzerdefinierte Logik in isolierten Prozessen aus. Jeder Prozess besitzt eigenen Speicher und erhält nur die von der Laufzeit bereitgestellten Fähigkeiten. Da viele Prozesse gleichzeitig laufen können, muss die eingebettete Sprache Folgendes unterstützen:

- **Geringer Aufwand pro Prozess.** Der Speicherverbrauch muss auch bei wachsender Prozesszahl praktikabel bleiben.
- **Isolation von Fähigkeiten.** Die Laufzeit muss steuern können, welche Module, Funktionen und Systemoperationen jedem Prozess zur Verfügung stehen.
- **Einbettung im selben Prozess.** Wippys Go-Kern muss für jeden Prozess eine Sprachumgebung erstellen, konfigurieren und beenden können.
- **Kontrolliertes Laden von Modulen.** Module müssen aus der Allowlist der Laufzeit oder aus deklarierten Registry-Importen stammen, nicht aus beliebigen Dateisystempfaden.
- **Eine kleine Sprachoberfläche.** Anwendungscode soll lesbar sowie einfach zu generieren, zu prüfen und zu linten sein.

## Betrachtete Alternativen

### Python

Python bietet ein großes Ökosystem für Anwendungen und Datenverarbeitung. Sein Interpreter, Importmodell und seine Paketannahmen passen jedoch nicht zu Wippys Einbettung pro Prozess und dessen Fähigkeitsmodell. Python-Dienste können Wippy weiterhin über explizite Dienstgrenzen integrieren.

### JavaScript

JavaScript-Laufzeiten bieten mehrere Einbettungsmöglichkeiten. Ihre Modul- und Paketökosysteme erfordern jedoch eine zusätzliche Integrationsschicht für Wippys Registry-bezogenes Lademodell. Für Anwendungscode hat Wippy die kleinere, vom Host kontrollierte Laufzeitoberfläche von Lua gewählt.

### Go

Go wird für Wippys Kernlaufzeit verwendet. Kompilierter Go-Code und Plugins bieten nicht dieselbe isolierte, pro Prozess eingebettete Umgebung, die benutzerdefinierte Anwendungslogik benötigt.

### WebAssembly

WebAssembly übernimmt eine ergänzende Rolle, statt Lua als primäre Autorensprache zu ersetzen. Die Aufgabenteilung wird unter [Lua und WebAssembly](#lua-und-webassembly) beschrieben.

## Warum Lua geeignet ist

### Vom Host kontrollierte Einbettung

Lua ist für die Ausführung innerhalb einer Hostanwendung ausgelegt. Wippy erstellt für jeden Prozess eine Umgebung, verbindet sie mit Scheduler und Registry und kontrolliert Globals sowie den Modullader. `require` liest ausschließlich Module, die bereits in dieser Umgebung installiert sind: die stets verfügbaren Basismodule und Standardbibliotheken, das umgebungsseitige `process`-Modul des ausführbaren Eintrags, durch `modules:` erlaubte integrierte Laufzeitmodule sowie über `imports:` deklarierte Registry-Bibliotheken. Es durchsucht keine Dateisystempfade und installiert keine Pakete aus dem Netzwerk. Verschiedene Einträge können deshalb unterschiedliche Modulmengen erhalten, ohne anwendungsseitige Laderegeln zu benötigen.

### Sprachoberfläche

Lua besitzt eine kompakte Syntax und eine kleine Standardumgebung. Wippy ergänzt Typannotationen und Linting, damit Code inkrementell geprüft werden kann, ohne das zugrunde liegende Ausführungsmodell zu verändern.

### Kooperatives Scheduling

Lua-Coroutinen passen zu Wippys kooperativem Scheduling-Modell. Ein Prozess kann während Kanal- oder E/A-Operationen yielden, während der Scheduler andere Arbeit ausführt.

## Abwägungen

Lua bietet kein prozessinternes Paketökosystem, das mit pip oder npm vergleichbar wäre. Wippy stellt integrierte Laufzeitmodule über eine Allowlist und Anwendungsbibliotheken über Registry-Importe bereit, statt Pakete aus dem Netzwerk zu installieren. Workloads, die große externe Bibliotheken benötigen, können als Dienste oder WebAssembly-Komponenten laufen.

Lua kann außerdem für Entwickler aus anderen Sprachökosystemen ungewohnt sein. Die Syntax ist kompakt, doch Teams benötigen für Produktionscode weiterhin Konventionen, Reviews und Linting.

## Lua und WebAssembly

Wippy stellt zwei sich ergänzende Laufzeiten bereit:

- **Lua** ist die primäre Laufzeit für Anwendungslogik, Tools und Agenten.
- **WebAssembly** führt kompilierte Workloads und vorhandenen Code aus, der WASM als Ziel unterstützt.

Lua- und WASM-Prozesseinträge verwenden Wippys Prozessmodell; Lua- und WASM-Funktionen werden über registrierte Funktionseinträge bereitgestellt. Beide Integrationen werden über die Registry und Laufzeit-Sicherheitsrichtlinien konfiguriert. Lua-Code kann registrierte WASM-Funktionen aufrufen, und WASM-Prozesse können registrierte Lua-Funktionen aufrufen.

## Siehe auch

- [Übersicht der Lua-Laufzeit](./overview.md) - Die Lua-Laufzeit und ihre Module
- [Typen](./types.md) - Typannotationen, Generics und Unions
- [Linter](../guides/linter.md) - Statische Analyse für Lua
- [WASM-Laufzeit](../wasm/overview.md) - Kompilierten Code in der Sandbox ausführen
