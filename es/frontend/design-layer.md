---
title: "La capa de diseño"
description: "Cómo situar estilos y componentes frontend en el tema, un paquete de diseño compartido o un módulo individual."
---

# La capa de diseño

Esta página guía decisiones de propiedad del diseño. Sus fragmentos CSS y de componentes son patrones parciales que presuponen un paquete frontend Wippy y una compilación existentes.

Un frontend Wippy puede contener muchos módulos publicados de forma independiente. El **tema** alcanza todas las superficies, mientras cada **módulo** posee su presentación local. Una **capa de diseño compartida** cubre el caso más estrecho en que varios módulos comparten un concepto que el tema no proporciona.

## Las capas

| Capa | Alcanza | Posee |
|------|---------|-------|
| **Tema** | *Todas* las superficies, incluso módulos ajenos | Componentes PrimeVue, tokens semánticos compartidos y clases documentadas |
| **Capa de diseño compartida** | Solo módulos que la adoptan | Vocabulario compartido por esos módulos sin componente temático detrás |
| **Módulo** | A sí mismo | Lo específico de una superficie |

### El tema es universal, y esa es la restricción

El tema aplica estilos a markup **que no controla**. Cualquier módulo, incluido un plugin de terceros cuyo autor no conoce la aplicación, se renderiza en el mismo host y recibe el mismo tema. Esa universalidad impone dos reglas:

**Nada específico de una aplicación puede entrar en el tema**, porque se impondría a módulos que no lo solicitaron.

**Un módulo no puede depender de que algo específico de una aplicación esté en el tema.** El contrato consta de componentes PrimeVue, tokens semánticos compartidos de Wippy y clases documentadas. Los presets propios de PrimeVue tampoco son el contrato: Wippy ejecuta PrimeVue con `theme: 'none'`, así que debe depender de tokens Wippy.

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

Esto también responde a «¿puedo poner nuestro vocabulario compartido en la fachada?». Solo si debe alcanzar markup arbitrario ajeno. Si está limitado a *sus* módulos, pertenece a la capa inferior.

### La base y cuándo puede excluirse un componente

PrimeVue y Tailwind distribuidos por el host son la base recomendada. Un componente **puede** excluirse, pero la excepción desaparece en cuanto renderiza algo convencional:

| El componente… | Debe cargar |
|----------------|-------------|
| es neutral: canvas, SVG o gráfico sin controles, tokens, utilidades ni scroll | nada: `hostCssKeys: []` |
| consume tokens semánticos o modo oscuro | `themeConfigUrl` |
| puede desplazarse | `iframeCssUrl` |
| renderiza Markdown | `markdownCssUrl` |
| usa utilidades Tailwind para layout o espaciado | `primeVueCssUrl` (el Host incluye Tailwind en este recurso) |
| renderiza algo para lo que **PrimeVue** ofrece componente: botón, input, formulario, tabla, diálogo, menú, tag, tooltip o feedback | `primeVueCssUrl` **y** `PrimeVuePlugin` |

Un gráfico canvas sin interfaz es la excepción típica. Si se añade una barra de herramientas deja de ser neutral: el botón debe ser PrimeVue y conlleva toda la integración.

**Tailwind se entrega con `primeVueCssUrl`.** No existe una clave separada de CSS Tailwind. Prefiera utilidades para layout y espaciado ordinarios cuando aclaren el componente, aunque CSS portable propiedad del módulo sigue siendo válido. `preflightCssUrl` no forma parte del conjunto de claves; si se necesita preflight en un shadow root, cárguelo imperativamente, algo poco habitual.

La mayoría de necesidades ya están en esta base. La capa compartida es una franja estrecha, no un lugar para rehacer PrimeVue y Tailwind. Consulte [Inyección de CSS](./web-host/css-injection.md).

### La capa de diseño compartida

Algunas ideas se repiten en un conjunto conocido de módulos sin contrato en el tema: un resumen de dominio, fila de cabecera, estado vacío o vocabulario propio para tags. Pertenecen a la capa compartida.

Se distribuyen como **paquete publicado**, materializado en cada consumidor durante la compilación. Debe ser un paquete, no un alias de ruta, porque los consumidores viven en repositorios diferentes.

El módulo productor declara el paquete como **artefacto de compilación** y cada consumidor lo materializa en su árbol. Consulte [Artefactos de compilación](../guides/artifacts.md) para `node-package`, la reconciliación del runtime y el glue que aún debe aportar la compilación.

### El módulo

Todo lo demás, además de cada divergencia deliberada respecto al vocabulario compartido.

## Decidir dónde pertenece algo

Pregunte en orden; gana el primer sí.

1. **¿Es un valor?** Color, radio, espaciado, elevación, severity. → **Tema.** Lea un token semántico, nunca un literal.
2. **¿El tema ya proporciona un componente?** Button, Dialog, Select, Tag. → **Tema.** Use el componente y aplique una clase sobre él; no lo reconstruya.
3. **¿Dos o más módulos propios necesitan el mismo concepto sin componente temático?** → **Capa de diseño compartida.**
4. En otro caso → **Módulo.**

## Ejemplos

Los ejemplos usan `kx-` para clases y hojas específicas. Las reglas se aplican a cualquier aplicación Wippy.

### Nunca reconstruya un componente temático

PrimeVue proporciona `Button`. Sustituirlo por `.kx-btn` sobre un `<button>` crea una segunda implementación que puede divergir.

**Incorrecto:** un `button` nativo con `.kx-btn .kx-btn-primary`.

**Correcto:** el componente temático, con una clase cuando necesite ajustarlo.

```vue
<Button label="Save" class="kx-save" />
```

Si no encaja, no es licencia para reconstruirlo. Aplique una clase: en la fachada si el ajuste es global o en el módulo si es local.

### Severity pertenece al tema

`success`, `danger`, `warn` e `info` son semántica del tema con escalas publicadas. Redefinirla con nombres locales crea definiciones competidoras.

```css
/* BAD — severity re-derived under a module-local name */
.tone-gn { color: #16a34a; }

/* GOOD — severity from the theme */
.status-dot.success { background: var(--p-success-500); }
```

Un *tono* puede existir en la capa compartida solo como color decorativo de categoría, nunca como severity. Si puede significar «falló», pertenece al tema.

### Vocabulario sin lugar en el tema

```css
/* GOOD — this application-specific card contract and empty-state vocabulary
   recur across modules. PrimeVue's generic Card does not define these domain
   semantics, so the shared layer owns them. */
@import "@kickside/ui-kit/kx-card.css";
@import "@kickside/ui-kit/kx-state.css";
```

### Adoptar significa importar y eliminar

Un `@import` CSS debe preceder cualquier otra regla. La hoja compartida llega primero y lo que el módulo declare después gana con la misma especificidad. Importar y conservar una copia local no cambia nada.

```css
/* BAD — the import is inert; the local copy still wins */
@import "@kickside/ui-kit/kx-card.css";
.kx-card { border-radius: 14px; border: 1px solid var(--p-content-border-color); }

/* GOOD — import, delete the local copy, keep only a documented delta */
@import "@kickside/ui-kit/kx-card.css";
/* This surface's cards are inline in a dense list, so they lose the lift. */
.kx-card:hover { transform: none; }
```

Conserve **solo el delta**, no repita todo el cuerpo. Si un nombre significa cosas diferentes en dos módulos, son dos conceptos: separe el nombre.

### Especificidad frente al tema

El CSS del módulo se inyecta primero en el shadow root y la hoja PrimeVue del tema se añade después. Ambos son `<style>`, así que decide el orden y gana el tema a igual especificidad. Una regla del módulo debe tener más *especificidad*, no estar más abajo en el archivo. `adoptedStyleSheets` transporta CSS personalizado de la fachada, no el tema, y tampoco resuelve esto.

```css
/* BAD — this class is applied to PrimeVue's own footer element, so at equal
   specificity the theme wins and the padding never applies. */
.kx-modal-foot { padding: 14px 18px; }

/* GOOD — scoped under the dialog root, so it out-specifies the theme */
.kx-modal > .kx-modal-foot { padding: 14px 18px; }
```

## Contenido permitido en la capa compartida

Todo lo que un conjunto de módulos comparte realmente y el tema no posee: vocabulario CSS, tokens derivados, componentes internos, helpers y harnesses de prueba.

**Use unidades semánticas.** Cada unidad debe ser un concepto nombrado que el consumidor pueda entender: `kx-card`, `kx-state`, `kx-tag`. Prefiera paquetes granulares; un único paquete con varias unidades claramente nombradas funciona, pero no es el objetivo.

**Use nombres específicos.** Evite `common`, `shared`, `misc` o `utils`. Un nombre que no describe su contenido acumulará conceptos no relacionados.

## Normalizar es un cambio visual

Consolidar copias divergentes puede cambiar el renderizado. Compare cada definición, elija la canónica, documente el motivo, mantenga divergencias deliberadas como overrides e inspeccione el resultado visualmente. Las pruebas unitarias no ven el layout.

## Relacionado

- [Temas](./micro-frontends/theming.md) — Catálogo de tokens y entrega del tema al host y a los hijos
- [Lista de conformidad](./micro-frontends/compliance-checklist.md) — Reglas por módulo
- [Artefactos de compilación](../guides/artifacts.md) — Declarar y materializar el paquete
- [Gestión de dependencias](../guides/dependency-management.md) — Declarar y resolver lo que consume un módulo
