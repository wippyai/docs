---
title: Sicherheitsmodell - Prozessisolation, Capability-Kontrolle und Datengrenzen
description: Wie Wippy steuert, worauf Ihr Code zugreifen kann, worauf nicht und wer diese Grenzen durchsetzt. Behandelt Prozessisolation, registry-basierte Capability-Kontrolle, mandantenfähige Durchsetzung und Agentensicherheit.
---

# Sicherheitsmodell

Wippys Sicherheitsmodell definiert, worauf Ihr Code zugreifen kann, worauf nicht und wer diese Grenzen durchsetzt. Es lohnt sich, es vor dem Bauen zu lesen, denn es arbeitet auf zwei Ebenen, die die meisten Frameworks zu einer zusammenfallen lassen: Die Laufzeit isoliert jeden Prozess, sodass gefährliche Capabilities schlicht nicht vorhanden sind, und eine attributbasierte Richtlinienschicht regelt, welche Registry-Capabilities ein Prozess verwenden darf. Beides zu verstehen ändert, wie Sie eine Anwendung strukturieren.

## Vertrauensmodell

Wippys Isolationsschicht gibt einem Prozess keine Umgebungsautorität. Ein frischer Lua- oder WASM-Prozess kann weder das Dateisystem noch das Netzwerk, das Host-Betriebssystem oder den Speicher anderer Prozesse berühren, weil diese Capabilities in seiner Umgebung nicht vorhanden sind. Capabilities kommen ausschließlich über die Registry: Funktionen, Tools, Verbindungen und Konfiguration, die dem Prozess ausdrücklich gewährt werden.

Darüber hinaus wird der Zugriff auf Registry-Capabilities durch attributbasierte Zugriffskontrolle (ABAC) geregelt. Jede geschützte Operation wird gegen den Sicherheits-Scope des aktuellen Actors geprüft — eine Menge von Richtlinien, die eine Aktion auf einer Ressource erlauben oder verweigern, optional bedingt durch Metadaten von Actor und Ressource. Das ist deklarativ: Sie definieren Richtlinien in der Konfiguration, nicht im Anwendungscode.

Wenn ein Prozess mit Actor und Scope läuft, gilt Zugriff standardmäßig als verweigert: Eine Anfrage wird nur erlaubt, wenn eine Richtlinie sie ausdrücklich zulässt und keine sie verweigert. Der **Strict Mode** regelt den unvollständigen Fall, in dem weder Actor noch Scope etabliert sind. Er ist **standardmäßig aktiv**, sodass ein unvollständiger Kontext verweigert wird; mit `security.strict_mode: false` in der Laufzeitkonfiguration wählen Sie stattdessen das permissive Verhalten. Die Konsequenz, die Sie einplanen müssen: Ein Prozess ohne deklarierten Sicherheitskontext scheitert unter dem Standard an jeder Prüfung — geben Sie einem solchen Prozess einen `security:`-Block in seinem Eintrag oder starten Sie ihn über einen Pfad, der einen liefert. Kombiniert mit Least-Privilege-Richtlinien erhalten Sie so Fail-Closed-Autorisierung auf einer Isolation, die auf Abwesenheit beruht. Siehe die [Sicherheitsreferenz](system/security.md) für Richtliniensyntax, Evaluierungsregeln und die Form des `security:`-Blocks.

## Prozessisolation

Jede Ausführungseinheit in Wippy läuft in einem isolierten Prozess mit eigenem eingebettetem Interpreter (Lua oder WASM).

**Was ein Prozess hat:** seinen eigenen Speicherbereich (ein Grund-Overhead von ~13 KB bei Lua). Eine begrenzte Sicht auf die Registry. Eine Actor-Identität und einen Sicherheits-Scope. Einen überwachten Lebenszyklus mit Absturz-Wiederherstellung und Neustart-Limits.

**Was ein Prozess nicht hat:** Zugriff auf das Dateisystem (außer über registry-kontrollierte Filesystem-Einträge). Zugriff auf das Netzwerk (außer über gewährte HTTP-Client- oder Tool-Module). Zugriff auf den Speicher anderer Prozesse. Zugriff auf die Go-Laufzeit, die ihn hostet. Zugriff auf Umgebungsvariablen (außer über gewährte Environment-Einträge).

**Wie Isolation durchgesetzt wird:** Jeder Lua-Prozess startet mit einer minimalen Standardbibliothek. Datei-I/O, Zugriff auf OS-Prozesse, dynamisches Laden von Code und Netzwerkfunktionen werden nie geladen, sind also in der Umgebung nicht vorhanden, und der Prozess kann nicht wiederherstellen, was nicht existiert. Das Laden von Modulen ist eingeschränkt: `require` löst nur die Module und Registry-Einträge auf, die dem Prozess ausdrücklich gewährt wurden, ohne Suchpfad im Dateisystem. WASM-Prozesse erreichen gleichwertige Isolation über WASI: Erreichbar sind nur die Host-Funktionen und eingehängten Filesystem-Einträge, die für diesen Eintrag konfiguriert sind.

Das ist kein Sandboxing über Laufzeitberechtigungen (wie seccomp oder AppArmor). Es ist Sandboxing durch Abwesenheit. Gefährliche Capabilities werden nie geladen, können also nicht ausgenutzt, umgangen oder eskaliert werden.

## Capability-Kontrolle

Die Registry ist Wippys Capability-Speicher, und Sicherheitsrichtlinien sind ihre Autorisierungsschicht.

**Jede Capability ist ein Registry-Eintrag.** Funktionen, Tools, Agentendefinitionen, Datenbankverbindungen, Environment-Referenzen, Konfigurationswerte und geplante Aufgaben sind alle Registry-Einträge mit einem deklarierten Kind, Schema und Metadaten. Einträge werden bei der Registrierung von ihrem Kind-Handler validiert.

**Entry-IDs sind namespaced.** Eine ID hat die Form `namespace:name` mit einem einzelnen Doppelpunkt, und Namespaces sind über punktgetrennte Segmente hierarchisch, zum Beispiel `tenant_acme.tools:read` (Namespace `tenant_acme.tools`, Name `read`). Richtlinien matchen Aktionen und Ressourcen, und Ressourcenmuster können ein Namespace-Präfix adressieren, sodass eine einzige Regel einen ganzen Namespace abdecken kann.

**Richtlinien entscheiden über Zugriff.** Jeder Capability-Zugriff (ein Registry-Lookup, ein Funktionsaufruf, ein Datenbank-Handle, ein Öffnen einer Datei) wird gegen den Scope des Actors geprüft. Eine Richtlinie deklariert die Aktionen und Ressourcen, die sie abdeckt, einen Allow- oder Deny-Effekt und optionale Bedingungen auf Metadaten von Actor und Ressource. Die Evaluierung geschieht pro Zugriff, nicht einmalig beim Start: Verweigert irgendeine Richtlinie, wird der Zugriff verweigert; erlaubt mindestens eine und verweigert keine, wird er erlaubt; matcht keine Richtlinie, wird der Zugriff verweigert. (Hat der Kontext überhaupt keinen Actor und keinen Scope, entscheidet über diesen unvollständigen Fall der Strict Mode statt der Richtlinienevaluierung.)

**Ein Kontext wird deklariert, nicht aus dem Nichts geerbt.** Funktionen erben Actor und Scope des Aufrufers. Ein gespawnter Prozess nicht: Er bezieht seinen Kontext aus dem `security:`-Block seines eigenen Eintrags, der einen Actor benennt und Richtlinien und Richtliniengruppen über ihre Registry-IDs auflistet. Die Auflösung ist atomar — fehlt eine benannte Richtlinie oder Gruppe, scheitert der Spawn, statt mit einem unvollständigen Scope fortzufahren. Ein CLI-Kommando kann zusätzlich `meta.command.security` deklarieren, das nur auf dem vertrauenswürdigen Startpfad angewendet wird, auf dem der Operator das Kommando selbst gestartet hat.

**Tool-Argumente sind schemageformt.** Ein Tool deklariert ein JSON Schema für seine Eingaben. Dieses Schema wird dem Modell übergeben, damit es konforme Argumente generiert, und der Zugriff auf das Tool wird vor dem Aufruf gegen die Richtlinien geprüft.

## Datengrenzen

**Datenbankverbindungen sind Registry-Einträge.** Ein Prozess setzt seinen eigenen Verbindungsstring nicht zusammen. Er fordert eine Verbindung über eine Registry-ID an, und diese Anforderung wird richtliniengeprüft, bevor ein Handle zurückgegeben wird. Ein Prozess, dessen Richtlinien den Datenbankeintrag von Mandant B nicht gewähren, kann kein Handle darauf erhalten.

**LLM-API-Schlüssel leben im Environment-System.** Schlüssel für Claude, GPT und andere Anbieter werden aus dem Environment-System gelesen (zum Beispiel OS-Umgebungsvariablen, die über einen `env.storage.os`-Eintrag freigegeben und von `env.variable`-Einträgen referenziert werden, deren Lesezugriffe über die Aktion `env.get` richtliniengeprüft sind). Der Anbieter liest sie intern; sie werden nicht in Prozessargumenten übergeben oder an aufrufenden Code zurückgegeben.

**Datei- und Blob-Speicher folgen demselben Modell.** Ein Prozess liest oder schreibt über Filesystem- oder Cloud-Storage-Registry-Einträge, jeder Zugriff richtliniengeprüft. WASM-Prozesse greifen nur über Filesystem-Einträge auf Dateien zu, die für diesen Eintrag ausdrücklich eingehängt sind.

## Agentensicherheit

Agenten sind LLM-gestützte Prozesse mit Tool-Nutzung. Sie treffen zur Laufzeit Entscheidungen, die Ihr Code nicht direkt kontrolliert, deshalb sind ihre Grenzen wichtig. Wippy handhabt das über dieselben Registry- und Richtlinienmechanismen wie bei jedem anderen Prozess.

**Tool-Zugriff.** Ein Agent kann nur Tools aufrufen, die in seiner Definition aufgeführt sind, und jede Tool-Ausführung läuft über `funcs.call`, das richtliniengeprüft ist. Ein verweigerter Aufruf scheitert, bevor die Tool-Funktion läuft. Ein Agent, der Kundendaten lesen, aber nicht löschen soll, hat entweder kein Lösch-Tool in seiner Definition oder ihm wird diese Aktion per Richtlinie verweigert.

**Externe und MCP-Tools.** Wippy kann externe Tools konsumieren und eigene über das Model Context Protocol bereitstellen. Konsumierte Tools laufen über denselben Funktionsaufrufpfad und dieselben Richtlinienprüfungen wie native Tools. Tools, die Wippy externen MCP-Clients bereitstellt, sind durch begrenzte, widerrufbare Zugriffstoken abgesichert, die einschränken, welche Aktionen ein Client ausführen darf.

**Strukturierte Ausgabe.** Das LLM-Modul kann schemabeschränkte (strukturierte) Ausgabe über die native Structured-Output-Unterstützung des Anbieters anfordern, sodass die Ausgabe eines Agenten an eine deklarierte Form gebunden werden kann.

**Observability.** Bei aktiviertem OpenTelemetry werden LLM-Anbieteraufrufe und Tool-Aufrufe nachverfolgt, und der Token-Verbrauch wird über den Usage-Tracker-Contract erfasst. Das gibt Ihnen einen Prüfpfad darüber, was ein Agent aufgerufen und was er verbraucht hat. Siehe [Observability](guides/observability.md).

**Grenzen der Selbstmodifikation.** Einem Agenten, der Tools in einem Namespace erstellen darf, kann Schreibzugriff auf seine eigene Definition in einem anderen verweigert werden. Registry-Schreibzugriffe sind richtliniengeprüfte Aktionen, sodass eine Deny-Richtlinie auf dem eigenen Namespace des Agenten verhindert, dass er sich selbst bearbeitet oder sich neue Zugriffe gewährt.

## Mandantenfähige Durchsetzung

Für Deployments, in denen mehrere Kunden eine einzelne Wippy-Instanz teilen, wird Isolation durch Richtlinienevaluierung vor jeder Operation durchgesetzt, nicht durch Anwendungscode, der Mandanten-IDs prüft.

**Mandantenisolation ist richtliniengetrieben.** Geben Sie jedem Mandanten einen Actor und einen Scope, dessen Richtlinien nur die Namespaces dieses Mandanten abdecken. Bei aktivem Strict Mode wird dem Prozess eines Mandanten der Zugriff auf Ressourcen außerhalb seines Scopes verweigert, bevor sein Code läuft. Wirksame Isolation hängt davon ab, dass Sie diese mandantenbezogenen Richtlinien schreiben; die Laufzeit setzt sie durch, leitet die Mandantenzugehörigkeit aber nicht für Sie ab.

**Mandantenübergreifender Zugriff ist explizit.** Eine über Mandanten hinweg geteilte Capability lebt in einem gemeinsamen Namespace, den die Richtlinien jedes Mandanten erlauben. Teilen ist pro Namespace ein Opt-in.

**Nebenläufigkeit wird am Host begrenzt.** Process Hosts begrenzen Nebenläufigkeit über Worker-Pools. Prozessgruppen (`pg.scope`) bieten isolierte, clusterweite Mitgliedschafts- und Broadcast-Namespaces und können Gruppen- und Mitgliederzahlen deckeln. Obergrenzen für CPU oder Speicher pro Mandant sind kein eingebautes Laufzeitfeature; setzen Sie diese auf Infrastrukturebene durch.

Ein eigener Leitfaden zur mandantenfähigen Architektur ist geplant.

## Umfang und Grenzen

Wippys Sicherheitsmodell deckt Prozessisolation, Capability-Kontrolle und Datengrenzen ab. Das Folgende liegt außerhalb des Umfangs der Laufzeit und bleibt Aufgabe Ihrer Infrastruktur.

**Verschlüsselung ruhender Daten.** Verschlüsselung von Datenbank, Festplatte und Blob-Speicher wird von der zugrunde liegenden Infrastruktur übernommen (PostgreSQL TDE, Festplattenverschlüsselung und Ähnliches). Wippy geht davon aus, dass die Speicherschicht die Verschlüsselung übernimmt.

**Isolation auf Netzwerkebene.** Prozessisolation geschieht auf Anwendungsebene. Netzwerksegmentierung zwischen Wippy und seinen Abhängigkeiten (Datenbank, LLM-APIs, externe Dienste) wird von der Infrastruktur übernommen: VPCs, Security Groups, Firewalls.

**Identitätsverwaltung.** Authentifizierung (die Prüfung, wer ein Benutzer ist) wird von Ihrer Auth-Schicht übernommen. Wippys Sicherheitsmodell beginnt nach der Authentifizierung: Es steuert, was die Prozesse eines authentifizierten Benutzers tun dürfen, nicht wer der Benutzer ist. Token, die Actor und Scope tragen, können über einen Token Store ausgestellt und validiert werden.

**Infrastruktur-Audit-Logs.** Wippys Tracing deckt Operationen auf Prozessebene ab: Funktionsaufrufe, Tool-Aufrufe, Prozessaktivität. Zugriffe auf Infrastrukturebene (SSH auf den Server, Datenbank-Administrationsoperationen) sollten von Infrastruktur-Tools auditiert werden.

## Häufige Fragen

**Kann der Agent eines Mandanten auf die Daten eines anderen Mandanten zugreifen?**
Nicht, wenn die Ressourcen jedes Mandanten per Richtlinie begrenzt sind. Mit mandantenbezogenen Richtlinien und Strict Mode verweigert die Laufzeit den Zugriff auf Ressourcen außerhalb des Mandanten-Scopes, bevor der Code des Agenten läuft.

**Kann ein Agent seine eigenen Berechtigungen eskalieren?**
Nur wenn seine Richtlinien das Schreiben auf seine eigene Definition erlauben. Registry-Schreibzugriffe sind richtliniengeprüft, sodass eine Deny-Richtlinie auf dem eigenen Namespace des Agenten Selbstmodifikation verhindert. Ein Agent, der Tools in einem Namespace erstellen kann, kann sich keinen Zugriff auf Namespaces gewähren, die sein Scope nicht bereits abdeckt.

**Wie sehe ich, was ein Agent getan hat?**
Bei aktiviertem OpenTelemetry werden LLM- und Tool-Aufrufe nachverfolgt, und der Token-Verbrauch wird über den Usage-Tracker-Contract erfasst. Siehe [Observability](guides/observability.md).

**Was passiert, wenn ein Agent sich unerwartet verhält?**
Er wird von der Sandbox eingegrenzt: kein Dateisystem, kein Netzwerk, kein Betriebssystem, kein Zugriff auf andere Prozesse über das hinaus, was ihm gewährt wurde. Er kann nur Tools aus seiner Definition aufrufen, die die Richtlinien erlauben, und diese Aufrufe werden protokolliert.

**Wird Mandantenisolation von meinem Code oder von der Laufzeit durchgesetzt?**
Von der Laufzeit. Die Richtlinien-Engine evaluiert jeden Zugriff, bevor die Operation läuft. Ihre Aufgabe ist es, die mandantenbezogenen Richtlinien zu schreiben; die Laufzeit setzt sie durch.

**Wie werden externe MCP-Tools abgesichert?**
Über MCP konsumierte Tools laufen über denselben Funktionsaufrufpfad und dieselben Richtlinienprüfungen wie native Tools. Tools, die Wippy externen MCP-Clients bereitstellt, sind durch begrenzte, widerrufbare Zugriffstoken abgesichert. Das Anbinden eines MCP-Dienstes umgeht das Sicherheitsmodell nicht.

## Sicherheitsreferenz

| Aspekt | Wippys Ansatz |
|---------|------------------|
| Prozessisolation | Eigener Interpreter pro Prozess (Lua oder WASM), kein geteilter Speicher |
| Standardzugriff | Nicht gematchte Richtlinien verweigern, wenn Actor und Scope gesetzt sind; Strict Mode, standardmäßig aktiv, verweigert, wenn weder Actor noch Scope etabliert sind |
| Kontextdeklaration | `security:`-Block am Eintrag (Actor, Richtlinien, Gruppen); Auflösung ist atomar und fail-closed |
| Lieferkette | Modul-Packs werden bei Installation und beim Boot per Digest verifiziert; eine Abweichung weist das Modul zurück |
| Vertrauen zwischen Knoten | Gegenseitig authentifiziertes Internode-Mesh; ed25519-Identität pro Knoten, explizite Trusted-Peer-Map |
| Workflow-Propagierung | Actor und Scope werden als signierter, audience-gebundener Header an Temporal weitergegeben; ein Verifikationsfehler lässt die Ausführung scheitern |
| Capability-Kontrolle | Registry-Einträge, geregelt durch attributbasierte Sicherheitsrichtlinien (Actor, Scope, Aktion, Ressource) |
| Datengrenzen | Verbindungen und Speicher sind Registry-Einträge; jeder Zugriff wird per Entry-ID richtliniengeprüft |
| API-Schlüsselverwaltung | Im Environment-System gespeichert, intern von Anbietern gelesen, nicht an Prozesscode freigegeben |
| Agenten-Tool-Kontrolle | Tools auf die Definition des Agenten begrenzt; jeder Aufruf über die `funcs.call`-Richtlinie geprüft |
| Externe Tools (MCP) | Derselbe Funktionsaufrufpfad und dieselben Richtlinienprüfungen; bereitgestellte Tools durch begrenzte Token abgesichert |
| Agenten-Prüfpfad | OpenTelemetry-Tracing (wenn aktiviert) plus Usage-Tracker-Aufzeichnungen |
| Mandantenisolation | Mandantenbezogene Richtlinien und Scopes, von der Laufzeit vor jeder Operation evaluiert |
| Nebenläufigkeitsgrenzen | Begrenzt durch Worker-Pools des Hosts; keine eingebauten CPU-/Speicher-Obergrenzen pro Mandant |
| Selbstmodifikation | Deny-Richtlinien auf Registry-Schreibaktionen verhindern, dass Agenten ihre eigenen Definitionen bearbeiten |

## Siehe auch

- [Sicherheitsreferenz](system/security.md) - Richtlinien, Scopes, Actors, Token Stores und der `security:`-Block
- [Abhängigkeitsverwaltung](guides/dependency-management.md#integrity-verification) - Verifikation von Modul-Digests
- [Cluster](guides/cluster.md#internode-identity) - Internode-Identität und Peer-Vertrauen
- [Temporal-Workflows](temporal/workflows.md#security-context) - Signierte Kontextpropagierung
- [Registry](concepts/registry.md) - Der Capability-Speicher
- [Prozessmodell](concepts/process-model.md) - Prozessisolation und Lebenszyklus
- [Agenten](framework/agents.md) - Agentendefinitionen und Tool-Nutzung
