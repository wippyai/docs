---
title: "Frontend-Compliance und Veröffentlichungsgates"
description: "Normative Frontend-Compliance-Regeln, Checker-Zuständigkeit, Veröffentlichungsgates und deterministische visuelle Evidenz."
---

# Frontend-Compliance und Veröffentlichungsgates

**Klassifizierung: normative Compliance- und Evidenzreferenz.** Die JSON-Blöcke
definieren Formen mit Platzhaltern; sie sind weder bestandene Evidenz noch ein
eigenständiges Anwendungsfixture.

Diese Seite besitzt die folgenden deterministischen Checker- und
Veröffentlichungsanforderungen. Der
[Vertrag für portable Oberflächen](../portable-ui-contract.md) besitzt die
Portabilitäts- und UI-Regeln; die verlinkten Anleitungen erklären deren Umsetzung.

Die öffentliche Paketfamilie `@wippy-fe/*` 0.0.56 enthält keine Modul-
Compliance-CLI. Der Dokumentationschecker prüft Beispiele und Aktualität der
generierten Kataloge. Der für ein Modul gewählte Compliance-Ablauf muss die
folgenden Anwendungsprüfungen selbst implementieren.

| Regel | Ausführliche Anleitung | Deterministisches Ergebnis |
|---|---|---|
| FE-PORT-001 | [Vertrag für portable Oberflächen](../portable-ui-contract.md) | Private Portabilitätsannahmen ablehnen |
| FE-UI-001 | [Vertrag für portable Oberflächen](../portable-ui-contract.md) | Rohe oder selbst gebaute Standardsteuerelemente ablehnen |
| FE-UI-002 | [Vertrag für portable Oberflächen](../portable-ui-contract.md) | Affordanzanalyse verlangen |
| FE-UI-003 | [Vertrag für portable Oberflächen](../portable-ui-contract.md) | Geschwistervertrag und Evidenz eines Alternativthemes verlangen |
| FE-UI-004 | [Vertrag für portable Oberflächen](../portable-ui-contract.md) | PrimeVue-Einrichtung verlangen, wenn Steuerelemente existieren |
| FE-UI-005 | [Vertrag für portable Oberflächen](../portable-ui-contract.md) | Erfundenen Props und APIs ablehnen |
| FE-TW-001 | [Tailwind-Vertrag](./tailwind-contract.md) | Gewähltes Wippy-Preset auflösen |
| FE-TW-002 | [Tailwind-Vertrag](./tailwind-contract.md) | Als Runtime dokumentierte Compile-Time-Werte ablehnen |
| FE-TW-003 | [Tailwind-Vertrag](./tailwind-contract.md) | Feste Geschwisterwerte ohne Invariantklassifizierung ablehnen |
| FE-TW-004 | [Tailwind-Vertrag](./tailwind-contract.md) | Überschreibungen geschützter Abbildungen ablehnen |
| FE-TOKEN-001 | [Tokenkatalog](./token-catalogue.md) | Nicht deklarierte `--p-*`-Referenzen ablehnen |
| FE-TOKEN-002 | [Tokenkatalog](./token-catalogue.md) | Abgeleitete oder erfundene Tokennamen ablehnen |
| FE-STYLE-001 | [Theme-Erstellung](./theming.md) | Private Facade-Klassen und modullokales `.p-*`-Theming ablehnen |
| FE-A11Y-001 | [Vertrag für portable Oberflächen](../portable-ui-contract.md) | Ungültige oder unzugängliche eigene Steuerelemente ablehnen |

## Erforderliche Checker-Gruppen

- Token-CSS mit PostCSS parsen; generierten Snapshot bytegenau vergleichen.
- Tatsächliche Tailwind-Konfiguration auflösen und repräsentative Utilities kompilieren.
- Deklarationen als Runtime-Variable, kompilierte Konstante, beliebiges Literal oder intern/transient klassifizieren.
- Rohe Steuerelemente, fehlendes PrimeVue, geschützte Überschreibungen, nicht deklarierte Tokens, private Facade-Abhängigkeiten und Vertragshash-Drift ablehnen.
- Import-Map-Externals mit dem vollständigen fixierten Snapshot vergleichen.
- Buildausgabe gegen Registry und ausgeliefertes Asset prüfen.
- Themewechsel über `host.setThemeMode()` und weitergegebenen AppConfig-Zustand prüfen; direkte Klassenmanipulation und interne Proxy-Wires ablehnen.
- Generierte Kataloge auf Herkunft, Versionstupel und Quellhashes prüfen.
- Kopierbare Beispiele parsen, soweit anwendbar bauen und auf verschachtelte interaktive Inhalte prüfen.
- Projektgebundener Modus gibt exakt `UNSUPPORTED` zurück; Standard-CI schlägt fehl.

Promptmap darf Hinweise erzeugen, ist aber keine Evidenz für Tokenexistenz,
Utility-Auflösung, Erreichbarkeit oder Löschung.

## Generierte Veröffentlichungsgates

Generierte Token- und Tailwind-Abschnitte dürfen bei Veröffentlichung keinen
Pending-Marker enthalten. Jedes neue Runtime-Token benötigt einen realen
Wippy-CSS-Verbraucher, einen Computed-Style-Mutationstest und einen dokumentierten Zweck.

Setzen Sie:

- `WIPPY_THEME_ROOT` auf das gewählte Paket `@wippy-fe/theme`.
- `WIPPY_FE_EVIDENCE_ROOT` auf das Release-Evidenzverzeichnis mit `runtime-acceptance-evidence.json`, `visual-evidence-index.json`, Szenariomanifesten und Screenshots.
- `WIPPY_FE_RUNTIME_EVIDENCE_SHA256` auf den kleingeschriebenen SHA-256 der exakten Bytes von `runtime-acceptance-evidence.json`.

Führen Sie aus dem Wippy-Docs-Root mit Node.js 22+ die Publikationsprüfung aus.
PowerShell:

```powershell
$env:FRONTEND_DOCS_PUBLICATION = '1'
node scripts/check-frontend-docs.mjs
Remove-Item Env:FRONTEND_DOCS_PUBLICATION
```

POSIX-Shell:

```sh
FRONTEND_DOCS_PUBLICATION=1 node scripts/check-frontend-docs.mjs
```

Der Check ruft den kanonischen Acceptance-Checker des gewählten Themes mit
Evidenzpfad und Hash auf und validiert sowie berechnet die visuelle Evidenz neu.
Normale Aktualitätschecks benötigen keine lokale Release-Evidenz.

## Deterministische visuelle Prüfung

Jede von einer Darstellungsänderung betroffene Komponente besitzt ein
Szenariomanifest und unveränderliche Vorher-/Nachher-/Diff-Evidenz. Basis und
Kandidat verwenden denselben Browserbuild, Device-Pixel-Ratio, Fonts,
Fixture-Daten, Theme, Viewport, Reduced-Motion-Einstellung und Settling-Regel.
Erfassen Sie alle anwendbaren Hell-/Dunkel-, Interaktions-, Overlay-,
Disabled-/Error- und unterstützten Desktopzustände. Erfinden Sie keine
Mobile-Anforderung für ein reines Desktopprodukt.

Jedes Szenario erfasst Komponentenausschnitt und Anwendungskontext sowie bei
möglichen Overlay-, Overflow- oder Layouteffekten die ganze Seite. Ein
Komponentenindex deklariert die vollständige Matrix:

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

Der Checker bildet das Kreuzprodukt und schlägt bei fehlendem eindeutigen
Szenario fehl. Mit `overlay: true` braucht jedes Szenario zusätzlich den Scope
`full-page`. Commit und Hash des finalen Builds müssen zu jedem Kandidaten
passen und `recapturedAfterBuild` muss `true` sein.

Jedes Szenariomanifest speichert Hashes statt Dateinamen zu vertrauen:

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

Die Werte zeigen nur die Form. Veröffentlichung schlägt fehl, wenn einer
geänderten Komponente oder einem Zustand ein Szenario fehlt, ein Capture-Scope
fehlt, Bild oder Hash fehlt, Builds veraltet sind, unerwartete Konsolenfehler
bleiben, Fixture-Code zurückbleibt oder der Diff ohne geprüften Design-Waiver
die Toleranz überschreitet. Ein Waiver nennt exakte geänderte Pixel,
Designgrund, Prüfer und Szenario; fehlende Captures, Konsolenfehler oder
Fixture-Bereinigung kann er nicht erlassen.
