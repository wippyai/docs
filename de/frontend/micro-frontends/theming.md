---
title: "Theme-Erstellung"
description: "Wie die Facade ein PrimeVue-Theme verfasst und wie Module portabel bleiben."
---

# Theme-Erstellung

Die Facade verfasst ein PrimeVue-Theme. Module konsumieren dieses Theme; sie schaffen keine parallelen Mini-Designsysteme.

Wippy betreibt PrimeVue derzeit mit `theme: 'none'`. Das Erscheinungsbild der Komponenten liefern Wippys mit Tailwind verfasstes PrimeVue-CSS, öffentliche Laufzeitvariablen und die Facade-Anpassung.

## Wo Styling hingehört

| Styling-Anliegen | Zuständig |
|---|---|
| Produktweit geteiltes Erscheinungsbild von PrimeVue-Komponenten | PrimeVue-Theme der Facade in `custom_css` und öffentliche Theme-Variablen |
| Nur das Chrome der Host-Hülle | Facade-CSS mit Scope `.wippy-host-app` |
| Eine geteilte `.p-*`-Regel für Host- und Kind-Roots | Globales `custom_css` der Facade; kein Host-Scope nötig |
| Theme-Override nur für eine Seite | Seitenkonfiguration mit der unterstützten Frontend-Schreibweise |
| Domänenlayout oder neuartige Struktur | Modul-CSS oder Tailwind |
| Ein notwendiger Nicht-PrimeVue-Custom-Baustein | Modul-CSS, das öffentliche Tokens und dokumentierte invariante Utilities wiederverwendet |
| Derselbe Nicht-PrimeVue-Baustein für mehrere eigene Module | Ein gemeinsames Paket — siehe [Die Design-Schicht](../design-layer.md) |
| Eine beliebige Klasse, die von einer bestimmten Facade erwartet wird | Nicht portabel; durch FE-STYLE-001 untersagt |

Eine globale `.p-drawer-content`-Regel ist eine gültige Theme-Implementierung, wenn sie für jeden Drawer in Host- und Kind-Roots gedacht ist. `.wippy-host-app .p-drawer-content` ist nur angemessen, wenn die Regel host-spezifisch ist.

Dupliziertes Modul-CSS in Facade-CSS zu verschieben beseitigt die Abhängigkeit nicht. Ist der Selektor nicht Teil des geteilten PrimeVue-Theme-Vokabulars, entsteht ein privater Facade-Vertrag. Der Ort für Vokabular, das Ihre eigenen Module teilen, das aber im Theme fehlt, ist ein veröffentlichtes Paket: siehe [Die Design-Schicht](../design-layer.md).

## Semantische Gleichheit

Semantisch gleichwertige Steuerelemente sollten gleichwertig aussehen. Bevorzugen Sie PrimeVue-Komponenten direkt. Wenn ein wirklich eigenes Steuerelement nötig ist, bestimmen Sie sein visuelles PrimeVue-Geschwister und verwenden Sie dieselben öffentlichen Laufzeit-Properties für Farbe, Rahmen, Fokus, Zustand und jede als theme-variable eingestufte Geometrie.

Der eigene Baustein darf nur die neuartige Struktur besitzen, die das Geschwister nicht bietet. Verwenden Sie dokumentierte Theme-Verträge für Padding, Abmessungen, Typografie, Radius, Schatten, Fokus und Bewegung wieder, wo es sie gibt. Kopieren Sie kein aktuelles Literal aus generiertem Komponenten-CSS und nennen es Vererbung.

## Laufzeit- versus invariante Properties

Jede geteilte Erscheinungs-Property hat genau eine Policy:

- `theme-variable`: Sie muss über eine dokumentierte öffentliche Laufzeitvariable aufgelöst werden.
- `platform-invariant`: Der geteilte kompilierte Tailwind-Wert ist über jedes konforme Theme hinweg bewusst stabil.

Fügen Sie keine Laufzeit-Tokens für theoretische Flexibilität hinzu. Ergänzen oder übernehmen Sie ein Token erst, nachdem das Hauptbuch des effektiven Vertrags eine reale Laufzeitlücke, einen exakten unterstützten Pfad, einen realen Konsumenten und einen Mutationsnachweis belegt.

## CSS-Transport ist keine Erlaubnis

Seiten erhalten Styles in einem iframe. Web Components können Styles innerhalb eines Shadow Root erhalten. Das erklärt, wo CSS wirken kann; es berechtigt ein Modul nicht dazu, von beliebigen Facade-Selektoren abzuhängen.

## Moduswechsel zur Laufzeit

Der öffentliche Vertrag für den Theme-Modus ist AppConfig plus `@wippy-fe/proxy`:

```typescript
import { host, on } from '@wippy-fe/proxy'

async function setThemeMode(mode: 'auto' | 'light' | 'dark') {
  await new Promise<void>((resolve, reject) => {
    const stop = on('@theme', (appliedMode) => {
      if (appliedMode !== mode) return
      stop()
      const currentMode = host.getThemeMode()
      if (currentMode !== mode) {
        reject(new Error(`Theme propagation mismatch: ${currentMode}`))
        return
      }
      resolve()
    })
    host.setThemeMode(mode)
  })
}

await setThemeMode('dark')
```

Verwenden Sie ausschließlich `auto`, `light` oder `dark`. Der Host besitzt die Anwendung und die rekursive
Weitergabe an Kinder; die Facade bzw. der Einbetter besitzt die Persistenz. `w-theme-dark` /
`w-theme-light` direkt zu bearbeiten, interne Theme-Hilfsfunktionen aufzurufen, AppConfig-Globals zu
schreiben oder Host-Nachrichten zu posten umgeht diesen Vertrag und ist nicht konform.
Visuelle Nachweise sind erst gültig, nachdem die öffentliche API den weitergegebenen Modus
meldet.

Siehe [Tailwind-Vertrag](./tailwind-contract.md), [Token-Katalog](./token-catalogue.md) und [Portabler UI-Vertrag](../portable-ui-contract.md).
