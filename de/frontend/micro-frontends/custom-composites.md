---
title: "Custom Composites"
description: "Vertrags-zuerst-Ausnahmen für Controls, deren erforderliche Affordanz PrimeVue nicht bereitstellen kann."
---

# Custom Composites

Custom Controls sind Ausnahmen, keine alternative Komponentenbibliothek.

## Zulassungstest

Ein Custom Control wird nur akzeptiert, wenn:

1. PrimeVue die beabsichtigte Semantik, Interaktion und Affordanz weder bereitstellen noch komponieren kann.
2. Die Ausnahme die abgelehnten PrimeVue-Kompositionen festhält.
3. Sie einen exakten generierten PrimeVue-Sibling-Vertrag und dessen Vertrags-Hash benennt.
4. Jede Eigenschaft, die dieser Sibling-Vertrag als `shared-runtime` klassifiziert, ein exaktes Quell-Mapping hat.
5. Ein fester Utility-Wert nur dann akzeptiert wird, wenn der Sibling-Vertrag genau diese Eigenschaft als `platform-invariant` klassifiziert.
6. Neuartige Geometrie und Verhalten isoliert und dokumentiert sind.
7. Barrierefreiheits- und visuelle Nachweise bestehen.

Gleichheit der Datenform ist keine Gleichheit der Affordanz. Ein `SelectButton` mit mehreren Optionen kann drei Werte repräsentieren, sieht aber nicht wie ein gleitender Drei-Positionen-Schalter aus und verhält sich auch nicht so. Umgekehrt: Erfinden Sie keine `positions`-Prop für `ToggleSwitch`. Bauen Sie ein geprüftes Custom Sibling nur dann, wenn die Affordanz-Anforderung real ist.

## Modulvertrag

Hinterlegen Sie eine geprüfte Ausnahme in `wippy-fe.contract.json` im Modul-Root:

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

Die gezeigten Werte sind Schema-Platzhalter, keine gültigen Nachweise. Das
vollständige Mapping wird aus dem gewählten Sibling-Vertrag generiert; der
Auszug mit einer Zeile ist für sich genommen keine gültige Ausnahme. Tooling
generiert die Quell- und Vertrags-Hashes. Ein geänderter Quell-Hash oder
Sibling-Vertrags-Hash macht die Prüfung ungültig.

Diese Seite definiert die normativen Felder; sie ist kein JSON Schema, und der
Dokumentations-Checker weist lediglich nach, dass dieses Beispiel die
erforderliche Form beibehält. `wippy-fe-compliance` validiert einen echten
Modulvertrag gegen das gewählte Theme-Manifest, verifiziert die Hashes und die
vollständige Eigenschaftsmenge und prüft, dass jede Nachweisreferenz auf das
benannte bestandene Ergebnis bzw. Capture aus demselben Kandidaten-Build
auflöst. Barrierefreiheitsnachweise binden den `sourceSha256` der Komponente,
gehashte Dateien, null unerwartete Konsolenfehler und ein bestandenes Ergebnis.
Visuelle Nachweise binden kanonische Vorher-/Nachher-/Diff-Dateien, Hashes, neu
berechnete Metriken und Disposition sowie den passenden Kandidaten-Build. Ein
String, eine fehlende Datei, ein fehlendes Szenario/Ergebnis/Capture, ein
veralteter Build-Hash, `pending` oder ein ungeprüftes Ergebnis erfüllen die
Nachweisanforderung nicht.

`platformInvariantUtilities` und `moduleLocalProperties` dürfen leer sein.
Erfinden Sie niemals `gap-2`, `w-10`, `rounded-md` oder eine andere feste
Utility, nur um ein Vertragsfeld nicht leer zu lassen. Insbesondere darf ein
ToggleSwitch-Sibling Breite, Höhe, Radius, Fokusgeometrie oder Bewegung nicht
als invariant umetikettieren, wenn sein gewählter Sibling-Vertrag diese
Eigenschaften als `shared-runtime` klassifiziert.

Das Sibling-Manifest klassifiziert Eigenschaften als:

- `shared-runtime`: Jedes Custom Sibling mappt und konsumiert das
  veröffentlichte Token oder die laufzeitgestützte semantische Utility.
- `platform-invariant`: Ein fester Wert ist nur für genau diese Eigenschaft
  zulässig.
- `implementation-private`: Interne PrimeVue-Mechanik wird nicht zur Anforderung
  für ein Custom Sibling.

Existiert die erforderliche Laufzeitsemantik nicht, korrigieren Sie zuerst den gemeinsamen Theme-Vertrag. Kopieren Sie niemals die aktuellen Sibling-Dimensionen und erfinden Sie keinen Token-Namen.

`sharedAppearanceMappings` ist erschöpfend, nicht illustrativ: Es enthält genau
ein Mapping für jede `shared-runtime`-Eigenschaft im gewählten Sibling-Vertrag,
keine zusätzlichen Property-IDs, den Vertragsteil, einen stabilen
Modul-Selektor sowie die exakte veröffentlichte Quellart und deren Namen. Das
Compliance-Tooling nutzt Selektor, Teil, CSS-Eigenschaft und veröffentlichte
Quelle, um das Mapping strukturell mit PostCSS nachzuweisen; ein Token-Name in
einem Kommentar oder in einem unbeteiligten Selektor zählt nicht. Ein
Tailwind-gestütztes Mapping hält zusätzlich eindeutige, exakte `utilityClasses`
fest; nach der Normalisierung muss diese Menge der Quellmenge des gewählten
Sibling-Vertrags entsprechen. `platformInvariantUtilities` enthält Einträge der
Form `{ "contractProperty": "...", "utility": "..." }`, deren Utility der Quelle
des gewählten Sibling-Vertrags entspricht. `moduleLocalProperties` enthält, wenn
nicht leer, strukturierte Property-IDs und Prüfgründe statt eines formlosen
CSS-Sammelsuriums.

Für eine einzelne Ausnahme wird kein gemeinsames `@wippy-fe/ui`-Package angelegt. Eine Beförderung kommt erst infrage, nachdem ein zweiter unabhängiger Konsument dieselben Verhaltens- und Portabilitätsanforderungen nachgewiesen hat.
