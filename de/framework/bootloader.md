---
title: "Bootloader"
description: "Geordnete Initialisierungsfunktionen beim Anwendungsstart mit wippy/bootloader entdecken und ausführen."
---

# Bootloader

Das Modul `wippy/bootloader` entdeckt Initialisierungsfunktionen der Anwendung und
führt sie beim Start in einer festgelegten Reihenfolge aus. Framework-Module verwenden
Bootloader beispielsweise zum Einrichten von Verschlüsselungsschlüsseln und für
Datenbankmigrationen.

Diese Seite ist ein Teilrezept zur Integration und eine API-Referenz, keine
eigenständige Anwendung. Die Definition unten ist strukturell vollständig;
`apply_seed()` steht jedoch für Anwendungscode, der den eigentlichen Seed-Vorgang und
dessen Idempotenzprüfung implementieren muss. Persistente Bereinigung oder Umkehrung
hängt von diesem anwendungsspezifischen Vorgang ab.

## Einrichtung

Fügen Sie das Modul zum Projekt hinzu:

```bash
wippy add wippy/bootloader
wippy install
```

Deklarieren Sie die Abhängigkeit und den erforderlichen Anwendungshost:

```yaml
version: "1.0"
namespace: app

entries:
  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: os_env
    kind: env.storage.os

  - name: dep.bootloader
    kind: ns.dependency
    component: wippy/bootloader
    version: "*"
    parameters:
      - name: application_host
        value: app:processes
      - name: env_storage
        value: app:os_env
```

Die Abhängigkeit aktiviert `wippy.bootloader:bootloader.service`, einen
`process.service` mit `auto_start: true`.

## Funktionsweise

Beim Start führt der Bootloader folgende Schritte aus:

1. Er entdeckt alle Einträge mit `meta.type: bootloader` in der Registry.
2. Sortiert sie aufsteigend nach `meta.order` (niedrigste zuerst).
3. Führt sie nacheinander als Lua-Funktionen aus.
4. Stoppt die verbleibende Sequenz beim ersten Ergebnis mit `status = "error"`.
5. Meldet nach Abschluss die Anzahl aller, erfolgreichen, fehlgeschlagenen und übersprungenen Bootloader.

Jeder Bootloader prüft seine eigenen Bedingungen, führt seine Arbeit aus und meldet
ein strukturiertes Ergebnis.

## Einen Bootloader definieren

Jeder `function.*`-Eintrag mit `meta.type: bootloader` ist ein Bootloader. Die meisten
Bootloader einer Anwendung verwenden `function.lua`:

```yaml
- name: seed_defaults
  kind: function.lua
  meta:
    type: bootloader
    order: 50
    description: Seed default rows for a new install
  source: file://seed_defaults.lua
  method: run
  modules:
    - logger
  imports:
    sql: :sql
```

| Feld | Erforderlich | Beschreibung |
|-------|----------|-------------|
| `meta.type` | Ja | Muss `bootloader` sein |
| `meta.order` | Nein | Ausführungsreihenfolge (Standard `999`); niedrigere Werte laufen zuerst |
| `meta.description` | Nein | Menschenlesbare Zusammenfassung |
| `meta.requires` | Nein | Eine ID oder ein Array von Bootloader-/Service-IDs. Frühere Bootloader müssen `success` oder `skipped` zurückgegeben haben; Service-Anforderungen müssen in der Registry vorhanden sein. Eine unerfüllte Anforderung stoppt die verbleibende Sequenz. |

Der Abhängigkeitstyp wird aus dem referenzierten Registry-Eintrag bestimmt:
`meta.type: bootloader` kennzeichnet einen Bootloader, andere aufgelöste Einträge
gelten als Services. Kann eine ID nicht aufgelöst werden, behandelt der Fallback einen
Namespace mit Punkt als Bootloader-ID und eine andere ID mit Doppelpunkt als Service-ID.
Eine Service-Prüfung wartet bis zu 20 Versuche im Abstand von 500 ms, prüft jedoch nur
die Registry-Präsenz und nicht den Laufzeitzustand.

### Rückgabevertrag

Die `method` gibt eine Tabelle zurück, die das Ergebnis beschreibt:

```lua
local function run()
    local ok, err = apply_seed()
    if err then
        return {
            status = "error",
            message = "seed failed: " .. tostring(err)
        }
    end

    if not ok then
        return {
            status = "skipped",
            message = "already seeded"
        }
    end

    return {
        status = "success",
        message = "seeded default rows"
    }
end

return { run = run }
```

| Status | Bedeutung |
|--------|---------|
| `success` | Arbeit abgeschlossen |
| `skipped` | Keine Aktion (bereits erledigt oder Vorbedingung nicht erfüllt) |
| `error` | Fehler — stoppt die verbleibende Bootloader-Sequenz |

Ein Bootloader, der einen Lua-Fehler auslöst, einen Ausführungsfehler zurückgibt oder
einen Wert zurückgibt, der keine Tabelle ist, wird in ein `error`-Ergebnis umgewandelt.
Der Orchestrator misst und überschreibt `duration`; ein zurückgegebener Wert `details`
bleibt für das Logging erhalten.

Verwenden Sie die drei Statuswerte exakt. Ein anderer Wert wird als `UNKNOWN`
protokolliert, keinem Statuszähler zugerechnet und stoppt derzeit nachfolgende
Bootloader nicht.

## Ausführungsreihenfolge

Niedrigere `order`-Werte werden zuerst ausgeführt. Reservieren Sie niedrige Werte für Infrastruktur:

| Reihenfolge | Typische Verwendung |
|-------|-------------|
| `10` | Secrets und Verschlüsselungsschlüssel (vom Modul bereitgestellt) |
| `20` | Schema-Migrationen (von `wippy/migration` bereitgestellt) |
| `50` | Daten-Seeding und Aufwärmen von Suchindizes |
| `100` | Aufgaben auf Anwendungsebene (Konvention) |

Haben zwei Bootloader denselben Wert, werden sie alphabetisch nach ihrer
vollqualifizierten Eintrags-ID ausgeführt.

## Eingebaute Bootloader

### Verschlüsselungsschlüssel (Reihenfolge `10`)

Erzeugt 32 zufällige Bytes, codiert sie als 64 Zeichen langen hexadezimalen
`ENCRYPTION_KEY` und speichert den Wert über den konfigurierten `env_storage`, falls
noch keiner vorhanden ist. Ist die Variable bereits gesetzt, wird der Schritt übersprungen.

### Migrations-Bootloader (Reihenfolge `20`)

Bereitgestellt von `wippy/migration`. Entdeckt alle Einträge mit
`meta.type: migration`, gruppiert sie nach `meta.target_db` und wendet ausstehende
Migrationen an. Siehe [Migrationen](./migration.md).

## Boot-Status beobachten

Der Service protokolliert zunächst die Anzahl gefundener Bootloader und anschließend
für jeden ausgeführten Bootloader eine Ergebniszeile (`SUCCESS`, `FAILED`, `SKIPPED`)
mit Eintrags-ID, Reihenfolge und Dauer. Die abschließende Zusammenfassung enthält die
Anzahl ausgeführter Bootloader und die Werte je Status. Ein Fehler stoppt spätere
Bootloader und lässt den Orchestrator `false` zusammen mit seiner Statistik
zurückgeben; er löst nicht selbst einen Lua-Prozessfehler aus.

<tip>
Halten Sie Bootloader idempotent. Sie laufen erneut, wenn `bootloader.service` neu
gestartet wird. Prüfen Sie daher Vorbedingungen — etwa ob eine Zeile, Datei oder
Umgebungsvariable bereits vorhanden ist — bevor Sie Änderungen vornehmen.
</tip>

## Siehe auch

- [Migrationen](./migration.md) — Migrations-Bootloader und DSL
- [Supervision](../guides/supervision.md) — Service-Lebenszyklus und Neustartrichtlinie
- [Framework-Übersicht](./overview.md) — Verwendung von Framework-Modulen
