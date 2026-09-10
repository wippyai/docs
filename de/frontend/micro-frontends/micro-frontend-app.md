---
title: "Seiten-Rezept"
description: "Ein portables view.page-Rezept mit unterstütztem Routing, Theme-Auslieferung, Abhängigkeiten und Build-Zuständigkeit."
---

# Seiten-Rezept

Eine Seite ist eine mit Vite gebaute Anwendung, die in einem `about:srcdoc`-iframe gerendert wird. Route und Host-Kontext kommen aus Wippy-AppConfig und -Paketen, nicht aus der Browser-Location.

## Erforderliches Setup

1. Registrieren Sie eine `view.page` sowie ihre Filesystem-/Router-Einträge für die Auslieferung.
2. Aktivieren Sie die erforderliche CSS-Auslieferung. Lassen Sie den `iframe`-CSS-Block aktiviert, damit Scrollbars standardmäßig konsistent bleiben.
3. Verwenden Sie `@wippy-fe/router` für Vue-Routing.
4. Installieren Sie PrimeVue und das Wippy-PrimeVue-Plugin, wenn die Seite irgendein PrimeVue-artiges Steuerelement rendert.
5. Verwenden Sie das gemeinsame Wippy-Tailwind-Preset, wenn die Seite Tailwind-Utilities schreibt.
6. Erzeugen Sie Externals aus dem gepinnten Import-Map-Snapshot des Web Host.
7. Bauen Sie in das vom Deployment gewählte Ausgabeverzeichnis.

```ts
import { createApp } from 'vue'
import PrimeVue from '@wippy-fe/theme/primevue-plugin'
import { createAppRouter } from '@wippy-fe/router'
import App from './App.vue'
import { routes } from './routes'

const app = createApp(App)
app.use(PrimeVue)
app.use(createAppRouter(routes))
app.mount('#app')
```

Prüfen Sie die exakten exportierten Signaturen gegen die gewählte Paketversion. Erstellen Sie keine lokale Schicht zur Router-Synchronisation.

## Theme-Injektion

Die Seite konsumiert das Facade-Theme, das in ihr iframe geliefert wird. Verwenden Sie öffentliche PrimeVue-Komponenten, öffentliche Theme-Variablen, dokumentierte laufzeitgestützte Tailwind-Utilities und ausdrücklich invariante Compile-Time-Utilities.

Verwenden Sie keinen Host-Query-Parameter als Anwendungs-Fixture. AppConfig besitzt den Host-Kontext.

## Build

Rufen Sie das Make-Target des Wippy-Modul-Repositorys auf. Sein Rezept versorgt die
Deployment-Ausgabe mit:

```text
npm run build -- --outDir <target> --emptyOutDir
```

`vite.config.ts` behält das relative Asset-Verhalten bei und kodiert kein `outDir` des Deployments fest.

Rufen Sie den zugrundeliegenden Paketmanager- oder Vite-Build-Befehl nicht direkt auf.
Unter Windows rufen Sie `make.bat` auf; es delegiert an die `make.ps1`-Implementierung
des Targets.

Siehe [Build- und Abhängigkeitsvertrag](./build-system.md), [Plattform-Topologie](../platform-topology.md) und [Konfiguration und Schreibweise](./configuration-casing.md).
