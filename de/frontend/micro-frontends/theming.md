---
title: "Theme-Erstellung"
description: "Wie die Facade ein PrimeVue-Theme definiert und Module portabel bleiben."
---

# Theme-Erstellung

**Klassifizierung: Referenz für Theme-Zuständigkeit und Runtime-Vertrag.** Der
Block zum Moduswechsel zeigt einen öffentlichen API-Ablauf; er setzt einen
laufenden Host voraus und konfiguriert weder Facade noch Modul.

Die Facade definiert ein PrimeVue-Theme. Module verwenden es, statt ein
unabhängiges Designsystem aufzubauen.

Wippy betreibt PrimeVue derzeit mit `theme: 'none'`. Das Erscheinungsbild
stammt aus Wippys mit Tailwind erstelltem PrimeVue-CSS, öffentlichen
Runtime-Variablen und Facade-Anpassungen.

## Zuständigkeit für Styles

| Anliegen | Zuständig |
|---|---|
| Produktweit gemeinsames PrimeVue-Erscheinungsbild | Facade-PrimeVue-Theme in `custom_css` und öffentliche Theme-Variablen |
| Nur Host-Shell-Chrome | Auf `.wippy-host-app` begrenztes Facade-CSS |
| Gemeinsame `.p-*`-Regel für Host- und Kind-Roots | Globales Facade-`custom_css`, kein Host-Scope nötig |
| Seitenspezifische Theme-Überschreibung | Seitenkonfiguration mit unterstützter Frontend-Schreibweise |
| Domänenlayout oder neue Struktur | Modul-CSS oder Tailwind |
| Notwendiges eigenes Nicht-PrimeVue-Teil | Modul-CSS mit öffentlichen Tokens und dokumentierten invarianten Utilities |
| Gleiches eigenes Teil in mehreren Modulen | Gemeinsames Paket; siehe [Designschicht](../design-layer.md) |
| Beliebige von einer Facade erwartete Klasse | Nicht portabel; durch FE-STYLE-001 verboten |

Eine globale Regel `.p-drawer-content` ist gültige Theme-Implementierung, wenn
sie für jeden Drawer in Host- und Kind-Roots gelten soll. Nur hostspezifische
Regeln gehören unter `.wippy-host-app .p-drawer-content`.

Verschiebt man dupliziertes Modul-CSS in die Facade, verschwindet die
Abhängigkeit nicht. Gehört der Selektor nicht zum gemeinsamen PrimeVue-
Themevokabular, entsteht ein privater Facade-Vertrag. Modulübergreifendes
Vokabular außerhalb des Themes gehört in ein veröffentlichtes Paket; siehe
[Designschicht](../design-layer.md).

## Semantische Gleichheit

Semantisch gleiche Steuerelemente sollen gleich aussehen. Bevorzugen Sie
PrimeVue-Komponenten. Ist ein wirklich eigenes Element nötig, bestimmen Sie
sein visuelles PrimeVue-Geschwister und verwenden für Farbe, Rahmen, Fokus,
Zustand und als Theme-Variable klassifizierte Geometrie dieselben öffentlichen
Runtime-Eigenschaften.

Das eigene Teil besitzt nur die neue Struktur. Wo dokumentierte Verträge für
Padding, Abmessungen, Typografie, Radius, Schatten, Fokus und Bewegung
existieren, werden sie wiederverwendet. Ein aus generiertem Komponenten-CSS
kopiertes Literal folgt künftigen Themeänderungen nicht.

## Runtime- und invariante Eigenschaften

Jede gemeinsame Darstellungseigenschaft hat genau eine Richtlinie:

- `theme-variable`: Auflösung über eine dokumentierte öffentliche Runtime-Variable.
- `platform-invariant`: Der kompilierte gemeinsame Tailwind-Wert ist absichtlich in jedem konformen Theme stabil.

Fügen Sie keine Runtime-Tokens für theoretische Flexibilität hinzu. Ein Token
setzt eine reale Runtime-Lücke, einen exakten unterstützten Pfad, einen echten
Verbraucher und dokumentierte Mutationsevidenz voraus.

## CSS-Transport ist keine Berechtigung

Der Stiltransport folgt der Engine: iframe nutzt die Proxy-Injektionspipeline,
Web Fragment erhält Plattform-CSS vom Gateway und Seitenüberschreibungen im
reflektierten Head, Web Components gegebenenfalls CSS im Shadow Root. Diese
Mechanismen erklären den Wirkungsort, erlauben aber keine Abhängigkeit von
beliebigen Facade-Selektoren.

## Theme-Modus zur Laufzeit wechseln

Der öffentliche Vertrag besteht aus AppConfig und `@wippy-fe/proxy`:

```typescript
import { host, on } from '@wippy-fe/proxy'

async function setThemeMode(mode: 'auto' | 'light' | 'dark') {
  if (host.getThemeMode() === mode) return

  await new Promise<void>((resolve, reject) => {
    let settled = false
    let stop = () => {}
    const finish = (error?: unknown) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      stop()
      if (error) reject(error)
      else resolve()
    }
    const timeout = window.setTimeout(
      () => finish(new Error(`Timed out waiting for theme mode: ${mode}`)),
      5_000,
    )

    stop = on('@theme', (appliedMode) => {
      if (appliedMode !== mode) return
      finish()
    })

    try {
      host.setThemeMode(mode)
    } catch (error) {
      finish(error)
    }
  })
}

await setThemeMode('dark')
```

Zulässig sind nur `auto`, `light` und `dark`. Der Host besitzt die Weitergabe
an Anwendung und rekursive Kinder; Facade/Embedder besitzt die Persistenz.
Direktes Bearbeiten von `w-theme-dark` / `w-theme-light`, interne Theme-Helfer,
Schreiben in AppConfig-Globals oder Hostnachrichten umgehen den Vertrag.
Visuelle Evidenz ist erst gültig, wenn die öffentliche API den weitergegebenen
Modus meldet.

Siehe [Tailwind-Vertrag](./tailwind-contract.md),
[Tokenkatalog](./token-catalogue.md) und
[Vertrag für portable Oberflächen](../portable-ui-contract.md).
