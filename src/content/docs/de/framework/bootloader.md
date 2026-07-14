---
title: "Bootloader"
---

# Bootloader

Das Modul `wippy/bootloader` orchestriert die Anwendungsinitialisierung, indem es Bootloader-Funktionen entdeckt und in einer definierten Reihenfolge beim Start ausfuehrt. Andere Framework-Module (Migrationen, Verschluesselung, Index-Refresh) registrieren Bootloader, um ihre eigenen Initialisierungsschritte auszufuehren.

## Einrichtung

Fuege das Modul deinem Projekt hinzu:

```bash
wippy add wippy/bootloader
wippy install
```

Deklariere die Abhaengigkeit und den erforderlichen Anwendungs-Host:

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

Der Bootloader selbst laeuft als `wippy.bootloader:bootloader.service` (ein `process.service` mit `auto_start: true`). Nichts weiter ist erforderlich, um ihn zu aktivieren.

## Funktionsweise

Beim Start fuehrt der Bootloader folgende Schritte aus:

1. Entdeckt jeden Eintrag mit `meta.type: bootloader` aus der Registry.
2. Sortiert sie aufsteigend nach `meta.order` (niedrigste zuerst).
3. Fuehrt jeden einzelnen sequenziell als Lua-Funktion aus.
4. Stoppt beim ersten Fehler, der `status = "error"` zurueckgibt.
5. Meldet nach Abschluss die Gesamt-/Erfolgs-/Fehl-/Uebersprungen-Zaehler.

Bootloader sind autonom -- jeder prueft seine eigenen Bedingungen, erledigt seine Arbeit und meldet ein strukturiertes Ergebnis.

## Einen Bootloader definieren

Ein Bootloader ist ein beliebiger `function.lua`-Eintrag mit `meta.type: bootloader`:

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
| `meta.order` | Nein | Ausfuehrungsreihenfolge (Standard `100`); niedrigere laufen zuerst |
| `meta.description` | Nein | Menschenlesbare Zusammenfassung |
| `meta.requires` | Nein | Abhaengigkeitshinweise, die in Logs angezeigt werden |

### Rueckgabevertrag

Die `method` gibt eine Tabelle zurueck, die das Ergebnis beschreibt:

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
| `skipped` | Keine Aktion (bereits erledigt, Vorbedingung nicht erfuellt) |
| `error` | Fehler -- stoppt die Boot-Sequenz |

Ein Bootloader, der einen Lua-Fehler ausloest, wird als `error` behandelt.

## Ausfuehrungsreihenfolge

Niedrigere `order`-Werte werden zuerst ausgefuehrt. Reserviere niedrige Reihenfolgen fuer Infrastruktur:

| Order | Typische Verwendung |
|-------|-------------|
| `10` | Geheimnisse und Verschluesselungsschluessel (vom Modul bereitgestellt) |
| `20` | Schema-Migrationen (von `wippy/migration` bereitgestellt) |
| `50` | Daten-Seeding, Suchindex-Aufwaermung |
| `100` | Standard -- Aufgaben auf Anwendungsebene |

Wenn zwei Bootloader dieselbe Reihenfolge teilen, ist die Ausfuehrungsreihenfolge zwischen ihnen nicht garantiert.

## Eingebaute Bootloader

### Verschluesselungsschluessel (Order `10`)

Generiert einen 256-Bit `ENCRYPTION_KEY` und speichert ihn ueber den konfigurierten `env_storage`, falls noch kein Wert vorhanden ist. Andere Module (Sicherheit, Nutzungsverfolgung) lesen diese Variable fuer Envelope-Verschluesselung. Wird uebersprungen, wenn die Variable bereits existiert.

### Migrations-Bootloader (Order `20`)

Bereitgestellt von `wippy/migration`. Entdeckt jeden Eintrag mit `meta.type: migration`, gruppiert sie nach `meta.target_db` und wendet die ausstehenden an. Siehe [Migrationen](framework/migration.md).

## Boot-Status beobachten

Der Service protokolliert eine Zeile pro Bootloader (`SUCCESS`, `FAILED`, `SKIPPED`) mit der Eintrags-ID, Reihenfolge und Dauer. Die abschliessende Zusammenfassungszeile meldet aggregierte Zaehler. Ein fehlgeschlagener Bootloader bricht den Start ab -- die Restart-Policy des Supervisors gilt dann fuer `bootloader.service`.

<tip>
Halte Bootloader idempotent. Sie koennen nach einem Crash-Restart erneut laufen, daher pruefe Vorbedingungen (Zeile existiert, Datei vorhanden, Env-Variable gesetzt), bevor du Arbeit verrichtest.
</tip>

## Siehe Auch

- [Migrationen](framework/migration.md) - Migrations-Bootloader und DSL
- [Supervision](guides/supervision.md) - Service-Lebenszyklus und Restart-Policy
- [Framework-Uebersicht](framework/overview.md) - Verwendung von Framework-Modulen
