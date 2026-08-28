---
title: "Buildzeit-Artefakte"
description: "Formatbewusste Dateisystemartefakte für konsumierende Projekte deklarieren, validieren, veröffentlichen und materialisieren."
---

# Buildzeit-Artefakte

Ein Modul kann ein Verzeichnis ausliefern, das Konsumenten **zur Buildzeit** statt zur Laufzeit verwenden, beispielsweise ein Paket, gegen das andere Module kompilieren. Wippy bezeichnet solche Inhalte als **Artefakte**: WAPP-Dateisystemressourcen mit `meta.artifact.format`.

Artefakte ermöglichen es, ein gemeinsam genutztes Paket zusammen mit einem Modul über Repository-Grenzen hinweg zu transportieren, an denen ein repository-lokaler Pfadalias nicht aufgelöst werden kann.

[Die Designschicht](../frontend/design-layer.md) erklärt, *was* in ein solches Paket gehört und was nicht; diese Seite beschreibt den Mechanismus für seine Auslieferung.

## Artefakt deklarieren

Der Produzent deklariert ein normales `fs.directory` und kennzeichnet es mit einem Format:

```yaml
# src/_index.yaml
entries:
  - name: package_fs
    kind: fs.directory
    meta:
      comment: The npm package consumers materialize at build time.
      artifact:
        format: node-package
    directory: ./package
```

Die Kennzeichnung allein schließt den Verzeichnisinhalt nicht ein. Wählen Sie den Eintrag `fs.directory` über die Liste `embed:` des Produzentenmanifests oder das Flag `--embed` von Publish beziehungsweise Pack aus. Nach der Auswahl wird der Eintrag in eine gepackte Ressource umgewandelt und sein Artefaktformat validiert; fehlerhafte ausgewählte Artefakte schlagen fehl, bevor das WAPP erzeugt wird.

## Formate

Ein Formatadapter entscheidet, wie ein Verzeichnis validiert wird, welche Identität es besitzt und wo es abgelegt wird. Wippy liefert ein integriertes Format:

| Format | Verwalteter Teilbaum | Validiert |
|---|---|---|
| `node-package` | `npm/` | `package.json` |

`node-package` erfordert `name` und eine semantische `version` und **weist die Lifecycle-Skripte `preinstall`, `install`, `postinstall` und `prepare` zurück** — ein materialisiertes Paket darf bei der Installation nichts ausführen. Es schreibt unterhalb des Materialisierungs-Roots nach `npm/<package name>`.

Das Format muss in dem Binary registriert sein, das die Arbeit ausführt. Hosts können zusätzliche Formate registrieren; doppelte Namen und überlappende Roots werden abgewiesen.

## Materialisierung

Materialisierte Ausgaben werden automatisch abgeglichen bei:

- vollständigem und gezieltem `wippy install` sowie `wippy update`
- Kaltstart
- Hub-gestützter dynamischer Installation, Aktualisierung und Deinstallation

Vollständige Installation, Aktualisierung, Kaltstart und Laufzeit-Abhängigkeitsabgleich sind *exakt*: Veraltete Ausgaben werden entfernt. Eine **gezielte** Installation legt nur die ausgewählten Module darüber und erhält Ausgaben von nicht ausgewählten Modulen.

Lokale Modulersetzungen durchlaufen denselben Validierungs- und Materialisierungs-Lifecycle wie gepackte Ressourcen. Das Artefakt eines ersetzten Moduls verhält sich deshalb wie ein veröffentlichtes.

### Explizite Materialisierung

Für einen Buildschritt, der das Artefakt benötigt, bevor die Laufzeit beteiligt ist, stellt die CLI es direkt bereit:

```bash
wippy artifacts materialize <pack.wapp> <namespace:name> [--root <directory>]
```

Der Standardwert von `--root` ist `.wippy`. Die Ressource muss `meta.artifact.format` deklarieren, und dieses Format muss in der CLI registriert sein.

Dieser Befehl löst **keine** Modulabhängigkeiten auf, verändert `wippy.lock` nicht, ruft keine Paketmanager auf und nimmt nicht an der Laufzeitkomposition teil. Er validiert ein Artefakt aus einem WAPP und schreibt es auf die Festplatte.

### Ausgabeort

`artifact.materialization_root` konfiguriert den anwendungseigenen Ausgabe-Root. Standardmäßig ist dies das übergeordnete Verzeichnis des Dependency-Vendor-Verzeichnisses. Jedes Format verwaltet darunter einen nicht überlappenden Teilbaum; die Ausgabe von `node-package` liegt deshalb stets unter `<root>/npm/`.

Die Materialisierung ist transaktional. Inhalte werden validiert und bereitgestellt, verwaltete Roots unter einer Prozesssperre atomar ausgetauscht, ein Fehler mit der umgebenden Registry-Transaktion zurückgerollt und ein unterbrochener Austausch beim nächsten Lauf wiederhergestellt.

## Ausgearbeitetes Integrationsbeispiel: ein gemeinsames Frontend-Paket

Die Namen `kickside/ui-kit`, Make-Targets, Umgebungsvariablen und Repository-Pfade in diesem Abschnitt veranschaulichen ein Integrationsmuster. Es sind keine von Wippy bereitgestellten Befehle oder Hilfsskripte; passen Sie sie an den Produzenten und das Buildsystem an, die Ihr Artefakt verwalten.

Ein Produzentenmodul kann ein Paket veröffentlichen, ohne eine Laufzeitressource bereitzustellen:

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

Ein Konsument materialisiert es vor der Installation von Abhängigkeiten in seinen eigenen Baum:

```bash
wippy artifacts materialize kickside-ui-kit-1.5.0.wapp \
  kickside.ui_kit:package_fs --root ./.wippy
```

Dadurch entsteht `./.wippy/npm/@kickside/ui-kit`. Der Konsument nimmt es über ein gewöhnliches Workspaces-Glob auf; ab diesem Punkt erfolgt die Auflösung als normale Node-Auflösung:

```json
{
  "workspaces": ["./.wippy/npm/@*/*"]
}
```

```bash
npm install
```

Diese Anordnung besitzt zwei wichtige Eigenschaften:

- **Das Paket ist ein eigenes Modul und kein Verzeichnis innerhalb eines größeren Moduls.** Das Artefakt trägt seine eigene `package.json`-Version. Wird es an ein Modul gekoppelt, das sich aus anderen Gründen ändert, erzwingt jede Änderung des einen eine Veröffentlichung des anderen.
- **Der Konsument löst es als normale Abhängigkeit auf.** Nach der Materialisierung gibt es keinen Wippy-spezifischen Importpfad. Dadurch kann derselbe Quellcode sowohl innerhalb als auch außerhalb des Monorepos gebaut werden.

## End-to-End-Workflow

### Produzent erstellen

Bei einem Paketartefakt kann das Verzeichnis selbst das Lieferobjekt sein. Ein Paket für ein CSS-Vokabular besteht aus seinen Dateien und dem Manifest:

```text
platform/ui-kit/
├── wippy.yaml           # selects package_fs for embedding
├── src/_index.yaml      # declares package_fs as the artifact
└── package/             # the directory that becomes the npm package
    ├── package.json
    ├── kx-card.css
    └── kx-state.css
```

Bewahren Sie die Embed-Auswahl im Produzentenmanifest auf, damit Veröffentlichung, lokales Packen und CI dieselbe Ressourcenmenge verwenden:

```yaml
# platform/ui-kit/wippy.yaml
embed:
  - package_fs
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

`sideEffects` ist für ein reines CSS-Paket wichtig: Ohne diese Angabe kann ein Bundler ein importiertes Stylesheet als toten Code behandeln und entfernen.

**Die Paketversion muss der Modulversion entsprechen.** `wippy publish` validiert dies und weist Abweichungen zurück; erhöhen Sie daher beide gemeinsam. Dies ist ein weiterer Grund, einem gemeinsam genutzten Paket ein *eigenes* Modul zu geben, statt es in ein größeres einzubetten: Andernfalls erzwingt jede nicht verwandte Änderung am Hostmodul eine Veröffentlichung des Pakets und umgekehrt.

### Veröffentlichen

```bash
# validate without publishing
wippy publish --dry-run --version 1.5.0

# publish
wippy publish --create --module-type library --module-visibility public --version 1.5.0
```

Da das Produzentenmanifest `package_fs` zum Einbetten auswählt, wird das Artefakt beim Veröffentlichen eingeschlossen und validiert. Eine `package.json`, die die Formatregeln verletzt, wird hier statt erst im Build eines Konsumenten abgewiesen.

### Entwicklungszyklus

Packen Sie den Produzenten während der Entwicklung lokal und richten Sie den Materialisierungsschritt des Konsumenten auf diese Datei:

```bash
# from the producer module
wippy pack /tmp/ui-kit-dev.wapp

# consumers materialize from the local pack rather than the published one
UI_KIT_WAPP=/tmp/ui-kit-dev.wapp make ui-kit MOD=workflows
```

Die Überschreibung der Packdatei sollte der einzige Unterschied zwischen Entwicklung und CI bleiben. Eine Umgebungsvariable kann das lokale Pack auswählen, während nachgelagerte Materialisierungs- und Buildschritte unverändert bleiben.

### Build- und CI-Integration

Machen Sie die Materialisierung zu einer **Voraussetzung des Konsumenten-Builds**:

```make
UI_KIT_WAPP ?=

build:
	@case " $(UI_KIT_CONSUMERS) " in *" $(MOD) "*) $(MAKE) ui-kit MOD=$(MOD);; esac
	cd $(call fe_dir,$(MOD)) && npm run build
```

CI kann anschließend dasselbe `make build` ohne zusätzlichen Artefaktschritt ausführen. `UI_KIT_WAPP` ist nicht gesetzt, sodass der Abruf- und Materialisierungspfad gegen die in `build-inputs` fixierte veröffentlichte Version läuft. Ein frischer Checkout kann nicht gegen ein veraltetes oder fehlendes Paket kompilieren; auch ein Mitwirkender, der Artefakte nicht kennt, erhält einen korrekten Build.

## Integrationsschritte für Konsumenten

Da `wippy artifacts materialize` eine Ressource aus einem Pack verarbeitet, muss ein Konsumenten-Build vier Schritte koordinieren:

**1. `.wapp` abrufen.** Der Befehl erwartet einen *Pfad zu einer Packdatei*, keine Modulreferenz, und löst keine Abhängigkeiten auf. Ein möglicher Ansatz ist ein kleines Wippy-Projekt, das den Produzenten fixiert und herunterlädt:

```yaml
# build-inputs/wippy.lock — a project that exists only to fetch
modules:
  - name: kickside/ui-kit
    version: 1.5.0
    hash: be1eafd5…
```

```bash
( cd build-inputs && wippy install )
wapp=$(ls build-inputs/.wippy/vendor/kickside/ui-kit-*.wapp | grep -v sha256 | sort | tail -1)
```

Die Fixierung hier statt im Anwendungs-Lock hält eine Buildzeit-Eingabe aus dem Laufzeit-Abhängigkeitsgraphen heraus.

**2. Einmal pro Konsument materialisieren**, und zwar in einen Root, den dessen Paketmanager sehen kann:

```bash
wippy artifacts materialize "$wapp" kickside.ui_kit:package_fs --root ./ui/.wippy
```

**3. `package.json` des Konsumenten verdrahten.** Die Materialisierung schreibt Dateien, bearbeitet jedoch keine Manifeste. npm verlinkt das Paket nur, wenn der Konsument *sowohl* das Workspace-Glob als auch die Abhängigkeit deklariert:

```json
{
  "workspaces": ["./.wippy/npm/@*/*"],
  "dependencies": { "@kickside/ui-kit": "*" }
}
```

Die Version lautet `*`, weil das materialisierte Paket seine eigene Version trägt. Automatisieren Sie diesen Schritt und machen Sie ihn idempotent. Ohne die Manifestverdrahtung kann der Build später für ein Stylesheet `ENOENT` melden, statt die fehlende Abhängigkeitskonfiguration zu benennen.

**4. Paketmanager ausführen.** `materialize` ruft keinen Paketmanager auf; führen Sie daher nach Schritt 3 `npm install` aus.

Zusammengefasst in einem Target, das das konsumierende Modul als Parameter erhält:

```make
ui-kit:
	@set -e; \
	( cd build-inputs && $(WIPPY) install ); \
	wapp=$$(ls build-inputs/.wippy/vendor/kickside/ui-kit-*.wapp | grep -v sha256 | sort | tail -1); \
	test -n "$$wapp" || { echo "no ui-kit .wapp; is the module published?"; exit 1; }; \
	$(WIPPY) artifacts materialize "$$wapp" kickside.ui_kit:package_fs --root $(DIR)/.wippy; \
	cd $(DIR) && node ../../scripts/wire-ui-kit.mjs && npm install --no-audit --no-fund
```

Machen Sie das gesamte Target zu einer Voraussetzung des Konsumenten-Builds, damit ein frischer Checkout nicht gegen ein veraltetes oder fehlendes Paket kompiliert.

## Nicht abgedeckt

Artefakte führen bewusst keinen zweiten Resolver, keine Paket-Registry, kein Archivformat, kein Lockschema, keine Hub-API und kein Modulmanifest ein. Semantik reiner Build-Abhängigkeiten, Weiterverteilungsrichtlinien und Host-ABI-Validierung sind separate Belange und werden hier nicht gelöst.

## Verwandte Themen

- [Abhängigkeitsverwaltung](./dependency-management.md) — Module und lokale Ersetzungen auflösen
- [Veröffentlichen](./publishing.md) — Inhalt eines veröffentlichten Moduls
- [Die Designschicht](../frontend/design-layer.md) — Warum ein gemeinsames Frontend-Vokabular überhaupt als Paket ausgeliefert wird
