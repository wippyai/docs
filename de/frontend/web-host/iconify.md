---
title: "Iconify-Anbieter"
description: "Online-Iconify-Quellen oder eine lokale Sammlung für den Web Host konfigurieren."
---

# Iconify-Anbieter

Der Web Host verwendet standardmäßig Online-Quellen von Iconify. Konfigurieren Sie `AppConfig.iconify.providers` nur, wenn die Bereitstellung eine andere Quelle benötigt. Die hier beschriebene lokale Tabler-Sammlung ist eine ausdrückliche Option für Offline-Bereitstellungen. Sie ändert nicht die Standardquelle.
Die bestätigte Web-Host-Release-Basis für die direkte Verwendung von `AppConfig.iconify` ist Version 1.0.64. Für Facade-Bereitstellungen finden Sie die bestätigte Basis im [Facade-Modul](../../framework/facade.md).

## Anbieter konfigurieren

`providers` wird nach der Iconify-Anbieter-ID geordnet. Verwenden Sie den leeren Schlüssel (`""`) für den integrierten Anbieter oder eine kleingeschriebene ID mit Bindestrichen für einen benannten Anbieter. Jeder Wert enthält ein nicht leeres `resources`-Array mit HTTP(S)-Ursprüngen. Stock Iconify verwendet diese Ressourcen als alternative Ursprünge. Es kann einen erfolgreichen Ursprung speichern und spätere Anfragen dort beginnen. Der Host ergänzt die konfigurierte Liste nicht um eine öffentliche Quelle.

```ts
interface IconifyConfig {
  providers?: Record<string, {
    resources: string[]
    path?: string
    timeout?: number
  } | null> | null
}
```

`path` ist standardmäßig `/` und erhält führende und abschließende Schrägstriche. `timeout` beträgt standardmäßig 5000 Millisekunden und akzeptiert positive Ganzzahlen bis 60000. Ressourcenwerte sind Ursprünge. Zugangsdaten, Abfrage, Fragment oder Basispfad sind nicht zulässig.

## So verwenden Sie Wippy offline

Für Offline-Nutzung muss die Bereitstellung eine eigene Kopie der Sammlung auf einem für den Browser erreichbaren Server bereitstellen. Das öffentliche Web-Host-CDN ist online und stellt die Anwendung oder andere Dienste nicht offline bereit. Das Host-Release enthält `iconify/tabler.json`.

```ts
const config = {
  iconify: {
    providers: {
      "": {
        resources: ["http://localhost:5173"],
        path: "/iconify/",
      },
    },
  },
}
```

Für lokale Tests stellen Sie den Host-Build bereit, sodass `dist/iconify/tabler.json` unter `/iconify/tabler.json` erreichbar ist. Für die Bereitstellung verwenden Sie einen eigenen Ursprung und versionsgebundenen Pfad:

```ts
const deploymentConfig = { iconify: { providers: { "": { resources: ["https://wippy-host.internal"], path: "/webcomponents-<host-release>/iconify/" } } } }
```

Ersetzen Sie `<host-release>` durch das festgelegte Host-Release. Der Server muss JSON mit `application/json` zurückgeben und Browseranfragen vom Anwendungsursprung erlauben. Iconify sendet `?icons=...`; die statische Sammlung ignoriert diese Abfrage und liefert die vollständige Sammlung. Die Suche wird nicht unterstützt. Die Sammlung basiert auf Tabler 3.41.1, MIT-Lizenz, Autor Paweł Kuna. Metadaten nennen 6092 Icons; die Quelle enthält 6140 Definitionen und 184 Aliase. SHA-256: `cf18f905479c5ca5d0be13217e17d240deea3c457b70b2ae84bcaa0d5a98a51c`.

### Mirror richtig bereitstellen

Der statische Server gehört zur Offline-Konfiguration. Er muss die Datei mit `application/json` bereitstellen, Browseranfragen vom Anwendungsursprung per CORS erlauben, JSON komprimieren, wenn der Browser dies unterstützt, und für eine fehlende Sammlung einen echten 404-Status zurückgeben. Eine fehlende Datei darf nicht wie eine erfolgreiche Antwort zwischengespeichert werden. Versionsgebundene Pfade können unveränderlich gecacht werden. Bei einem nicht versionierten Pfad muss der Server mit `ETag` oder `Last-Modified` eine erneute Prüfung verlangen.

Dieses Nginx-Beispiel setzt Dateien unter `/srv/wippy/host/webcomponents-<host-release>/iconify/tabler.json`, den unten gezeigten exakten Anwendungsursprung und eine anderweitig konfigurierte TLS-Zertifikatsverwaltung voraus. Ersetzen Sie Ursprung und Stammverzeichnis durch Ihre Werte. Der Ausschnitt installiert keine Nginx-Module und konfiguriert kein TLS:

```nginx
server {
    location ~ ^/webcomponents-[^/]+/iconify/ {
        root /srv/wippy/host;
        default_type application/json;
        add_header Access-Control-Allow-Origin "https://app.example.com" always;
        add_header Vary Origin always;
        add_header Cache-Control "public, max-age=31536000, immutable";
        gzip on;
        gzip_types application/json;
        gzip_vary on;
        try_files $uri =404;
    }
}
```

Ersetzen Sie bei einem nicht versionierten Pfad die unveränderliche Cache-Regel durch eine erneute Prüfung, etwa `Cache-Control: no-cache`, und aktivieren Sie `ETag` oder `Last-Modified`. Prüfen Sie vor der Nutzung, ob der bereitgestellte Server JSON tatsächlich komprimiert, die erwartete Cache-Regel verwendet und korrekte CORS-, MIME- und 404-Antworten liefert.

## Benannte Anbieter und Icons

Ein benannter Anbieter verwendet `@anbieter:präfix:name`, zum Beispiel `@tenant:tabler:home`. Vue und das Custom Element verwenden denselben Namen.

```ts
const namedConfig = { iconify: { providers: { tenant: { resources: ["https://icons.example.internal"], path: "/tenant/" } } } }
```

```vue
<script setup lang="ts">
import { Icon } from '@iconify/vue'
</script>

<Icon icon="@tenant:tabler:home" />
<iconify-icon icon="@tenant:tabler:settings"></iconify-icon>
```

Die Quelle deckt nur Icon-Sammlungsanfragen ab. APIs, Schriftarten und andere Kickside-Ressourcen benötigen eigene Offline-Unterstützung.

## Zurücksetzen und Aktualisieren

Fehlt `iconify` in der anfänglichen Konfiguration, gelten die Online-Standards. Fehlt es in einer späteren Aktualisierung, bleibt die aktuelle Iconify-Konfiguration unverändert. `iconify: null` oder `providers: null` setzt den gesamten Abschnitt zurück und entfernt benannte Anbieter. Der leere Anbieter mit `null` setzt nur den integrierten Anbieter zurück. Ein benannter Anbieter mit `null` deaktiviert dessen Namespace. Ausgelassene Schlüssel behalten ihre Routen. Ein leeres `providers`-Objekt setzt nichts zurück.

Das generierte Schema prüft die JSON-Form und Feldgrenzen. Die Laufzeitvalidierung prüft zusätzlich, ob `resources` HTTP(S)-Ursprünge und `path` nach den Host-Regeln sind. Ein Wert kann daher das Schema erfüllen und trotzdem zur Laufzeit abgelehnt werden. Erlaubt sind nur `providers` sowie `resources`, `path` und `timeout`. Ungültige Erstwerte werden ignoriert und lassen die Online-Standards aktiv. Ungültige Updates behalten die letzte gültige Iconify-Einstellung; andere gültige AppConfig-Felder können weiter aktualisiert werden. Der Host gibt `timeout` an die Anbieter-API von Stock Iconify weiter und richtet jeden Store nur einmal ein. Stock Iconify übernimmt das Laden von Icons, die Auswahl und Wiederholung von Ressourcen sowie das Caching. Das Paket kann einen erfolgreichen Ursprung speichern und spätere Anfragen dort beginnen. Laden Sie das Dokument neu, damit Anbieteränderungen gelten. `iconifyIcons` steuert das Laden und Registrieren des Elements `<iconify-icon>`, nicht die Quelle. Explizite Werte werden an Kind-Apps weitergegeben. Schema 2.0 und 2.1 werden nach 2.2 migriert. Siehe [Bootstrap-Ablauf](./bootstrap.md), [CSS-Injektion](./css-injection.md), [Proxy-API](../micro-frontends/proxy-api.md) und [Facade](../../framework/facade.md).

## Provider trust and updates

Verwenden Sie nur vertrauenswürdige Anbieter-Ursprünge. Die Seite rendert Icon-Inhalte als SVG-Markup. Verwenden Sie `wippy-context-2.2` für neue `SetConfig`-Daten. Versionierte Daten mit `wippy-context-2.0` und `wippy-context-2.1` werden angenommen und migriert; schemafreie Daten im Format 1.0 können die neuen Felder `iconify` und `importMap` nicht enthalten.

## Schema-Versionen

Verwenden Sie `wippy-context-2.2` für neue Konfigurationen. Versionierte Eingaben mit `wippy-context-2.0` und `wippy-context-2.1` werden migriert. Eingaben ohne `$schema` verwenden den veralteten Legacy-Konverter. Er bildet bekannte Legacy-Felder ab, übernimmt aber nicht die neuen Felder `iconify` und `importMap`. Das erzeugte Schema prüft JSON-Form und Feldgrenzen. Die Laufzeit prüft zusätzlich HTTP(S)-Ursprünge und die Host-Regeln für Pfade. Ein Wert kann daher das Schema erfüllen und trotzdem zur Laufzeit abgelehnt werden.

## Entwicklungs-Overlay

Starten Sie die konsumierende Anwendung mit Vite und aktiviertem `@wippy-fe/vite-plugin`; das Plugin stellt dem Entwicklungs-Overlay die Wippy-Einstellungen aus `package.json` bereit. Klicken Sie auf die schwebende Schaltfläche **Wippy Dev**, öffnen Sie **Configuration**, ergänzen Sie `iconify.providers` unter **App Config (JSON)** und klicken Sie auf **Accept**. Beim ersten Start kann die Anwendung danach laden. Angenommene Einstellungen werden im Browser gespeichert. Laden Sie die bereits laufende Anwendung nach späteren Änderungen neu, bevor Sie sie prüfen, denn **Accept** speichert die Einstellungen, aktualisiert aber nicht die bereits verwendete App-Konfiguration. Bei aktiviertem Auto-Accept meldet die Konsole zusätzlich `Config updated (reload to apply)`.
