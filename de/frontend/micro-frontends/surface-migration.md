---
title: "Migration von Oberflächen"
description: "Rezepte zum Umstellen viewportbasierter responsiver Regeln auf den Wippy-Oberflächenvertrag."
---

# Migration von Oberflächen

**Klassifizierung: Sammlung partieller Migrationsrezepte.** Jeder Vorher-/Nachher-
Block konvertiert ein isoliertes Muster. Wenden Sie den Entscheidungsbaum auf
das gesamte Stylesheet an und prüfen Sie danach beide Engines und Sizing-Modi.

| Label | Bedeutung |
|---|---|
| **automatisch** | Mechanisch, gleiche Bedeutung. |
| **bedingt** | Nur unter genannter Vorbedingung sicher. |
| **manuell** | Menschliche Entscheidung nötig. |
| **nicht konvertierbar** | Keine Containerform; `host.surface` verwenden oder Viewportverhalten bewusst behalten. |

Nicht ausgelieferte Tailwind-`surface-*`-Varianten, Builddiagnostik,
hostvermitteltes Scrollen und Hit-Testing werden ausdrücklich gekennzeichnet.

## Entscheidungsbaum

```text
Does the rule respond to how much room THIS PAGE has?
├── yes → convert to @container wippy-surface        (recipes 1-8)
├── no, it responds to one COMPONENT's width
│        → give that component its own container      (recipe 22)
├── no, it responds to a user/device PREFERENCE
│        → leave it as @media                         (recipe 13)
└── no, it deliberately tracks the BROWSER WINDOW
         (a true full-window overlay)
         → leave it, and document why
```

Unklare Regeln bleiben zunächst unverändert. Eine falsch konvertierte Regel ist
schlimmer als eine sichtbar nicht portable Media Query.

## 1. `max-width` → `inline-size <=` — **automatisch**

```css
/* before */ @media (max-width: 640px)                      { .nav { display: none } }
/* after  */ @container wippy-surface (max-width: 640px)    { .nav { display: none } }
```

## 2. `min-width` → `inline-size >=` — **automatisch**

```css
/* before */ @media (min-width: 640px)                      { .sidebar { display: block } }
/* after  */ @container wippy-surface (min-width: 640px)    { .sidebar { display: block } }
```

## 3. Begrenzter Breitenbereich — **automatisch**

```css
/* before */ @media (min-width: 640px) and (max-width: 1024px) { … }
/* after  */ @container wippy-surface (640px <= width <= 1024px) { … }
```

Die Bereichssyntax wird von allen Zielengines unterstützt; die `and`-Form geht ebenfalls.

## 4. Mehrere Breakpoints — **automatisch**

Container Queries ändern weder Spezifität noch Reihenfolge. Behalten Sie die Quellreihenfolge:

```css
@container wippy-surface (min-width: 480px)  { .grid { grid-template-columns: repeat(2, 1fr) } }
@container wippy-surface (min-width: 900px)  { .grid { grid-template-columns: repeat(4, 1fr) } }
```

## 5. Höhenabfragen — **bedingt** (nur Container-Sizing)

```css
/* after */ @container wippy-surface (min-height: 500px) { .tall-only { display: block } }
```

Deklarieren Sie die Abhängigkeit, damit Content-Sizing sichtbar abgelehnt wird:

```json
{ "wippy": { "surface": { "contract": 1, "requirements": ["block-size"] } } }
```

## 6. Seitenverhältnis — **bedingt** (nur Container-Sizing)

```css
/* before */ @media (min-aspect-ratio: 16/9)                     { … }
/* after  */ @container wippy-surface (min-aspect-ratio: 16/9)   { … }
```

## 7. Orientierung — **bedingt**

`@container wippy-surface (orientation: landscape)` beschreibt das Panel.
War das Gerät gemeint, bleibt die Media Query.

## 8. Höhe/Verhältnis/Orientierung bei Content-Sizing — **nicht konvertierbar**

Ohne Blockachse gibt es keine Abfrage. Verwenden Sie kein `cqh`. Sizing wird
durch den Renderort bestimmt, nicht das Paket. Ist die Blockachse zwingend,
deklarieren Sie `requirements: ["block-size"]` und rendern Sie in einem
Containerkontext.

## 9. Geometrie in einer Umwelt-Media-Query — **manuell**

```css
/* before */
@media (prefers-color-scheme: dark) and (min-width: 640px) { .panel { … } }

/* after — split: the preference stays, the geometry moves */
@media (prefers-color-scheme: dark) {
  @container wippy-surface (min-width: 640px) { .panel { … } }
}
```

Die Verschachtelung kann Präzedenz ändern; Ergebnis erneut prüfen.

## 10. Komma-OR — **manuell**

```css
/* before */ @media (max-width: 480px), (min-width: 1200px) { … }
```

Ein Komma ist OR. Nur zwei identische benachbarte Blöcke erhalten die Semantik:

```css
@container wippy-surface (max-width: 480px)  { … }
@container wippy-surface (min-width: 1200px) { … }
```

## 11. `not`, `only`, komplexe Boolesche Ausdrücke — **manuell**

`only` entfällt. `not` invertiert die Gesamtbedingung; bei `and`/`or` Klammern
ausdrücklich setzen.

## 12. `screen` / `print` mit Geometrie — **manuell**

Medientypen haben keine Containerform. Typ als Media Query behalten und
Geometrie darin verschachteln. Print bleibt meist vollständig seitenbasiert.

## 13. Präferenzen bleiben Media Queries — **nicht konvertierbar**

`prefers-color-scheme`, `prefers-contrast`, `prefers-reduced-motion`,
`forced-colors`, `hover`, `pointer`, `any-pointer` bleiben unverändert.

## 14. `em`-Breakpoints — **manuell**

In Media Queries bezieht sich `em` auf die initiale Schriftgröße, in Container
Queries auf die Containerschrift. In `px` umrechnen oder berechneten Wert prüfen.

## 15. `rem`-Breakpoints — **manuell**

Auch `rem` bezieht sich in Media Queries auf die initiale Browser-Schriftgröße,
in Container Queries gewöhnlich auf Root/Container. Ein Reset auf 62,5 %
verschiebt 640 px auf 400 px. In `px` umrechnen, sofern der Root nicht
nachweislich dem Browserstandard entspricht.

## 16. Scrollbargrenze — **bedingt**

`100vw` enthält klassische Scrollbargutter. iframe misst die Content Box und
korrigiert dadurch meist den bekannten Horizontaloverflow; Fragment misst einen
Hostwrapper und tut dies nicht. Bedingung ist die Engine.

## 17. Regeln für `html` / `body` — **manuell**

iframe setzt die Querybox unter `body`, Fragment benennt Dokumentelemente in
`wf-html` / `wf-body` um. In beiden Fällen gehört das Ziel auf den eigenen Root:

```css
/* ✗ silently never matches */
@container wippy-surface (min-width: 640px) { body { display: flex } }

/* ✓ move it to your own root inside the surface */
@container wippy-surface (min-width: 640px) { #app { display: flex } }
```

## 18. `<picture><source media>` und `<link media>` — **nicht konvertierbar**

HTML-Ressourcenauswahl kennt keine Container Queries. Per
`host.surface.onChange` steuern oder Art Direction in CSS verlagern.

## 19. Geometrisches `matchMedia()` → `host.surface` — **automatisch**

```js
// before
const mq = matchMedia('(min-width: 640px)')
mq.addEventListener('change', render)

// after
import { host } from '@wippy-fe/proxy'

const off = host.surface.onChange(s => render(s.width >= 640))
render(host.surface.snapshot.width >= 640)
// call off() on teardown
```

Für Präferenzen bleibt `matchMedia` richtig.

## 20. Runtime-CSS, Adopted Stylesheets, CSS-in-JS — **manuell**

Bevorzugen Sie `@container`-Regeln. JS-Pixelwerte müssen bei jedem `onChange`
neu entstehen. Definieren oder registrieren Sie nie die vier reservierten
`--wippy-surface-*`-Namen; beides zerstört das Signal „Blockachse fehlt“.

## 21. Gebündeltes Drittanbieter-CSS — **manuell**

Bevorzugt konfiguriert die Bibliothek eine von `host.surface` gelieferte Breite,
alternativ wird sie in einen eigenen Container gehüllt. Letzter Ausweg ist
`wippy.renderEngine: "iframe"` mit bewusstem Fensterverhalten. Automatische
Buildscans sind noch nicht verfügbar.

## 22. Verschachtelte Container und `cq*`-Fallback — **manuell**

Einheiten lösen gegen den nächsten Container mit benötigter Achse auf:

```css
.card { container-type: inline-size; }   /* has NO block axis */
.card .thing { block-size: 25cqh; }      /* ✗ silently uses the small viewport */
```

`cqh`/`cqb` fallen ohne Blockachse auf den Small Viewport zurück. Verwenden Sie
für die Surface-Blockachse `var(--wippy-surface-height, <fallback>)`, das
rootgebunden ist und sichtbar fallbackt. Komponentenqueries sind additiv.

## Viewport-Einheiten

| Vorher | Ersatz | Hinweise |
|---|---|---|
| `100vw` | `var(--wippy-surface-width)` | Content Box; siehe Rezept 16 |
| `1vw` / `37vw` | `calc(var(--wippy-surface-width-unit) * 37)` oder `37cqw` | Einheit ist 1 % |
| `100vh` | `var(--wippy-surface-height)` | nur Container-Sizing |
| `1vh` / `37vh` | `calc(var(--wippy-surface-height-unit) * 37)` | nur Container-Sizing |
| `vmin` | `min(var(--wippy-surface-width), var(--wippy-surface-height))` | beide Achsen nötig |
| `vmax` | `max(var(--wippy-surface-width), var(--wippy-surface-height))` | beide Achsen nötig |
| `vi` / `vb` | `cqi` / `cqb` oder physische Variablen | Surface-Variablen sind physisch |
| `sv*` / `lv*` / `dv*` | `var(--wippy-surface-*)` | keine getrennten Äquivalente |

`sv*`/`lv*` sind Browser-Viewport-Einheiten, nicht „surface“.

```css
/* before */ block-size: calc(100vh - 4rem);
/* after  */ block-size: calc(var(--wippy-surface-height, 400px) - 4rem);
```

Ein fixer, sichtbar falscher Fallback ist besser als `100vh`, das den alten
Fehler verbirgt. `min()`/`max()`/`clamp()` bleiben strukturell gleich.

Soll ein Element seinen Elternknoten füllen, verwenden Sie `100%` oder
`w-full`; Surface-Werte nur für die Seitenfläche selbst.

```css
/* ✗ */ inline-size: var(--wippy-surface-width, 100vw);
```

Dieser Fallback verbirgt den fehlenden Vertrag und ist verboten.

## Overlays

`position: fixed` wird nicht vom Oberflächenvertrag gebunden. Die Positionierung
braucht keine Migration, die Größe schon: Ein surfacefüllendes Overlay nutzt
`inset: 0`, nicht `vw`/`vh` oder die bei Content-Sizing fehlende Höhenvariable.
Für beide Engines: `absolute` in einem eigenen `relative` App-Root. `fixed` ist
nur in iframe panelbezogen; in Fragment bezieht es sich auf das Hostfenster.
Hostvermittelte Overlay-Platzierung und Scrollhilfen sind noch nicht verfügbar.

## Checkliste

1. Jede Regel als Seite, Komponente, Präferenz oder bewusstes Fensterverhalten klassifizieren.
2. Seitengeometrie nach `@container wippy-surface` konvertieren.
3. Viewport-Einheiten ersetzen.
4. `html`/`body`-Ziele auf den eigenen Root verschieben.
5. `em`-Breakpoints erneut prüfen.
6. Bei Blockachsenabhängigkeit `requirements` deklarieren.
7. In beiden Engines und beiden Sizing-Modi testen; Modus aus `host.surface.snapshot.sizing` lesen und Blockachse über `supports('block-size')` absichern.
