---
title: "Seitenrezept"
description: "Portables view.page-Rezept mit unterstütztem Routing, Theme-Bereitstellung, Abhängigkeiten und Build-Zuständigkeit."
---

# Seitenrezept

Eine Seite ist eine mit Vite gebaute Anwendung, die durch die ältere
`about:srcdoc`-iframe-Engine oder die Web-Fragment-Engine dargestellt wird.
Route und Hostkontext stammen aus Wippy-AppConfig und Paketen, nicht aus dem
Browserstandort.

Dies ist ein Integrationsrezept für ein vorhandenes Vue-/Vite-Projekt. Es nennt
Wippy-spezifischen Einstiegscode und Deploymentvertrag, stellt aber weder ein
eigenständiges Projektscaffold noch das Backend bereit.

## Erforderliche Einrichtung

1. Registrieren Sie eine `view.page` und die zugehörigen Dateisystem-/Router-Einträge.
2. Aktivieren Sie die benötigte CSS-Bereitstellung. Kann iframe gewählt werden, bleibt der CSS-Block `iframe` für einheitliche Scrollbars aktiv.
3. Verwenden Sie `@wippy-fe/router` für Vue-Routing.
4. Installieren Sie PrimeVue und das Wippy-PrimeVue-Plugin, sobald die Seite PrimeVue-artige Steuerelemente darstellt.
5. Verwenden Sie das gemeinsame Wippy-Tailwind-Preset für Tailwind-Utilities.
6. Erzeugen Sie Externals aus dem fixierten Snapshot der Web-Host-Import-Map.
7. Mounten Sie an `#app`; inhaltsbasierte Web Fragments verlangen genau diese Root-ID.
8. Bauen Sie in das vom Deployment gewählte Ausgabeverzeichnis.

```ts
import { createApp } from 'vue'
import PrimeVue from '@wippy-fe/theme/primevue-plugin'
import { createAppRouter } from '@wippy-fe/router'
import { config } from '@wippy-fe/proxy'
import App from './App.vue'
import { routes } from './routes'

const app = createApp(App)
app.use(PrimeVue)
app.use(createAppRouter(routes, {
  initialPath: config.context?.route ?? '/',
}))
app.mount('#app')
```

Prüfen Sie die exakten exportierten Signaturen gegen die gewählte Paketversion.
Erstellen Sie keine eigene Routersynchronisierung.

## Theme-Injektion

Die Seite verwendet das Facade-Theme, das in den gewählten Seiten-Realm
geliefert wird. Nutzen Sie öffentliche PrimeVue-Komponenten, Theme-Variablen,
dokumentierte runtimegestützte Tailwind-Utilities und ausdrücklich invariante
Compile-Time-Utilities.

Ein Host-Query-Parameter ist kein Anwendungsfixture. AppConfig besitzt den Hostkontext.

## Build

Rufen Sie das Make-Ziel des Wippy-Modulrepositories auf. Dessen Rezept füllt die Deploymentausgabe mit:

```text
npm run build -- --outDir <target> --emptyOutDir
```

`vite.config.ts` bewahrt relatives Assetverhalten und hardcodiert kein
Deployment-`outDir`. Rufen Sie weder Package Manager noch Vite-Build direkt
auf. Unter Windows verwenden Sie `make.bat`; es delegiert an die
`make.ps1`-Implementierung des Ziels.

Siehe [Build- und Abhängigkeitsvertrag](./build-system.md),
[Plattformtopologie](../platform-topology.md) und
[Konfiguration und Schreibweise](./configuration-casing.md).
