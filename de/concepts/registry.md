---
title: "Registry"
description: "Wie Wippy typisierte Einträge speichert, Runtime-Ressourcen initialisiert und Konfigurationsänderungen weitergibt."
---

# Registry

Die Registry ist Wippys versionierter Speicher für Entrypoints, Services, Ressourcen und andere Runtime-Definitionen. Die meisten Runtime-Entry-Kinds werden über Event-Bus-Transaktionen abgeglichen; interne Kinds wie `registry.entry` und Namespace-Metadaten umgehen standardmäßig den Event-Versand.

## Einträge

Die Registry enthält **Einträge** — typisierte Definitionen mit eindeutigen IDs:

```
app.api:get_user          → HTTP handler
app.workers:email_sender  → Background process
app:database              → Database connection
app:templates             → Template set
```

Jeder Eintrag hat eine `ID` im Format `namespace:name`, einen `kind`, der seinen Handler bestimmt, beliebige `meta`-Felder und Kind-spezifische `data`.

Registry-IDs dienen bei vielen Autorisierungsprüfungen auch als Ressourcen. Die Registry speichert die Definitionen; der Security-Scope entscheidet, ob geschützte Operationen darauf zugreifen dürfen. Siehe [Sicherheitsmodell](./security-model.md).

Neben diesem verfassten Inhalt führt die Registry für jeden Eintrag ihre eigene Herkunftsinformation: den `owner`, also die Deployment-Quelle, aus der der Eintrag stammt, und `root`, das eine vom Deployment ausgewählte Abhängigkeitsdeklaration markiert. Dieser Zustand wird von der Registry vergeben und nicht vom Autor des Eintrags geschrieben, und er wird getrennt von `meta` gehalten, damit beide nie verwechselt werden können. Gelesen wird er über die Snapshot-State-API statt über die gewöhnlichen Eintrags-APIs — siehe [Registry-Modul](lua/core/registry.md#snapshot-state).

## Kind-Handler

Wenn ein Eintrag übermittelt wird, bestimmt sein `kind`, welcher Handler ihn verarbeitet. Der Handler validiert die Konfiguration und erstellt Laufzeit-Ressourcen — ein `http.service`-Eintrag startet einen HTTP-Server, ein `function.lua`-Eintrag erstellt einen Funktionspool, ein `db.sql.postgres`-Eintrag richtet einen Verbindungspool ein. Siehe [Entry-Typen-Anleitung](guides/entry-kinds.md) für verfügbare Typen und [Benutzerdefinierte Entry-Typen](internals/kinds.md) für die Implementierung von Handlern.

## Live-Updates

Einträge können während des Betriebs hinzugefügt, aktualisiert oder entfernt werden. Bei versendeten Kinds fordert eine Registry-Transaktion beteiligte Handler vor dem Commit auf, jede Operation anzunehmen oder abzulehnen. Eine Ablehnung verwirft die Transaktion und wendet den umgekehrten Übergang an. Zusammengehörige Topologieänderungen erzeugen eine neue Registry-Version.

Wenn Historie aktiviert ist, unterstützt der Versionsverlauf Übergänge vorwärts und rückwärts. Die standardmäßige In-Memory-Historie gilt für die Lebensdauer des Prozesses; SQLite- und PostgreSQL-Backends speichern sie über Neustarts hinweg.

YAML- und JSON-Definitionsdateien sind Quellmanifeste, die der Bootloader in Einträge umwandelt. Sie sind keine serialisierten Registry-Snapshots. Siehe [Registry-Modul](lua/core/registry.md) für den programmatischen Zugriff.

## Siehe auch

- [YAML und Projektstruktur](start/structure.md) — Definitionsdateien
- [Benutzerdefinierte Entry-Kinds](internals/kinds.md) — Kind-Handler implementieren
- [Prozessmodell](concepts/process-model.md) — Prozessausführung verstehen
