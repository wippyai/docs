---
title: "Migration von Oberflächen"
description: "Rezepte zum Umstellen viewportbasierter responsiver Regeln auf den Wippy-Oberflächenvertrag."
---

# Migration von Oberflächen

**Klassifizierung: Sammlung partieller Migrationsrezepte.** Jeder Vorher-/Nachher-
Block konvertiert ein isoliertes Muster. Wenden Sie den Entscheidungsbaum auf
das gesamte Stylesheet an und prüfen Sie danach beide Engines und Sizing-Modi.

Die Rezepte stellen eine vorhandene Micro-Frontend-Anwendung von
viewportbasierter Responsivität auf den
[Oberflächenvertrag](./surface-portability.md) um.

Jedes Rezept trägt ein Label:

| Label | Bedeutung |
|---|---|
| **automatisch** | Mechanisch. Die konvertierte Regel hat dieselbe Bedeutung. |
| **bedingt** | Nur sicher, wenn eine genannte Vorbedingung erfüllt ist. Prüfen Sie sie. |
| **manuell** | Eine menschliche Entscheidung ist nötig; es gibt keine einzige richtige Umstellung. |
| **nicht konvertierbar** | Es gibt keine Container-Query-Form. Verwenden Sie `host.surface` oder behalten Sie das Viewportverhalten bewusst bei. |

Jedes folgende Rezept zeigt eine Technik isoliert. Das Web-Host-Repository
enthält eine ausführbare Seite, die sie kombiniert und von seiner Testsuite
abgedeckt wird.

> Rezepte, die von noch nicht ausgelieferten Funktionen abhängen — Tailwind-`surface-*`-Varianten, Builddiagnostik, hostvermitteltes Scrollen oder Hit-Testing — sind als **noch nicht ausgeliefert** gekennzeichnet und beschreiben ausschließlich den heutigen Stand.

---

## Entscheidungsbaum: Worauf bezieht sich diese Regel?

Klassifizieren Sie vor jeder Konvertierung die Absicht. Eine mechanisch
korrekte Umstellung bleibt falsch, wenn sich die ursprüngliche Regel nicht auf
die Oberfläche bezog.

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

Wenn die Absicht unklar ist, lassen Sie die Regel stehen und prüfen Sie sie
später erneut. Eine nicht konvertierte Media Query ist lediglich nicht
portabel; eine falsch konvertierte Regel ist unbemerkt defekt.

---

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

Die Bereichssyntax wird von allen Engines unterstützt, die der
Oberflächenvertrag adressiert. Falls bevorzugt, funktioniert auch die
`and`-Form.

## 4. Mehrere Breakpoints mit erhaltener Kaskadenreihenfolge — **automatisch**

Container Queries ändern weder Spezifität noch Reihenfolge. Behalten Sie die Quellreihenfolge:

```css
@container wippy-surface (min-width: 480px)  { .grid { grid-template-columns: repeat(2, 1fr) } }
@container wippy-surface (min-width: 900px)  { .grid { grid-template-columns: repeat(4, 1fr) } }
```

## 5. Höhenabfragen — **bedingt** (nur Container-Sizing)

```css
/* after */ @container wippy-surface (min-height: 500px) { .tall-only { display: block } }
```

Vorbedingung: Die Seite verwendet **Container-Sizing**. Bei Content-Sizing ist
die Höhe der Seite ihr eigener Inhalt, sodass Höhenabfragen niemals matchen.
Deklarieren Sie die Abhängigkeit, damit ein falscher Renderort sichtbar
abgelehnt wird, statt unbemerkt fehlerhaft zu rendern:

```json
{ "wippy": { "surface": { "contract": 1, "requirements": ["block-size"] } } }
```

## 6. Seitenverhältnis — **bedingt** (nur Container-Sizing)

```css
/* before */ @media (min-aspect-ratio: 16/9)                     { … }
/* after  */ @container wippy-surface (min-aspect-ratio: 16/9)   { … }
```

Es gilt dieselbe Vorbedingung wie in Rezept 5: Das Seitenverhältnis benötigt
beide Achsen.

## 7. Orientierung — **bedingt** (nur Container-Sizing)

`@container wippy-surface (orientation: landscape)` beschreibt die Form
**Ihres Panels**, was meist die eigentliche Absicht ist. War tatsächlich das
Gerät gemeint, handelt es sich um eine Media Query — belassen Sie sie (Rezept
13).

## 8. Höhe/Verhältnis/Orientierung bei Content-Sizing — **nicht konvertierbar**

Es gibt keine abfragbare Blockachse. Strukturieren Sie das Layout so um, dass
es von der Inline-Achse abhängt. Simulieren Sie die Höhe nicht mit `cqh` — siehe
Rezept 22.

Die App kann sich nicht selbst auf Container-Sizing umstellen: Der Web Host
legt den Modus durch den Renderort fest, nicht durch eine Angabe im Paket. Wenn
das Layout ohne Blockachse wirklich nicht funktioniert, deklarieren Sie
`requirements: ["block-size"]`. Dann wird eine Content-Sizing-Platzierung
vollständig abgelehnt, statt falsch zu rendern. Lassen Sie die App in einem
Container-Sizing-Kontext rendern, etwa auf einer eigenen Route oder in einem
Layoutpanel. Siehe „Container-Sizing und Content-Sizing“ unter
[Portabilität von Oberflächen](./surface-portability.md).

## 9. Geometrie in einer Umwelt-Media-Query — **manuell**

```css
/* before */
@media (prefers-color-scheme: dark) and (min-width: 640px) { .panel { … } }

/* after — split: the preference stays, the geometry moves */
@media (prefers-color-scheme: dark) {
  @container wippy-surface (min-width: 640px) { .panel { … } }
}
```

Dies ist manuell, weil die Verschachtelungsreihenfolge ändern kann, welche
Deklarationen gewinnen, wenn beide Bedingungen zuvor in einem Prelude
kombiniert waren. Prüfen Sie das Ergebnis erneut.

## 10. Komma-OR — **manuell**

```css
/* before */ @media (max-width: 480px), (min-width: 1200px) { … }
```

Ein Komma bedeutet OR. Eine Aufteilung in zwei `@container`-Blöcke erhält OR
**nur, wenn beide Blöcke ansonsten identisch und benachbart sind**. Werden sie
versehentlich verschachtelt, wird OR zu AND und nichts matcht. Duplizieren Sie
die Deklarationen in zwei gleichrangige Blöcke:

```css
@container wippy-surface (max-width: 480px)  { … }
@container wippy-surface (min-width: 1200px) { … }
```

## 11. `not`, `only`, komplexe Boolesche Ausdrücke — **manuell**

`only` ist ein Artefakt von Medientypen und besitzt kein Container-Äquivalent —
lassen Sie es weg. `not` invertiert in beiden Syntaxen die Gesamtbedingung; bei
einer Kombination aus `and`/`or` gelten jedoch andere Präzedenzregeln. Setzen
Sie Klammern ausdrücklich, statt der ursprünglichen Gruppierung zu vertrauen.

## 12. `screen` / `print` mit Geometrie — **manuell**

Medientypen haben keine Containerform. Behalten Sie den Typ als Media Query und
verschachteln Sie die Geometrie darin, wie in Rezept 9. Insbesondere ein
Printlayout sollte meist vollständig viewport- beziehungsweise seitenbasiert
bleiben.

## 13. Präferenzen bleiben Media Queries — **nicht konvertierbar**

`prefers-color-scheme`, `prefers-contrast`, `prefers-reduced-motion`,
`forced-colors`, `hover`, `pointer`, `any-pointer` bleiben unverändert.
`@container` unterstützt nur Größenmerkmale. Eine Konvertierung dieser
Präferenzen erzeugt eine Regel, die niemals matcht.

## 14. `em`-Breakpoints — **manuell**

`@media (min-width: 40em)` wertet `em` gegen die initiale Schriftgröße aus.
`@container wippy-surface (min-width: 40em)` wertet es gegen die Schriftgröße
des **Containers** aus. Unterscheiden sich beide, verschiebt sich der Breakpoint
unbemerkt. Rechnen Sie in `px` um oder prüfen Sie zuerst den berechneten
`font-size` des Containers.

## 15. `rem`-Breakpoints — **manuell**

`rem` ist innerhalb von `@media` **nicht** rootrelativ. Media-Query-Bedingungen
werten sowohl `em` als auch `rem` gegen die *initiale* Schriftgröße aus, also
den Browserstandard unabhängig von Autoren-CSS. `@container` wertet sie dagegen
auf gewöhnliche Weise gegen die tatsächliche berechnete Root-/Container-
Schriftgröße aus.

Sobald die Root-Schriftgröße vom Browserstandard abweicht, sind beide Werte
bereits ungleich, ohne dass zur Laufzeit etwas geändert wird. Schon der übliche
Reset `html { font-size:
62.5% }` verschiebt einen konvertierten Breakpoint von 640 px auf 400 px.

„Die Root-Schriftgröße ändert sich nicht“ ist deshalb **keine** ausreichende
Vorbedingung. Rechnen Sie in `px` um, ebenso wie bei `em` (Rezept 14), sofern die
berechnete Root-Schriftgröße nicht nachweislich dem Browserstandard entspricht.

## 16. Scrollbargrenze — **bedingt**

`100vw` enthält die klassische Scrollbar-Rinne. In der **iframe-Engine** ist die
Oberflächenbreite die **Content Box** der Querybox im App-Dokument und enthält
sie deshalb nicht. Bei einer Seite mit Dokument-Scrollbar ist der konvertierte
Wert um deren Breite kleiner; meistens ist das die beabsichtigte Korrektur, denn
Horizontaloverflow durch `100vw` ist ein klassischer Fehler.

Die **Fragment-Engine** misst einen Wrapper im Hostdokument, den das Scrollen
des Inhalts nicht verengt, und nimmt diese Korrektur daher nicht vor. Dasselbe
Panel mit demselben scrollenden Inhalt liefert je nach Engine eine um die
Scrollbarbreite unterschiedliche Breite. Vorbedingung dieses Rezepts ist somit
die verwendete Engine, nicht nur pixelgenaue Ausrichtung.

## 17. Regeln für `html` / `body` — **manuell**

Eine Container Query kann ihren eigenen Container nicht stylen. Eine Regel für
`html` oder `body` scheitert daher in beiden Engines — aus unterschiedlichen
Gründen:

- **iframe-Engine:** Der Host legt die Surface-Box um den Body-Inhalt; `html`
  und `body` sind Vorfahren des Querycontainers. Eine `@container`-Regel kann
  keinen Vorfahren erreichen.
- **Fragment-Engine:** Hier liegt die Querybox über dem Inhalt. Ein wörtlicher
  `body`-Selektor scheitert trotzdem, weil das reflektierte Dokument in
  `wf-html` / `wf-body` umbenannt wird.

Die engine-sichere Lösung ist in beiden Fällen gleich: Verschieben Sie die
Regel auf Ihren eigenen Root innerhalb der Oberfläche.

```css
/* ✗ silently never matches */
@container wippy-surface (min-width: 640px) { body { display: flex } }

/* ✓ move it to your own root inside the surface */
@container wippy-surface (min-width: 640px) { #app { display: flex } }
```

## 18. `<picture><source media>` und `<link media>` — **nicht konvertierbar**

HTML-Ressourcenauswahl kennt keine Container Queries. Per
`host.surface.onChange` steuern oder Art Direction in CSS verlagern, etwa als
`background-image` unter einer `@container`-Regel.

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

Für Präferenzabfragen bleibt `matchMedia` richtig — nur Geometrie ist hier
falsch.

## 20. Runtime-CSS, Adopted Stylesheets, CSS-in-JS — **manuell**

Bevorzugen Sie ausgegebene `@container wippy-surface (...)`-Regeln und lassen
Sie CSS reagieren. Wenn Sie Pixelwerte in JavaScript berechnen, erzeugen Sie
sie bei `onChange` neu: Ein einmal aus `snapshot` gelesener Wert bleibt
eingefroren und läuft beim nächsten Resize auseinander.

Geben Sie niemals selbst die vier reservierten `--wippy-surface-*`-Namen aus,
und registrieren Sie sie weder mit `@property` noch mit
`CSS.registerProperty()`. Eine Registrierung zerstört das Hostsignal
„Blockachse nicht verfügbar“, sodass sich eine Content-Sizing-App unbemerkt als
Container-Sizing meldet. Eine Deklaration auf einem Nachfahren überschreibt den
geerbten Wert und löst die Seite von der Oberfläche.

## 21. Gebündeltes Drittanbieter-CSS — **manuell**

Solche Styles lassen sich meist nicht bearbeiten. Bevorzugt konfigurieren Sie
die Bibliothek mit einem Breakpoint oder einer Breite aus `host.surface`.
Alternativ hüllen Sie sie in einen eigenen Container und übersetzen dort. Als
letzten Ausweg pinnen Sie die Seite an die iframe-Engine
(`wippy.renderEngine: "iframe"`) und akzeptieren bewusst fensterbasiertes
Verhalten. Buildzeitliches Scannen nach solchen Regeln ist **noch nicht
verfügbar**.

## 22. Verschachtelte Container und `cq*`-Fallback — **manuell**

Einheiten lösen gegen den nächsten Container mit benötigter Achse auf:

```css
.card { container-type: inline-size; }   /* has NO block axis */
.card .thing { block-size: 25cqh; }      /* ✗ silently uses the small viewport */
```

`cqh`/`cqb` erzeugen keinen Fehler, wenn kein Blockachsencontainer gefunden
wird. Sie fallen auf den Small Viewport zurück und liefern einen plausiblen,
aber falschen Wert. Verwenden Sie für die Surface-Blockachse
`var(--wippy-surface-height, <fallback>)`: Der Wert ist am Root gebunden, kann
nicht von einem näheren Container abgefangen werden und fällt sichtbar zurück,
wenn die Achse fehlt.

Komponentenqueries sind additiv und kein Ersatz: Auch aus einem verschachtelten
Container heraus bezeichnet `wippy-surface` weiterhin die Fläche der Seite.

---

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
| `sv*` / `lv*` / `dv*` | `var(--wippy-surface-*)` | **keine getrennten Äquivalente.** Diese Einheiten beschreiben Zustände der Browser-Chrome, die ein Panel nicht besitzt; die Oberfläche hat genau eine Größe |

`sv*`/`lv*` sind Browser-Viewport-Einheiten, nicht „surface“.

### Berechnungen

```css
/* before */ block-size: calc(100vh - 4rem);
/* after  */ block-size: calc(var(--wippy-surface-height, 400px) - 4rem);
```

Der Fallback ist absichtlich fest und offensichtlich falsch statt `100vh` —
siehe „Fehlenden Vertrag nicht hinter einem Fallback verbergen“. Auf der
Blockachse ist das besonders wichtig: Die Höhe ist bei **jeder** Content-Sizing-
Platzierung ungültig, nicht nur bei fehlendem Vertrag. Ein `100vh`-Fallback
rendert daher beim ersten Embed unbemerkt die Fensterhöhe.

`min()`/`max()`/`clamp()` werden unverändert konvertiert; ersetzen Sie die darin
verwendeten Einheiten.

### Wann `100%` besser als ein Surface-Wert ist

Soll ein Element seinen **Elternknoten** füllen, verwenden Sie `100%` oder
`w-full`. Greifen Sie nur dann zu `--wippy-surface-width`, wenn Sie ausdrücklich
die Seitenfläche benötigen, typischerweise um aus einem schmaleren Vorfahren
auszubrechen. Etwas am Root zu binden, das elternrelativ sein sollte, erzeugt
Layouts, die nur bei genau einer Verschachtelungstiefe stimmen.

### Fehlenden Vertrag nicht hinter einem Fallback verbergen

```css
/* ✗ */ inline-size: var(--wippy-surface-width, 100vw);
```

Dieser Fallback rendert bei fehlendem Vertrag die Fensterbreite — genau den
Fehler, den der Vertrag verhindern soll — und macht ihn unsichtbar. Lassen Sie
die Deklaration sichtbar fehlschlagen oder wählen Sie einen festen,
offensichtlich falschen Fallback (`400px`), damit der Fehler auffällt.

---

## Overlays

Der Oberflächenvertrag erfasst `position: fixed` **nicht**. `container-type`
erzeugt einen unabhängigen Formatierungskontext ohne Layout-Containment; ein
Querycontainer berechnet daher `contain: none` und verankert nichts. PrimeVue-
Overlays und selbst implementierte Fixed-Overlays funktionieren unverändert,
die **Positionierung benötigt also keine Migration**.

Ihre *Größe* benötigt sie. Ein Overlay, das die Oberfläche abdecken soll,
verwendet `inset: 0` statt `100vw`/`100vh`, die im Multi-Panel-Host das
Browserfenster messen und überstehen. Verwenden Sie auch nicht
`var(--wippy-surface-height)`, das bei Content-Sizing fehlt. Kombinieren Sie
`inset: 0` für beide Engines mit `position: absolute` und einem eigenen App-Root, der
`position: relative` besitzt. `position: fixed` ist nur in der iframe-Engine
richtig, wie der folgende Absatz erklärt.

Zu beachten ist die Engine, nicht der Vertrag: In der Web-Fragment-Engine löst
`position: fixed` gegen das **Hostfenster** auf, nicht gegen Ihr Panel. Siehe
[Render-Engines](../web-host/render-engines.md) und pinnen Sie die App bei Bedarf
mit `wippy.renderEngine: "iframe"`.

Hostvermittelte Overlay-Platzierung und Scrollhilfen über `host.surface` sind
**noch nicht verfügbar**.

---

## Checkliste

1. Jede Regel als Seite, Komponente, Präferenz oder bewusstes Fensterverhalten klassifizieren.
2. Seitengeometrie nach `@container wippy-surface` konvertieren.
3. Viewport-Einheiten ersetzen.
4. `html`/`body`-Ziele auf den eigenen Root verschieben.
5. `em`-Breakpoints erneut prüfen.
6. Bei Blockachsenabhängigkeit `requirements` deklarieren.
7. Die Seite in beiden Engines **und beiden Sizing-Modi** testen — Container
   und Content sind das, was diese Migration tatsächlich aktiviert. Eine App
   ist Content-Sizing, sobald sie eingebettet statt geroutet wird. Den Modus aus
   `host.surface.snapshot.sizing` lesen und Blockachsenverhalten über
   `host.surface.supports('block-size')` absichern.
