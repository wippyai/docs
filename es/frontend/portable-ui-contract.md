---
title: "Contrato de interfaz portable"
description: "Reglas normativas para PrimeVue, Tailwind, tokens, controles personalizados, accesibilidad y portabilidad."
---

# Contrato de interfaz portable

Esta página es una referencia normativa. Sus ID de reglas definen requisitos de revisión y aceptación, no un tutorial de implementación.

Los siguientes ID son los propietarios canónicos de sus reglas.

## Portabilidad

### FE-PORT-001: Portable por defecto

Un módulo conforme funciona con otro tema de fachada conforme sin editar el módulo y sin clases privadas de la fachada del proyecto.

### FE-STYLE-001: Sin dependencias privadas de la fachada

Los módulos portables no pueden exigir clases o selectores arbitrarios definidos solo por una fachada. Las reglas compartidas `.p-*` del tema PrimeVue no son clases privadas. Los estilos no PrimeVue que necesita un único módulo pertenecen a ese módulo, aunque deben minimizarse usando componentes y semántica compartidos.

Cuando *varios* módulos propios necesitan el mismo estilo no PrimeVue, no pertenece ni a la fachada ni a cada módulo: consulte [La capa de diseño](./design-layer.md).

## Componentes y affordance

### FE-UI-001: Use PrimeVue cuando satisfaga el control

Si PrimeVue proporciona la semántica, interacción y affordance necesarias, el módulo debe usarlo.

### FE-UI-002: La forma de los datos no es la affordance

Poder representar los mismos valores no hace equivalentes a dos controles. Un `SelectButton` no sustituye automáticamente a un interruptor deslizante de tres posiciones cuando la affordance prevista debe ser visible y comportarse como un interruptor.

### FE-UI-003: Misma semántica y affordance implican misma apariencia

Los controles equivalentes deben compartir tamaños, espaciado, colores, tipografía, bordes, sombras, foco, hover, estados desactivado y no válido, y movimiento. Un composite personalizado nombra su equivalente visual de PrimeVue y hereda todas las propiedades compartidas aplicables en runtime.

### FE-UI-004: Omitir PrimeVue es una excepción estrecha

PrimeVue solo puede omitirse cuando el módulo no renderiza nada física o semánticamente similar a PrimeVue. Un componente solo con un gráfico cumple este requisito; un gráfico con un botón o campo de formulario no.

### FE-UI-005: Nunca invente API de componentes

Una propiedad o comportamiento no documentados no son un atajo. `ToggleSwitch` de PrimeVue no se convierte en un control de tres posiciones inventando una propiedad de posiciones. Cuando ningún componente o composición de PrimeVue proporciona la affordance necesaria, use el proceso revisado de equivalencia personalizada.

## Tailwind y tokens

### FE-TW-001: Tailwind de Wippy es compatible

El preset compartido de Wippy es un contrato compatible en tiempo de compilación. Los módulos pueden usar sus utilidades documentadas y ampliarlo para layout de dominio, breakpoints específicos de la aplicación, decoración y visualizaciones nuevas.

### FE-TW-002: Los valores compilados no son tokens de runtime

Utilidades como `px-3`, `rounded-md` y `duration-200` normalmente compilan a constantes. Proporcionan una base coherente, pero no cambian cuando una fachada sustituye variables de tema en runtime.

### FE-TW-003: La apariencia equivalente compartida sigue la semántica de runtime

Cuando una propiedad visual debe seguir a un equivalente PrimeVue entre temas, use una utilidad semántica documentada respaldada por el runtime o un token público directo. Una utilidad fija solo se permite cuando la propiedad está clasificada explícitamente como `platform-invariant`.

### FE-TW-004: Los mapeos protegidos conservan su significado

Los módulos pueden ampliar el preset, pero no redefinir de forma incompatible la semántica protegida de primary, surface, severity, text, content, highlight o controles portables.

### FE-TOKEN-001: Todo token debe existir

Cada referencia `--p-*` debe existir en el manifiesto generado seleccionado.

### FE-TOKEN-002: Los nombres de tokens no son API deducibles

Nunca construya un token por analogía. Busque en el [Catálogo de tokens](./micro-frontends/token-catalogue.md) o en el manifiesto del paquete seleccionado.

## Accesibilidad

### FE-A11Y-001: Personalizado no exime de accesibilidad

Una excepción para un control personalizado debe conservar HTML válido, interacción mediante teclado, foco, nombre accesible, estado y comportamiento desactivado. Los elementos interactivos no deben anidarse.
