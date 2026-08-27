---
title: "Die Designschicht"
description: "Wie Frontend-Styles und -Komponenten im Theme, einem gemeinsamen Designpaket oder einem einzelnen Modul platziert werden."
---

# Die Designschicht

Diese Seite ist ein Entscheidungsleitfaden für Designverantwortung. Ihre CSS- und Komponentenausschnitte sind unvollständige Muster, die ein vorhandenes Wippy-Frontend-Paket und einen Build voraussetzen.

Ein Wippy-Frontend kann viele unabhängig veröffentlichte Module in einer Anwendung enthalten. Das **Theme** erreicht jede Oberfläche, während jedes **Modul** seine lokale Darstellung verwaltet. Eine **gemeinsame Designschicht** deckt den engeren Fall ab, in dem mehrere Module ein Konzept teilen, das das Theme nicht bereitstellt.

## Die Schichten

| Schicht | Erreicht | Verwaltet |
|---------|----------|-----------|
| **Theme** | *Jede* Oberfläche, auch nicht selbst verwaltete Module | PrimeVue-Komponenten, gemeinsame semantische Tokens, dokumentierte Klassen |
| **Gemeinsame Designschicht** | Nur Module, die sie übernehmen | Gemeinsames Vokabular dieser Module, hinter dem keine Theme-Komponente steht |
| **Modul** | Sich selbst | Was tatsächlich nur für eine Oberfläche gilt |

### Das Theme ist universell — und genau das ist die Einschränkung

Das Theme gestaltet Markup, das **Sie nicht verwalten**. Jedes Modul — auch ein Plugin eines Drittanbieters, dessen Autor Ihre Anwendung nie gesehen hat — rendert in denselben Host und wird vom selben Theme dargestellt. Dadurch ist das Theme die universelle Schicht, mit Folgen in beide Richtungen:

**Nichts Anwendungsspezifisches darf in das Theme**, weil es jedem Modul aufgezwungen würde, das es nie angefordert hat.

**Ein Modul darf nicht davon abhängen, dass etwas Anwendungsspezifisches im Theme liegt.** Der Vertrag lautet *PrimeVue-Komponenten + gemeinsame semantische Wippy-Tokens + dokumentierte Klassen* — ohne anwendungseigene Ergänzungen. Auch PrimeVues eigene Presets sind nicht der Vertrag: Wippy führt PrimeVue mit `theme: 'none'` aus; verlassen Sie sich daher auf Wippys semantische Tokens.

```css
/* GOOD — shared Wippy semantic tokens, present for every module */
.my-panel {
  color: var(--p-text-color);
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
}

/* BAD — an application-specific token. Your module now only works inside
   one app, and silently loses the declaration anywhere else: an undefined
   custom property makes the declaration invalid at computed-value time, so
   it drops and the element quietly inherits instead. */
.my-panel { background: var(--kx-surface-2); }
```

Dies beantwortet auch die Frage: *„Kann ich unser gemeinsames Vokabular in die Facade legen?“* Nur wenn es tatsächlich beliebiges, nicht selbst verwaltetes Markup erreichen muss. Ist es auf *Ihre* Modulmenge begrenzt, gehört es nicht in das Theme, sondern in die darunterliegende Schicht.

### Das Rückgrat und wann eine Komponente darauf verzichten darf

PrimeVue und Tailwind, wie vom Host ausgeliefert, sind das empfohlene Rückgrat jeder Komponente. Eine Komponente **darf** darauf verzichten — doch die Ausnahme wird enger, sobald sie etwas Konventionelles rendert, und die Leiter führt nur in eine Richtung:

| Die Komponente … | Dann muss sie laden |
|------------------|---------------------|
| ist darstellungsneutral — Canvas, SVG, Diagramm ohne Steuerelemente, Tokens, Utilities oder Scrolling | nichts: `hostCssKeys: []` |
| verwendet semantische Tokens oder Dark Mode | `themeConfigUrl` |
| kann scrollen | `iframeCssUrl` |
| rendert Markdown | `markdownCssUrl` |
| verwendet Tailwind-Utilities für gewöhnliches Layout oder Abstände | `primeVueCssUrl` (der Host bündelt Tailwind mit diesem Asset) |
| rendert etwas, für das **PrimeVue** eine Komponente liefert — Button, Eingabefeld, Formular, Tabelle, Dialog, Menü, Tag, Tooltip oder ein anderes Feedback-Steuerelement | `primeVueCssUrl` **und** `PrimeVuePlugin` |

Ein Diagramm auf einem Canvas ist der archetypische berechtigte Verzicht: Es besitzt keine klassische Oberfläche und benötigt deshalb nichts vom Rückgrat. Sobald dasselbe Diagramm eine Toolbar erhält, ist es nicht mehr darstellungsneutral — der Button ist ein PrimeVue-Button und bringt die gesamte Integration mit.

Beachten Sie die Kopplung: **Tailwind-Utilities werden mit `primeVueCssUrl` ausgeliefert.** Es gibt keinen separaten Tailwind-Host-CSS-Schlüssel; in der Praxis lädt eine Komponente, die Tailwind verwendet, deshalb auch das PrimeVue-Asset. Bevorzugen Sie Utilities für gewöhnliches Layout und Abstände, wenn sie die Komponente klar halten. Portables moduleigenes CSS bleibt gültig, wenn eine Utility nicht der beste Ausdruck des Designs ist. (`preflightCssUrl` gehört nicht zur Schlüsselunion; wenn Tailwind Preflight im Shadow Root tatsächlich erforderlich ist, laden Sie es imperativ — dies ist selten nötig.)

Die praktische Folge für diese Seite: **Das meiste, was ein Modul benötigt, ist bereits im Rückgrat vorhanden.** Die gemeinsame Designschicht ist ein schmales Band darüber, kein Ort, um PrimeVue und Tailwind erneut umzusetzen. Die Mechanik beschreibt [CSS-Injektion](./web-host/css-injection.md).

### Die gemeinsame Designschicht

Manche Ideen wiederholen sich in einer bekannten Modulmenge und besitzen keinen anwendungsweiten Vertrag im Theme: eine domänenspezifische Match-Zusammenfassung, eine Oberflächen-Kopfzeile, ein Leerzustand oder ein projektspezifisches Vokabular für Tag-Größen. Diese Konzepte gehören in die gemeinsame Designschicht.

Sie werden als **veröffentlichtes Paket** ausgeliefert und zur Buildzeit in jeden Konsumenten materialisiert. Es muss ein Paket statt eines Pfadalias sein, weil Konsumenten in unterschiedlichen Repositories liegen. Ein Modul in einem anderen Repository ohne Pfadzugriff auf den Produzenten muss das Vokabular konsumieren und bauen können.

Das produzierende Modul deklariert das Paket als **Buildzeit-Artefakt**; jeder Konsument materialisiert es in seinen eigenen Baum. [Buildzeit-Artefakte](../guides/artifacts.md) beschreibt Deklaration, Format `node-package`, den automatischen Laufzeitabgleich und die weiterhin vom Build bereitzustellende Verklebung.

### Das Modul

Alles Übrige sowie jede bewusste Abweichung vom gemeinsamen Vokabular.

## Entscheiden, wo etwas hingehört

Fragen Sie in dieser Reihenfolge. Das erste Ja entscheidet.

1. **Ist es ein Wert?** Farbe, Radius, Abstand, Elevation, Severity. → **Theme.** Lesen Sie ein semantisches Token, niemals ein Literal.
2. **Liefert das Theme bereits eine Komponente dafür?** Button, Dialog, Select, Tag. → **Theme.** Verwenden Sie die Komponente. Gestalten Sie sie, indem Sie *auf ihr* eine Klasse setzen — bauen Sie sie niemals nach.
3. **Benötigen zwei oder mehr eigene Module dasselbe Konzept, ohne dass eine Theme-Komponente dahintersteht?** → **Gemeinsame Designschicht.**
4. Andernfalls → **Modul.**

## Ausgearbeitete Beispiele

Die Beispiele verwenden das Präfix `kx-` für anwendungsspezifische Klassen und Stylesheet-Namen. Die Platzierungsregeln gelten für jede Wippy-Anwendung.

### Theme-Komponenten niemals nachbauen

PrimeVue liefert `Button`. Ihn durch `.kx-btn` auf einem nativen `<button>` zu ersetzen, erzeugt eine zweite Implementierung, deren Interaktion und Erscheinungsbild von der Theme-Komponente abweichen können.

**Schlecht:** ein natives `button`-Element mit `.kx-btn .kx-btn-primary` — eine zweite Implementierung einer bereits vom Theme gelieferten Komponente.

**Gut:** die Theme-Komponente, bei Bedarf mit einer Klasse zur Anpassung.

```vue
<Button label="Save" class="kx-save" />
```

Wenn die Theme-Komponente nicht passt, ist das keine Erlaubnis, sie nachzubauen. Setzen Sie eine Klasse auf die Komponente und gestalten Sie diese Klasse — in der Facade für anwendungsweite, im Modul für lokale Anpassungen.

### Severity gehört dem Theme, nicht dem Modul

Severity — `success`, `danger`, `warn`, `info` — ist Theme-Semantik mit veröffentlichten Skalen. Sie unter modullokalen Namen neu abzuleiten, erzeugt konkurrierende Definitionen, die zwischen Modulen auseinanderlaufen können.

```css
/* BAD — severity re-derived under a module-local name */
.tone-gn { color: #16a34a; }

/* GOOD — severity from the theme */
.status-dot.success { background: var(--p-success-500); }
```

Ein *Farbton* darf in der gemeinsamen Schicht existieren, jedoch nur als **dekorative Kategoriefarbe**, niemals als Severity. Kann er „fehlgeschlagen“ bedeuten, ist er Severity und gehört dem Theme.

### Gemeinsames Vokabular ohne Platz im Theme

```css
/* GOOD — this application-specific card contract and empty-state vocabulary
   recur across modules. PrimeVue's generic Card does not define these domain
   semantics, so the shared layer owns them. */
@import "@kickside/ui-kit/kx-card.css";
@import "@kickside/ui-kit/kx-state.css";
```

### Übernehmen bedeutet importieren *und löschen*

Ein CSS-`@import` muss jeder anderen Regel in einem Stylesheet vorausgehen. Das gemeinsame Stylesheet steht deshalb immer **zuerst**; alles, was das Modul danach mit gleicher Spezifität deklariert, hat Vorrang. Ein Modul, das das Paket importiert und seine eigene Kopie behält, hat nichts geändert.

```css
/* BAD — the import is inert; the local copy still wins */
@import "@kickside/ui-kit/kx-card.css";
.kx-card { border-radius: 14px; border: 1px solid var(--p-content-border-color); }

/* GOOD — import, delete the local copy, keep only a documented delta */
@import "@kickside/ui-kit/kx-card.css";
/* This surface's cards are inline in a dense list, so they lose the lift. */
.kx-card:hover { transform: none; }
```

Behalten Sie **nur das Delta** — formulieren Sie niemals den gesamten Block erneut. Vereinen Sie außerdem nie zwei Absichten unter einem Namen: Wenn ein Klassenname in zwei Modulen Unterschiedliches bedeutet, sind es zwei Konzepte mit demselben Namen. Teilen Sie den Namen auf, statt einen Gewinner auszuwählen und den Verlierer umzugestalten.

### Spezifität gegenüber dem Theme

Das CSS des Moduls wird zuerst in den Shadow Root injiziert; das PrimeVue-Stylesheet des Themes wird danach angehängt. Beide sind `<style>`-Elemente, deshalb entscheidet die **Dokumentreihenfolge und das Theme steht an zweiter Stelle**. Eine Modulregel, die eine Theme-Komponentenklasse überstimmen muss, benötigt mehr *Spezifität* — keine spätere Zeile in der Datei. (`adoptedStyleSheets` enthält das benutzerdefinierte CSS der Facade, nicht das Theme; der Griff zu einem Adopted Sheet gewinnt daher ebenfalls nicht.)

Dies ist bei Pass-through-Klassen besonders sichtbar, bei denen Ihre Klasse *auf* einem Theme-Element landet:

```css
/* BAD — this class is applied to PrimeVue's own footer element, so at equal
   specificity the theme wins and the padding never applies. */
.kx-modal-foot { padding: 14px 18px; }

/* GOOD — scoped under the dialog root, so it out-specifies the theme */
.kx-modal > .kx-modal-foot { padding: 14px 18px; }
```

## Was die gemeinsame Schicht enthalten darf

Alles, was eine Modulmenge tatsächlich teilt und das Theme nicht verwaltet: CSS-Vokabular, abgeleitete Tokens, interne Komponenten, Hilfsfunktionen und Test-Harnesses.

**Verwenden Sie semantische Einheiten.** Jede Einheit sollte ein benanntes Konzept sein, das ein Konsument verstehen kann — `kx-card`, `kx-state`, `kx-tag`. Bevorzugen Sie feingranulare Pakete, damit ein Konsument nur das Benötigte übernimmt. Ein einzelnes Paket mit mehreren klar benannten Einheiten ist praktikabel, aber nicht das anzustrebende Zielbild.

**Verwenden Sie konkrete Namen.** Vermeiden Sie Sammelnamen wie `common`, `shared`, `misc` oder `utils`. Eine Einheit, deren Name den Inhalt nicht beschreibt, sammelt nicht verwandte Konzepte an und erzeugt erneut die Duplikation, die diese Schicht vermeiden soll.

## Normalisierung ist eine visuelle Änderung

Das Zusammenführen auseinanderentwickelter Kopien kann die Darstellung verändern. Vergleichen Sie jede Definition, wählen Sie die kanonische Version, dokumentieren Sie den Grund, bewahren Sie bewusste Abweichungen als dokumentierte Überschreibung und prüfen Sie das Ergebnis visuell. Unit-Tests erkennen kein Layout.

## Verwandte Themen

- [Theming](./micro-frontends/theming.md) — Token-Katalog und Theme-Auslieferung an Host sowie Kinder
- [Konformitätscheckliste](./micro-frontends/compliance-checklist.md) — Regeln, gegen die ein Frontend pro Modul geprüft wird
- [Buildzeit-Artefakte](../guides/artifacts.md) — Paket deklarieren und in einen Konsumenten materialisieren
- [Abhängigkeitsverwaltung](../guides/dependency-management.md) — Konsumierte Inhalte deklarieren und auflösen
