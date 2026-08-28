---
title: "Nicht unterstützte projektgebundene Module"
description: "Hinweis für fortgeschrittene Module, die Wippys Frontend-Portabilität absichtlich aufgeben."
---

# Nicht unterstützte projektgebundene Module

**Klassifizierung: normative Richtlinienreferenz.** Sie definiert Marker und
Pflichtergebnis eines projektgewählten Compliance-Ablaufs. Die öffentliche
Paketfamilie stellt diesen Ablauf nicht als ausführbare CLI bereit.

Wippys unterstützter Frontendvertrag ist portabel. Ein Modul, das absichtlich
privates Facade-CSS, private Klassen oder eine andere deploymentspezifische
Frontendannahme benötigt, ist `UNSUPPORTED`.

Dies ist keine normale Ausnahme. Der projektseitige Compliance-Ablauf muss
folgende Ergebnisse durchsetzen:

- Standard-Compliance gibt exakt `UNSUPPORTED` zurück.
- Standard-CI schlägt fehl.
- Wiederverwendung, Theme-Portabilität, Upgrades und Support sind nicht garantiert.
- Der Moduleigentümer trägt die Verantwortung für jede verwendende Facade und Migration.

Nennen Sie diesen Modus nicht „abgeraten“, „teilweise compliant“ oder
„nicht compliant, aber akzeptiert“. Der kanonische Status lautet `UNSUPPORTED`.

Der projektgebundene Modus ist nur für Fortgeschrittene und erscheint weder im
Schnellstart noch in Standardrezepten. Er kann Barrierefreiheit, HTML-Gültigkeit,
Sicherheit oder Backend-Schemaanforderungen nicht außer Kraft setzen.

Auch ein nur für ein Deployment bestimmtes Gesamtprojekt lockert den Vertrag
nicht stillschweigend. Projektpolicy und Modulmetadaten müssen den Status
ausdrücklich nennen; das Standard-CI-Fehlschlagen wird bewusst außerhalb von
Wippys unterstütztem Compliance-Ablauf behandelt.

Deklarieren Sie den Status in `wippy-fe.contract.json` im Modul-Root mit exakt diesem Feld und Wert:

```json
{
  "portability": "project-bound"
}
```

`mode` und andere Aliasse sind ungültig. Der Compliance-Ablauf muss für den
Marker `UNSUPPORTED` zurückgeben und erfolglos enden; er gewährt keine Ausnahme.
Die öffentliche Paketfamilie `@wippy-fe/*` 0.0.56 enthält keine Anwendungs-
Compliance-CLI. Das Projekt muss dieses Gate im gewählten Ablauf selbst umsetzen.
