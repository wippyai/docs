---
title: "Portabilidad de superficies"
description: "Use consultas de contenedor, variables de superficie y host.surface para dimensionar aplicaciones view.page con independencia del viewport del navegador."
---

# Portabilidad de superficies

**Clasificación: referencia del contrato de renderizado con ejemplos específicos.** Los bloques CSS, JavaScript y de metadatos de paquete ilustran reglas individuales del contrato; no son un fixture de aplicación completo.

Una aplicación micro frontend recibe una **superficie**: el área rectangular que Web Host le asigna. Normalmente esa área **no** es la ventana del navegador. La aplicación puede ocupar un panel entre varios en un [layout multipanel](../web-host/multi-panel-layout.md), y la misma aplicación puede renderizarse mediante cualquiera de los [motores de renderizado](../web-host/render-engines.md) con tamaños distintos en una misma pantalla.

Por tanto, dimensionar un layout a partir de la ventana es incorrecto en ambos motores. El contrato de superficie ofrece una alternativa portable en CSS y JavaScript.

> **Estado:** contrato 1, publicado. Las variantes Tailwind `surface-*`, el scroll mediado por el host y el hit testing profundo **aún no están publicados**; esta página solo documenta lo que existe actualmente.

## Contrato CSS

### Consultas de contenedor

El host denomina `wippy-surface` al cuadro de la aplicación, de modo que puede consultarse como cualquier contenedor CSS:

```css
@container wippy-surface (min-width: 640px) {
  .sidebar { display: block; }
}
```

Use esto en vez de `@media (min-width: 640px)` para cualquier comportamiento que responda al espacio ocupado por la aplicación. Las unidades nativas de contenedor se resuelven respecto al mismo cuadro:

```css
.hero { inline-size: 50cqw; }
```

### Variables de superficie

Cuatro propiedades personalizadas transportan la geometría como longitudes sencillas en píxeles:

| Propiedad | Significado |
|----------|---------|
| `--wippy-surface-width` | anchura completa de la superficie |
| `--wippy-surface-width-unit` | 1 % de la anchura de la superficie |
| `--wippy-surface-height` | altura completa de la superficie (solo dimensionado por contenedor) |
| `--wippy-surface-height-unit` | 1 % de la altura de la superficie (solo dimensionado por contenedor) |

Son el sustituto portable de `vw` / `vh`:

```css
/* was: inline-size: 50vw */
.panel { inline-size: calc(var(--wippy-surface-width-unit) * 50); }
```

Los valores se heredan, por lo que cualquier elemento de la aplicación puede leerlos. Describen el **content box** del cuadro de consulta, el mismo cuadro respecto al que se resuelve `100cqw`.

Las aplicaciones **no deben** declarar ni asignar estos cuatro nombres. Una declaración descendiente oculta el valor heredado y desvincula silenciosamente la aplicación de la superficie.

También deben permanecer **sin registrar**. No los describa con `@property` ni `CSS.registerProperty()`. El host marca el eje de bloque como no disponible asignando un valor inválido garantizado, que solo se calcula como cadena vacía mientras la propiedad no está registrada. Si le asigna un `initial-value`, se calculará ese valor; una aplicación dimensionada por contenido se presentará como dimensionada por contenedor y `supports('block-size')` comenzará a devolver `true`, sin mostrar ningún error.

Dos matices al comparar estos valores con `100cqw` píxel por píxel. El **primer frame puede ser más ancho**: el valor de arranque se toma del elemento `<iframe>` del host antes de que exista el documento de la aplicación, por lo que desconoce si el contenido producirá una barra de desplazamiento. Ese valor se integra en el CSS del documento; el primer layout lo usa y se corrige un frame después. Además, los valores se **cuantizan a 1/64 px**, así que compare con tolerancia.

## Dimensionado por contenedor y por contenido

| | Eje inline | Eje de bloque |
|---|---|---|
| **Dimensionado por contenedor**: el host impone ambas dimensiones | disponible | disponible |
| **Dimensionado por contenido**: el contenido de la aplicación decide la altura | disponible | **no disponible** |

En el dimensionado por contenido, las propiedades de altura son deliberadamente inválidas, por lo que `var(--wippy-surface-height, 400px)` usa el fallback en vez de devolver un número y `@container wippy-surface (min-height: …)` nunca coincide.

**La aplicación no elige cuál recibe**, y nada en `package.json` lo modifica. El dimensionado depende de *dónde renderiza Web Host la aplicación*:

| Se renderiza como | Dimensionado |
|---|---|
| una página enrutada, un panel de layout, el panel derecho o una pestaña de registro | **contenedor** |
| un artefacto integrado, un bloque de artefacto inline o un widget de navbar | **contenido** |

Así, el mismo paquete se dimensiona por contenedor en su propia ruta y por contenido cuando alguien lo integra. Una aplicación que necesite el eje de bloque debe tolerar su ausencia o declarar el requisito —como se explica a continuación— para que se rechace en lugar de renderizarse rota. Lea el modo actual mediante `host.surface.snapshot.sizing` y condicione el comportamiento a `host.surface.supports('block-size')`; nunca lo presuponga.

`cqh` se comporta peor que «no disponible»: las unidades de contenedor recurren al **viewport pequeño** cuando ningún contenedor proporciona el eje necesario, por lo que `cqh` produce silenciosamente un número plausible que no tiene relación con la superficie. Prefiera `var(--wippy-surface-height, <fallback>)`, que está fijado a la raíz y usa el fallback de forma visible. El mismo problema aparece dentro de una aplicación que declara `container-type: inline-size` en un elemento intermedio y usa `cqh` bajo él.

## Declaración de requisitos

Opcional, en el `package.json` de la aplicación:

```json
{
  "wippy": {
    "path": "index.html",
    "surface": {
      "contract": 1,
      "requirements": ["block-size"]
    }
  }
}
```

Los tokens aceptados son `block-size` y `surface-scroll`; ambos requieren dimensionado por contenedor y se rechazan cuando la instancia está dimensionada por contenido. `registered-hit-testing`, `native-document-hit-testing` y `owner-visibility` son vocabulario reservado y se rechazan como no implementados en vez de ignorarse silenciosamente.

La validación se ejecuta antes del arranque, de modo que una declaración imposible falla de forma visible en lugar de renderizar una aplicación cuyas consultas del eje de bloque nunca coinciden. Una aplicación sin bloque `surface` sigue renderizándose y recibiendo el cuadro de consulta y las variables; simplemente no anuncia portabilidad.

`surface-scroll` se acepta y `supports()` lo notifica, pero esta versión **no** incluye ninguna API de scroll mediada por el host: declararlo expresa una intención, no habilita un método.

## Lectura de la superficie desde JavaScript

Consulte [API Proxy → Superficie](./proxy-api.md#superficie) para ver la firma completa.

```js
const { width, widthUnit, height, sizing } = host.surface.snapshot

if (host.surface.supports('block-size')) {
  // safe to rely on the block axis
}

const off = host.surface.onChange((s) => reposition(s.width, s.height))
// call off() on teardown
```

La instantánea se lee de las mismas propiedades personalizadas calculadas que resuelven CSS, por lo que no puede divergir de lo que ven `@container` y `cqw`.

Prefiera CSS para el layout. Use la API JavaScript donde CSS no llega: dimensionado de canvas, cálculos de virtualización, selección de recursos y estilos generados en runtime.

### `engine: 'host'`

`host.surface.engine` devuelve `iframe`, `fragment` o `host`. El último no es un motor de página: indica que el código se ejecuta donde no se asignó ninguna superficie:

- un componente web montado directamente en el documento del host en lugar de una página;
- el proxy de desarrollo independiente, sin Web Host.

En ese caso, la instantánea devuelve `width: 0`, `height: null`, `sizing: 'content'` y `supports()` es `false` para todo. Es deliberado: sustituirla por la ventana del navegador sería la equivalencia falsa que el contrato pretende evitar. Un componente montado directamente debe medir su propia raíz.

## Lo que no cubre el contrato

Las consultas de contenedor sustituyen las consultas media en **CSS**. Estos mecanismos viven fuera de CSS y siguen usando la ventana del navegador:

| Mecanismo | Motivo | Solución |
|---|---|---|
| `<picture>` / `<source media>` | Selección de recursos HTML; no existe una forma de consulta de contenedor | Controle desde `host.surface.onChange` o mueva la dirección artística a un `background-image` CSS bajo `@container` |
| `srcset` + `sizes` | se resuelven respecto al viewport | Derive `sizes` de la superficie o defina el origen desde JS |
| `matchMedia()` | consulta la ventana por definición | Use `host.surface.onChange` para geometría; conserve `matchMedia` para preferencias |

## Overlays

El contrato de superficie **no** captura `position: fixed`. `container-type` establece un contexto de formato independiente sin contención de layout, por lo que un contenedor de consulta calcula `contain: none` y no ancla nada. Los overlays de PrimeVue y los overlays fixed propios siguen funcionando sin cambios.

El comportamiento del motor es otra cuestión: en Web Fragment, `position: fixed` se resuelve respecto a la **ventana del host**, no al panel de la aplicación. Consulte [Motores de renderizado](../web-host/render-engines.md) y fije la aplicación con `wippy.renderEngine: "iframe"` si importa el anclaje exacto al viewport.

Dimensionar un overlay es distinto de anclarlo. Para un fondo o drawer que deba cubrir exactamente la superficie, sustituya las unidades de viewport por `inset: 0`, pero combínelo con el esquema de posicionamiento que corresponda a la portabilidad requerida:

```css
/* Portable across BOTH engines: resolves against the app's own root rather
   than against whatever `fixed` happens to be relative to.
   `min-block-size: 100%` is load-bearing — see below. */
.app-root { position: relative; min-block-size: 100%; }
.backdrop { position: absolute; inset: 0; }
```

El containing block es la **raíz de la aplicación**, no la superficie, por lo que el overlay solo cubre la superficie si la raíz también lo hace. En dimensionado por contenido sucede automáticamente, porque el contenido determina la altura. En dimensionado por contenedor, el host impone una altura al cuadro de consulta que la raíz de la aplicación no hereda; sin `min-block-size: 100%`, el fondo queda corto aunque la versión `fixed` cubriese la superficie. También difieren en comportamiento: `absolute` se desplaza con el contenido y `fixed` permanece fijado.

Defina `min-block-size: 100%` en el elemento **más externo** dentro de la superficie. Una altura porcentual necesita una cadena ininterrumpida de alturas definidas por encima, por lo que aplicarla a la raíz de un componente anidado en un `#app` de altura automática se resuelve a cero y reintroduce el mismo hueco. Verificado en Chromium, Firefox y WebKit, usando como control el caso sin `min`.

```css
/* Iframe engine only. `fixed` resolves against the child viewport, which IS
   the surface there — but against the HOST WINDOW in the fragment engine,
   where this covers the whole application instead of the panel. */
.backdrop { position: fixed; inset: 0; }
```

Evite `var(--wippy-surface-height)` para esto: no está disponible en dimensionado por contenido, por lo que un fondo escrito así colapsa en páginas dimensionadas por contenido.

## Elemento raíz de la aplicación (`#app`)

**El motor Web Fragment exige que el elemento raíz tenga `id="app"`.** No `#root`, ni `#main`, ni `<main>`: el id se compara literalmente.

El motor vincula la cadena de altura de la página a ese selector y mide a través de él la altura del contenido. El documento reflejado expone `wf-html`/`wf-body` en vez de `html`/`body`, por lo que no puede construir la cadena desde la raíz del documento como en un iframe.

**Síntoma si es incorrecto:** una página fragment dimensionada por contenido cuya raíz sea `#root` —o cualquier otra— se renderiza con **altura cero**: panel en blanco, sin error en su propio código. El host registra un error que nombra el requisito. El motor iframe no se ve afectado porque obtiene la altura de `CmdBodySize`, por lo que el mismo paquete puede parecer correcto allí y quedar en blanco como fragmento.

```html
<!-- correct -->
<body><div id="app"></div></body>
```

```js
createApp(App).mount('#app')
```

**No intente corregir un fragmento de altura cero asignando altura a `#root`.** Añadir `height: 100%`, `min-height: 100dvh` o `100vh` a una raíz con otro nombre no hace que el motor la mida. Las unidades de viewport describen la ventana del navegador, no la superficie asignada. Cambie el nombre del elemento a `app`.

## Limitaciones

- **Cuadro de body.** En iframe, el host pone a cero `margin`, `padding` y `border` del `body` de la aplicación para definir claramente la superficie asignada. Coloque el padding de la página en su propio elemento raíz. Fragment no lo hace, por lo que una aplicación que dependa del padding de body se renderiza de forma ligeramente distinta entre motores. Aún no existe un diagnóstico de compilación.
- **Selectores `body > *` y reglas dirigidas a `html`/`body`.** En iframe, el host envuelve el contenido de body en el cuadro de superficie, de modo que los selectores de hijos directos arraigados en `body` dejan de coincidir con elementos de la aplicación y `body`/`html` se convierten en *ancestros* del cuadro de consulta: una regla `@container` dirigida a ellos nunca se aplica. Fragment presenta la topología opuesta —el cuadro queda sobre el árbol reflejado—, pero un selector `body` literal tampoco funciona porque el documento se renombra a `wf-html`/`wf-body`. Coloque esas reglas en su propio elemento raíz dentro de la superficie; funciona en ambos motores.
- **Todo lo renderizado mediante `<w-iframe>` / `<w-artifact>` carece de superficie, incluso un panel gestionado de nivel superior.** Estos elementos siempre construyen el documento hijo con el arranque de superficie desactivado y nada los mide, por lo que `host.surface` devuelve `width: 0` y `sizing: 'content'`, pero con `engine: 'iframe'`, no `host`. Compruebe `snapshot.width` en vez de `engine` si el componente puede integrarse así. Es lo esperado para un embed *anidado*, pero resulta fácil pasarlo por alto en un panel gestionado de nivel superior declarado como `{ kind: 'component', tagName: 'w-artifact' }`: ocupa un slot completo pero sigue sin contrato. Use `kind: 'page'` para contenido que lo necesite.
- **Sin eje de bloque en dimensionado por contenido.**
- **Selector raíz de fragmento.** Las aplicaciones Fragment deben montarse en `#app`; consulte [Elemento raíz de la aplicación (`#app`)](#elemento-raíz-de-la-aplicación-app) para el requisito de cadena de altura y el síntoma de altura cero.
- **La ruta obsoleta `/page/:id` carece de superficie.** Renderiza en un iframe simple que no mide nada, por lo que renuncia por completo: sin cuadro de consulta, wrapper ni cambio del DOM de la aplicación. Allí una aplicación se comporta exactamente como antes del contrato. Use `/c/:id` para obtener una superficie. Como los embeds anidados, sigue notificando `engine: 'iframe'`, así que compruebe `snapshot.width`, no el nombre del motor.
- **Los motores pueden diferir por una barra de desplazamiento.** Iframe mide el eje inline desde el cuadro de consulta *dentro* del documento de la aplicación, por lo que una barra de documento lo estrecha. Fragment mide un wrapper del documento host, que el scroll del contenido reflejado no estrecha. Con el mismo panel asignado y contenido desplazable, Fragment devuelve un número ligeramente mayor.
- **No es un límite de aislamiento.** El contrato controla el layout. No proporciona a un fragmento documento, viewport, selección, capa superior ni origen independientes.

## Migración

[Migración de superficies](./surface-migration.md) contiene conversiones receta por receta para aplicaciones existentes, etiquetadas como automáticas, condicionales, manuales o no convertibles.
