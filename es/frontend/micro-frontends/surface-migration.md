---
title: "Migración de superficies"
description: "Recetas para convertir reglas responsive basadas en el viewport al contrato de superficies de Wippy."
---

# Migración de superficies

**Clasificación: colección parcial de recetas de migración.** Cada bloque de antes y después convierte un patrón aislado. Aplique el árbol de decisión a toda la hoja de estilos y verifique después la página en ambos motores de renderizado y modos de dimensionado.

Recetas para convertir una aplicación micro frontend existente de un comportamiento responsive basado en el viewport al [contrato de superficies](./surface-portability.md).

Cada receta lleva una etiqueta:

| Etiqueta | Significado |
| --- | --- |
| **automática** | Mecánica. La regla convertida significa lo mismo. |
| **condicional** | Solo es segura si se cumple la precondición indicada. Compruébela. |
| **manual** | Requiere una decisión humana; no existe una única reescritura correcta. |
| **no convertible** | No existe una forma de consulta de contenedor. Use `host.surface` o conserve deliberadamente el comportamiento de viewport. |

Cada receta presenta una técnica de forma aislada. El repositorio Web Host incluye una página ejecutable que las combina y está cubierta por su suite de pruebas.

> Las recetas que dependen de trabajo aún no publicado —variantes Tailwind `surface-*`, diagnósticos de compilación, scroll mediado por el host y hit testing— se marcan como **aún no publicado** y solo describen lo que existe actualmente.

---

## Árbol de decisión: ¿de qué trata la regla?

Antes de convertir nada, clasifique la intención. Una conversión mecánicamente correcta sigue siendo errónea si la regla original no dependía de la superficie.

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

Si no puede determinarlo, déjela sin cambiar y vuelva a revisarla. Una media query sin convertir solo es no portable; una mal convertida queda rota silenciosamente.

---

## 1. `max-width` → `inline-size <=` — **automática**

```css
/* before */ @media (max-width: 640px)                      { .nav { display: none } }
/* after  */ @container wippy-surface (max-width: 640px)    { .nav { display: none } }
```

## 2. `min-width` → `inline-size >=` — **automática**

```css
/* before */ @media (min-width: 640px)                      { .sidebar { display: block } }
/* after  */ @container wippy-surface (min-width: 640px)    { .sidebar { display: block } }
```

## 3. Rango de anchura limitado — **automática**

```css
/* before */ @media (min-width: 640px) and (max-width: 1024px) { … }
/* after  */ @container wippy-surface (640px <= width <= 1024px) { … }
```

La sintaxis de rango se admite en todos los motores objetivo del contrato de superficie. La forma con `and` también funciona si la prefiere.

## 4. Varios breakpoints con el orden de cascada conservado — **automática**

Las consultas de contenedor no cambian la especificidad ni el orden. Convierta cada bloque y mantenga el mismo orden del código fuente:

```css
@container wippy-surface (min-width: 480px)  { .grid { grid-template-columns: repeat(2, 1fr) } }
@container wippy-surface (min-width: 900px)  { .grid { grid-template-columns: repeat(4, 1fr) } }
```

## 5. Consultas de altura — **condicional** (solo dimensionado por contenedor)

```css
/* after */ @container wippy-surface (min-height: 500px) { .tall-only { display: block } }
```

Precondición: la página está **dimensionada por contenedor**. En dimensionado por contenido, la altura de la página es su propio contenido y las consultas de altura nunca coinciden. Declare la dependencia para que falle de forma visible:

```json
{ "wippy": { "surface": { "contract": 1, "requirements": ["block-size"] } } }
```

## 6. Consultas de relación de aspecto — **condicional** (solo dimensionado por contenedor)

```css
/* before */ @media (min-aspect-ratio: 16/9)                     { … }
/* after  */ @container wippy-surface (min-aspect-ratio: 16/9)   { … }
```

La misma precondición que en la receta 5: la relación de aspecto necesita ambos ejes.

## 7. Consultas de orientación — **condicional** (solo dimensionado por contenedor)

`@container wippy-surface (orientation: landscape)` describe la forma de *su panel*, que normalmente es lo buscado. Si realmente se refería al dispositivo, es una media query: consérvela (receta 13).

## 8. Altura, aspecto u orientación en dimensionado por contenido — **no convertible**

No existe eje de bloque que consultar. Reestructure el layout para que dependa del eje inline. No lo simule con `cqh`; consulte la receta 22.

La aplicación no puede cambiarse por sí misma a dimensionado por contenedor: lo determina el lugar donde Web Host la renderiza, no el paquete. Si el layout no puede funcionar sin el eje de bloque, declare `requirements: ["block-size"]` para que se rechace una colocación dimensionada por contenido y renderice la aplicación en un contexto dimensionado por contenedor, como su propia ruta o un panel de layout. Consulte «Dimensionado por contenedor y por contenido» en [Portabilidad de superficies](./surface-portability.md).

## 9. Geometría anidada en una media query ambiental — **manual**

```css
/* before */
@media (prefers-color-scheme: dark) and (min-width: 640px) { .panel { … } }

/* after — split: the preference stays, the geometry moves */
@media (prefers-color-scheme: dark) {
  @container wippy-surface (min-width: 640px) { .panel { … } }
}
```

Es manual porque el orden de anidamiento puede cambiar qué declaraciones prevalecen cuando antes ambas condiciones compartían un prelude. Vuelva a comprobar el resultado.

## 10. Ramas OR separadas por coma — **manual**

```css
/* before */ @media (max-width: 480px), (min-width: 1200px) { … }
```

Una coma significa OR. Dividirla en dos bloques `@container` conserva OR **solo si ambos bloques son idénticos y adyacentes**; si los anida por error, convierte OR en AND y no coincidirá nunca. Duplique las declaraciones en dos bloques hermanos:

```css
@container wippy-surface (max-width: 480px)  { … }
@container wippy-surface (min-width: 1200px) { … }
```

## 11. `not`, `only` y booleanos complejos — **manual**

`only` es un artefacto de los tipos media sin equivalente de contenedor: elimínelo. `not` invierte toda la condición en ambas sintaxis, pero la precedencia cambia al mezclar `and`/`or`; use paréntesis explícitos en vez de confiar en la agrupación original.

## 12. `screen` / `print` combinados con geometría — **manual**

Los *tipos* media no tienen forma de contenedor. Conserve el tipo como media query y anide la geometría en él, como en la receta 9. El layout de impresión normalmente debe seguir dependiendo por completo del viewport o la página.

## 13. Las preferencias permanecen como media queries — **no convertible** (y correcto tal como está)

`prefers-color-scheme`, `prefers-contrast`, `prefers-reduced-motion`, `forced-colors`, `hover`, `pointer`, `any-pointer`. `@container` solo admite características de tamaño. Convertirlas produce una regla que nunca coincide.

## 14. Breakpoints en `em` — **manual**

`@media (min-width: 40em)` resuelve `em` respecto al tamaño de fuente inicial. `@container wippy-surface (min-width: 40em)` lo resuelve respecto al tamaño de fuente **del contenedor**. Si difieren, el breakpoint se desplaza silenciosamente. Conviértalo a `px` o verifique primero el `font-size` calculado del contenedor.

## 15. Breakpoints en `rem` — **manual**

`rem` **no** es relativo a la raíz dentro de `@media`. Las condiciones de media query resuelven `em` y `rem` respecto al tamaño de fuente *inicial* —el valor predeterminado del navegador, independiente del CSS del autor—, mientras que `@container` los resuelve de forma ordinaria respecto al tamaño calculado de la raíz o contenedor.

Por tanto, ya son distintos en cuanto el tamaño de fuente de la raíz difiere del predeterminado del navegador, sin que nada cambie en runtime. El restablecimiento habitual `html { font-size: 62.5% }` basta para mover un breakpoint convertido de 640 px a 400 px.

«Nada cambia el tamaño de fuente raíz» **no** es una precondición suficiente. Conviértalo a `px`, igual que con `em` (receta 14), salvo que pueda demostrar que el tamaño calculado de la raíz coincide con el predeterminado del navegador.

## 16. Límite de barra de desplazamiento entre viewport y content box — **condicional**

`100vw` incluye el espacio de una barra de desplazamiento clásica. En iframe, la anchura de la superficie es el **content box** del cuadro de consulta dentro del documento, por lo que no la incluye: en una página con barra de documento, el valor convertido es más estrecho por la anchura de la barra. Normalmente es la corrección deseada; `100vw` que provoca overflow horizontal es un error clásico.

Fragment mide un wrapper del documento host que el scroll del contenido no estrecha, de modo que no aplica esa corrección. Mismo panel y contenido desplazable, pero anchuras separadas por una barra. Por tanto, la condición es *qué motor ejecuta la aplicación*, no solo si la alineación debe ser exacta al píxel.

## 17. Reglas dirigidas a `html` / `body` — **manual**

Una consulta de contenedor nunca da estilo a su propio contenedor, y una regla dirigida a `html` o `body` falla en ambos motores por motivos distintos:

- **Iframe:** el host envuelve el contenido del body en el cuadro de superficie; `html` y `body` son *ancestros* del contenedor y una regla `@container` no alcanza un ancestro.
- **Fragment:** la topología opuesta, con el cuadro sobre el contenido; aun así, un selector `body` literal falla porque el documento reflejado se renombra `wf-html` / `wf-body`.

La solución es la misma y funciona con ambos motores:

```css
/* ✗ silently never matches */
@container wippy-surface (min-width: 640px) { body { display: flex } }

/* ✓ move it to your own root inside the surface */
@container wippy-surface (min-width: 640px) { #app { display: flex } }
```

## 18. `<picture><source media>` y `<link media>` — **no convertible**

La selección de recursos a nivel HTML no tiene forma de consulta de contenedor. Contrólela desde JS mediante `host.surface.onChange` o mueva la dirección artística a CSS —`background-image` bajo `@container`—, donde se aplica el contrato.

## 19. `matchMedia()` de geometría → `host.surface` — **automática**

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

Conserve `matchMedia` para consultas de preferencias; solo es incorrecto para geometría.

## 20. CSS de runtime, hojas adoptadas y CSS-in-JS — **manual**

Prefiera emitir reglas `@container wippy-surface (...)` y dejar que CSS responda. Si calcula píxeles en JS, regenérelos desde `onChange`: un valor leído una vez de `snapshot` queda congelado y se desincroniza en el siguiente resize. Nunca emita los cuatro nombres reservados `--wippy-surface-*` ni los registre con `@property` / `CSS.registerProperty()`: el registro invalida la señal del host de eje de bloque no disponible, de modo que una aplicación dimensionada por contenido se presenta silenciosamente como dimensionada por contenedor; una declaración descendiente oculta el valor heredado y desvincula la página.

## 21. CSS incluido de terceros — **manual**

Normalmente no puede editarlo. En orden de preferencia: configure la biblioteca para aceptar un breakpoint o anchura proporcionado desde `host.surface`; envuélvala en su propio contenedor y traduzca; o fije la página al motor iframe (`wippy.renderEngine: "iframe"`) y acepte el comportamiento basado en ventana. El escaneo de compilación para detectarlo automáticamente **aún no está publicado**.

## 22. Contenedores anidados y el problema del fallback `cq*` — **manual**

Las unidades de contenedor se resuelven respecto al contenedor *más cercano* que tenga el eje necesario. Dos consecuencias:

```css
.card { container-type: inline-size; }   /* has NO block axis */
.card .thing { block-size: 25cqh; }      /* ✗ silently uses the small viewport */
```

`cqh`/`cqb` no producen error cuando no encuentran un contenedor con eje de bloque: recurren al viewport pequeño y renderizan un número plausible pero incorrecto. Use `var(--wippy-surface-height, <fallback>)` cuando quiera el eje de bloque de la superficie: está fijado a la raíz, por lo que ningún contenedor más cercano lo intercepta, y usa el fallback visiblemente cuando no está disponible.

Las consultas de componentes son aditivas, no un reemplazo: desde un contenedor anidado, `wippy-surface` sigue refiriéndose al área de la página.

---

## Unidades de viewport

| Antes | Use | Notas |
| --- | --- | --- |
| `100vw` | `var(--wippy-surface-width)` | content box; consulte la receta 16 |
| `1vw` / `37vw` | `calc(var(--wippy-surface-width-unit) * 37)` o `37cqw` | la unidad es 1 % |
| `100vh` | `var(--wippy-surface-height)` | solo dimensionado por contenedor |
| `1vh` / `37vh` | `calc(var(--wippy-surface-height-unit) * 37)` | solo dimensionado por contenedor |
| `vmin` | `min(var(--wippy-surface-width), var(--wippy-surface-height))` | solo dimensionado por contenedor; necesita ambos ejes |
| `vmax` | `max(var(--wippy-surface-width), var(--wippy-surface-height))` | solo dimensionado por contenedor |
| `vi` / `vb` | `cqi` / `cqb`, o las variables físicas | son lógicas; las variables de superficie son físicas |
| `sv*` / `lv*` / `dv*` | `var(--wippy-surface-*)` | **sin equivalentes separados.** Describen estados del chrome del navegador que un panel no tiene; la superficie tiene un tamaño |

`sv*`/`lv*` son unidades CSS reales; **no** significan «surface».

### Cálculos

```css
/* before */ block-size: calc(100vh - 4rem);
/* after  */ block-size: calc(var(--wippy-surface-height, 400px) - 4rem);
```

El fallback es deliberadamente fijo y obviamente incorrecto, no `100vh`; consulte «No oculte un contrato ausente tras un fallback». Esto importa más en el eje de bloque: la altura es inválida en **toda** colocación dimensionada por contenido, no solo donde falta el contrato, por lo que un fallback `100vh` renderiza silenciosamente la altura de ventana la primera vez que se integra la aplicación.

`min()`/`max()`/`clamp()` se convierten sin cambios; sustituya las unidades dentro.

### Cuándo es mejor `100%` que un valor de superficie

Si un elemento debe llenar su **padre**, use `100%` o `w-full`. Use `--wippy-surface-width` solo si necesita específicamente el área de *la página*, normalmente porque un ancestro es más estrecho y desea salir de él. Fijar a la raíz algo que debería depender del padre produce layouts correctos en un nivel de anidamiento e incorrectos en otro.

### No oculte un contrato ausente tras un fallback

```css
/* ✗ */ inline-size: var(--wippy-surface-width, 100vw);
```

Esto renderiza con anchura de ventana cuando falta el contrato: oculta exactamente el error que el contrato pretende evitar. Deje que falle visiblemente o elija un fallback fijo claramente incorrecto, como `400px`.

---

## Overlays

El contrato de superficie **no** captura `position: fixed`: `container-type` establece un contexto de formato independiente sin contención de layout, por lo que un contenedor de consulta calcula `contain: none` y no ancla nada. Se ha verificado en Chromium, Firefox y WebKit. Los overlays PrimeVue y propios con fixed siguen funcionando, así que **el posicionamiento no requiere migración**.

Su *dimensionado* sí. Un overlay que deba cubrir la superficie debe usar `inset: 0`, no `100vw`/`100vh`, que miden la ventana y sobrepasan un host multipanel, ni `var(--wippy-surface-height)`, ausente con dimensionado por contenido. Combine `inset: 0` con `position: absolute` dentro de una raíz propia `position: relative` si debe funcionar con ambos motores; `position: fixed` solo es correcto con iframe, por el motivo siguiente.

Lo que requiere atención es el motor, no el contrato: en Web Fragment, `position: fixed` se resuelve respecto a la **ventana del host**, no al panel. Consulte [Motores de renderizado](../web-host/render-engines.md) y fije la aplicación con `wippy.renderEngine: "iframe"` si importa.

La colocación de overlays mediada por el host y los helpers de scroll de `host.surface` **aún no están publicados**.

---

## Lista de comprobación

1. Clasifique cada regla: página, componente, preferencia o ventana deliberada.
2. Convierta la geometría relativa a la página a `@container wippy-surface`.
3. Sustituya unidades de viewport por variables de superficie.
4. Mueva las reglas dirigidas a `html`/`body` a su propio elemento raíz.
5. Vuelva a comprobar los breakpoints en `em`.
6. Declare `requirements` si depende del eje de bloque.
7. Ejecute la página en ambos motores **y ambos dimensionados**. Contenedor y contenido son lo que activa esta migración; una aplicación se dimensiona por contenido cuando está integrada y no enrutada. Compruebe el modo mediante `host.surface.snapshot.sizing` y condicione el eje de bloque a `host.surface.supports('block-size')`.
