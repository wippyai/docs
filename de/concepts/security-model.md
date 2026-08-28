---
title: "Sicherheitsmodell: Prozessisolation und Richtlinienprüfungen"
description: "Wie Wippy Lua- und WASM-Ausführungsumgebungen begrenzt und geschützte Laufzeitoperationen mit Akteuren, Geltungsbereichen und Richtlinien autorisiert."
---

# Sicherheitsmodell

Wippy verbindet Ausführungsisolation mit attributbasierter Zugriffskontrolle (ABAC). Die Isolation bestimmt, welche Module und Hostressourcen Code erreichen kann. ABAC bestimmt, ob eine geschützte Operation im aktuellen Akteur- und Richtliniengeltungsbereich erlaubt ist. Beide Grenzen sind wichtig: Der Import eines Moduls erteilt keine Berechtigungen, und eine Richtlinie kann ein nicht deklariertes Modul nicht für Lua-Code verfügbar machen.

## Autorisierungsregeln

Ein Sicherheitskontext kann einen **Akteur** und einen **Geltungsbereich** enthalten. Der Akteur identifiziert den Principal und kann Metadaten enthalten. Der Geltungsbereich ist eine unveränderliche Menge von Richtlinien. Eine Richtlinie gleicht Aktion und Ressource ab, kann Akteur- oder Ressourcenmetadaten prüfen und gibt `allow`, `deny` oder `undefined` zurück.

Wenn sowohl Akteur als auch Geltungsbereich vorhanden sind:

1. Jedes passende Deny hat Vorrang.
2. Mindestens ein Allow und kein Deny erlaubt die Operation.
3. Keine passende Richtlinie ergibt `undefined`, das geschützte Laufzeitoperationen als verweigert behandeln.

`security.strict_mode` gilt nur für einen unvollständigen Kontext, in dem Akteur oder Geltungsbereich fehlt. Runtime v0.3.32a startet mit aktiviertem Strict Mode. Deaktivieren Sie ihn nur, wenn Legacy- oder Übergangscode für einen unvollständigen Kontext weiterhin permissiv behandelt werden muss:

```yaml
# .wippy.yaml
security:
  strict_mode: false
```

| Kontext | `strict_mode: false` | `strict_mode: true` |
|---------|----------------------|---------------------|
| Akteur und Geltungsbereich vorhanden | Richtlinien auswerten; nur `allow` erlaubt den Zugriff | Gleich |
| Akteur oder Geltungsbereich fehlt | Geschützte Operation erlauben | Geschützte Operation verweigern |

Lassen Sie den Strict Mode in Deployments aktiviert, die geschlossen fehlschlagen müssen, und stellen Sie sicher, dass Dienste mit dem für ihre Arbeit erforderlichen Akteur und Geltungsbereich starten. Das Deaktivieren des Strict Mode wandelt das Ergebnis `undefined` eines vollständigen Geltungsbereichs nicht in ein Allow um.

Die [Sicherheitsreferenz](../system/security.md) beschreibt Richtliniensyntax, Akteure, Geltungsbereiche und Token-Speicher.

## Lua-Isolation

Jeder Lua-Akteurprozess besitzt einen Lua-State; Funktionseinträge werden über Pools isolierter States ausgeführt. Die Laufzeit öffnet statt der vollständigen Hostumgebung eine eingeschränkte Basisumgebung:

- Die Umgebungsbibliotheken sind die eingeschränkten Bibliotheken `table`, `math`, `os`, `coroutine`, `string` und `errors` sowie Kernglobals wie `channel`, `payload` und `print`.
- `package.path` und `package.cpath` sind leer, und `package.loadlib` ist deaktiviert.
- Registry-basierte Module und Bibliotheken sind nur für Chunks sichtbar, die sie über `modules:` oder `imports:` deklarieren.
- `require()` löst diese begrenzte Menge auf und schlägt bei einem nicht deklarierten Registry-Modul fehl.

Lua-Code besitzt daher keine direkte API für Hostdateisystem, Sockets, native Prozesse oder Umgebungsvariablen. Er erreicht diese Funktionen nur über Laufzeitmodule wie `fs`, `http_client`, `exec` und `env`; deren geschützte Operationen führen weiterhin Richtlinienprüfungen aus.

Eine importierte Bibliothek gibt ihre Importe nicht an ihren Aufrufer weiter. Jede Bibliothek und jeder Einstiegspunkt erhält eine eigene begrenzte Umgebung. Eine intern von einer Bibliothek verwendete Fähigkeit steht einer importierenden Funktion daher nicht automatisch zur Verfügung.

## WASM-Isolation

WASM-Code läuft über konfigurierte Hostimporte und WASI-Einstellungen. Umgebungswerte und Dateisystem-Mounts müssen am WASM-Eintrag deklariert werden. Vor der Instanziierung prüft die Laufzeit `env.get` für jeden konfigurierten Umgebungseintrag und `fs.get` für jeden konfigurierten Mount. Dateisystem-Mounts werden auf das konfigurierte Dateisystem umgewurzelt, statt das Host-Root offenzulegen.

WASM-Hostfunktionen für Sockets und ausgehendes HTTP führen außerdem operationsspezifische Prüfungen wie `socket.connect`, `socket.listen`, `socket.resolve` und `http_client.request` aus.

## Erwerb und Verwendung von Fähigkeiten

Viele Laufzeitressourcen sind Registry-Einträge. Module beziehen diese Ressourcen über die Eintrags-ID und prüfen eine entsprechende Aktion. Beispiele in v0.3.32a:

| Operation | Prüfung | Ressource |
|-----------|---------|-----------|
| Registry-Eintrag lesen | `registry.get` | Eintrags-ID |
| Funktion aufrufen | `funcs.call` | Funktions-ID |
| SQL-Datenbankhandle beziehen | `db.get` | ID des Datenbankeintrags |
| Dateisystem beziehen | `fs.get` | Dateisystem-ID |
| Umgebungswert lesen | `env.get` | Variablenname oder -ID |
| Prozess starten | `process.spawn` | ID des Prozesseintrags |
| Prozesshost auswählen | `process.host` | ID des Hosteintrags |

Diese Prüfungen erfolgen nicht alle mit derselben Granularität. `db.get` autorisiert beispielsweise den Erwerb eines Datenbankhandles; einzelne SQL-Abfragen über dieses Handle wiederholen `db.get` nicht. Ebenso autorisiert `fs.get` den Erwerb eines Dateisystemhandles, statt für jede Dateioperation eine ABAC-Entscheidung anzuwenden. Geben Sie ein erworbenes Handle nicht an einen weniger vertrauenswürdigen Kontext weiter, sofern dieser die Autorität des Handles nicht behalten soll.

Netzwerkmodule führen, wo dokumentiert, zusätzliche Prüfungen für jede Anfrage, Verbindung oder jeden Listener aus. Die Modulreferenz nennt die genaue Aktion und Ressource einer Operation.

## Kontextvererbung

Akteur und Geltungsbereich sind vererbbare Werte des Frame-Kontexts. Funktionsaufrufe und gestartete Prozesse erben sie, sofern der Aufrufer keinen Ersatzkontext erstellt. Das explizite Setzen eines Akteurs oder Geltungsbereichs für einen gestarteten Prozess erfordert zusätzlich zu den jeweiligen Startberechtigungen die Berechtigung `process.security`.

Diese Vererbung hält die Autorisierung an eine Aufrufkette gebunden. Ein privilegierter Elternprozess muss den Kontext von Arbeit, die er an weniger vertrauenswürdigen Code delegiert, jedoch bewusst einschränken.

## Registry-Mutation

Das Lesen von Einträgen und das Ändern der Registry sind unterschiedliche Berechtigungen. Normale dauerhafte Changesets erfordern `registry.apply`; in v0.3.32a verwendet diese Prüfung eine leere Ressource und ist keine Schreibentscheidung pro Eintrag oder Namespace. Erteilen Sie einem nicht vertrauenswürdigen Agenten nicht `registry.apply` in der Annahme, ein Namespace-Muster würde seine Schreibzugriffe begrenzen.

Prozesslokale Overlays besitzen eine kleinere Berechtigungsoberfläche. Sie prüfen den Overlay-Eigentümer sowie operationsspezifische Aktionen wie `registry.overlay.create.<kind>`, `registry.overlay.update.<kind>` und `registry.overlay.delete.<kind>` gegen die betroffene Eintrags-ID. Siehe [Eintrags-Registry](../lua/core/registry.md).

## Datengrenzen

Verwenden Sie unterschiedliche Registry-IDs für mandantenspezifische Datenbanken, Dateisysteme, Funktionen und Umgebungsvariablen. Schreiben Sie anschließend Richtlinien, die nur die vorgesehenen IDs erlauben. So kann ein Kontext keine geschützte Ressource eines anderen Mandanten beziehen, wenn alle Zugriffspfade die geprüften Laufzeitmodule verwenden.

Umgebungsreferenzen halten Anbieterzugangsdaten aus Quellmanifesten heraus. Ein Anbieter kann eine konfigurierte `env.variable` intern auflösen; dadurch ist der Wert für Anwendungscode jedoch nicht grundsätzlich unlesbar: Code, der `env` importiert und `env.get` für dieselbe Variable verwenden darf, kann ihn lesen. Schützen Sie Secrets sowohl durch Modulbegrenzung als auch durch Richtlinien.

Der Strict Mode ist für mandantenfähige Deployments wichtig, weil er verhindert, dass Arbeit mit fehlendem Akteur oder Geltungsbereich die Richtlinienauswertung umgeht. Er leitet keine Mandantenidentität ab und erzeugt keine Mandantenrichtlinien; die Anwendung muss Akteur, Geltungsbereich, Ressourcen und Richtlinienabdeckung korrekt festlegen.

## Grenzen von Agenten und Tools

Framework-Agenten kompilieren die in ihren Definitionen und Traits ausgewählten Tools. Toolschemas begrenzen und validieren die an diese Tools übergebenen Argumente. Registry-basierte Toolimplementierungen laufen über den `funcs`-Aufrufpfad; deshalb wird `funcs.call` gegen die ID der Zielfunktion geprüft.

Toolliste und Richtliniengeltungsbereich ergänzen einander:

- Wird ein Tool weggelassen, kann das Modell es nicht über die normale Agent-Tool-Schnittstelle auswählen.
- Wird `funcs.call` verweigert, ist die Ausführung auch dann verhindert, wenn das Tool in der kompilierten Liste vorhanden ist.
- Das Erteilen von `funcs.call` fügt kein nicht deklariertes Tool zur Liste des Modells hinzu.

Behandeln Sie Toolwrapper und externe Integrationen als zusätzlichen Anwendungscode. Sie ersetzen die Laufzeitprüfungen nicht; ihre eigenen Netzwerkzugangsdaten und Autorisierungsregeln müssen ebenfalls geprüft werden.

## Verantwortlichkeiten beim Deployment

Wippys Ausführungs- und Richtliniengrenzen ersetzen keine Infrastrukturkontrollen:

- Speicherverschlüsselung und Sicherungsrichtlinien gehören zur konfigurierten Datenbank, Festplatte oder zum Objektspeicher.
- VPCs, Firewalls und Dienstrichtlinien steuern die Erreichbarkeit auf Netzwerkebene.
- Authentifizierung stellt die Benutzer- oder Dienstidentität her, bevor Wippys Autorisierung greift.
- Hostadministration, SSH-Zugriff und Datenbankadministratoraktionen benötigen Audit-Logging auf Infrastrukturebene.
- CPU- und Speicherquoten pro Mandant erfordern Kontrollen auf Deployment-Ebene.

OpenTelemetry kann konfigurierte Laufzeit- und Frameworkoperationen nachverfolgen, doch die Abdeckung hängt von der aktivierten Instrumentierung ab. Siehe [Observability](../guides/observability.md).

## Review-Checkliste

- Lassen Sie `security.strict_mode` aktiviert, wenn unvollständige Kontexte geschlossen fehlschlagen müssen.
- Geben Sie jedem Dienst einen bewusst gewählten Akteur und Geltungsbereich.
- Prüfen Sie sowohl deklarierte Lua-Module/-Importe als auch die Richtlinien für deren geschützte Operationen.
- Halten Sie `registry.apply` von nicht vertrauenswürdigem Code fern, sofern keine vollständige Mutation der dauerhaften Registry beabsichtigt ist.
- Teilen Sie erworbene Datenbank- oder Dateisystemhandles nicht über Vertrauensgrenzen hinweg.
- Trennen Sie Mandantenressourcen nach Registry-ID und testen Sie die Verweigerung außerhalb jedes Mandantengeltungsbereichs.
- Schützen Sie Umgebungssecrets sowohl durch Modulbegrenzung als auch durch `env.get`-Richtlinien.
- Prüfen Sie Tracing und Infrastrukturkontrollen unabhängig von der Laufzeitautorisierung.

## Siehe auch

- [Sicherheitsreferenz](../system/security.md) — Richtlinien, Geltungsbereiche, Akteure, Strict Mode und Token-Speicher
- [Eintrags-Registry](../lua/core/registry.md) — Lesen und Ändern der Registry sowie Overlay-Berechtigungen
- [Prozessverwaltung](../lua/core/process.md) — Berechtigungen für Start, Kontext und Prozesssicherheit
- [Prozessmodell](./process-model.md) — Prozessisolation und Lifecycle
- [Agenten](../framework/agents.md) — Agentdefinitionen und Toolauswahl
