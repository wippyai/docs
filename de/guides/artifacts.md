---
title: "Build-Zeit-Artefakte"
description: "Eine Filesystem-Ressource als formatbewusstes Artefakt deklarieren, sie in ein konsumierendes Projekt materialisieren und was die Laufzeit automatisch abgleicht."
---

# Build-Zeit-Artefakte

Ein Modul kann ein Verzeichnis ausliefern, das Konsumenten **zur Build-Zeit** statt
zur Laufzeit verwenden — am nützlichsten ein Paket, gegen das andere Module kompilieren. Wippy
nennt diese **Artefakte**: gewöhnliche WAPP-Filesystem-Ressourcen, markiert mit
`meta.artifact.format`.

So erreicht ein geteiltes Paket ein Modul in einem anderen Repository. Ein Pfad-Alias
löst nur innerhalb eines Repos auf; ein Artefakt reist mit dem Modul.

[Die Design-Schicht](../frontend/design-layer.md) erklärt, *was* in ein solches
Paket gehört und was nicht; diese Seite ist der Mechanismus, der es ausliefert.

## Ein Artefakt deklarieren

Der Produzent deklariert ein normales `fs.directory` und markiert es mit einem Format:

```yaml
# src/_index.yaml
entries:
  - name: package_fs
    kind: fs.directory
    meta:
      comment: Das npm-Paket, das Konsumenten zur Build-Zeit materialisieren.
      artifact:
        format: node-package
    directory: ./package
```

Sonst ändert sich nichts: Die Ressource wird wie gewohnt in das WAPP gepackt. Deklarierte
Artefakte werden **beim Veröffentlichen des Moduls und beim Packen der Anwendung validiert**, sodass ein
fehlerhaftes Artefakt beim Veröffentlichen scheitert statt bei einem Konsumenten.

## Formate

Ein Format-Adapter entscheidet, wie ein Verzeichnis validiert wird, welche Identität es hat
und wo es landet. Wippy liefert eines eingebaut mit:

| Format | Besitzt Teilbaum | Validiert |
|---|---|---|
| `node-package` | `npm/` | `package.json` |

`node-package` erfordert einen `name` und eine semantische `version` und **lehnt die
Lifecycle-Skripte `preinstall`, `install`, `postinstall` und `prepare` ab** — ein
materialisiertes Paket darf bei der Installation nichts ausführen. Es schreibt nach
`npm/<Paketname>` unterhalb der Materialisierungswurzel.

Das Format muss in der Binärdatei registriert sein, die die Arbeit erledigt. Hosts können zusätzliche
Formate registrieren; doppelte Namen und überlappende Wurzeln werden abgelehnt.

## Materialisieren

Meistens führen Sie nichts aus. Materialisierte Ausgaben werden automatisch abgeglichen während:

- vollständigem und gezieltem `wippy install` und `wippy update`
- Kaltstart
- Hub-gestützter dynamischer Installation, Aktualisierung und Deinstallation

Vollständige Installation, Aktualisierung, Kaltstart und Laufzeit-Abgleich von Abhängigkeiten sind
*exakt*: veraltete Ausgaben werden entfernt. Eine **gezielte** Installation überlagert nur die
ausgewählten Module und bewahrt Ausgaben, die zu nicht ausgewählten Modulen gehören.

Lokale Modulersetzungen durchlaufen denselben Validierungs- und Materialisierungslebenszyklus
wie gepackte Ressourcen, sodass sich das Artefakt eines ersetzten Moduls wie ein veröffentlichtes verhält.

### Explizit materialisieren

Für einen Build-Schritt, der das Artefakt braucht, bevor die Laufzeit beteiligt ist, stellt die
CLI es direkt bereit:

```bash
wippy artifacts materialize <pack.wapp> <namespace:name> [--root <directory>]
```

`--root` verwendet standardmäßig `.wippy`. Die Ressource muss `meta.artifact.format` deklarieren,
und dieses Format muss in dieser CLI registriert sein.

Machen Sie sich klar, was dieses Kommando bewusst **nicht** tut: Es löst keine Modulabhängigkeiten
auf, verändert `wippy.lock` nicht, ruft keine Paketmanager auf und nimmt nicht an der
Laufzeitkomposition teil. Es validiert ein Artefakt aus einem WAPP und schreibt es auf die Festplatte.

### Wo die Ausgabe landet

`artifact.materialization_root` konfiguriert die von der Anwendung besessene Ausgabewurzel.
Der Standardwert ist das übergeordnete Verzeichnis des Vendor-Verzeichnisses für Abhängigkeiten. Jedes Format besitzt
darunter einen nicht überlappenden Teilbaum, sodass die `node-package`-Ausgabe immer unter
`<root>/npm/` liegt.

Materialisierung ist transaktional. Inhalte werden validiert und bereitgestellt, verwaltete
Wurzeln werden unter einer Prozesssperre atomar getauscht, ein Fehler rollt mit der umgebenden
Registry-Transaktion zurück, und ein unterbrochener Tausch wird beim nächsten Lauf wiederhergestellt.

## Ausgearbeitetes Beispiel: ein geteiltes Frontend-Paket

Ein Produzentenmodul, dessen einzige Aufgabe das Veröffentlichen eines Pakets ist — es liefert zur
Laufzeit nichts aus:

```yaml
# platform/ui-kit/src/_index.yaml
version: "1.0"
namespace: kickside.ui_kit

entries:
  - name: package_fs
    kind: fs.directory
    meta:
      artifact:
        format: node-package
    directory: ./package
```

Ein Konsument materialisiert es in seinen eigenen Baum, bevor er Abhängigkeiten installiert:

```bash
wippy artifacts materialize kickside-ui-kit-1.5.0.wapp \
  kickside.ui_kit:package_fs --root ./.wippy
```

Das schreibt `./.wippy/npm/@kickside/ui-kit`. Der Konsument greift es mit einem
gewöhnlichen Workspaces-Glob auf, sodass die Auflösung von da an schlichte Node-Auflösung ist:

```json
{
  "workspaces": ["./.wippy/npm/@*/*"]
}
```

```bash
npm install
```

Zwei Dinge lohnen sich, aus dieser Form zu übernehmen:

- **Das Paket ist ein eigenes Modul, kein Verzeichnis in einem größeren.** Das
  Artefakt trägt seine eigene `package.json`-Version, und es an ein Modul zu binden,
  das sich aus unabhängigen Gründen ändert, erzwingt jedes Mal ein Release des einen, wenn das
  andere sich bewegt.
- **Der Konsument löst es als normale Abhängigkeit auf.** Einmal materialisiert gibt es
  keinen Wippy-spezifischen Importpfad, und genau das lässt dieselbe Quelle innerhalb
  des Monorepos und außerhalb davon bauen.

## Von Anfang bis Ende: Erstellen, Dev-Loop, CI

### Den Produzenten erstellen

Für ein Paket-Artefakt gibt es meist **nichts zu bauen** — das Verzeichnis ist
das Liefergut. Ein CSS-Vokabularpaket besteht nur aus Dateien plus einem Manifest:

```text
platform/ui-kit/
├── src/_index.yaml      # deklariert package_fs als Artefakt
└── package/             # das Verzeichnis, das zum npm-Paket wird
    ├── package.json
    ├── kx-card.css
    └── kx-state.css
```

```json
{
  "name": "@kickside/ui-kit",
  "version": "1.5.0",
  "type": "module",
  "sideEffects": ["*.css"],
  "exports": {
    "./kx-card.css": "./kx-card.css",
    "./kx-state.css": "./kx-state.css"
  },
  "files": ["kx-card.css", "kx-state.css", "package.json"]
}
```

`sideEffects` ist für ein reines CSS-Paket entscheidend: Ohne dieses Feld steht es einem Bundler
frei, ein importiertes Stylesheet als toten Code zu behandeln und zu verwerfen.

**Die Paketversion muss der Modulversion entsprechen.** `wippy publish`
validiert das und verweigert eine Abweichung, also erhöhen Sie beide gemeinsam. Das ist auch der
Grund, einem geteilten Paket ein *eigenes* Modul zu geben, statt es in ein
größeres zu verschachteln — sonst erzwingt jede unabhängige Änderung am Host-Modul ein
Release des Pakets und umgekehrt.

### Veröffentlichen

```bash
# validieren, ohne zu veröffentlichen
wippy publish --dry-run --version 1.5.0

# veröffentlichen
wippy publish --create --module-type library --module-visibility public --version 1.5.0
```

Deklarierte Artefakte werden als Teil des Veröffentlichens validiert, sodass eine package.json, die
die Regeln des Formats verletzt, hier abgelehnt wird und nicht erst im Build eines Konsumenten.

### Der Dev-Loop

Bei jeder Änderung zu veröffentlichen ist kein Dev-Loop. Packen Sie den Produzenten lokal und richten Sie den
Materialisierungsschritt des Konsumenten stattdessen auf diese Datei:

```bash
# aus dem Produzentenmodul
wippy pack /tmp/ui-kit-dev.wapp

# Konsumenten materialisieren aus dem lokalen Pack statt aus dem veröffentlichten
UI_KIT_WAPP=/tmp/ui-kit-dev.wapp make ui-kit MOD=workflows
```

Behalten Sie diese Überschreibung als *einzigen* Unterschied zwischen Dev-Pfad und CI — eine
Umgebungsvariable, die die Pack-Datei auswählt, während alles Nachgelagerte identisch bleibt. Ein
Dev-Loop, der anders materialisiert als CI, sagt CI nicht mehr voraus.

### Einbindung in make und CI

Machen Sie den Materialisierungsschritt zu einer **Voraussetzung des Konsumenten-Builds**, nicht zu
etwas, an dessen Ausführung sich jemand erinnern muss:

```make
UI_KIT_WAPP ?=

build:
	@case " $(UI_KIT_CONSUMERS) " in *" $(MOD) "*) $(MAKE) ui-kit MOD=$(MOD);; esac
	cd $(call fe_dir,$(MOD)) && npm run build
```

CI braucht dann überhaupt keinen artefaktspezifischen Schritt: Es führt dasselbe `make build` aus,
`UI_KIT_WAPP` ist nicht gesetzt, also läuft der Abruf-und-Materialisieren-Pfad gegen die in
`build-inputs` gepinnte veröffentlichte Version. Ein frischer Checkout kann nicht gegen ein
veraltetes oder fehlendes Paket kompilieren, und ein Mitwirkender, der nie von
Artefakten gehört hat, bekommt trotzdem einen korrekten Build.

## Was Sie weiterhin selbst zusammenbauen müssen

`wippy artifacts materialize` ist bewusst eng gefasst, sodass ein Build, der ein Artefakt
konsumiert, derzeit vier Schritte selbst zusammenklebt. Zu wissen, welche vier,
erspart deren Wiederentdeckung:

**1. Das `.wapp` beschaffen.** Das Kommando nimmt einen *Pfad zu einer Pack-Datei*, keine Modul-Referenz,
und löst keine Abhängigkeiten auf — also muss etwas den Produzenten zuerst holen. Das
praktikable Muster ist ein winziges Wippy-Projekt, dessen einzige Aufgabe es ist, ihn zu pinnen und herunterzuladen:

```yaml
# build-inputs/wippy.lock — ein Projekt, das nur zum Abrufen existiert
modules:
  - name: kickside/ui-kit
    version: 1.5.0
    hash: be1eafd5…
```

```bash
( cd build-inputs && wippy install )
wapp=$(ls build-inputs/.wippy/vendor/kickside/ui-kit-*.wapp | grep -v sha256 | sort | tail -1)
```

Es hier statt im Anwendungs-Lock zu pinnen, hält eine Build-Zeit-Eingabe
aus dem Laufzeit-Abhängigkeitsgraphen heraus.

**2. Einmal pro Konsument materialisieren**, in eine Wurzel, die der Paketmanager des
Konsumenten sehen kann:

```bash
wippy artifacts materialize "$wapp" kickside.ui_kit:package_fs --root ./ui/.wippy
```

**3. Die `package.json` des Konsumenten verdrahten.** Materialisieren schreibt Dateien; es
bearbeitet keine Manifeste. npm verlinkt das Paket nur, wenn der Konsument *sowohl*
den Workspace-Glob als auch die Abhängigkeit deklariert:

```json
{
  "workspaces": ["./.wippy/npm/@*/*"],
  "dependencies": { "@kickside/ui-kit": "*" }
}
```

Die Version ist `*`, weil das materialisierte Paket seine eigene trägt. Skripten Sie
das und machen Sie es idempotent — fehlt die Verdrahtung, scheitert der Build viel
später mit einem nackten `ENOENT` auf einem Stylesheet, was sich wie eine fehlende Datei
liest statt wie fehlende Verdrahtung.

**4. Den Paketmanager ausführen.** `materialize` ruft keinen auf, also liegt
`npm install` nach Schritt 3 bei Ihnen.

Zusammen, in einem Target, das das konsumierende Modul als Parameter nimmt:

```make
ui-kit:
	@set -e; \
	( cd build-inputs && $(WIPPY) install ); \
	wapp=$$(ls build-inputs/.wippy/vendor/kickside/ui-kit-*.wapp | grep -v sha256 | sort | tail -1); \
	test -n "$$wapp" || { echo "no ui-kit .wapp; is the module published?"; exit 1; }; \
	$(WIPPY) artifacts materialize "$$wapp" kickside.ui_kit:package_fs --root $(DIR)/.wippy; \
	cd $(DIR) && node ../../scripts/wire-ui-kit.mjs && npm install --no-audit --no-fund
```

Machen Sie das gesamte Target zu einer Voraussetzung des Konsumenten-Builds, damit ein frischer
Checkout nicht gegen ein veraltetes oder fehlendes Paket kompilieren kann.

## Nicht im Umfang

Artefakte führen absichtlich keinen zweiten Resolver, keine Paket-Registry,
kein Archivformat, kein Lock-Schema, keine Hub-API und kein Modulmanifest ein. Semantik reiner
Build-Abhängigkeiten, Weiterverbreitungsrichtlinien und Host-ABI-Validierung sind separate Belange
und werden hier nicht gelöst.

## Verwandt

- [Abhängigkeitsverwaltung](./dependency-management.md) — Module und lokale
  Ersetzungen auflösen
- [Veröffentlichen](./publishing.md) — was ein veröffentlichtes Modul enthält
- [Die Design-Schicht](../frontend/design-layer.md) — warum ein geteiltes Frontend-Vokabular
  überhaupt als Paket ausgeliefert wird
