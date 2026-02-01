# Registry

Die Registry ist Wippys zentraler Konfigurationsspeicher. Alle Definitionen — Entry Points, Dienste, Ressourcen — leben hier, und Änderungen propagieren reaktiv durch das System.

## Einträge

Die Registry enthält **Einträge** — typisierte Definitionen mit eindeutigen IDs:

```
app.api:get_user          → HTTP-Handler
app.workers:email_sender  → Hintergrundprozess
app:database              → Datenbankverbindung
app:templates             → Template-Set
```

Jeder Eintrag hat eine `ID` (namespace:name-Format), einen `kind`, der seinen Handler bestimmt, beliebige `meta`-Felder und kind-spezifische `data`.

## Kind-Handler

Wenn ein Eintrag übermittelt wird, bestimmt sein `kind`, welcher Handler ihn verarbeitet. Der Handler validiert die Konfiguration und erstellt Runtime-Ressourcen — ein `http.service`-Eintrag startet einen HTTP-Server, ein `function.lua`-Eintrag erstellt einen Funktionspool, ein `sql.database`-Eintrag stellt einen Connection-Pool her. Siehe [Entry-Typen-Anleitung](guide-entry-kinds.md) für verfügbare Kinds und [Benutzerdefinierte Entry-Typen](internal-kinds.md) für die Implementierung von Handlern.

## Live-Updates

Die Registry unterstützt Laufzeitänderungen — Einträge hinzufügen, aktualisieren oder entfernen, während das System läuft. Änderungen fließen durch den Event-Bus, wo Listener sie validieren oder ablehnen können, und Transaktionen stellen Atomizität sicher. Versionshistorie ermöglicht Rollback.

YAML-Definitionsdateien sind serialisierte Registry-Snapshots, die beim Start geladen werden. Siehe [Registry-Modul](lua-registry.md) für programmatischen Zugriff.

## Siehe auch

- [YAML & Projektstruktur](getting-started-structure.md) - Definitionsdateien
- [Benutzerdefinierte Entry-Typen](internal-kinds.md) - Kind-Handler implementieren
- [Prozessmodell](concept-process-model.md) - Wie Prozesse funktionieren
