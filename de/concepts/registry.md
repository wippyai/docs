# Registry

Die Registry ist Wippys zentraler Konfigurationsspeicher. Alle Definitionen — Einstiegspunkte, Dienste, Ressourcen — befinden sich hier, und Änderungen werden reaktiv durch das System weitergegeben.

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

Wenn ein Eintrag übermittelt wird, bestimmt sein `kind`, welcher Handler ihn verarbeitet. Der Handler validiert die Konfiguration und erstellt Laufzeit-Ressourcen — ein `http.service`-Eintrag startet einen HTTP-Server, ein `function.lua`-Eintrag erstellt einen Funktionspool, ein `sql.database`-Eintrag richtet einen Verbindungspool ein. Siehe [Entry-Typen-Anleitung](guides/entry-kinds.md) für verfügbare Typen und [Benutzerdefinierte Entry-Typen](internals/kinds.md) für die Implementierung von Handlern.

## Live-Updates

Die Registry unterstützt Änderungen zur Laufzeit — Einträge hinzufügen, aktualisieren oder entfernen, während das System läuft. Änderungen fließen durch den Ereignisbus, wo Listener sie validieren oder ablehnen können, und Transaktionen stellen Atomarität sicher. Die Versionshistorie ermöglicht das Zurücksetzen auf frühere Versionen.

YAML-Definitionsdateien sind serialisierte Registry-Momentaufnahmen, die beim Start geladen werden. Siehe [Registry-Modul](lua/core/registry.md) für programmatischen Zugriff.

## Siehe auch

- [YAML & Projektstruktur](start/structure.md) - Definitionsdateien
- [Benutzerdefinierte Entry-Typen](internals/kinds.md) - Kind-Handler implementieren
- [Prozessmodell](concepts/process-model.md) - Wie Prozesse funktionieren
