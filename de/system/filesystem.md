---
title: "Dateisystem"
description: "Konfigurieren Sie verzeichnisbasierte und schreibgeschützte eingebettete Dateisysteme."
---

# Dateisystem

Dateisystem-Einträge stellen Laufzeitmodulen verzeichnisbasierten oder schreibgeschützten eingebetteten Speicher bereit. Diese Seite ist eine Konfigurationsreferenz; ihre YAML-Blöcke sind einzelne Entry-Fragmente und keine vollständigen Projekte.

## Entry-Typen

| Art | Beschreibung |
|------|--------------|
| `fs.directory` | Verzeichnisbasiertes Dateisystem |
| `fs.embed` | Schreibgeschütztes eingebettetes Dateisystem |

## Verzeichnis-Dateisystem

```yaml
- name: uploads
  kind: fs.directory
  directory: "/var/data/uploads"
  auto_init: true
  mode: "0755"
```

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `directory` | string | erforderlich | Wurzelpfad |
| `auto_init` | bool | false | Verzeichnis erstellen wenn nicht vorhanden |
| `mode` | string | 0755 | Unix-Berechtigungsmodus (oktal) |
| `base` | string | abgeleitet | Basis für relative Pfade: `project` (Arbeitsverzeichnis des Prozesses) oder `module` (Ressourcenwurzel des besitzenden Moduls) |

Bei einem moduleigenen Eintrag wird ein relatives Verzeichnis ohne `base` von der Ressourcenwurzel des besitzenden Moduls aus aufgelöst. Vom Host definierte Einträge bleiben relativ zum Arbeitsverzeichnis des Prozesses. Setzen Sie `base: project`, um für einen Moduleintrag die Auflösung gegen das Arbeitsverzeichnis zu erzwingen, oder `base: module`, um die Auflösung gegen die Modulwurzel ausdrücklich anzufordern. Wenn die Modulzugehörigkeit oder ihre Ressourcenwurzel nicht verfügbar ist, lässt die Runtime den relativen Pfad unverändert.

Die konfigurierten Owner-Bits des Modus beschränken Operationen; angeforderte Berechtigungen für neu erstellte Dateien und Verzeichnisse werden mit diesem Modus maskiert. Wenn alle Lesebits vorhanden und keine Ausführungsbits gesetzt sind, ergänzt die Runtime die Ausführungsbits, sodass beispielsweise aus `0444` der Modus `0555` wird. Die Betriebssystemberechtigungen des zugrunde liegenden Verzeichnisses gelten weiterhin.

<note>
Pfade werden normalisiert und validiert. Es ist nicht möglich, auf Dateien außerhalb des konfigurierten Wurzelverzeichnisses zuzugreifen.
</note>

## Eingebettetes Dateisystem

```yaml
- name: static
  kind: fs.embed
```

Eingebettete Dateisysteme laden aus Pack-Ressourcen unter Verwendung der Entry-ID. Sie sind schreibgeschützt.

<warning>
Eingebettete Dateisysteme sind ein interner Mechanismus. Manuelle Konfiguration ist typischerweise nicht erforderlich.
</warning>

## Operationen

Beide Dateisystemtypen implementieren:

| Operation | Directory | Embed |
|-----------|-----------|-------|
| Open/Read | Ja | Ja |
| Stat | Ja | Ja |
| Lstat | Ja | Ja |
| ReadDir | Ja | Ja |
| OpenFile (write) | Ja | Nein |
| Remove | Ja | Nein |
| Mkdir | Ja | Nein |
| Rename | Ja | Nein |
| Truncate | Ja | Nein |
| Chtimes | Ja | Nein |

Schreiboperationen auf eingebetteten Dateisystemen geben einen Fehler zurück.

## Lua-API

Siehe [Dateisystem-Modul](../lua/storage/filesystem.md) für Dateioperationen.

## Siehe auch

- [Dateisystem-Modul](../lua/storage/filesystem.md) - Lua-API-Referenz
- [Cloud Storage](./cloudstorage.md) - S3-kompatibler Objektspeicher
- [Template](./template.md) - Aus Dateisystemen geladene Templates
