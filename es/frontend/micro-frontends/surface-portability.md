# Portabilidad de Surface

A una app de micro frontend se le asigna una **surface**: el área rectangular que el Web Host le reserva. Esa área normalmente **no** es la ventana del navegador: la app puede ser uno de varios paneles en un [layout multipanel](../web-host/multi-panel-layout.md), y la misma app puede renderizarse con cualquiera de los dos [motores de renderizado](../web-host/render-engines.md) en tamaños distintos dentro de la misma pantalla.

Dimensionar un layout contra la ventana es, por tanto, incorrecto en ambos motores. El contrato de surface le da una alternativa portable en CSS y en JavaScript.

> **Estado:** contrato 1, entregado. Las variantes `surface-*` de Tailwind, el scroll mediado por el host y el hit testing profundo **aún no están entregados**; esta página documenta solo lo que existe hoy.

## El contrato de CSS

### Container queries

El host nombra la caja de la app `wippy-surface`, así que puede consultarse como cualquier contenedor CSS:

```css
@container wippy-surface (min-width: 640px) {
  .sidebar { display: block; }
}
```

Use esto en lugar de `@media (min-width: 640px)` para todo lo que responda al espacio que ocupa la app. Las unidades nativas de contenedor se resuelven contra la misma caja:

```css
.hero { inline-size: 50cqw; }
```

### Variables de surface

Cuatro propiedades personalizadas llevan la geometría como longitudes en píxeles:

| Propiedad | Significado |
|----------|---------|
| `--wippy-surface-width` | anchura completa de la surface |
| `--wippy-surface-width-unit` | 1 % de la anchura de la surface |
| `--wippy-surface-height` | altura completa de la surface (solo con dimensionado por contenedor) |
| `--wippy-surface-height-unit` | 1 % de la altura de la surface (solo con dimensionado por contenedor) |

Son el reemplazo portable de `vw` / `vh`:

```css
/* antes: inline-size: 50vw */
.panel { inline-size: calc(var(--wippy-surface-width-unit) * 50); }
```

Los valores se heredan, así que cualquier elemento de la app puede leerlos. Informan del **content box** de la caja de consulta, que es la misma caja contra la que se resuelve `100cqw`.

Las aplicaciones **no** deben declarar ni asignar estos cuatro nombres. Una declaración descendiente ensombrece el valor heredado y desancla la app de la surface en silencio.

También deben permanecer **sin registrar**. No las describa con `@property` ni con `CSS.registerProperty()`. El host marca el eje de bloque como no disponible asignando un valor garantizado como inválido, que computa a la cadena vacía solo mientras la propiedad esté sin registrar. Deles un `initial-value` y computarán a eso en su lugar, así que una app dimensionada por contenido se declara como dimensionada por contenedor y `supports('block-size')` empieza a devolver `true`, sin ningún error en ninguna parte.

Dos advertencias antes de comparar estos valores con `100cqw` píxel a píxel. El **primer frame puede ser más ancho**: el valor de arranque se siembra desde el elemento `<iframe>` del lado del host antes de que exista el documento de la app, así que no puede saber si el contenido levantará una barra de scroll. Ese valor queda incrustado en el CSS del documento, así que el primer layout lo usa y se corrige un frame después. Y los valores están **cuantizados a 1/64 px**, así que compare con una tolerancia.

## Dimensionado por contenedor y dimensionado por contenido

| | Eje inline | Eje de bloque |
|---|---|---|
| **Dimensionado por contenedor**: el host impone ambas dimensiones | disponible | disponible |
| **Dimensionado por contenido**: el contenido de la app decide la altura | disponible | **no disponible** |

En el dimensionado por contenido las propiedades de altura son deliberadamente inválidas, así que `var(--wippy-surface-height, 400px)` recurre al fallback en lugar de informar un número, y `@container wippy-surface (min-height: …)` nunca coincide.

**Cuál le toca a una app no es una elección del autor**, y nada de `package.json` lo cambia. El dimensionado lo fija *dónde renderiza el Web Host la app*:

| Renderizada como | Dimensionado |
|---|---|
| una página enrutada, un panel de layout, el panel derecho, una pestaña de registry | **contenedor** |
| un artefacto incrustado, un bloque de artefacto en línea, un widget de la barra de navegación | **contenido** |

Así que el mismo paquete está dimensionado por contenedor en su propia ruta y por contenido cuando alguien lo incrusta. Una app que necesite el eje de bloque debe por tanto tolerar no tenerlo, o declarar el requisito (abajo) para que se rechace en vez de renderizarse rota. Lea el modo actual con `host.surface.snapshot.sizing`, y condicione el comportamiento a `host.surface.supports('block-size')`; nunca lo suponga.

`cqh` se comporta peor que "no disponible": las unidades de contenedor recurren al **small viewport** cuando ningún contenedor aporta el eje que necesitan, así que `cqh` produce en silencio un número plausible pero sin relación con la surface. Prefiera `var(--wippy-surface-height, <fallback>)`, que está anclado a la raíz y recurre al fallback de forma visible. La misma trampa aparece dentro de una app que declara `container-type: inline-size` en un elemento intermedio y luego usa `cqh` por debajo.

## Declarar requisitos

Opcional, en el `package.json` de la app:

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

Los tokens aceptados son `block-size` y `surface-scroll`, ambos requieren dimensionado por contenedor y se rechazan cuando la instancia está dimensionada por contenido. `registered-hit-testing`, `native-document-hit-testing` y `owner-visibility` son vocabulario reservado y se rechazan como no implementados en lugar de ignorarse en silencio.

La validación se ejecuta antes del arranque, así que una declaración insatisfacible falla de forma visible en lugar de renderizar una app cuyas consultas de eje de bloque nunca coinciden. Una app sin bloque `surface` sigue renderizándose y sigue recibiendo la caja de consulta y las variables; simplemente no anuncia portabilidad.

`surface-scroll` se acepta y lo informa `supports()`, pero esta release **no** entrega API de scroll mediada por el host: declararlo afirma una intención, no desbloquea un método.

## Leer la surface desde JavaScript

Vea [API del Proxy → Surface](./proxy-api.md#surface) para la firma completa.

```js
const { width, widthUnit, height, sizing } = host.surface.snapshot

if (host.surface.supports('block-size')) {
  // es seguro apoyarse en el eje de bloque
}

const off = host.surface.onChange((s) => reposition(s.width, s.height))
// llame a off() al desmontar
```

El snapshot se lee de vuelta de las mismas propiedades personalizadas computadas que resuelve el CSS, así que no puede desviarse de lo que ven `@container` y `cqw`.

Prefiera CSS para el layout. Recurra a la API de JavaScript donde el CSS no llega: dimensionado de canvas, cálculos de virtualización, selección de recursos y estilos generados en runtime.

### `engine: 'host'`

`host.surface.engine` informa de `iframe`, `fragment` o `host`. El último no es un motor de página: significa que el código se ejecuta donde no se asignó ninguna surface:

- un web component montado directamente en el documento del host en lugar de en una página;
- el dev proxy standalone, sin ningún Web Host.

Ahí, el snapshot informa `width: 0`, `height: null`, `sizing: 'content'`, y `supports()` es `false` para todo. Eso es deliberado: sustituirlo por la ventana del navegador sería la falsa equivalencia que el contrato existe para evitar. Un componente montado directamente debería medir su propia raíz en su lugar.

## Qué no cubre el contrato

Las container queries reemplazan a las media queries en **CSS**. Estos mecanismos viven fuera del CSS y siguen siguiendo a la ventana del navegador:

| Mecanismo | Por qué | Qué hacer |
|---|---|---|
| `<picture>` / `<source media>` | selección de recursos en HTML; sin forma de container query | Dirigirlo desde `host.surface.onChange`, o mover la dirección artística a un `background-image` CSS bajo `@container` |
| `srcset` + `sizes` | se resuelven contra el viewport | Derivar `sizes` de la surface, o fijar la fuente desde JS |
| `matchMedia()` | pregunta a la ventana por definición | Use `host.surface.onChange` para geometría; mantenga `matchMedia` para preferencias |

## Overlays

El contrato de surface **no** captura `position: fixed`. `container-type` establece un contexto de formato independiente sin contención de layout, así que un contenedor de consulta computa `contain: none` y no ancla nada. Tanto los overlays de PrimeVue como los overlays fijos hechos a mano siguen funcionando sin cambios.

El comportamiento del motor es asunto aparte: en el motor de Web Fragment `position: fixed` se resuelve contra la **ventana del host**, no contra el panel de la app. Vea [Motores de Renderizado](../web-host/render-engines.md) y fije la app con `wippy.renderEngine: "iframe"` si el anclaje exacto al viewport importa.

Dimensionar un overlay es una cuestión distinta de anclarlo. Para un backdrop o un drawer que deba cubrir exactamente la surface, deje las unidades de viewport y use `inset: 0`, pero combínelo con el esquema de posicionamiento que corresponda a lo portable que deba ser la app:

```css
/* Portable en AMBOS motores: se resuelve contra la propia raiz de la app en
   lugar de contra aquello a lo que `fixed` resulte ser relativo.
   `min-block-size: 100%` es estructural: vea mas abajo. */
.app-root { position: relative; min-block-size: 100%; }
.backdrop { position: absolute; inset: 0; }
```

El bloque contenedor es la **raíz de la app**, no la surface, así que el overlay cubre la surface solo si esa raíz lo hace. En el dimensionado por contenido lo hace automáticamente (el contenido *es* la altura). En el dimensionado por contenedor el host impone una altura a la caja de consulta que la raíz de la app no hereda, así que sin `min-block-size: 100%` el backdrop se queda corto en silencio, fallando exactamente en el modo donde la versión con `fixed` habría parecido correcta. Los dos también difieren en comportamiento: `absolute` se desplaza con el contenido, `fixed` se queda fijo.

Ponga `min-block-size: 100%` en el elemento **más externo** dentro de la surface. Una altura en porcentaje necesita una cadena ininterrumpida de alturas definidas por encima, así que aplicarlo a la raíz de un componente anidado dentro de un `#app` de altura automática resuelve a cero y reintroduce el mismo hueco. Verificado en Chromium, Firefox y WebKit, con el caso sin `min` como control.

```css
/* Solo motor de iframe. `fixed` se resuelve contra el viewport hijo, que ALLI
   ES la surface; pero contra la VENTANA DEL HOST en el motor de fragment,
   donde esto cubre toda la aplicacion en lugar del panel. */
.backdrop { position: fixed; inset: 0; }
```

Evite `var(--wippy-surface-height)` para esto: no está disponible en el dimensionado por contenido, así que un backdrop escrito así se colapsa exactamente en las páginas donde es más difícil de notar.

## El elemento raíz de la app (`#app`)

**El motor de Web Fragment requiere que su elemento raíz sea `id="app"`.** Ni
`#root`, ni `#main`, ni `<main>`: el id se compara literalmente.

El motor liga la cadena de altura de la página a ese selector y mide a través de
él la altura de su contenido. El documento reflejado expone `wf-html`/`wf-body`
en lugar de `html`/`body`, así que no puede construir la cadena desde la raíz del
documento como sí puede dentro de un iframe.

**Síntoma cuando está mal:** una página de fragment dimensionada por contenido
cuya raíz es `#root` (o cualquier otra cosa) se renderiza con **altura cero**:
panel en blanco, sin error en su propio código. El host registra un error que
nombra el requisito. El motor de iframe no se ve afectado, porque toma la altura
de `CmdBodySize`, así que el mismo paquete puede verse bien allí y estar en
blanco como fragment.

```html
<!-- correcto -->
<body><div id="app"></div></body>
```

```js
createApp(App).mount('#app')
```

**No intente arreglar un fragment de altura cero dándole una altura a `#root`.**
Añadir `height: 100%`, `min-height: 100dvh` o `100vh` a una raíz con otro nombre
no hace que el motor la mida, y las unidades de viewport están mal aquí por la
razón por la que existe toda esta página: describen la ventana del navegador, no
su surface. Renombre el elemento a `app` en su lugar.

## Limitaciones

- **Caja del body.** En el motor de iframe el host pone a cero `margin`, `padding` y `border` del `body` de la app para que la surface asignada quede bien definida. Ponga el padding de página en su propio elemento raíz. El motor de fragment no hace esto, así que una app que se apoye en el padding del body se renderiza ligeramente distinta entre motores. Todavía no hay un diagnóstico en tiempo de build para esto.
- **Selectores `body > *` y reglas que apuntan a `html`/`body`.** En el motor de **iframe** el host envuelve el contenido del body en la caja de surface, así que los selectores de hijo directo enraizados en `body` ya no coinciden con elementos de la app, y `body`/`html` pasan a ser *ancestros* de la caja de consulta: una regla `@container` que los apunte nunca se aplica. El motor de **fragment** tiene la topología opuesta (la caja de consulta está por encima del árbol reflejado), pero un selector literal `body` sigue fallando allí porque el documento reflejado se renombra `wf-html`/`wf-body`. Ponga esas reglas en su propio elemento raíz dentro de la surface; eso es correcto en ambos motores.
- **Cualquier cosa renderizada a través de `<w-iframe>` / `<w-artifact>` no obtiene surface, incluido un panel gestionado de nivel superior.** Estos elementos siempre construyen su documento hijo con el bootstrap de surface deshabilitado y nada los mide, así que `host.surface` informa `width: 0` y `sizing: 'content'`, pero con `engine: 'iframe'`, no `engine: 'host'`. Compruebe `snapshot.width` en lugar de `engine` si su componente puede incrustarse de esa forma. Eso es lo esperado en un embed *anidado*; es fácil pasarlo por alto en un panel de layout gestionado declarado como `{ kind: 'component', tagName: 'w-artifact' }`, que es un slot de nivel superior a tamaño completo y aun así no obtiene contrato. Use `kind: 'page'` para contenido que necesite uno.
- **Sin eje de bloque en el dimensionado por contenido.**
- **El motor de fragment requiere que el elemento raíz de la app sea `#app`.** Liga la cadena de altura de la página a ese selector y mide a través de él la altura del contenido, porque el documento reflejado expone `wf-html`/`wf-body` en lugar de `html`/`body`, de modo que una app no puede construir su propia cadena desde la raíz como sí puede dentro de un iframe. Una app de fragment dimensionada por contenido con otra raíz (`#root`, `<main>`) no puede medirse: el host registra un error que nombra el requisito y el panel se renderiza con altura cero. El motor de iframe no se ve afectado: toma la altura de `CmdBodySize`.
- **La ruta obsoleta `/page/:id` no obtiene surface.** Renderiza en un iframe desnudo que nunca mide nada, así que se queda totalmente fuera: sin caja de consulta, sin envoltorio, sin cambios en el DOM de la app. Una app se comporta allí exactamente como antes de que existiera este contrato. Use `/c/:id` para obtener una surface. Igual que los embeds anidados, sigue informando `engine: 'iframe'`, así que compruebe `snapshot.width` en lugar del nombre del motor.
- **Los dos motores pueden diferir en una barra de scroll.** El motor de iframe mide el eje inline desde la caja de consulta *dentro* del documento de la app, así que una barra de scroll de documento lo estrecha. El motor de fragment mide un envoltorio del documento del host, que el scroll del contenido reflejado no estrecha. El mismo panel asignado y el mismo contenido con scroll: el motor de fragment informa el número ligeramente más ancho.
- **No es un límite de aislamiento.** El contrato gobierna el layout. No le da a un fragment un documento, viewport, selección, top layer u origen independientes.

## Migración

[Migración de Surface](./surface-migration.md) tiene conversiones receta a receta para apps existentes, cada una etiquetada como automática, condicional, manual o no convertible.
