---
title: "Dateisystem"
description: "Verzeichnis- und eingebetteter Dateisystemzugriff."
---

# Dateisystem

Verzeichnis- und eingebetteter Dateisystemzugriff.

## Entry-Typen

| Kind | Beschreibung |
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
| `base` | string | - | Basis für relative Pfade: `project` (Arbeitsverzeichnis des Prozesses) oder `module` (Lade-Wurzel des besitzenden Moduls) |

Absolute Pfade werden unverändert verwendet, unabhängig von `base`.

Bei einem relativen Pfad hält `base: project` ihn relativ zum Arbeitsverzeichnis des Prozesses. Sowohl `base: module` als auch ein nicht gesetztes `base` lösen ihn gegen die Lade-Wurzel des Moduls auf, dem der Eintrag gehört, ermittelt über den Registry-Owner des Eintrags. Hat der Eintrag kein besitzendes Modul oder dieses Modul keine auflösbare Ressourcen-Wurzel, bleibt der Pfad relativ zum Arbeitsverzeichnis des Prozesses.

Jeder andere Wert wird mit `invalid directory base` abgelehnt.

Der Modus beschränkt alle Dateioperationen. Ausführungsbits werden automatisch hinzugefügt wenn Lesebits vorhanden sind.

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
| ReadDir | Ja | Ja |
| OpenFile (write) | Ja | Nein |
| Remove | Ja | Nein |
| Mkdir | Ja | Nein |

Schreiboperationen auf eingebetteten Dateisystemen geben einen Fehler zurück.

## Lua-API

Siehe [Dateisystem-Modul](lua/storage/filesystem.md) für Dateioperationen.

## Siehe auch

- [Dateisystem-Modul](lua/storage/filesystem.md) - Lua-API-Referenz
- [Cloud Storage](system/cloudstorage.md) - S3-kompatibler Objektspeicher
- [Template](system/template.md) - Aus Dateisystemen geladene Templates
