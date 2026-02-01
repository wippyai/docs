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

Siehe [Dateisystem-Modul](lua-fs.md) für Dateioperationen.
