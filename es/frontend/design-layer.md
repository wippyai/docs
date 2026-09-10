---
title: "La capa de diseño"
description: "Tema, capa de diseño compartida, local al módulo: qué va dónde cuando varios módulos necesitan lo mismo y el tema no tiene un sitio para ello, con ejemplos trabajados buenos y malos."
---

# La capa de diseño

Un frontend de Wippy son muchos módulos publicados de forma independiente que
renderizan en una sola aplicación. Dos hogares son obvios: el **tema**, que
consume cada superficie, y el **módulo**, que se posee a sí mismo. El hueco
entre ambos no es obvio, y es donde se acumula la duplicación: una idea que
varios módulos comparten realmente y para la que el tema no tiene componente.

Esta página nombra las tres capas, da una prueba para elegir entre ellas y
muestra cómo se ve cada elección cuando sale bien y cuando sale mal.

## Las capas

| Capa | Alcanza | Posee |
|---|---|---|
| **Tema** | *Todas* las superficies, incluidos módulos que usted no posee | Componentes de PrimeVue, los tokens semánticos compartidos, clases documentadas |
| **Capa de diseño compartida** | Solo los módulos que se adhieren | El vocabulario que esos módulos comparten y que no tiene un componente del tema detrás |
| **Módulo** | A sí mismo | Lo que es genuinamente específico de una superficie |

### El tema es universal, y esa es la restricción

El tema estiliza marcado **que usted no posee**. Cualquier módulo, incluido un
plugin de terceros escrito por alguien que nunca ha visto su aplicación,
renderiza en el mismo host y es pintado por el mismo tema. Eso es lo que hace
del tema la capa universal, y corta por los dos lados:

**Nada específico de la aplicación puede ir en el tema**, porque se impondría a
todo módulo que nunca lo pidió.

**Un módulo no puede depender de que haya algo específico de la aplicación en
el tema.** El contrato es *componentes de PrimeVue + los tokens semánticos
compartidos de Wippy + clases documentadas*, nada que una aplicación haya
añadido por encima. Tenga en cuenta que los propios presets de PrimeVue tampoco
son el contrato: Wippy ejecuta PrimeVue con `theme: 'none'`, así que son los
tokens semánticos de Wippy en los que usted se apoya.

```css
/* BIEN: tokens semánticos compartidos de Wippy, presentes para cada módulo */
.my-panel {
  color: var(--p-text-color);
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
}

/* MAL: un token específico de la aplicación. Su módulo ahora solo funciona
   dentro de una aplicación, y pierde la declaración en silencio en cualquier
   otro sitio: una propiedad personalizada indefinida hace que la declaración
   sea inválida en tiempo de valor computado, así que se descarta y el elemento
   hereda en silencio. */
.my-panel { background: var(--kx-surface-2); }
```

Esta es también la respuesta a *"¿puedo poner nuestro vocabulario compartido en
el facade?"*. Solo si realmente debe alcanzar marcado arbitrario y no poseído.
Si está acotado a *su* conjunto de módulos, no pertenece al tema: pertenece a
la capa de abajo.

### La columna vertebral, y cuándo un componente puede quedarse fuera

PrimeVue y Tailwind, tal como los entrega el host, son la columna vertebral
recomendada para cualquier componente. Un componente **puede** quedarse fuera,
pero la exención se estrecha en cuanto renderiza algo convencional, y la
escalera solo va en un sentido:

| El componente… | Entonces debe cargar |
|---|---|
| es neutral en presentación: canvas, SVG, un gráfico sin controles, sin tokens, sin utilidades, sin scroll | nada: `hostCssKeys: []` |
| consume tokens semánticos o modo oscuro | `themeConfigUrl` |
| puede hacer scroll | `iframeCssUrl` |
| renderiza markdown | `markdownCssUrl` |
| renderiza cualquier cosa que **Tailwind** pueda expresar | Tailwind: escriba utilidades, no CSS hecho a mano |
| renderiza cualquier cosa para la que **PrimeVue** entregue un componente: botón, input, formulario, tabla, diálogo, menú, tag, tooltip, cualquier control de feedback | `primeVueCssUrl` **y** `PrimeVuePlugin` |

Un gráfico sobre un canvas es la exención legítima arquetípica: no tiene UI
clásica, así que no necesita nada de la columna vertebral. Dele a ese mismo
gráfico una barra de herramientas y deja de ser neutral en presentación: el
botón es un botón de PrimeVue, y toda la integración viene con él.

Note el acoplamiento: **las utilidades de Tailwind se entregan con
`primeVueCssUrl`.** No hay una clave de CSS del host separada para Tailwind, así
que en la práctica un componente que necesita Tailwind también está cargando el
asset de PrimeVue. (`preflightCssUrl` no forma parte de la unión de claves; si
el preflight de Tailwind es realmente necesario dentro del shadow root,
cárguelo de forma imperativa: rara vez hace falta.)

La consecuencia práctica para esta página: **la mayor parte de lo que un módulo
quiere ya existe en la columna vertebral.** La capa de diseño compartida es una
banda estrecha por encima de ella, no un sitio para rehacer lo que PrimeVue y
Tailwind ya cubren. Vea [Inyección de CSS](./web-host/css-injection.md) para la
mecánica.

### La capa de diseño compartida

Algunas ideas se repiten en un conjunto conocido de módulos y no tienen
componente en el tema: una tarjeta de contenido, una fila de cabecera de
superficie, lo que una superficie muestra cuando no tiene nada, los tamaños en
los que viene un tag. Reales, compartidas y sin hogar.

Se entregan como un **paquete publicado**, materializado en cada consumidor en
tiempo de build. Debe ser un paquete y no un alias de ruta, porque los
consumidores viven en repositorios distintos: la prueba falsable de esta capa es
que un módulo en un repositorio *diferente*, sin acceso por ruta al productor,
consume el vocabulario y compila.

El módulo productor declara el paquete como un **artefacto de tiempo de build** y
cada consumidor lo materializa en su propio árbol. Vea
[Artefactos de tiempo de build](../guides/artifacts.md) para la declaración, el
formato `node-package`, lo que el runtime reconcilia por usted y el pegamento
que un build todavía tiene que aportar por sí mismo.

### El módulo

Todo lo demás, más cada divergencia deliberada del vocabulario compartido.

## Decidir dónde pertenece algo

Pregunte en orden. El primer sí gana.

1. **¿Es un valor?** Color, radio, espaciado, elevación, severidad.
   → **Tema.** Lea un token semántico. Nunca un literal.
2. **¿El tema ya entrega un componente para esto?** Button, Dialog,
   Select, Tag. → **Tema.** Use el componente. Estilícelo poniendo una clase
   *sobre* él, nunca lo reconstruya.
3. **¿Dos o más de sus módulos necesitan este mismo concepto, sin ningún
   componente del tema detrás?** → **Capa de diseño compartida.**
4. En caso contrario → **Módulo.**

La pregunta 2 es la que atrapa a la gente, y tiene una regla afilada detrás.

## Ejemplos trabajados

Los ejemplos siguientes provienen de Kickside, una aplicación Wippy cuyo CSS de
módulo tenía un 15,4 % de duplicación de clones exactos antes de que creciera
esta capa.

### Nunca reconstruya un componente del tema

PrimeVue entrega `Button`. Nueve módulos de Kickside se quedaron fuera y
escribieron a mano `.kx-btn` sobre un `<button>` nativo; otros siete módulos
usaron el componente. Ambos dialectos eran localmente razonables: simplemente no
había un sitio compartido para poner un botón, así que media aplicación inventó
uno. Medidos entre sí, coincidían en font-size y line-height y en nada más.

**Mal:** un elemento `button` nativo llevando `.kx-btn .kx-btn-primary`, una
segunda implementación de un componente que el tema ya entrega. (Escrito aquí
como selector a propósito: la puerta de documentación rechaza controles nativos
de producto en el código de ejemplo, que es esta misma regla aplicada una capa
más arriba.)

**Bien:** el componente del tema, con una clase encima cuando necesite ajustarlo.

```vue
<Button label="Save" class="kx-save" />
```

Cuando el componente del tema no encaja, eso no es licencia para reconstruirlo.
Ponga una clase sobre el componente y estilice esa clase: en el facade si el
ajuste es de toda la aplicación, en el módulo si es local. El módulo `knowledge`
de Kickside todavía lleva `.kn-btn` / `.kn-primary` sobre botones nativos; eso es
una migración pendiente, no un patrón a copiar.

### La severidad es del tema, no suya

La severidad (`success`, `danger`, `warn`, `info`) es semántica del tema con
rampas publicadas. Kickside la volvió a derivar **dieciséis veces bajo cuatro
esquemas de nombres** (`tone-gn`, `t-ok`, `kx-tone-success`, `tone-success`). El
mismo nombre de clase significaba tres colores distintos en tres módulos, así
que publicar cualquiera de las definiciones habría repintado las otras en
silencio.

```css
/* MAL: severidad vuelta a derivar bajo un nombre local del módulo */
.tone-gn { color: #16a34a; }

/* BIEN: severidad tomada del tema */
.status-dot.success { background: var(--p-success-500); }
```

Un *tono* puede seguir existiendo en la capa compartida, pero solo como **color
decorativo de categoría**, nunca como severidad. Si puede significar "esto
falló", es severidad y es del tema.

### Vocabulario compartido para el que el tema no tiene sitio

```css
/* BIEN: PrimeVue no entrega Card, ni Header de superficie, ni EmptyState.
   Estos se repiten entre módulos sin nada del tema detrás, así que son
   exactamente para lo que existe la capa compartida. */
@import "@kickside/ui-kit/kx-card.css";
@import "@kickside/ui-kit/kx-state.css";
```

### Adoptar significa importar *y borrar*

Un `@import` de CSS debe preceder a cualquier otra regla de una hoja. La hoja
compartida aterriza por tanto siempre **primero**, y todo lo que el módulo
declare después le gana con igual especificidad. Un módulo que importa el
paquete y conserva su propia copia no ha cambiado nada en absoluto.

```css
/* MAL: el import es inerte; la copia local sigue ganando */
@import "@kickside/ui-kit/kx-card.css";
.kx-card { border-radius: 14px; border: 1px solid var(--p-content-border-color); }

/* BIEN: importar, borrar la copia local, conservar solo un delta documentado */
@import "@kickside/ui-kit/kx-card.css";
/* Las tarjetas de esta superficie van en línea en una lista densa, así que
   pierden la elevación. */
.kx-card:hover { transform: none; }
```

Conserve **solo el delta**, nunca reformule el cuerpo entero. Y nunca pliegue dos
intenciones en un nombre: si un nombre de clase significa cosas distintas en dos
módulos, eso son dos conceptos llevando un solo nombre. Divida el nombre; no
elija un ganador y repinte al perdedor.

### Especificidad frente al tema

El CSS del módulo se inyecta primero en el shadow root; la hoja de PrimeVue del
tema se añade después. Ambos son elementos `<style>`, así que **decide el orden
del documento y el tema va segundo**. Una regla de módulo que deba ganar a una
clase de componente del tema necesita más *especificidad*, no una línea más
tardía en el archivo. (`adoptedStyleSheets` lleva el CSS personalizado del
facade, no el tema, así que recurrir a una hoja adoptada tampoco gana esto.)

Esto muerde con más fuerza en las clases de paso, donde su clase aterriza
*sobre* un elemento del tema:

```css
/* MAL: esta clase se aplica al propio elemento footer de PrimeVue, así que a
   igual especificidad gana el tema y el padding nunca se aplica. */
.kx-modal-foot { padding: 14px 18px; }

/* BIEN: acotada bajo la raíz del diálogo, así que supera en especificidad al
   tema */
.kx-modal > .kx-modal-foot { padding: 14px 18px; }
```

## Qué puede contener la capa compartida

Todo lo que un conjunto de módulos comparte de verdad y el tema no posee:
vocabulario CSS, tokens derivados, componentes internos, helpers, arnés de
pruebas. La duplicación es idéntica en clase: Kickside tenía diecinueve copias
de un mismo bootstrap de pruebas junto a su CSS clonado.

**Entréguelo en trozos semánticos.** Cada unidad debería ser un concepto con
nombre sobre el que un consumidor pueda razonar: `kx-card`, `kx-state`,
`kx-tag`. Prefiera paquetes de grano más fino para que un consumidor tome solo
lo que necesita; un único paquete que entregue varias unidades claramente
nombradas es viable, pero no es la forma a la que apuntar.

**Nunca un cajón de sastre.** Nada de `common`, `shared`, `misc` ni `utils`. Una
unidad cuyo nombre no dice lo que hay dentro acumulará todo lo que no tenía otro
sitio adonde ir, y habrá reconstruido el problema que esta capa existe para
resolver.

## Normalizar es un cambio visual

Consolidar copias que han derivado mueve píxeles. Kickside tenía un selector con
**diecinueve definiciones en diecisiete cuerpos distintos**. Haga el diff de cada
cuerpo, elija el canon, registre por qué lo eligió, conserve la divergencia
deliberada como un override documentado y mire el resultado. Las pruebas
unitarias no pueden ver el layout.

## Relacionado

- [Temas](./micro-frontends/theming.md): el catálogo de tokens y cómo el tema
  alcanza tanto al host como a los hijos
- [Lista de conformidad](./micro-frontends/compliance-checklist.md): las reglas
  por módulo contra las que se comprueba un frontend
- [Artefactos de tiempo de build](../guides/artifacts.md): declarar el paquete y
  materializarlo en un consumidor
- [Gestión de dependencias](../guides/dependency-management.md): declarar y
  resolver lo que un módulo consume
