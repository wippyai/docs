---
title: "Composites Personalizados"
description: "Excepciones basadas en contrato para controles cuya affordance requerida no puede proporcionar PrimeVue."
---

# Composites Personalizados

Los controles personalizados son excepciones, no una biblioteca de componentes alternativa.

## Prueba de admisión

Un control personalizado se acepta solo cuando:

1. PrimeVue no puede proporcionar ni componer la semántica, la interacción y la affordance previstas.
2. La excepción registra las composiciones de PrimeVue rechazadas.
3. Nombra un contrato exacto de componente hermano de PrimeVue generado y su hash de contrato.
4. Toda propiedad que ese contrato hermano clasifica como `shared-runtime` tiene un mapeo de origen exacto.
5. Una utilidad fija se acepta solo cuando el contrato hermano clasifica esa propiedad exacta como `platform-invariant`.
6. La geometría y el comportamiento novedosos están aislados y documentados.
7. La evidencia de accesibilidad y la visual pasan.

La equivalencia de forma de datos no es equivalencia de affordance. Un `SelectButton` multiopción puede representar tres valores, pero no se ve ni se comporta como un interruptor deslizante de tres posiciones. A la inversa, no invente una prop `positions` para `ToggleSwitch`. Construya un hermano personalizado revisado solo cuando el requisito de affordance sea real.

## Contrato del módulo

Guarde una excepción revisada en el `wippy-fe.contract.json` de la raíz del módulo:

```json
{
  "schemaVersion": "generated-by-selected-contract-tool",
  "exceptions": [
    {
      "id": "module.control.example",
      "source": "src/components/ExampleControl.vue",
      "sourceSha256": "generated-from-source",
      "semanticRole": "documented-role",
      "requiredAffordance": "documented-affordance",
      "rejectedPrimeVueCompositions": [
        {
          "components": ["SelectButton"],
          "reason": "The reviewed sliding affordance cannot be preserved."
        }
      ],
      "visualSibling": {
        "component": "ToggleSwitch",
        "contractId": "primevue.toggleswitch.portable-appearance",
        "contractHash": "generated-from-selected-theme-contract"
      },
      "sharedAppearanceMappings": [
        {
          "contractProperty": "root.width",
          "part": "root",
          "selector": ".example-control",
          "source": {
            "kind": "css-variable",
            "name": "--p-toggleswitch-width"
          }
        }
      ],
      "platformInvariantUtilities": [],
      "moduleLocalProperties": [],
      "accessibilityEvidence": {
        "manifest": ".local/evidence/accessibility-manifest.json",
        "scenarioId": "module.control.example.keyboard",
        "resultId": "module.control.example.keyboard.passed",
        "build": {
          "head": "generated-candidate-commit",
          "trackedFrontendDiffSha256": "generated-diff-hash"
        }
      },
      "visualEvidence": {
        "manifest": ".local/evidence/visual-manifest.json",
        "scenarioId": "module.control.example.light.default",
        "captureId": "module.control.example.light.default.component",
        "build": {
          "head": "generated-candidate-commit",
          "trackedFrontendDiffSha256": "generated-diff-hash"
        }
      }
    }
  ]
}
```

Los valores mostrados son marcadores de esquema, no evidencia válida. El mapeo
completo se genera a partir del contrato hermano seleccionado; el extracto de una
sola fila no es por sí mismo una excepción válida. Las herramientas generan los
hashes de origen y de contrato. Un hash de origen o de contrato hermano cambiado
invalida la revisión.

Esta página define los campos normativos; no es un JSON Schema y el verificador
de documentación solo demuestra que este ejemplo conserva la forma requerida.
`wippy-fe-compliance` valida un contrato de módulo real contra el manifiesto del
tema seleccionado, verifica los hashes y el conjunto completo de propiedades, y
comprueba que cada referencia de evidencia resuelve al resultado o captura
nombrados y aprobados del mismo build candidato. La evidencia de accesibilidad
liga el `sourceSha256` del componente, los archivos hasheados, cero errores
inesperados de consola y un resultado aprobado. La evidencia visual liga los
archivos canónicos de antes/después/diff, los hashes, las métricas y la
disposición recalculadas, y el build candidato correspondiente. Una cadena, un
archivo faltante, un escenario/resultado/captura faltante, un hash de build
obsoleto, `pending` o un resultado no revisado no satisfacen el requisito de
evidencia.

`platformInvariantUtilities` y `moduleLocalProperties` pueden estar vacíos. Nunca
invente `gap-2`, `w-10`, `rounded-md` u otra utilidad fija solo para que un campo
del contrato no quede vacío. En particular, un hermano de ToggleSwitch no puede
reetiquetar el ancho, el alto, el radio, la geometría de foco o el movimiento como
invariantes cuando su contrato hermano seleccionado clasifica esas propiedades
como `shared-runtime`.

El manifiesto del hermano clasifica las propiedades como:

- `shared-runtime`: todo hermano personalizado mapea y consume el token publicado
  o la utilidad semántica respaldada en runtime.
- `platform-invariant`: se permite un valor fijo solo para esta propiedad exacta.
- `implementation-private`: la mecánica interna de PrimeVue no se convierte en
  requisito para un hermano personalizado.

Si la semántica de runtime requerida no existe, corrija primero el contrato del tema compartido. Nunca copie las dimensiones actuales del hermano ni invente un nombre de token.

`sharedAppearanceMappings` es exhaustivo, no ilustrativo: contiene exactamente un
mapeo por cada propiedad `shared-runtime` del contrato hermano seleccionado,
ningún ID de propiedad adicional, la parte del contrato, un selector de módulo
estable y la clase y el nombre exactos de la fuente publicada. Las herramientas de
conformidad usan el selector, la parte, la propiedad CSS y la fuente publicada
para demostrar el mapeo estructuralmente con PostCSS; un nombre de token en un
comentario o en un selector no relacionado no cuenta. Un mapeo respaldado por
Tailwind también registra `utilityClasses` únicas y exactas; tras la
normalización, ese conjunto debe ser igual al conjunto de fuentes del contrato
hermano seleccionado. `platformInvariantUtilities` contiene registros
`{ "contractProperty": "...", "utility": "..." }` cuya utilidad es igual a la
fuente del contrato hermano seleccionado. `moduleLocalProperties`, cuando no está
vacío, contiene IDs de propiedad estructurados y razones de revisión, no un saco
de CSS de forma libre.

No se crea un paquete `@wippy-fe/ui` compartido para una sola excepción. La promoción solo se vuelve elegible después de que un segundo consumidor independiente demuestre los mismos requisitos de comportamiento y portabilidad.
