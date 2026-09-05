---
title: "Contrato de UI Portable"
description: "Reglas normativas para PrimeVue, Tailwind, tokens, controles personalizados, accesibilidad y portabilidad."
---

# Contrato de UI Portable

Los siguientes IDs son los propietarios canónicos de sus reglas.

## Portabilidad

### FE-PORT-001: Portable es el valor por defecto

Un módulo conforme funciona con otro tema de facade conforme sin ediciones en el módulo y sin clases privadas del facade del proyecto.

### FE-STYLE-001: Sin dependencia privada del facade

Los módulos portables no pueden requerir clases o selectores arbitrarios definidos solo por un facade. Las reglas de tema `.p-*` compartidas de PrimeVue no son clases privadas. El estilo no perteneciente a PrimeVue que requiere un módulo pertenece a ese módulo, pero debe minimizarse ajustándose a los componentes y la semántica compartidos.

Cuando *varios* de sus propios módulos necesitan el mismo estilo no perteneciente a PrimeVue, no pertenece ni al facade ni a cada módulo: vea [La Capa de Diseño](./design-layer.md).

## Componentes y affordance

### FE-UI-001: Use PrimeVue cuando satisfaga el control

Si PrimeVue proporciona la semántica, la interacción y la affordance prevista requeridas, el módulo debe usarlo.

### FE-UI-002: La forma de los datos no es affordance

La capacidad de representar los mismos valores no hace equivalentes a dos controles. Un `SelectButton` no es automáticamente un sustituto de un toggle deslizante de tres posiciones cuando la affordance prevista es, visual y funcionalmente, un toggle.

### FE-UI-003: La misma semántica y affordance implica la misma apariencia

Los controles equivalentes deben compartir tamaños, espaciado, colores, tipografía, bordes, sombras, foco, hover, deshabilitado, inválido y comportamiento de movimiento. Un composite personalizado nombra a su hermano visual de PrimeVue y hereda cada propiedad de runtime compartida aplicable.

### FE-UI-004: La omisión de PrimeVue es limitada

PrimeVue solo puede omitirse cuando el módulo no renderiza nada que sea física o semánticamente similar a PrimeVue. Un componente exclusivamente de gráficos cumple; un gráfico con un botón o un campo de formulario, no.

### FE-UI-005: Nunca invente APIs de componentes

Una prop o un comportamiento no documentados no son un atajo. El `ToggleSwitch` de PrimeVue no se convierte en un control de tres posiciones inventando una nueva prop de posiciones. Cuando ningún componente ni composición de PrimeVue proporciona la affordance requerida, use el proceso revisado de hermano personalizado.

## Tailwind y tokens

### FE-TW-001: Wippy Tailwind está soportado

El preset compartido de Wippy es un contrato soportado en tiempo de build. Los módulos pueden usar sus utilidades documentadas y extenderlo para el layout del dominio, breakpoints específicos de la aplicación, decoración y visualizaciones novedosas.

### FE-TW-002: Los valores compilados no son tokens de runtime

Utilidades como `px-3`, `rounded-md` y `duration-200` normalmente compilan a constantes. Proporcionan una base consistente, pero no cambian cuando un facade sustituye las variables de tema de runtime.

### FE-TW-003: La apariencia del hermano compartido sigue la semántica de runtime

Cuando una propiedad de apariencia debe seguir a un hermano de PrimeVue entre temas, use una utilidad semántica documentada respaldada en runtime o un token público directo. Una utilidad fija solo se permite cuando la propiedad está explícitamente clasificada como `platform-invariant`.

### FE-TW-004: Los mapeos protegidos conservan su significado

Los módulos pueden extender el preset, pero no pueden redefinir de forma incompatible las semánticas protegidas de primary, surface, severity, texto, contenido, highlight o controles portables.

### FE-TOKEN-001: Todo token debe existir

Toda referencia `--p-*` debe estar presente en el manifiesto generado seleccionado.

### FE-TOKEN-002: Los nombres de tokens no son APIs deducibles

Nunca construya un token por analogía. Busque en el [Catálogo de Tokens](./micro-frontends/token-catalogue.md) o en el manifiesto del paquete seleccionado.

## Accesibilidad

### FE-A11Y-001: Personalizado no es una exención de accesibilidad

Una excepción de control personalizado debe preservar HTML válido, interacción con teclado, foco, nombre accesible, estado y comportamiento de deshabilitado. Los elementos interactivos no deben anidarse.
