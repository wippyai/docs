---
title: "Nicht unterstützte projektgebundene Module"
description: "Warnung für Fortgeschrittene zu Modulen, die die Portabilität des Wippy-Frontends absichtlich aufgeben."
---

# Nicht unterstützte projektgebundene Module

Der unterstützte Frontend-Vertrag von Wippy ist portabel. Ein Modul, das absichtlich projektprivates Facade-CSS, private Klassen oder eine andere deploymentspezifische Frontend-Annahme voraussetzt, ist `UNSUPPORTED`.

Das ist keine normale Ausnahme:

- Die Standard-Compliance liefert exakt `UNSUPPORTED`.
- Die Standard-CI schlägt fehl.
- Wiederverwendung, Theme-Portabilität, Upgrades und Support sind nicht garantiert.
- Der Moduleigentümer verantwortet jede konsumierende Facade und jede Migration.

Bezeichnen Sie diesen Modus nicht als „unerwünscht“, „teilweise konform“ oder „nicht konform, aber akzeptiert“. Der kanonische Status ist `UNSUPPORTED`.

Der projektgebundene Modus ist ausschließlich für Fortgeschrittene und wird weder im Quickstart noch in Standardrezepten gezeigt. Er kann Anforderungen an Barrierefreiheit, HTML-Gültigkeit, Sicherheit oder Backend-Schemata nicht erlassen.

Dass ein gesamtes Projekt für ein einziges Deployment gedacht ist, lockert den Vertrag nicht stillschweigend. Der nicht unterstützte Status muss in der Projektrichtlinie und in den Modul-Metadaten explizit sein, wobei das Fehlschlagen der Standard-CI bewusst außerhalb des unterstützten Compliance-Workflows von Wippy behandelt wird.

Deklarieren Sie den Status in `wippy-fe.contract.json` im Modul-Root mit exakt
dem folgenden Feld und Wert:

```json
{
  "portability": "project-bound"
}
```

`mode` und andere Aliasse werden nicht akzeptiert. Dieser Marker bewirkt, dass
das Standard-Compliance-Kommando `UNSUPPORTED` liefert und erfolglos beendet
wird; er gewährt keine Ausnahmegenehmigung.
