# Sprachserver

Wippy enthalt einen integrierten LSP-Server (Language Server Protocol), der IDE-Funktionen fur Lua-Code bereitstellt. Der Server lauft als Teil der Wippy-Laufzeitumgebung und verbindet sich uber TCP oder HTTP mit Editoren.

## Funktionen

- Code-Vervollstandigung mit typbewussten Vorschlagen
- Hover-Informationen mit Typen und Signaturen
- Zur Definition springen
- Referenzen finden
- Dokument- und Workspace-Symbole
- Aufrufhierarchie (eingehende und ausgehende Aufrufe)
- Echtzeit-Diagnosen (Parse-Fehler, Typfehler)
- Signaturhilfe fur Funktionsparameter

## Konfiguration

Aktivieren Sie den LSP-Server in `.wippy.yaml`:

```yaml
version: "1.0"

lua:
  type_system:
    enabled: true

lsp:
  enabled: true
  address: ":7777"
```

### Konfigurationsfelder

| Feld | Standard | Beschreibung |
|------|----------|--------------|
| `enabled` | false | TCP-Server aktivieren |
| `address` | :7777 | TCP-Adresse |
| `http_enabled` | false | HTTP-Transport aktivieren |
| `http_address` | :7778 | HTTP-Adresse |
| `http_path` | /lsp | HTTP-Endpunktpfad |
| `http_allow_origin` | * | Erlaubter CORS-Ursprung |
| `max_message_bytes` | 8388608 | Maximale eingehende Nachrichtengrosse (Bytes) |

### TCP-Transport

Der TCP-Server kommuniziert uber JSON-RPC 2.0 mit Standard-LSP-Nachrichtenrahmen (Content-Length-Header). Dies ist der primare Transport fur Editor-Integrationen.

### HTTP-Transport

Der HTTP-Transport akzeptiert POST-Anfragen mit JSON-RPC-Nutzdaten. Nutzlich fur browserbasierte Editoren und Web-Tools. CORS-Header sind fur Cross-Origin-Zugriff enthalten.

```yaml
lsp:
  enabled: true
  http_enabled: true
  http_address: ":7778"
  http_path: "/lsp"
  http_allow_origin: "*"
```

## Dokument-URI-Schema

Der LSP-Server verwendet das `wippy://`-URI-Schema zur Identifizierung von Registry-Eintragen:

```
wippy://namespace:entry_name
```

Editoren ordnen diese URIs den Eintrags-IDs in der Registry zu. Sowohl das `wippy://`-Schema als auch das reine `namespace:entry_name`-Format werden akzeptiert.

## Indizierung

Der LSP-Server pflegt einen Index aller Code-Eintrage fur schnelle Abfragen. Die Indizierung erfolgt im Hintergrund mit mehreren Workern.

Wichtige Verhaltensweisen:

- Eintrage werden in Abhangigkeitsreihenfolge indiziert (Abhangigkeiten zuerst)
- Anderungen losen eine Neuindizierung betroffener Eintrage aus
- Nicht gespeicherte Editor-Anderungen werden in einem Overlay gespeichert
- Der Index ist inkrementell - nur geanderte Eintrage werden neu verarbeitet

## Unterstutzte LSP-Methoden

| Methode | Beschreibung |
|---------|--------------|
| `initialize` | Fahigkeitsaushandlung |
| `textDocument/didOpen` | Geoffnete Dokumente verfolgen |
| `textDocument/didChange` | Vollstandige Dokumentsynchronisation |
| `textDocument/didClose` | Dokumente freigeben |
| `textDocument/hover` | Typinformation an der Cursorposition |
| `textDocument/definition` | Zur Definition springen |
| `textDocument/references` | Alle Referenzen finden |
| `textDocument/completion` | Code-Vervollstandigung |
| `textDocument/signatureHelp` | Funktionssignaturen |
| `textDocument/diagnostic` | Datei-Diagnosen |
| `textDocument/documentSymbol` | Datei-Symbole |
| `workspace/symbol` | Globale Symbolsuche |
| `textDocument/prepareCallHierarchy` | Aufrufhierarchie |
| `callHierarchy/incomingCalls` | Aufrufer finden |
| `callHierarchy/outgoingCalls` | Aufgerufene finden |

## Vervollstandigung

Die Vervollstandigungs-Engine lost Typen uber den Code-Graphen auf. Sie bietet:

- Mitgliedervervollstandigung nach `.` und `:` (Felder, Methoden)
- Lokale Variablenvervollstandigung
- Vervollstandigung von Symbolen auf Modulebene
- Ausloser-Zeichen: `.`, `:`

## Diagnosen

Diagnosen werden wahrend der Indizierung berechnet und umfassen:

- Parse-Fehler (Syntaxprobleme)
- Typprufungsfehler (Konflikte, undefinierte Symbole)
- Schweregrade: error, warning, information, hint

Diagnosen aktualisieren sich wahrend der Eingabe uber das Dokument-Overlay-System.

## Siehe auch

- [Linter](guides/linter.md) - CLI-basierte Code-Prufung
- [Typen](lua/types.md) - Typsystem-Dokumentation
- [Konfiguration](guides/configuration.md) - Laufzeitkonfiguration
