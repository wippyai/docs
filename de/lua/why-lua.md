---
title: "Warum Wippy Lua verwendet - Entscheidung für die eingebettete Laufzeitsprache"
description: "Wippy verwendet Lua als primäre Laufzeitsprache. Hier ist der Grund: Speicherbedarf, vollständige Sandbox-Fähigkeit, sauberes Go-Embedding, deterministisches Modul-Laden und LLM-freundliche Syntax."
---

# Warum Wippy Lua verwendet

Jeder technische Gutachter stellt diese Frage, deshalb hier die direkte Antwort.

## Laufzeitanforderungen

Wippy führt benutzerdefinierte Logik in isolierten Prozessen aus. Jeder Prozess benötigt seinen eigenen Speicherbereich, seinen eigenen Satz verfügbarer Capabilities und keine Möglichkeit, über seine Grenze hinauszureichen, sofern die Laufzeit es nicht ausdrücklich erlaubt. Die Plattform führt Tausende dieser Prozesse gleichzeitig auf einer einzelnen Instanz aus, von denen jeder potenziell anderen Code für andere Mandanten ausführt.

Das bedeutet, dass die in jedem Prozess eingebettete Sprachlaufzeit Folgendes sein muss:

- **Winzig.** Jeder Prozess läuft in seiner eigenen isolierten Umgebung. Bei Tausenden gleichzeitigen Prozessen zählt der Speicher pro Prozess. Wippy zielt auf einen Grund-Overhead von ~13 KB pro Prozess ab.
- **Vollständig sandbox-fähig.** Die Laufzeit muss genau steuern, auf welche Module, Funktionen und Systemaufrufe jeder Prozess zugreifen kann. Keine Umgebungsautorität. Kein globaler Zustand, der zwischen Prozessen durchsickert.
- **Einbettbar.** Die Sprachlaufzeit muss eine Bibliothek sein, die Wippys Kern (in Go geschrieben) pro Prozess instanziieren, konfigurieren und abbauen kann. Sie darf kein externer Prozess und keine separate Binärdatei sein.
- **Deterministisch beim Modul-Laden.** Wenn ein Prozess startet, entscheidet die Laufzeit, welchen Code er sehen kann. Kein Dateisystemzugriff. Kein `require`, das in beliebige Pfade greift. Abhängigkeiten kommen aus der Registry, pro Prozess begrenzt.
- **LLM-freundlich in der Syntax.** Agenten generieren und ändern Code. Die Sprache muss einfach genug sein, damit ein LLM sie zuverlässig lesen, schreiben und durchdenken kann, ohne Syntax zu halluzinieren.

## Evaluierte Sprachen: Python, JavaScript, Go und WASM

### Python

Die Standardwahl für KI-Workloads. Wir haben es ausgeschlossen, weil der Speicherbedarf von CPython 10-30 MB pro Interpreter beträgt, Größenordnungen mehr als ein Lua-Prozess. Pythons Importsystem gibt Code Umgebungszugriff auf Dateisystem, Netzwerk und Betriebssystem. Python zu sandboxen erfordert entweder eine WASM-Kompilierung (die die meisten Bibliotheken zerstört) oder umfangreiches Patchen des Interpreters. Pythons Nebenläufigkeitsmodell (der GIL) steht ebenfalls im Konflikt mit unserem Isolationsmodell pro Prozess. Das Ökosystem ist eine Stärke für eigenständige Skripte, aber eine Belastung für eine Sandbox-Laufzeit, in der Sie deterministische Kontrolle darüber brauchen, worauf Code zugreifen kann.

### JavaScript (V8/QuickJS)

V8 ist schnell, aber riesig (Dutzende MB pro Isolate). QuickJS ist klein genug zum Einbetten, aber JavaScripts Prototypenkette und dynamisches Modulsystem machen das Sandboxen schwieriger, als es aussieht. `import` und `require` wollen ins Dateisystem greifen. Das Ökosystem erwartet npm, was Netzwerkzugriff und ein beschreibbares Dateisystem voraussetzt — beides existiert innerhalb eines Wippy-Prozesses nicht. Wir würden mehr Zeit damit verbringen, gegen die Annahmen der Sprache zu kämpfen, als das Produkt zu bauen.

### Go

Wippys Kern ist in Go geschrieben, das war also verlockend. Aber Go lässt sich nicht einbetten. Sie können keine Go-Laufzeit als Bibliothek innerhalb eines anderen Go-Programms instanziieren. Go-Plugins existieren, sind aber fragil, teilen sich den Speicher mit dem Host-Prozess und lassen sich nicht sandboxen. Go ist richtig für die Laufzeit selbst; es ist falsch für Benutzercode.

### WASM

Wirklich stark beim Sandboxing, und wir haben es als Wippys zweite Laufzeit gebaut (siehe unten). Aber WASM allein reicht als primäre Sprache für die Agentenentwicklung nicht aus. Die Entwicklererfahrung beim direkten Schreiben und Debuggen von WASM ist noch rau, und LLMs generieren WASM-gerichteten Code weniger zuverlässig als Lua. WASM ist die richtige Wahl, wenn Sie kompilierten Code aus anderen Sprachen innerhalb der Wippy-Sandbox ausführen müssen. Lua ist die richtige Wahl für die primäre Entwicklungs- und Agenten-Autorenerfahrung.

## Warum Lua alle fünf Anforderungen erfüllt

Lua wurde genau für diesen Anwendungsfall gebaut. Es ist die am häufigsten eingebettete Skriptsprache im Produktivbetrieb und läuft in World of Warcraft, Roblox, Redis, Nginx/OpenResty, Netzwerkgeräten von Cisco und Juniper, Adobe Lightroom und Hunderten von Spiel-Engines. Es ist seit über 25 Jahren in feindlichen Umgebungen eingebettet (Spiele, in denen Nutzer nicht vertrauenswürdigen Code ausführen).

### Speicher

Ein Wippy-Lua-Prozess hat einen Grund-Overhead von ~13 KB. Bei 10.000 gleichzeitigen Prozessen sind das rund 130 MB Grund-Overhead an Prozessen. In Python würde dieselbe Anzahl 100-300 GB benötigen. Das ist kein theoretisches Problem; es ist der Unterschied zwischen dem Betrieb auf einer einzelnen Maschine und dem Bedarf an einem Cluster.

### Sandboxing

Luas Modulsystem ist eine einzige Funktion (`require`), die der Host vollständig kontrolliert. Ersetzen Sie sie durch einen eigenen Loader, der nur auflöst, was dem Prozess gewährt wurde, und der Prozess sieht nur, was Sie erlauben. Es gibt kein `import os`, kein `subprocess`, keinen Umgebungszugriff auf das Dateisystem; diese Funktionen sind in der Umgebung eines Prozesses nicht vorhanden. Die Sandbox ist der Standardzustand, kein Patch auf einem offenen System.

### Embedding

Luas Schnittstelle ist bekanntermaßen klein. Die kanonische C-API umfasst rund 60 Funktionen, und reine Go-Implementierungen machen das Einbetten in Wippys Go-Kern unkompliziert, ohne cgo. Das Erstellen und Abbauen der Lua-Umgebung eines Prozesses ist billig; Wippy tut es bei jedem Prozessstart ohne messbaren Overhead.

### Deterministische Modulkontrolle

In Wippy wird der Code, den ein Prozess laden kann, durch seinen Registry-Scope bestimmt. Der Lua-Loader löst Module aus der Registry auf, nicht aus dem Dateisystem. Wenn einem Prozess ein Modul nicht gewährt wurde, existiert dieses Modul aus Sicht des Prozesses nicht. So funktioniert mandantenfähige Isolation auf Code-Ebene: Verschiedene Mandanten können unterschiedliche Module verfügbar haben, durchgesetzt von der Laufzeit, nicht von der Anwendungslogik.

### LLM-freundlich

Luas Syntax ist minimal: keine Klassen, keine Dekoratoren, keine in die Sprache eingebackenen Typannotationen, kein async/await, keine komplexe Modulauflösung. Ein LLM, das Lua gesehen hat, kann weit zuverlässiger beim ersten Versuch korrektes Lua generieren als korrektes Python (mit seinen Dekorator-Mustern, Kontextmanagern und Typsystem) oder JavaScript (mit seiner Prototypenkette, `this`-Bindung und Modulvarianten). Für eine Plattform, auf der Agenten ihre eigenen Tools schreiben und ändern, ist das entscheidend. Wippy erweitert Lua um ein Typannotationssystem (Generics, Unions, Channel-Typen) und einen eingebauten Linter, sodass Sie Typsicherheit ohne die Syntaxkomplexität erhalten.

### Coroutinen

Lua unterstützt Coroutinen nativ, was direkt auf Wippys nebenläufiges Prozessmodell abbildet. Jeder Prozess läuft in einer Coroutine, die an den Scheduler abgibt. Keine Threads. Keine Locks. Keine Race Conditions zwischen Prozessen. Tausende gleichzeitiger Prozesse arbeiten zusammen, ohne die Komplexität thread-basierter Nebenläufigkeit.

## Was Sie verlieren

Luas Ökosystem ist klein. Es gibt kein Äquivalent zu pip oder npm mit Zehntausenden Paketen. Das ist Absicht: In Wippy sind Abhängigkeiten Registry-Einträge mit deklarierten Capabilities und Sicherheitsrichtlinien, keine beliebigen Pakete aus dem Internet. Aber es bedeutet, dass Sie innerhalb eines Wippy-Prozesses kein `pip install pandas` ausführen können. Datenverarbeitung, die umfangreiche Bibliotheksunterstützung erfordert (ML-Modellinferenz, komplexe numerische Berechnungen), sollte entweder als externer Dienst laufen, den Wippy-Agenten über Tools aufrufen, oder als WASM-Funktion innerhalb der Wippy-Sandbox.

Lua ist außerdem den meisten Entwicklern unvertraut. Die Lernkurve ist real, aber kurz; Luas gesamte Sprachreferenz umfasst etwa 30 Seiten. Die meisten Entwickler, die irgendeine Programmiersprache kennen, können innerhalb eines Tages Lua schreiben. Die Unvertrautheit ist ein Reibungsverlust, aber die architektonischen Vorteile (Sandboxing, Speicher, Embedding) überwiegen ihn für eine Laufzeitplattform, auf der der meiste Benutzercode kurz, werkzeugorientiert und zunehmend KI-generiert ist.

## Lua + WASM: Das Gesamtbild

Wippy ist keine reine Lua-Plattform. Es liefert zwei Laufzeiten aus:

**Lua** ist die primäre Laufzeit für Agentenentwicklung, Tool-Erstellung und Anwendungslogik. Dort wird der meiste Wippy-Code geschrieben und dort generieren Agenten Code. Der kleine Fußabdruck, die vollständige Sandbox-Fähigkeit und die LLM-freundliche Syntax machen sie zum richtigen Standard.

**WASM** ist die sekundäre Laufzeit für kompilierte Workloads. Wenn Sie vorhandenen Code in Rust, Go, C oder einer beliebigen Sprache haben, die nach WebAssembly kompiliert, können Sie ihn innerhalb von Wippy mit derselben Prozessisolation und Registry-Integration wie Lua ausführen. WASM-Funktionen und -Prozesse integrieren sich mit WASI für Uhren, I/O, Dateisystem (über eingehängte Wippy-Filesystem-Einträge) und Umgebungszugriff. Das bedeutet, Sie können vorhandene Geschäftslogik in die Wippy-Sandbox bringen, ohne sie in Lua neu zu schreiben.

Die beiden Laufzeiten teilen sich dasselbe Prozessmodell, dieselbe Registry und dieselben Sicherheitsrichtlinien. Ein Lua-Agent kann eine WASM-Funktion aufrufen. Ein WASM-Prozess kann über die Registry Lua-Funktionen aufrufen. Sie sind Gleichgestellte im selben System.

## Siehe auch

- [Lua-Laufzeit im Überblick](lua/overview.md) - Die Lua-Laufzeit und ihre Module
- [Typen](lua/types.md) - Typannotationen, Generics und Unions
- [Linter](guides/linter.md) - Statische Analyse für Lua
- [WASM-Laufzeit](wasm/overview.md) - Kompilierten Code in der Sandbox ausführen
