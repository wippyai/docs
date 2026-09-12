---
title: "Language Server"
description: "Konfigurieren Sie Wippys integrierten Language-Server-Protocol-Server für Lua-Editorfunktionen über TCP oder HTTP."
---

# Language Server

Wippy enthält einen Language-Server-Protocol-Server (LSP) für Lua-Editorfunktionen. Er läuft als Teil der Wippy-Runtime und nimmt Editorverbindungen über TCP oder HTTP an.

## Funktionen

- Codevervollständigung mit typbewussten Vorschlägen
- Hover-Informationen mit Typen und Signaturen
- Zur Definition springen
- Referenzen finden
- Dokument- und Workspace-Symbole
- Aufrufhierarchie (eingehende und ausgehende Aufrufe)
- Pull-Diagnosen für Typfehler im aktuellen Editor-Overlay nach erfolgreichem Parsing
- Signaturhilfe für Funktionsparameter

## Konfiguration

Aktivieren Sie den LSP-Server in `.wippy.yaml`:

```yaml
lsp:
  enabled: true
  address: ":7777"
```

### Konfigurationsfelder

| Feld | Standard | Beschreibung |
|------|----------|--------------|
| `enabled` | false | LSP-Service und TCP-Server aktivieren |
| `address` | :7777 | TCP-Adresse |
| `http_enabled` | false | HTTP-Transport aktivieren |
| `http_address` | :7778 | HTTP-Adresse |
| `http_path` | /lsp | HTTP-Endpunktpfad |
| `http_allow_origin` | * | Erlaubter CORS-Ursprung |
| `max_message_bytes` | 8388608 | Maximale eingehende Nachrichtengröße (Bytes) |

### TCP-Transport

Der TCP-Server kommuniziert über JSON-RPC 2.0 mit Standard-LSP-Nachrichtenrahmen (Content-Length-Header). Dies ist der primäre Transport für Editor-Integrationen.

### HTTP-Transport

Der HTTP-Transport akzeptiert POST-Anfragen mit JSON-RPC-Payloads. Er unterstützt browserbasierte Editoren und Web-Tools, beantwortet CORS-Preflight-Anfragen mit `OPTIONS` und liefert CORS-Header für Cross-Origin-Zugriff.

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

Der LSP-Server verwaltet einen Index der Code-Einträge. Mehrere Worker aktualisieren ihn im Hintergrund.

Wichtige Verhaltensweisen:

- Einträge werden in Abhängigkeitsreihenfolge indiziert (Abhängigkeiten zuerst)
- Änderungen lösen eine Neuindizierung betroffener Einträge aus
- Nicht gespeicherte Editor-Änderungen werden in einem Overlay gespeichert
- Die Indizierung ist inkrementell; nur geänderte Einträge werden erneut verarbeitet

## Unterstutzte LSP-Methoden

| Methode | Beschreibung |
|---------|--------------|
| `initialize` | Fahigkeitsaushandlung |
| `initialized` | Benachrichtigung über den Abschluss der Initialisierung |
| `shutdown` | Protokollsitzung herunterfahren |
| `exit` | Exit-Benachrichtigung |
| `textDocument/didOpen` | Geoffnete Dokumente verfolgen |
| `textDocument/didChange` | Vollstandige Dokumentsynchronisation |
| `textDocument/didClose` | Dokumente freigeben |
| `textDocument/hover` | Typinformation an der Cursorposition |
| `textDocument/definition` | Zur Definition springen |
| `textDocument/references` | Alle Referenzen finden |
| `textDocument/completion` | Code-Vervollständigung |
| `textDocument/signatureHelp` | Funktionssignaturen |
| `textDocument/diagnostic` | Datei-Diagnosen |
| `textDocument/documentSymbol` | Datei-Symbole |
| `workspace/symbol` | Globale Symbolsuche |
| `textDocument/prepareCallHierarchy` | Aufrufhierarchie |
| `callHierarchy/incomingCalls` | Aufrufer finden |
| `callHierarchy/outgoingCalls` | Aufgerufene finden |

## Vervollständigung

Die Vervollständigungs-Engine löst Typen über den Code-Graphen auf. Sie bietet:

- Mitgliedervervollständigung nach `.` und `:` (Felder, Methoden)
- Lokale Variablenvervollständigung
- Vervollständigung von Symbolen auf Modulebene
- Ausloser-Zeichen: `.`, `:`

## Diagnosen

Nach erfolgreichem Parsing speichert die Indizierung Typprüfungsdiagnosen wie Konflikte und undefinierte Symbole. Diagnosen verwenden die Standard-Schweregrade error, warning, information und hint.

Benachrichtigungen über vollständige Dokumentänderungen aktualisieren das für Diagnosen verwendete Overlay. Clients rufen das aktuell gespeicherte Ergebnis mit `textDocument/diagnostic` ab; dieser Server sendet keine `textDocument/publishDiagnostics`-Benachrichtigungen. Ein Parsingfehler bricht die Neuindizierung ab, bevor neue Diagnosen gespeichert werden. Das Pull-Ergebnis meldet diesen Syntaxfehler daher nicht und kann das vorherige erfolgreiche Ergebnis behalten.

## Siehe auch

- [Linter](guides/linter.md) — Codeprüfung über die CLI
- [Typen](lua/types.md) — Dokumentation des Typsystems
- [Konfiguration](guides/configuration.md) — Runtime-Konfiguration
