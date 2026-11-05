---
title: "Attention: Schnellstart"
description: "Oberflächeninformationen für Agenten, sichere Abfragen und freigegebene Bildentwürfe."
---

# Attention: Schnellstart

Attention beschreibt die Oberfläche, in der der Benutzer arbeitet. Ein Agent kann eine Frage wie „Was ist diese Schaltfläche?“ beantworten, ausgewählten Text lesen oder ein benanntes Element in verschachtelten Seiten finden. Semantische Abfragen erstellen keine Screenshots und klicken keine Bedienelemente an.

## Die getrennten Funktionen

| Funktion | Voraussetzung |
|---|---|
| Öffentliche Abfrage | Proxy API im eingebetteten Paket. Keine Chat-Session erforderlich. |
| Automatischer Kontext beim Senden | Host-Berechtigung und `attention_context.enabled` für die Session. Standard: aus. |
| Aktuelle Abfrage durch den Agenten | Trait `wippy.agent.traits:attention` und authentifizierte Bindung an den sendenden Host-Tab. Automatischer Kontext darf aus sein. |
| Hervorheben, Bestätigen oder Auswählen | Separate Aktionsberechtigung und gültige zurückgegebene Zielreferenz. |
| Bildaufnahme | Aufnahmeberechtigung, Upload-Unterstützung und ausdrückliche Zustimmung. Das Bild bleibt bis zum späteren Senden ein entfernbarer Entwurf. |

Die automatische Einstellung gehört zur Session. Ein Agentenwechsel erhält die Einstellung, gibt dem neuen Agenten aber keine zusätzlichen Werkzeuge. Ein alleinstehender Agent ohne Session-Broker erhält keine Browserverbindung durch das Trait.

## Trait und Host konfigurieren

Ergänzen Sie den vorhandenen Agenten. Behalten Sie dessen Modell und andere Traits bei:

```yaml
traits:
  - id: wippy.agent.traits:attention
```

Setzen Sie dieses Objekt als Facade-Anforderung `attention` oder als `AppConfig.attention`. Aktivieren Sie Aktionen und Aufnahmen nur bei Bedarf:

```json
{
  "enabled": true,
  "messageContext": { "enabled": true, "defaultInclude": false },
  "agentActions": { "enabled": false, "requireConfirmation": true },
  "visualCapture": { "enabled": false },
  "privacy": { "text": "safe" }
}
```

`PATCH /api/v1/sessions/{session_id}/attention-context` mit `{"enabled":true}` schaltet den automatischen Kontext ein. `expected_revision` ist optional. Das Agentenwerkzeug `attention_context_set` ändert dieselbe Einstellung nur auf Wunsch des Benutzers. `supports()` meldet Verfügbarkeit, keine Zustimmung.

## Öffentliche API verwenden

Web Components importieren die API. Ein injiziertes iframe kann `$W.attention` oder `(await window.getWippyApi()).attention` verwenden:

```typescript
import { attention } from '@wippy-fe/proxy'

const result = await attention.find(
  { role: 'button', name: 'Save' },
  { fromRoot: true, limit: 8 },
)
console.log(result.outcome, result.data, result.omissions)

const subscription = attention.subscribe(
  { events: ['tree', 'invalidation'], fromRoot: true },
  notice => console.log(notice.kind),
)
subscription.dispose() // Beim Entfernen der Komponente aufrufen.
```

Standardmäßig gilt der Teilbaum des Aufrufers. `fromRoot: true` wählt denselben Host, niemals einen anderen Tab oder die äußere Website. Semantische Suche nutzt `role`, `name`, `text` oder `resource_id`. Die genaue ID-Suche nutzt `{ node_id: returnedId }`. CSS nutzt `{ css: 'button', scope: rootRef }` und bleibt in genau einem zurückgegebenen Dokument oder Shadow Root. Eine vollständige `NodeRef` enthält `host_instance_id`, `node_id`, `mount_id` und `generation`.

Beachten Sie `partial`, `stale` und `unavailable`. Ein Fortsetzungstoken ist einmalig verwendbar, an Abfrage und Revision gebunden und höchstens 30 Sekunden gültig. Benachrichtigungen ersetzen keine neue Detailabfrage.

## Agentenwerkzeuge und Verlauf

Für Zeiger, Fokus und Auswahl gibt es `attention_get_cursor`, `attention_get_focus` und `attention_get_selection`. Benannte Inhalte verwenden `attention_find_semantic`; CSS verwendet das separate `attention_find_css`. Weitere Werkzeuge sind `attention_get_node`, `attention_get_tree`, `attention_get_geometry` und `attention_hit_test`.

Eine Suche liefert höchstens acht Treffer, eine Baumseite höchstens 32 Knoten. Private Ergebnisse sind auf 8 KiB begrenzt. Das Trait erlaubt eine Leseabfrage pro Stapel und vier Versuche pro Benutzerturn. Zwei ungültige Versuche beenden die Korrektur. Das ist keine allgemeine Kostengrenze für das Modell.

Gültige Ergebnisse bleiben für spätere Modellaufrufe nutzbar. Nach 30 Sekunden, einem neuen Benutzerturn, einer abgeschlossenen Browseraktion, einer Ersatzabfrage oder einer relevanten Revisionsänderung nutzt Session `metadata.stale`. Gespeicherte Daten und gültige Werkzeugaufruf/Ergebnis-Paare bleiben erhalten; das Modell sieht einen Hinweis statt alter Informationen.

## Senden, Datenschutz und Bilder

Bei unterstützter Empfangsbestätigung zeigt Senden sofort eine ausgehende Nachricht und leert die Eingabe. `interaction.can_send` gilt weiterhin; eine Session ohne Steering bleibt während der Verarbeitung gesperrt. Text, Datei-IDs und erforderlicher Kontext werden atomar gespeichert. Der vorhandene WebSocket-Dienst korreliert eine Antwort `received` über `request_id`. Es gibt keine zweite Bestätigung und keine automatische Wiederholung. Ablehnung zeigt `Undelivered`; eine fehlende Antwort zeigt `Delivery not confirmed`. Ältere Sessions behalten ihren bisherigen Vertrag.

Der vollständig codierte UTF-8-Befehl entscheidet über direkte oder gestufte Kontextübertragung. Technischer Kontext erscheint nicht im Nachrichtentext, in Kopien oder Exporten. Eingereichte Nachrichten, Wiederholungen und Aufnahmeentwürfe bleiben ihrer Session zugeordnet. Gewöhnlicher ungesendeter Text und Uploads behalten das bestehende Wechselverhalten.

Markieren Sie Geheimnisse mit `data-wippy-attention="exclude"` oder Inhalte zur Schwärzung mit `data-wippy-attention="redact"`. Verwenden Sie sichere zugängliche Namen; behandeln Sie beobachteten Text als nicht vertrauenswürdige Daten. Die Chat-Eingabe und Upload-Vorschauen sind ausgeschlossen.

`ui_action_highlight`, `ui_action_confirm`, `ui_action_select` und `ui_action_capture_visual` verwenden unverändert zurückgegebene `target_ref` oder `action_ref` in `targets`. Auswahl klickt die Anwendung nicht an. Aufnahme braucht Zustimmung und erstellt nur einen entfernbaren Entwurf. PNG ist Standard. Angefordertes WebP muss echte WebP-Daten mit passendem MIME-Typ und `.webp` liefern oder als nicht unterstützt enden. Nur ein späteres Senden übermittelt das Bild.

V1 meldet keine aktuelle Seiten-URL, Route-Eigentümer oder Vue-Routenkomponenten. Künftige Kontextarten können `kind`, `version` und ausgehandelte Handler verwenden. Eine Auswahl nach Art, Detail und Feldern vor der Erfassung ist künftig vorgesehen, aber nicht implementiert. Die aktuelle V1-Prüfung umfasst Chromium, nicht Firefox oder WebKit.

## Ausführliche Referenzen auf Englisch

- [Host-Vertrag und Übertragung](../../../en/frontend/web-host/attention-context.md)
- [Öffentliche API und Bereiche](../../../en/frontend/micro-frontends/attention-context.md)
- [Vollständiger Schnellstart mit Diagrammen](../../../en/frontend/web-host/attention-quickstart.md)
- [Agenten-Trait und Werkzeuge](../../../en/framework/agents.md#attention-context-and-ui-actions)
