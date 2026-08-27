---
title: "Eigene Kompositionen"
description: "Vertragsbasierte Ausnahmen für Steuerelemente, deren erforderliche Affordanz PrimeVue nicht bereitstellen kann."
---

# Eigene Kompositionen

**Klassifizierung: normative Referenz für Ausnahmeverträge.** Der JSON-Block
ist ein Schema-Beispiel mit Platzhaltern, kein gültiger Vertrag oder Evidenzsatz.

Eigene Steuerelemente sind Ausnahmen, keine alternative Komponentenbibliothek.

## Zulassungstest

Ein eigenes Steuerelement ist nur zulässig, wenn:

1. PrimeVue die beabsichtigte Semantik, Interaktion und Affordanz weder bereitstellen noch zusammensetzen kann.
2. Die Ausnahme verworfene PrimeVue-Kompositionen dokumentiert.
3. Sie einen exakten generierten PrimeVue-Geschwistervertrag samt Hash nennt.
4. Jede dort als `shared-runtime` klassifizierte Eigenschaft eine exakte Quellabbildung besitzt.
5. Eine feste Utility nur für exakt als `platform-invariant` klassifizierte Eigenschaften verwendet wird.
6. Neue Geometrie und neues Verhalten isoliert und dokumentiert sind.
7. Barrierefreiheits- und visuelle Evidenz bestehen.

Datengleichheit ist keine Affordanzgleichheit. Ein `SelectButton` kann drei
Werte darstellen, wirkt aber nicht wie ein gleitender Drei-Positionen-Schalter.
Erfinden Sie umgekehrt kein `positions`-Prop für `ToggleSwitch`. Ein geprüftes
eigenes Geschwister ist nur bei realer Affordanzanforderung zulässig.

## Modulvertrag

Speichern Sie die geprüfte Ausnahme in `wippy-fe.contract.json` im Modul-Root:

```json
{
  "schemaVersion": "generated-by-selected-contract-tool",
  "exceptions": [
    {
      "id": "module.control.example",
      "source": "src/components/ExampleControl.vue",
      "sourceSha256": "generated-from-source",
      "semanticRole": "documented-role",
      "requiredAffordance": "documented-affordance",
      "rejectedPrimeVueCompositions": [
        {
          "components": ["SelectButton"],
          "reason": "The reviewed sliding affordance cannot be preserved."
        }
      ],
      "visualSibling": {
        "component": "ToggleSwitch",
        "contractId": "primevue.toggleswitch.portable-appearance",
        "contractHash": "generated-from-selected-theme-contract"
      },
      "sharedAppearanceMappings": [
        {
          "contractProperty": "root.width",
          "part": "root",
          "selector": ".example-control",
          "source": {
            "kind": "css-variable",
            "name": "--p-toggleswitch-width"
          }
        }
      ],
      "platformInvariantUtilities": [],
      "moduleLocalProperties": [],
      "accessibilityEvidence": {
        "manifest": ".local/evidence/accessibility-manifest.json",
        "scenarioId": "module.control.example.keyboard",
        "resultId": "module.control.example.keyboard.passed",
        "build": {
          "head": "generated-candidate-commit",
          "trackedFrontendDiffSha256": "generated-diff-hash"
        }
      },
      "visualEvidence": {
        "manifest": ".local/evidence/visual-manifest.json",
        "scenarioId": "module.control.example.light.default",
        "captureId": "module.control.example.light.default.component",
        "build": {
          "head": "generated-candidate-commit",
          "trackedFrontendDiffSha256": "generated-diff-hash"
        }
      }
    }
  ]
}
```

Die Werte sind Schemaplatzhalter, keine gültige Evidenz. Die vollständige
Abbildung wird aus dem gewählten Geschwistervertrag erzeugt; die einzelne Zeile
reicht nicht. Tooling erzeugt Quell- und Vertragshashes. Jede Änderung macht
die Prüfung ungültig.

Diese Seite definiert normative Felder, ist aber kein JSON Schema. Der
Dokumentationschecker beweist nur die Form des Beispiels. Eine echte
Compliance-Implementierung muss Vertrag, Hashes und vollständige
Eigenschaftsmenge gegen das gewählte Theme-Manifest prüfen und jede Evidenz auf
das benannte bestandene Ergebnis beziehungsweise Capture desselben Kandidaten-
Builds auflösen. Die öffentliche Familie `@wippy-fe/*` 0.0.56 enthält keine
Modul-Compliance-CLI. Barrierefreiheit bindet `sourceSha256`, Dateihashes, null
unerwartete Konsolenfehler und ein bestandenes Ergebnis. Visuelle Evidenz bindet
Vorher-/Nachher-/Diff-Dateien, Hashes, neu berechnete Metriken, Disposition und
denselben Build. String, fehlende Datei, fehlendes Szenario/Ergebnis/Capture,
veralteter Buildhash, `pending` oder ungeprüftes Ergebnis genügen nicht.

`platformInvariantUtilities` und `moduleLocalProperties` dürfen leer sein.
Erfinden Sie weder `gap-2`, `w-10`, `rounded-md` noch andere feste Utilities,
nur um Felder zu füllen. Ein ToggleSwitch-Geschwister darf Breite, Höhe, Radius,
Fokusgeometrie oder Bewegung nicht als invariant umdeklarieren, wenn der
Geschwistervertrag `shared-runtime` vorgibt.

Klassifikationen im Geschwistermanifest:

- `shared-runtime`: Jedes eigene Geschwister bildet das veröffentlichte Token oder die runtimegestützte semantische Utility ab und verwendet es.
- `platform-invariant`: Nur für exakt diese Eigenschaft ist ein fester Wert zulässig.
- `implementation-private`: PrimeVue-Interna werden nicht zu Anforderungen des eigenen Geschwisters.

Fehlt die nötige Runtime-Semantik, korrigieren Sie zuerst den gemeinsamen
Theme-Vertrag. Kopieren Sie weder aktuelle Abmessungen noch erfundene Tokennamen.

`sharedAppearanceMappings` ist vollständig: genau eine Abbildung je
`shared-runtime`-Eigenschaft, keine zusätzlichen IDs, mit Vertragsteil,
stabilem Modul-Selektor sowie exakter veröffentlichter Quellart und -bezeichnung.
Die gewählte Compliance-Implementierung muss Selektor, Teil, CSS-Eigenschaft und
Quelle strukturell mit PostCSS beweisen; Token in Kommentar oder fremdem
Selektor zählen nicht. Tailwind-Abbildungen speichern außerdem eindeutige,
exakte `utilityClasses`, deren normalisierte Menge der Quelle entspricht.
`platformInvariantUtilities` enthält Datensätze aus `contractProperty` und
`utility`; `moduleLocalProperties` enthält strukturierte Eigenschafts-IDs und
Prüfgründe statt einer freien CSS-Sammlung.

Für eine einzelne Ausnahme entsteht kein gemeinsames `@wippy-fe/ui`-Paket.
Eine Übernahme ist erst möglich, wenn ein zweiter unabhängiger Verbraucher
dasselbe Verhalten und dieselben Portabilitätsanforderungen belegt.
