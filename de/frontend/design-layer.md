---
title: "Die Design-Schicht"
description: "Theme, gemeinsame Design-Schicht, modul-lokal — was wohin gehört, wenn mehrere Module dasselbe brauchen und das Theme keinen Platz dafür hat, mit ausgearbeiteten guten und schlechten Beispielen."
---

# Die Design-Schicht

Ein Wippy-Frontend besteht aus vielen unabhängig veröffentlichten Modulen, die
in eine einzige Anwendung rendern. Zwei Orte sind offensichtlich: das **Theme**,
das jede Surface konsumiert, und das **Modul**, das sich selbst gehört. Die
Lücke dazwischen ist nicht offensichtlich, und dort sammelt sich Duplikation an
— eine Idee, die mehrere Module tatsächlich teilen, für die das Theme aber
keine Komponente hat.

Diese Seite benennt die drei Schichten, gibt einen Test für die Wahl zwischen
ihnen und zeigt, wie jede Wahl aussieht, wenn sie gelingt und wenn sie
misslingt.

## Die Schichten

| Schicht | Erreicht | Besitzt |
|---|---|---|
| **Theme** | *Jede* Surface, auch Module, die Ihnen nicht gehören | PrimeVue-Komponenten, die gemeinsamen semantischen Tokens, dokumentierte Klassen |
| **Gemeinsame Design-Schicht** | Nur die Module, die sich dafür entscheiden | Vokabular, das diese Module teilen und hinter dem keine Theme-Komponente steht |
| **Modul** | Sich selbst | Was wirklich spezifisch für eine Surface ist |

### Das Theme ist universell, und genau das ist die Einschränkung

Das Theme gestaltet Markup, **das Ihnen nicht gehört**. Jedes Modul — auch ein
Drittanbieter-Plugin, geschrieben von jemandem, der Ihre App nie gesehen hat —
rendert in denselben Host und wird vom selben Theme gestaltet. Das macht das
Theme zur universellen Schicht, und das schneidet in beide Richtungen:

**Nichts App-Spezifisches darf ins Theme**, denn es würde jedem Modul
aufgezwungen, das nie danach gefragt hat.

**Ein Modul darf sich nicht darauf verlassen, dass etwas App-Spezifisches im
Theme liegt.** Der Vertrag lautet *PrimeVue-Komponenten + die gemeinsamen
semantischen Wippy-Tokens + dokumentierte Klassen* — nichts, was eine Anwendung
obendrauf gelegt hat. Beachten Sie: Auch PrimeVues eigene Presets sind nicht
der Vertrag. Wippy betreibt PrimeVue mit `theme: 'none'`, also sind es die
semantischen Wippy-Tokens, auf die Sie sich stützen.

```css
/* GUT — gemeinsame semantische Wippy-Tokens, für jedes Modul vorhanden */
.my-panel {
  color: var(--p-text-color);
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
}

/* SCHLECHT — ein anwendungsspezifisches Token. Ihr Modul funktioniert jetzt
   nur noch innerhalb einer App und verliert die Deklaration anderswo
   stillschweigend: eine undefinierte Custom Property macht die Deklaration
   zum Zeitpunkt der Wertberechnung ungültig, sie fällt weg und das Element
   erbt still stattdessen. */
.my-panel { background: var(--kx-surface-2); }
```

Das ist zugleich die Antwort auf *"kann ich unser gemeinsames Vokabular in die
Facade legen?"* Nur wenn es tatsächlich beliebiges, fremdes Markup erreichen
muss. Ist es auf *Ihre* Menge von Modulen beschränkt, gehört es nicht ins Theme
— es gehört in die Schicht darunter.

### Das Rückgrat, und wann eine Komponente aussteigen darf

PrimeVue und Tailwind, so wie sie der Host ausliefert, sind das empfohlene
Rückgrat für jede Komponente. Eine Komponente **darf** aussteigen — aber der
Ausstieg verengt sich in dem Moment, in dem sie etwas Konventionelles rendert,
und die Leiter geht nur in eine Richtung:

| Die Komponente… | Dann muss sie laden |
|---|---|
| ist darstellungsneutral — Canvas, SVG, ein Chart ohne Bedienelemente, ohne Tokens, ohne Utilities, ohne Scrollen | nichts: `hostCssKeys: []` |
| konsumiert semantische Tokens oder Dark Mode | `themeConfigUrl` |
| kann scrollen | `iframeCssUrl` |
| rendert Markdown | `markdownCssUrl` |
| rendert irgendetwas, das **Tailwind** ausdrücken kann | Tailwind — schreiben Sie Utilities, kein handgeschriebenes CSS |
| rendert irgendetwas, wofür **PrimeVue** eine Komponente ausliefert — Button, Input, Formular, Tabelle, Dialog, Menü, Tag, Tooltip, jedes Feedback-Element | `primeVueCssUrl` **und** `PrimeVuePlugin` |

Ein Chart auf einem Canvas ist der archetypische legitime Ausstieg: Es hat keine
klassische UI und braucht daher nichts vom Rückgrat. Geben Sie demselben Chart
eine Toolbar, und es ist nicht mehr darstellungsneutral — der Button ist ein
PrimeVue-Button, und die gesamte Integration kommt mit.

Beachten Sie die Kopplung: **Tailwind-Utilities werden mit `primeVueCssUrl`
ausgeliefert.** Es gibt keinen separaten Tailwind-Host-CSS-Key, in der Praxis
lädt eine Komponente, die Tailwind braucht, also auch das PrimeVue-Asset.
(`preflightCssUrl` ist nicht Teil der Key-Union; wird Tailwind-Preflight
innerhalb des Shadow Roots wirklich benötigt, laden Sie es imperativ — selten
nötig.)

Die praktische Konsequenz für diese Seite: **Das meiste, was ein Modul will,
existiert bereits im Rückgrat.** Die gemeinsame Design-Schicht ist ein schmales
Band darüber, kein Ort, um nachzubauen, was PrimeVue und Tailwind bereits
abdecken. Siehe [CSS Injection](./web-host/css-injection.md) für die Mechanik.

### Die gemeinsame Design-Schicht

Manche Ideen wiederholen sich über eine bekannte Menge von Modulen hinweg und
haben keine Komponente im Theme: eine Content-Card, eine Kopfzeile für eine
Surface, das, was eine Surface zeigt, wenn sie nichts hat, die Größen, in denen
ein Tag kommt. Real, geteilt und heimatlos.

Sie werden als **veröffentlichtes Package** ausgeliefert und zur Build-Zeit in
jeden Konsumenten materialisiert. Es muss ein Package sein und kein Pfad-Alias,
denn Konsumenten leben in verschiedenen Repositories — der falsifizierbare Test
für diese Schicht lautet: Ein Modul in einem *anderen Repo*, ohne Pfadzugriff
auf den Produzenten, konsumiert das Vokabular und baut.

Das produzierende Modul deklariert das Package als **Build-Zeit-Artefakt**, und
jeder Konsument materialisiert es in seinen eigenen Baum. Siehe
[Build-time Artifacts](../guides/artifacts.md) für die Deklaration, das Format
`node-package`, was die Runtime für Sie abgleicht und welchen Kitt ein Build
weiterhin selbst liefern muss.

### Das Modul

Alles Übrige, plus jede bewusste Abweichung vom gemeinsamen Vokabular.

## Entscheiden, wohin etwas gehört

Fragen Sie der Reihe nach. Das erste Ja gewinnt.

1. **Ist es ein Wert?** Farbe, Radius, Abstand, Elevation, Severity.
   → **Theme.** Lesen Sie ein semantisches Token. Niemals ein Literal.
2. **Liefert das Theme bereits eine Komponente dafür?** Button, Dialog,
   Select, Tag. → **Theme.** Verwenden Sie die Komponente. Gestalten Sie sie,
   indem Sie eine Klasse *auf* sie setzen — bauen Sie sie niemals nach.
3. **Brauchen zwei oder mehr Ihrer Module dasselbe Konzept, ohne dass eine
   Theme-Komponente dahintersteht?** → **Gemeinsame Design-Schicht.**
4. Andernfalls → **Modul.**

Frage 2 ist die, über die Leute stolpern, und dahinter steckt eine scharfe
Regel.

## Ausgearbeitete Beispiele

Die folgenden Beispiele stammen aus Kickside, einer Wippy-Anwendung, deren
Modul-CSS zu 15,4 % aus exakten Klon-Duplikaten bestand, bevor diese Schicht
entstand.

### Bauen Sie niemals eine Theme-Komponente nach

PrimeVue liefert `Button`. Neun Kickside-Module verzichteten darauf und bauten
`.kx-btn` auf einem nativen `<button>` von Hand; sieben andere Module nutzten
die Komponente. Beide Dialekte waren lokal vernünftig — es gab schlicht keinen
gemeinsamen Ort für einen Button, also erfand die halbe App einen. Aneinander
gemessen stimmten sie in font-size und line-height überein und sonst in nichts.

**Schlecht:** ein natives `button`-Element mit `.kx-btn .kx-btn-primary` — eine
zweite Implementierung einer Komponente, die das Theme bereits liefert.
(Hier absichtlich als Selektor geschrieben: Das Dokumentations-Gate weist native
Produkt-Controls in Beispielcode zurück, das ist dieselbe Regel eine Schicht
höher durchgesetzt.)

**Gut:** die Theme-Komponente, mit einer Klasse darauf, wenn Sie sie anpassen
müssen.

```vue
<Button label="Save" class="kx-save" />
```

Wenn die Theme-Komponente nicht passt, ist das keine Lizenz, sie nachzubauen.
Setzen Sie eine Klasse auf die Komponente und gestalten Sie diese Klasse — in
der Facade, wenn die Anpassung app-weit gilt, im Modul, wenn sie lokal ist.
Kicksides Modul `knowledge` trägt weiterhin `.kn-btn` / `.kn-primary` auf
nativen Buttons; das ist eine ausstehende Migration, kein Muster zum Nachahmen.

### Severity gehört dem Theme, nicht Ihnen

Severity — `success`, `danger`, `warn`, `info` — ist Theme-Semantik mit
veröffentlichten Farbverläufen. Kickside leitete sie **sechzehnmal über vier
Namensschemata hinweg** neu ab (`tone-gn`, `t-ok`, `kx-tone-success`,
`tone-success`). Derselbe Klassenname bedeutete in drei Modulen drei
verschiedene Farben, sodass die Veröffentlichung einer einzigen Definition die
anderen stillschweigend umgefärbt hätte.

```css
/* SCHLECHT — Severity unter einem modul-lokalen Namen neu abgeleitet */
.tone-gn { color: #16a34a; }

/* GUT — Severity aus dem Theme */
.status-dot.success { background: var(--p-success-500); }
```

Ein *Tone* darf durchaus in der gemeinsamen Schicht existieren — aber nur als
**dekorative Kategoriefarbe**, niemals als Severity. Wenn es "das ist
fehlgeschlagen" bedeuten kann, ist es Severity und gehört dem Theme.

### Gemeinsames Vokabular, für das das Theme keinen Platz hat

```css
/* GUT — PrimeVue liefert keine Card, keinen Surface-Header, keinen EmptyState.
   Diese wiederholen sich über Module hinweg, ohne dass etwas aus dem Theme
   dahintersteht, also sind sie genau das, wofür die gemeinsame Schicht da
   ist. */
@import "@kickside/ui-kit/kx-card.css";
@import "@kickside/ui-kit/kx-state.css";
```

### Übernehmen heißt importieren *und löschen*

Ein CSS-`@import` muss jeder anderen Regel in einem Stylesheet vorangehen. Das
gemeinsame Stylesheet landet daher immer **zuerst**, und alles, was das Modul
danach deklariert, schlägt es bei gleicher Spezifität. Ein Modul, das das
Package importiert und seine eigene Kopie behält, hat überhaupt nichts
verändert.

```css
/* SCHLECHT — der Import ist wirkungslos; die lokale Kopie gewinnt weiterhin */
@import "@kickside/ui-kit/kx-card.css";
.kx-card { border-radius: 14px; border: 1px solid var(--p-content-border-color); }

/* GUT — importieren, die lokale Kopie löschen, nur ein dokumentiertes Delta
   behalten */
@import "@kickside/ui-kit/kx-card.css";
/* Die Cards dieser Surface stehen inline in einer dichten Liste, sie
   verlieren daher den Lift. */
.kx-card:hover { transform: none; }
```

Behalten Sie **nur das Delta** — wiederholen Sie niemals den ganzen Rumpf. Und
falten Sie niemals zwei Absichten in einen Namen: Wenn ein Klassenname in zwei
Modulen Verschiedenes bedeutet, sind das zwei Konzepte unter einem Namen.
Trennen Sie den Namen; küren Sie keinen Sieger und färben Sie den Verlierer
nicht um.

### Spezifität gegen das Theme

Das CSS des Moduls wird zuerst in den Shadow Root injiziert; das
PrimeVue-Stylesheet des Themes wird danach angehängt. Beide sind
`<style>`-Elemente, also **entscheidet die Dokumentreihenfolge, und das Theme
steht an zweiter Stelle**. Eine Modulregel, die eine Klasse einer
Theme-Komponente schlagen muss, braucht mehr *Spezifität* — nicht eine spätere
Zeile in der Datei. (`adoptedStyleSheets` trägt das eigene CSS der Facade, nicht
das Theme, der Griff zu einem adoptierten Stylesheet gewinnt hier also auch
nicht.)

Am stärksten trifft das Pass-Through-Klassen, bei denen Ihre Klasse *auf* einem
Theme-Element landet:

```css
/* SCHLECHT — diese Klasse wird auf PrimeVues eigenem Footer-Element
   angewendet, bei gleicher Spezifität gewinnt also das Theme und das Padding
   greift nie. */
.kx-modal-foot { padding: 14px 18px; }

/* GUT — unter dem Dialog-Root verschachtelt, schlägt damit das Theme in der
   Spezifität */
.kx-modal > .kx-modal-foot { padding: 14px 18px; }
```

## Was die gemeinsame Schicht enthalten darf

Alles, was eine Menge von Modulen tatsächlich teilt und das Theme nicht besitzt:
CSS-Vokabular, abgeleitete Tokens, interne Komponenten, Helfer,
Test-Harness. Die Duplikation ist von derselben Art — Kickside hatte neunzehn
Kopien eines einzigen Test-Bootstraps neben seinem geklonten CSS.

**Liefern Sie es in semantischen Einheiten aus.** Jede Einheit sollte ein
benanntes Konzept sein, über das ein Konsument nachdenken kann — `kx-card`,
`kx-state`, `kx-tag`. Bevorzugen Sie feiner granulierte Packages, damit ein
Konsument nur nimmt, was er braucht; ein einzelnes Package, das mehrere klar
benannte Einheiten ausliefert, ist praktikabel, aber nicht die anzustrebende
Form.

**Niemals ein Sammelbecken.** Kein `common`, kein `shared`, kein `misc`, kein
`utils`. Eine Einheit, deren Name nicht sagt, was darin steckt, wird alles
ansammeln, was sonst nirgendwo hinpasste, und Sie haben das Problem
nachgebaut, für dessen Lösung diese Schicht existiert.

## Vereinheitlichen ist eine visuelle Änderung

Das Zusammenführen auseinandergedrifteter Kopien verschiebt Pixel. Kickside
hatte einen Selektor mit **neunzehn Definitionen in siebzehn unterschiedlichen
Rümpfen**. Vergleichen Sie jeden Rumpf, wählen Sie den Kanon, halten Sie fest,
warum Sie ihn gewählt haben, behalten Sie bewusste Abweichung als dokumentiertes
Override — und sehen Sie sich das Ergebnis an. Unit-Tests können kein Layout
sehen.

## Verwandt

- [Theming](./micro-frontends/theming.md) — der Token-Katalog und wie das Theme
  sowohl Host als auch Children erreicht
- [Compliance-Checkliste](./micro-frontends/compliance-checklist.md) — die
  Regeln pro Modul, gegen die ein Frontend geprüft wird
- [Build-time Artifacts](../guides/artifacts.md) — das Package deklarieren und
  in einen Konsumenten materialisieren
- [Dependency Management](../guides/dependency-management.md) — deklarieren und
  auflösen, was ein Modul konsumiert
