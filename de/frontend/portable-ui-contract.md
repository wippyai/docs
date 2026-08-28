---
title: "Vertrag für portable Oberflächen"
description: "Normative Regeln für PrimeVue, Tailwind, Tokens, benutzerdefinierte Steuerelemente, Barrierefreiheit und Portabilität."
---

# Vertrag für portable Oberflächen

Diese Seite ist eine normative Vertragsreferenz. Ihre Regel-IDs definieren Review- und Abnahmeanforderungen und kein Implementierungstutorial.

Die folgenden IDs sind die kanonischen Eigentümer ihrer Regeln.

## Portabilität

### FE-PORT-001: Portabel ist der Standard

Ein konformes Modul funktioniert mit einem anderen konformen Facade-Theme ohne Moduländerungen und ohne projektprivate Facade-Klassen.

### FE-STYLE-001: Keine private Facade-Abhängigkeit

Portable Module dürfen keine beliebigen Klassen oder Selektoren benötigen, die nur eine Facade definiert. Gemeinsame PrimeVue-Theme-Regeln `.p-*` sind keine privaten Klassen. Nicht zu PrimeVue gehörendes Styling, das ein Modul benötigt, gehört in dieses Modul, sollte aber durch Konformität mit gemeinsamen Komponenten und Semantik minimiert werden.

Wenn *mehrere* eigene Module dasselbe nicht zu PrimeVue gehörende Styling benötigen, gehört es weder in die Facade noch einzeln in jedes Modul: siehe [Die Designschicht](./design-layer.md).

## Komponenten und Affordance

### FE-UI-001: PrimeVue verwenden, wenn es das Steuerelement erfüllt

Wenn PrimeVue die erforderliche Semantik, Interaktion und beabsichtigte Affordance bereitstellt, muss das Modul es verwenden.

### FE-UI-002: Datenform ist nicht Affordance

Die Fähigkeit, dieselben Werte darzustellen, macht zwei Steuerelemente nicht gleichwertig. Ein `SelectButton` ist nicht automatisch ein Ersatz für einen gleitenden Schalter mit drei Positionen, wenn die beabsichtigte Affordance sichtbar und im Verhalten die eines Schalters ist.

### FE-UI-003: Gleiche Semantik und Affordance bedeuten gleiches Erscheinungsbild

Gleichwertige Steuerelemente müssen Größen, Abstände, Farben, Typografie, Rahmen, Schatten, Fokus-, Hover-, deaktiviertes und ungültiges Verhalten sowie Bewegung teilen. Eine benutzerdefinierte Komposition benennt ihr visuelles PrimeVue-Gegenstück und erbt jede anwendbare gemeinsame Laufzeiteigenschaft.

### FE-UI-004: Das Weglassen von PrimeVue ist eng begrenzt

PrimeVue darf nur weggelassen werden, wenn das Modul nichts rendert, das physisch oder semantisch PrimeVue ähnelt. Eine reine Diagrammkomponente erfüllt dies; ein Diagramm mit Button oder Formularfeld nicht.

### FE-UI-005: Komponenten-APIs niemals erfinden

Eine nicht dokumentierte Property oder ein nicht dokumentiertes Verhalten ist keine Abkürzung. PrimeVue `ToggleSwitch` wird nicht durch das Erfinden einer neuen Property `positions` zu einem Steuerelement mit drei Positionen. Wenn keine PrimeVue-Komponente oder -Komposition die erforderliche Affordance bereitstellt, verwenden Sie den geprüften Prozess für benutzerdefinierte Gegenstücke.

## Tailwind und Tokens

### FE-TW-001: Wippy Tailwind wird unterstützt

Das gemeinsame Wippy-Preset ist ein unterstützter Buildzeitvertrag. Module dürfen seine dokumentierten Utilities verwenden und es für Domänenlayout, anwendungsspezifische Breakpoints, Dekoration und neuartige Visualisierung erweitern.

### FE-TW-002: Kompilierte Werte sind keine Laufzeit-Tokens

Utilities wie `px-3`, `rounded-md` und `duration-200` werden normalerweise zu Konstanten kompiliert. Sie stellen eine konsistente Basis bereit, ändern sich aber nicht, wenn eine Facade Laufzeit-Theme-Variablen austauscht.

### FE-TW-003: Gemeinsames Erscheinungsbild von Gegenstücken folgt der Laufzeitsemantik

Wenn eine Erscheinungseigenschaft einem PrimeVue-Gegenstück über Themes hinweg folgen muss, verwenden Sie eine dokumentierte laufzeitgestützte semantische Utility oder ein direktes öffentliches Token. Eine feste Utility ist nur erlaubt, wenn die Eigenschaft ausdrücklich als `platform-invariant` klassifiziert ist.

### FE-TW-004: Geschützte Zuordnungen behalten ihre Bedeutung

Module dürfen das Preset erweitern, aber geschützte Semantik für Primary, Surface, Severity, Text, Content, Highlight oder portable Steuerelemente nicht inkompatibel neu definieren.

### FE-TOKEN-001: Jedes Token muss existieren

Jede Referenz auf `--p-*` muss im ausgewählten generierten Manifest vorhanden sein.

### FE-TOKEN-002: Token-Namen sind keine erratbaren APIs

Konstruieren Sie Tokens niemals durch Analogie. Durchsuchen Sie den [Token-Katalog](./micro-frontends/token-catalogue.md) oder das ausgewählte Paketmanifest.

## Barrierefreiheit

### FE-A11Y-001: Benutzerdefiniert ist keine Ausnahme von Barrierefreiheit

Eine Ausnahme für ein benutzerdefiniertes Steuerelement muss gültiges HTML, Tastaturinteraktion, Fokus, zugänglichen Namen, Zustand und deaktiviertes Verhalten erhalten. Interaktive Elemente dürfen nicht ineinander verschachtelt werden.
