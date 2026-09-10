---
title: "Portabler UI-Vertrag"
description: "Normative Regeln für PrimeVue, Tailwind, Tokens, eigene Steuerelemente, Barrierefreiheit und Portabilität."
---

# Portabler UI-Vertrag

Die folgenden IDs sind die kanonischen Eigentümer ihrer Regeln.

## Portabilität

### FE-PORT-001: Portabel ist der Standard

Ein konformes Modul funktioniert mit einem anderen konformen Facade-Theme ohne Modul-Änderungen und ohne projektprivate Facade-Klassen.

### FE-STYLE-001: Keine private Facade-Abhängigkeit

Portable Module dürfen keine beliebigen Klassen oder Selektoren voraussetzen, die nur von einer bestimmten Facade definiert werden. Geteilte PrimeVue-`.p-*`-Theme-Regeln sind keine privaten Klassen. Nicht-PrimeVue-Styling, das ein Modul benötigt, gehört in dieses Modul, sollte aber durch Konformität mit geteilten Komponenten und Semantik minimiert werden.

Wenn *mehrere* Ihrer eigenen Module dasselbe Nicht-PrimeVue-Styling benötigen, gehört es weder in die Facade noch in jedes Modul: siehe [Die Design-Schicht](./design-layer.md).

## Komponenten und Affordanz

### FE-UI-001: PrimeVue verwenden, wenn es das Steuerelement abdeckt

Wenn PrimeVue die erforderliche Semantik, Interaktion und beabsichtigte Affordanz bietet, muss das Modul es verwenden.

### FE-UI-002: Datenform ist keine Affordanz

Die Fähigkeit, dieselben Werte darzustellen, macht zwei Steuerelemente nicht gleichwertig. Ein `SelectButton` ist nicht automatisch ein Ersatz für einen gleitenden Dreistellungs-Schalter, wenn die beabsichtigte Affordanz sichtbar und im Verhalten ein Schalter ist.

### FE-UI-003: Gleiche Semantik und Affordanz bedeutet gleiches Erscheinungsbild

Gleichwertige Steuerelemente müssen Größen, Abstände, Farben, Typografie, Rahmen, Schatten sowie Fokus-, Hover-, Disabled-, Invalid- und Bewegungsverhalten teilen. Ein eigenes Komposit benennt sein visuelles PrimeVue-Geschwister und erbt jede zutreffende geteilte Laufzeit-Property.

### FE-UI-004: Der Verzicht auf PrimeVue ist eng gefasst

PrimeVue darf nur weggelassen werden, wenn das Modul nichts rendert, das physisch oder semantisch PrimeVue-artig ist. Eine reine Diagrammkomponente qualifiziert sich dafür; ein Diagramm mit einer Schaltfläche oder einem Formularfeld nicht.

### FE-UI-005: Niemals Komponenten-APIs erfinden

Eine undokumentierte Prop oder ein undokumentiertes Verhalten ist keine Abkürzung. Der PrimeVue-`ToggleSwitch` wird nicht zu einem Dreistellungs-Steuerelement, indem man eine neue positions-Prop erfindet. Wenn keine PrimeVue-Komponente und keine Komposition die erforderliche Affordanz liefert, verwenden Sie den geprüften Prozess für eigene Geschwister.

## Tailwind und Tokens

### FE-TW-001: Wippy-Tailwind wird unterstützt

Das gemeinsame Wippy-Preset ist ein unterstützter Vertrag zur Build-Zeit. Module dürfen seine dokumentierten Utilities verwenden und es für Domänenlayout, anwendungsspezifische Breakpoints, Dekoration und neuartige Visualisierung erweitern.

### FE-TW-002: Kompilierte Werte sind keine Laufzeit-Tokens

Utilities wie `px-3`, `rounded-md` und `duration-200` kompilieren normalerweise zu Konstanten. Sie bieten eine konsistente Grundlinie, ändern sich aber nicht, wenn eine Facade Laufzeit-Theme-Variablen austauscht.

### FE-TW-003: Das Erscheinungsbild geteilter Geschwister folgt der Laufzeitsemantik

Wenn eine Erscheinungs-Property über Themes hinweg einem PrimeVue-Geschwister folgen muss, verwenden Sie eine dokumentierte, laufzeitgestützte semantische Utility oder ein direktes öffentliches Token. Eine feste Utility ist nur zulässig, wenn die Property ausdrücklich als `platform-invariant` eingestuft ist.

### FE-TW-004: Geschützte Zuordnungen behalten ihre Bedeutung

Module dürfen das Preset erweitern, aber die geschützte Semantik für primary, surface, severity, text, content, highlight oder portable Steuerelemente nicht inkompatibel umdefinieren.

### FE-TOKEN-001: Jedes Token muss existieren

Jede `--p-*`-Referenz muss im gewählten generierten Manifest vorhanden sein.

### FE-TOKEN-002: Token-Namen sind keine erratbaren APIs

Konstruieren Sie ein Token niemals per Analogie. Durchsuchen Sie den [Token-Katalog](./micro-frontends/token-catalogue.md) oder das Manifest des gewählten Pakets.

## Barrierefreiheit

### FE-A11Y-001: Eigenbau ist kein Freibrief bei Barrierefreiheit

Eine Ausnahme für ein eigenes Steuerelement muss gültiges HTML, Tastaturinteraktion, Fokus, zugänglichen Namen, Zustand und Disabled-Verhalten bewahren. Interaktive Elemente dürfen nicht verschachtelt werden.
