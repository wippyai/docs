---
title: "Index der Frontend-Compliance-Regeln"
description: "Kompakter Index der kanonischen Frontend-Regeln und der Zuständigkeit deterministischer Prüfer."
---

# Index der Frontend-Compliance-Regeln

Diese Seite ist ein Index, keine zweite Kopie des Vertrags. Der
[Portable UI Contract](../portable-ui-contract.md) besitzt die normativen
Regelformulierungen; die Links unten führen zu detaillierter
Umsetzungsanleitung.

| Regel | Detaillierte Anleitung | Deterministisches Ergebnis |
|---|---|---|
| FE-PORT-001 | [Portable UI Contract](../portable-ui-contract.md) | Private Portabilitätsannahmen zurückweisen |
| FE-UI-001 | [Portable UI Contract](../portable-ui-contract.md) | Rohe oder handgebaute Standard-Controls zurückweisen |
| FE-UI-002 | [Portable UI Contract](../portable-ui-contract.md) | Affordanz-Analyse verlangen |
| FE-UI-003 | [Portable UI Contract](../portable-ui-contract.md) | Nachweis für Sibling-Vertrag und alternatives Theme verlangen |
| FE-UI-004 | [Portable UI Contract](../portable-ui-contract.md) | PrimeVue-Setup verlangen, wenn Controls vorhanden sind |
| FE-UI-005 | [Portable UI Contract](../portable-ui-contract.md) | Erfundene Props und APIs zurückweisen |
| FE-TW-001 | [Tailwind Contract](./tailwind-contract.md) | Gewähltes Wippy-Preset auflösen |
| FE-TW-002 | [Tailwind Contract](./tailwind-contract.md) | Compile-Zeit-Werte zurückweisen, die als Laufzeitwerte dokumentiert sind |
| FE-TW-003 | [Tailwind Contract](./tailwind-contract.md) | Feste Sibling-Werte ohne Invarianten-Klassifikation zurückweisen |
| FE-TW-004 | [Tailwind Contract](./tailwind-contract.md) | Overrides geschützter Mappings zurückweisen |
| FE-TOKEN-001 | [Token Catalogue](./token-catalogue.md) | Nicht deklarierte `--p-*`-Referenzen zurückweisen |
| FE-TOKEN-002 | [Token Catalogue](./token-catalogue.md) | Abgeleitete oder erfundene Token-Namen zurückweisen |
| FE-STYLE-001 | [Theme Authoring](./theming.md) | Private Facade-Klassen und modul-lokales `.p-*`-Theming zurückweisen |
| FE-A11Y-001 | [Portable UI Contract](../portable-ui-contract.md) | Ungültige oder nicht barrierefreie Custom Controls zurückweisen |

## Erforderliche Prüfergruppen

- Token-CSS mit PostCSS geparst; erzeugter Token-Snapshot byteweise verglichen.
- Tatsächliche Tailwind-Konfiguration aufgelöst und repräsentative Utilities kompiliert.
- Ausgegebene Deklarationen klassifiziert als Laufzeitvariable, kompilierte Konstante, beliebiges Literal oder intern/transient.
- Rohe Controls, fehlendes PrimeVue-Setup, Overrides geschützter Mappings, nicht deklarierte Tokens, private Facade-Abhängigkeiten und Drift des Vertrags-Hashes zurückgewiesen.
- Import-Map-Externals mit dem vollständigen gepinnten Snapshot verglichen.
- Build-Ausgabe gegen die konfigurierte Registry und das ausgelieferte Asset geprüft.
- Theme-Umschaltung verwendet `host.setThemeMode()` und verifiziert den
  propagierten AppConfig-Zustand; direkte Manipulation von Theme-Klassen und
  interne Proxy-Verdrahtungen werden zurückgewiesen.
- Generierte Kataloge auf Herkunft, Versionstupel und Quell-Hashes geprüft.
- Kopierbare Beispiele geparst, wo zutreffend gebaut und auf verschachtelte interaktive Inhalte geprüft.
- Der Project-bound-Modus liefert exakt `UNSUPPORTED`, und die Standard-CI schlägt fehl.

Promptmap kann Hinweise liefern. Es ist kein Nachweis für Token-Existenz, Utility-Auflösung, Erreichbarkeit oder Löschung.

## Publikationstore für generierte Inhalte

Die generierten Token- und Tailwind-Abschnitte dürfen zum Publikationszeitpunkt keinen Pending-Marker enthalten. Jedes neue Laufzeit-Token braucht einen echten Wippy-CSS-Konsumenten, einen Mutationstest für berechnete Styles und einen dokumentierten Zweck für portable Konsumenten.

Die Publikation hält Laufzeitnachweise außerhalb des Repositories. Setzen Sie:

- `WIPPY_THEME_ROOT` auf das gewählte `@wippy-fe/theme`-Package.
- `WIPPY_FE_EVIDENCE_ROOT` auf das Release-Evidence-Verzeichnis, das
  `runtime-acceptance-evidence.json`, `visual-evidence-index.json`, deren
  relative Szenario-Manifeste und Screenshots enthält.
- `WIPPY_FE_RUNTIME_EVIDENCE_SHA256` auf den kleingeschriebenen SHA-256 der
  exakten Bytes von `runtime-acceptance-evidence.json`.

`FRONTEND_DOCS_PUBLICATION=1 node scripts/check-frontend-docs.mjs` ruft den
kanonischen Acceptance-Checker des gewählten Themes mit diesem Evidence-Pfad und
-Hash auf, validiert dann die visuellen Nachweise und berechnet sie neu. Normale
Aktualitätsprüfungen der Dokumentation benötigen keine lokalen
Release-Nachweise.

## Deterministische visuelle Verifikation

Jede von einer Erscheinungsänderung betroffene Komponente hat ein
Szenario-Manifest und unveränderliche Vorher-/Nachher-/Diff-Nachweise. Baseline
und Kandidat verwenden denselben Browser-Build, dieselbe Device-Pixel-Ratio,
dieselben Schriften, Fixture-Daten, dasselbe Theme, denselben Viewport, dieselbe
Reduced-Motion-Einstellung und dieselbe Settling-Regel. Erfassen Sie alle
zutreffenden Zustände, einschließlich hellem und dunklem Theme,
Interaktionszuständen, Overlays, Disabled-/Fehlerzuständen und den
Desktop-Layouts, die das Produkt unterstützt. Erfinden Sie keine Anforderung für
schmale/mobile Ansichten für ein reines Desktop-Produkt.

Jedes Szenario erfasst den Ausschnitt der Komponente und den umgebenden
Anwendungskontext. Es erfasst außerdem die vollständige Seite, wenn ein Overlay,
ein Overflow oder das Seitenlayout betroffen sein kann. Ein Komponentenindex
deklariert die vollständige zutreffende Matrix und verweist auf ein
unveränderliches Manifest pro Szenario:

```json
{
  "schemaVersion": "1.0.0",
  "componentId": "module.component",
  "applicability": {
    "themes": ["light", "dark"],
    "viewports": [{ "id": "desktop", "width": 1440, "height": 900 }],
    "states": ["default"],
    "overlay": false
  },
  "finalBuild": {
    "candidateCommit": "generated-candidate-commit",
    "candidateBuildHash": "sha256:generated-candidate-build-hash",
    "recapturedAfterBuild": true
  },
  "scenarios": [
    {
      "scenarioId": "module.component.light.default",
      "theme": "light",
      "viewport": "desktop",
      "state": "default",
      "manifest": "scenarios/module.component.light.default.json"
    },
    {
      "scenarioId": "module.component.dark.default",
      "theme": "dark",
      "viewport": "desktop",
      "state": "default",
      "manifest": "scenarios/module.component.dark.default.json"
    }
  ]
}
```

Der Prüfer bildet das Kreuzprodukt der Anwendbarkeit und schlägt fehl, wenn ein
deklariertes Theme, ein Viewport oder ein Zustand kein eindeutiges Szenario hat.
Wenn `overlay` true ist, verlangt jedes Szenario zusätzlich den Capture-Scope
`full-page`. Commit und Hash des finalen Builds müssen mit dem Kandidaten jedes
Szenarios übereinstimmen, und `recapturedAfterBuild` muss true sein.

Jedes Szenario-Manifest hält Hashes fest, statt Dateinamen zu vertrauen:

```json
{
  "schemaVersion": "1.0.0",
  "scenarioId": "module.component.light.default",
  "componentId": "module.component",
  "state": {
    "theme": "light",
    "viewport": { "width": 1440, "height": 900 },
    "interaction": "default"
  },
  "runtime": {
    "browserVersion": "pinned-browser-version",
    "devicePixelRatio": 1,
    "fontsHash": "sha256:generated-font-set-hash",
    "fixtureHash": "sha256:generated-fixture-hash"
  },
  "baseline": {
    "commit": "generated-baseline-commit",
    "buildHash": "sha256:generated-baseline-build-hash"
  },
  "candidate": {
    "commit": "generated-candidate-commit",
    "buildHash": "sha256:generated-candidate-build-hash",
    "recapturedAfterBuild": true
  },
  "requiredScopes": ["component", "context"],
  "captures": [
    {
      "scope": "component",
      "before": {
        "artifactId": "component-before",
        "path": "screenshots/component-before.png",
        "sha256": "sha256:generated-before-hash"
      },
      "after": {
        "artifactId": "component-after",
        "path": "screenshots/component-after.png",
        "sha256": "sha256:generated-after-hash"
      },
      "diff": {
        "artifactId": "component-diff",
        "path": "screenshots/component-diff.png",
        "sha256": "sha256:generated-diff-hash"
      }
    },
    {
      "scope": "context",
      "before": {
        "artifactId": "context-before",
        "path": "screenshots/context-before.png",
        "sha256": "sha256:generated-before-hash"
      },
      "after": {
        "artifactId": "context-after",
        "path": "screenshots/context-after.png",
        "sha256": "sha256:generated-after-hash"
      },
      "diff": {
        "artifactId": "context-diff",
        "path": "screenshots/context-diff.png",
        "sha256": "sha256:generated-diff-hash"
      }
    }
  ],
  "diff": {
    "changedPixels": 0,
    "totalPixels": 1296000,
    "changedRatio": 0,
    "pixelDeltaThreshold": 8,
    "changedRatioThreshold": 0.001,
    "disposition": "within-threshold",
    "result": "passed",
    "waiver": null
  },
  "console": { "unexpectedErrors": [] },
  "fixtureCleanup": { "temporaryArtifactsRemaining": [], "verified": true }
}
```

Die obigen Werte zeigen die erforderliche Form, keinen gültigen Nachweis. Die
Publikation schlägt fehl, wenn eine geänderte Komponente oder ein erforderlicher
Zustand kein Szenario hat, ein erforderlicher Capture-Scope fehlt, ein
referenziertes Bild oder ein Hash fehlt, Builds veraltet sind, unerwartete
Konsolenfehler bestehen bleiben, temporärer Fixture-Code zurückbleibt oder der
Diff die Toleranz ohne geprüften Design-Waiver überschreitet. Ein Waiver hält
die exakt geänderten Pixel, den Designgrund, den Prüfer und das betroffene
Szenario fest; er kann fehlende Captures, Konsolenfehler oder ausbleibendes
Fixture-Cleanup nicht erlassen.
