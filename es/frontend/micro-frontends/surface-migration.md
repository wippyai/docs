# Migración de Surface

Recetas para convertir una app de micro frontend existente de una capacidad de
respuesta basada en el viewport al [contrato de surface](./surface-portability.md).

Cada receta está etiquetada:

| Etiqueta | Significado |
| --- | --- |
| **automática** | Mecánica. La regla convertida significa lo mismo. |
| **condicional** | Segura solo cuando se cumple una precondición declarada. Compruébela. |
| **manual** | Necesita una decisión humana; no hay una única reescritura correcta. |
| **no convertible** | No existe forma de container query. Use `host.surface` o mantenga el comportamiento de viewport deliberadamente. |

Cada receta de abajo es una técnica aislada. El repositorio del Web Host mantiene
una página ejecutable que las combina todas, ejecutada por su suite de pruebas
para que las recetas no puedan pudrirse hasta convertirse en instrucciones
erróneas.

> Las recetas que dependen de trabajo no entregado (variantes `surface-*` de Tailwind,
> diagnósticos en tiempo de build, scroll mediado por el host, hit testing) se marcan como
> **aún no entregado** y describen solo lo que existe hoy.

---

## Árbol de decisión: ¿de qué trata esta regla?

Antes de convertir nada, clasifique la intención. La mayoría de las migraciones
malas son conversiones correctamente ejecutadas de reglas que no debieron
convertirse.

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

Si no puede decidirlo, déjelo y vuelva más tarde. Una media query no convertida
es simplemente no portable; una convertida por error está rota en silencio.

---

## 1. `max-width` → `inline-size <=` — **automática**

```css
/* antes */ @media (max-width: 640px)                       { .nav { display: none } }
/* despues */ @container wippy-surface (max-width: 640px)   { .nav { display: none } }
```

## 2. `min-width` → `inline-size >=` — **automática**

```css
/* antes */ @media (min-width: 640px)                       { .sidebar { display: block } }
/* despues */ @container wippy-surface (min-width: 640px)   { .sidebar { display: block } }
```

## 3. Un rango de anchura acotado — **automática**

```css
/* antes */ @media (min-width: 640px) and (max-width: 1024px) { … }
/* despues */ @container wippy-surface (640px <= width <= 1024px) { … }
```

La sintaxis de rango está soportada en todos los motores a los que apunta el
contrato de surface. La forma con `and` también funciona si la prefiere.

## 4. Múltiples breakpoints, con el orden de cascada preservado — **automática**

Las container queries no cambian la especificidad ni el orden. Convierta cada
bloque y manténgalos en el mismo orden de origen:

```css
@container wippy-surface (min-width: 480px)  { .grid { grid-template-columns: repeat(2, 1fr) } }
@container wippy-surface (min-width: 900px)  { .grid { grid-template-columns: repeat(4, 1fr) } }
```

## 5. Consultas de altura — **condicional** (solo con dimensionado por contenedor)

```css
/* despues */ @container wippy-surface (min-height: 500px) { .tall-only { display: block } }
```

Precondición: la página está **dimensionada por contenedor**. En el dimensionado
por contenido, la altura de la página es su propio contenido, así que las
consultas de altura nunca coinciden. Declare la dependencia para que falle de
forma ruidosa en lugar de silenciosa:

```json
{ "wippy": { "surface": { "contract": 1, "requirements": ["block-size"] } } }
```

## 6. Consultas de aspect-ratio — **condicional** (solo con dimensionado por contenedor)

```css
/* antes */ @media (min-aspect-ratio: 16/9)                      { … }
/* despues */ @container wippy-surface (min-aspect-ratio: 16/9)  { … }
```

La misma precondición que la receta 5: el aspect ratio necesita ambos ejes.

## 7. Consultas de orientación — **condicional** (solo con dimensionado por contenedor)

`@container wippy-surface (orientation: landscape)` describe la forma de *su
panel*, que suele ser lo que quería decir. Si de verdad se refería al
dispositivo, eso es una media query: manténgala (receta 13).

## 8. Altura / aspecto / orientación en dimensionado por contenido — **no convertible**

No hay eje de bloque que consultar. Reestructure para que el layout dependa del
eje inline. No lo simule con `cqh`: vea la receta 22.

No puede cambiar la app a dimensionado por contenedor usted mismo: el
dimensionado lo fija dónde renderiza la app el Web Host, no nada de su paquete.
Si el layout realmente no puede funcionar sin el eje de bloque, declare
`requirements: ["block-size"]` para que una colocación dimensionada por contenido
se rechace de plano en lugar de renderizarse mal, y consiga que la app se
renderice en un contexto dimensionado por contenedor (su propia ruta o un panel
de layout). Vea "Container sizing and content sizing" en
[Portabilidad de Surface](./surface-portability.md).

## 9. Geometría anidada dentro de una media query de entorno — **manual**

```css
/* antes */
@media (prefers-color-scheme: dark) and (min-width: 640px) { .panel { … } }

/* despues: dividir; la preferencia se queda, la geometria se mueve */
@media (prefers-color-scheme: dark) {
  @container wippy-surface (min-width: 640px) { .panel { … } }
}
```

Manual porque el orden de anidamiento puede cambiar qué declaraciones ganan
cuando las dos condiciones se combinaban antes en un solo prelude. Vuelva a
comprobar el resultado.

## 10. Ramas OR con coma — **manual**

```css
/* antes */ @media (max-width: 480px), (min-width: 1200px) { … }
```

Una coma es OR. Dividirla en dos bloques `@container` preserva el OR **solo si
los dos bloques son por lo demás idénticos y adyacentes**; si los anida por
accidente ha convertido el OR en AND, que no coincide con nada. Duplique las
declaraciones en dos bloques hermanos:

```css
@container wippy-surface (max-width: 480px)  { … }
@container wippy-surface (min-width: 1200px) { … }
```

## 11. `not`, `only`, booleanos complejos — **manual**

`only` es un artefacto del tipo de medio y no tiene equivalente en container:
elimínelo. `not` invierte toda la condición en ambas sintaxis, pero la
precedencia difiere en cuanto mezcla `and`/`or`; parentice explícitamente en
lugar de confiar en la agrupación original.

## 12. `screen` / `print` combinados con geometría — **manual**

Los *tipos* de medio no tienen forma de container. Mantenga el tipo como media
query y anide la geometría dentro (como en la receta 9). En particular, el layout
de impresión normalmente debería seguir basado por completo en el viewport/página.

## 13. Las preferencias siguen siendo media queries — **no convertible** (y correctas tal cual)

`prefers-color-scheme`, `prefers-contrast`, `prefers-reduced-motion`,
`forced-colors`, `hover`, `pointer`, `any-pointer`. `@container` solo soporta
características de tamaño. Convertirlas produce una regla que nunca coincide.

## 14. Breakpoints en `em` — **manual**

`@media (min-width: 40em)` resuelve `em` contra el tamaño de fuente inicial.
`@container wippy-surface (min-width: 40em)` lo resuelve contra el tamaño de
fuente **del contenedor**. Si difieren, su breakpoint se mueve en silencio.
Conviértalo a `px`, o verifique antes el `font-size` computado del contenedor.

## 15. Breakpoints en `rem` — **manual**

`rem` **no** es relativo a la raíz dentro de `@media`. Las condiciones de media
query resuelven tanto `em` como `rem` contra el tamaño de fuente *inicial* (el
predeterminado del navegador, independiente de cualquier CSS del autor), mientras
que `@container` los resuelve de la forma ordinaria, contra el tamaño de fuente
computado real de la raíz o del contenedor.

Así que los dos ya son desiguales en el momento en que el tamaño de fuente raíz
difiere del predeterminado del navegador, sin que nada cambie en runtime. El
habitual reset `html { font-size: 62.5% }` basta para mover un breakpoint
convertido de 640px a 400px.

Por tanto, "nada cambia el tamaño de fuente raíz" **no** es una precondición
suficiente. Convierta a `px`, exactamente igual que con `em` (receta 14), salvo
que el tamaño de fuente computado de la raíz sea demostrablemente igual al
predeterminado del navegador.

## 16. Frontera entre viewport y content box con barra de scroll — **condicional**

`100vw` incluye el canal clásico de la barra de scroll. En el **motor de iframe**
la anchura de la surface es el **content box** de la caja de consulta dentro del
documento de la app, así que no lo incluye: en una página con barra de scroll de
documento el valor convertido es más estrecho por el ancho de la barra, que
suele ser la corrección que quería (`100vw` provocando overflow horizontal es un
bug clásico).

El **motor de fragment** mide un envoltorio del documento del host que el scroll
del contenido no estrecha, así que no aplica esa corrección. El mismo panel, el
mismo contenido con scroll, anchuras que difieren en una barra de scroll. La
condición de esta receta es por tanto *en qué motor se ejecuta la app*, no
simplemente si la alineación es exacta al píxel.

## 17. Reglas que apuntan a `html` / `body` — **manual**

Una container query nunca estiliza su propio contenedor, y una regla dirigida a
`html` o `body` falla en ambos motores, por razones distintas:

- **Motor de iframe:** el host envuelve el contenido de su body en la caja de
  surface, así que `html` y `body` son *ancestros* del contenedor de consulta. Una
  regla `@container` no puede alcanzar a un ancestro.
- **Motor de fragment:** la topología opuesta (la caja de consulta es un
  envoltorio del documento del host *por encima* de su contenido), pero un
  selector literal `body` sigue fallando, porque el documento reflejado se
  renombra a `wf-html` / `wf-body`.

En cualquier caso la solución es la misma, y es segura para ambos motores:

```css
/* ✗ nunca coincide, en silencio */
@container wippy-surface (min-width: 640px) { body { display: flex } }

/* ✓ muevala a su propia raiz dentro de la surface */
@container wippy-surface (min-width: 640px) { #app { display: flex } }
```

## 18. `<picture><source media>` y `<link media>` — **no convertible**

La selección de recursos a nivel de HTML no tiene forma de container query. O
bien la dirige desde JS con `host.surface.onChange`, o bien mueve la dirección
artística al CSS (`background-image` bajo una regla `@container`), donde el
contrato aplica.

## 19. Geometría con `matchMedia()` → `host.surface` — **automática**

```js
// antes
const mq = matchMedia('(min-width: 640px)')
mq.addEventListener('change', render)

// despues
const off = host.surface.onChange(s => render(s.width >= 640))
render(host.surface.snapshot.width >= 640)
// llame a off() al desmontar
```

Mantenga `matchMedia` para las consultas de preferencias: solo la geometría está
mal.

## 20. CSS en runtime, adopted stylesheets, CSS-in-JS — **manual**

Prefiera emitir reglas `@container wippy-surface (...)` y dejar que el CSS
responda. Si calcula píxeles en JS, regenérelos desde `onChange`: un valor leído
una sola vez de `snapshot` queda congelado y se desincroniza en el siguiente
redimensionado. Nunca emita usted mismo los cuatro nombres reservados
`--wippy-surface-*`, y nunca los registre con `@property` /
`CSS.registerProperty()`: el registro anula la señal de "eje de bloque no
disponible" del host, así que una app dimensionada por contenido se declara en
silencio como dimensionada por contenedor; una declaración descendiente
ensombrece el valor heredado y desancla su página de la surface.

## 21. CSS empaquetado de terceros — **manual**

Normalmente no puede editarlo. Por orden de preferencia: configure la biblioteca
para que acepte un breakpoint/anchura que usted le suministre desde
`host.surface`; envuélvala en su propio contenedor y traduzca; o fije la página al
motor de iframe (`wippy.renderEngine: "iframe"`) y acepte el comportamiento
basado en ventana. El escaneo en tiempo de build para encontrarlos
automáticamente **aún no está entregado**.

## 22. Contenedores anidados y la trampa del fallback de `cq*` — **manual**

Las unidades de contenedor se resuelven contra el contenedor *más cercano* que
tenga el eje que necesitan. Dos consecuencias:

```css
.card { container-type: inline-size; }   /* NO tiene eje de bloque */
.card .thing { block-size: 25cqh; }      /* ✗ usa el small viewport en silencio */
```

`cqh`/`cqb` no dan error cuando no se encuentra un contenedor con eje de bloque:
recurren al small viewport y renderizan un número plausible pero equivocado. Use
`var(--wippy-surface-height, <fallback>)` cuando quiera el eje de bloque de la
surface: está anclado a la raíz, así que un contenedor más cercano no puede
interceptarlo, y recurre visiblemente al fallback cuando no está disponible.

Las consultas de componente son aditivas, no un reemplazo: `wippy-surface` sigue
refiriéndose al área de la página desde dentro de un contenedor anidado.

---

## Unidades de viewport

| Antes | Use | Notas |
| --- | --- | --- |
| `100vw` | `var(--wippy-surface-width)` | content box; vea la receta 16 |
| `1vw` / `37vw` | `calc(var(--wippy-surface-width-unit) * 37)` o `37cqw` | la unidad es el 1 % |
| `100vh` | `var(--wippy-surface-height)` | solo con dimensionado por contenedor |
| `1vh` / `37vh` | `calc(var(--wippy-surface-height-unit) * 37)` | solo con dimensionado por contenedor |
| `vmin` | `min(var(--wippy-surface-width), var(--wippy-surface-height))` | solo con dimensionado por contenedor: necesita ambos ejes |
| `vmax` | `max(var(--wippy-surface-width), var(--wippy-surface-height))` | solo con dimensionado por contenedor |
| `vi` / `vb` | `cqi` / `cqb`, o las variables físicas | lógicas; las variables de surface son físicas |
| `sv*` / `lv*` / `dv*` | `var(--wippy-surface-*)` | **no hay equivalentes separados.** Describen estados del chrome del navegador que un panel no tiene; la surface tiene un solo tamaño |

`sv*`/`lv*` son unidades CSS reales: **no** significan "surface".

### Cálculos

```css
/* antes */ block-size: calc(100vh - 4rem);
/* despues */ block-size: calc(var(--wippy-surface-height, 400px) - 4rem);
```

El fallback es deliberadamente fijo y obviamente erróneo en lugar de `100vh`: vea "No esconda un contrato ausente detrás de un fallback" más abajo. Eso importa más en el eje de bloque que en el inline: la altura es inválida en **toda** colocación dimensionada por contenido, no solo donde el contrato está ausente, así que un fallback de `100vh` renderiza en silencio la altura de la ventana la primera vez que la app se incrusta.

`min()`/`max()`/`clamp()` se convierten sin cambios; sustituya las unidades dentro de ellos.

### Cuándo `100%` es mejor que un valor de surface

Si un elemento debe llenar a su **padre**, use `100%` o `w-full`. Recurra a
`--wippy-surface-width` solo cuando necesite específicamente el área de la
*página*, típicamente porque un ancestro es más estrecho y quiere escapar de él.
Anclar a la raíz algo que debería ser relativo al padre es la forma en que un
layout acaba correcto a una profundidad de anidamiento y mal a otra.

### No esconda un contrato ausente detrás de un fallback

```css
/* ✗ */ inline-size: var(--wippy-surface-width, 100vw);
```

Eso renderiza la anchura de la ventana cuando el contrato está ausente: el
bug exacto que el contrato existe para prevenir, hecho invisible. Deje que falle
de forma visible, o elija un fallback fijo que sea obviamente erróneo (`400px`)
para que se note.

---

## Overlays

El contrato de surface **no** captura `position: fixed`: `container-type`
establece un contexto de formato independiente sin contención de layout, así que
un contenedor de consulta computa `contain: none` y no ancla nada. Esto está
verificado en Chromium, Firefox y WebKit. Tanto los overlays de PrimeVue como los
overlays fijos hechos a mano siguen funcionando, así que **el posicionamiento no
necesita migración**.

Su *dimensionado* sí. Un overlay pensado para cubrir la surface debería usar
`inset: 0`, no `100vw`/`100vh`, que miden la ventana del navegador y se pasan en
un host multipanel, y tampoco `var(--wippy-surface-height)`, que no está
disponible en el dimensionado por contenido. Combine `inset: 0` con
`position: absolute` dentro de una raíz `position: relative` propia de la app si
debe funcionar en ambos motores; `position: fixed` solo es correcto en el motor de
iframe, por la razón que sigue justo debajo.

Lo que sí requiere atención es el motor, no el contrato: en el motor de Web
Fragment `position: fixed` se resuelve contra la **ventana del host**, no contra
su panel. Vea [Motores de Renderizado](../web-host/render-engines.md) y fije la app
con `wippy.renderEngine: "iframe"` si eso importa.

La colocación de overlays mediada por el host y los helpers de scroll de
`host.surface` **aún no están entregados**.

---

## Lista de comprobación

1. Clasifique cada regla (página / componente / preferencia / ventana deliberada).
2. Convierta la geometría con intención de página a `@container wippy-surface`.
3. Reemplace las unidades de viewport por las variables de surface.
4. Mueva cualquier regla que apuntase a `html`/`body` a su propio elemento raíz.
5. Vuelva a comprobar los breakpoints en `em`.
6. Declare `requirements` si depende del eje de bloque.
7. Ejecute la página en ambos motores **y con ambos dimensionados**: contenedor y
   contenido son lo que esta migración activa realmente, y una app está
   dimensionada por contenido siempre que se incrusta en lugar de enrutarse.
   Compruebe en cuál está con `host.surface.snapshot.sizing`, y condicione el
   comportamiento del eje de bloque a `host.surface.supports('block-size')`.
