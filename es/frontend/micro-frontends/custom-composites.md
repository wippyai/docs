---
title: "Composiciones personalizadas"
description: "Excepciones basadas en contratos para controles cuya affordance necesaria no puede ofrecer PrimeVue."
---

# Composiciones personalizadas

**Clasificación: referencia normativa del contrato de excepciones.** El bloque JSON es un ejemplo de esquema con placeholders, no un contrato ni un paquete de pruebas válidos.

Los controles personalizados son excepciones, no una biblioteca de componentes alternativa.

## Prueba de admisión

Un control personalizado solo se acepta cuando:

1. PrimeVue no puede proporcionar ni componer la semántica, interacción y affordance buscadas.
2. La excepción registra las composiciones PrimeVue rechazadas.
3. Indica un contrato equivalente visual de PrimeVue generado y exacto, así como su hash.
4. Cada propiedad que ese contrato equivalente clasifica como `shared-runtime` tiene una asignación de origen exacta.
5. Solo se acepta una utilidad fija si el contrato equivalente clasifica esa propiedad exacta como `platform-invariant`.
6. La geometría y el comportamiento novedosos quedan aislados y documentados.
7. Se superan las pruebas visuales y de accesibilidad.

La equivalencia de forma de datos no equivale a la equivalencia de affordance. Un `SelectButton` de varias opciones puede representar tres valores, pero no tiene la apariencia ni el comportamiento de un interruptor deslizante de tres posiciones. Del mismo modo, no invente una prop `positions` para `ToggleSwitch`. Cree un equivalente personalizado revisado solo cuando la affordance sea un requisito real.

## Contrato del módulo

Guarde una excepción revisada en `wippy-fe.contract.json`, en la raíz del módulo:

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

Los valores mostrados son placeholders del esquema, no pruebas válidas. La asignación completa se genera desde el contrato equivalente seleccionado; el extracto de una sola fila no constituye por sí mismo una excepción válida. Las herramientas generan los hashes del código fuente y del contrato. Un cambio en el hash del código o del contrato equivalente invalida la revisión.

Esta página define los campos normativos; no es un JSON Schema y el comprobador de documentación solo demuestra que el ejemplo conserva la forma exigida. Una implementación de conformidad del módulo debe validar un contrato real contra el manifiesto de tema seleccionado, verificar los hashes y el conjunto completo de propiedades, y comprobar que cada referencia de prueba resuelve al resultado o captura aprobado con nombre de la misma compilación candidata. La familia de paquetes públicos `@wippy-fe/*` 0.0.56 no proporciona una CLI de conformidad de módulos. Las pruebas de accesibilidad vinculan el `sourceSha256` del componente, los archivos con hash, la ausencia de errores de consola inesperados y un resultado aprobado. Las pruebas visuales vinculan los archivos canónicos de antes, después y diff, sus hashes, las métricas y disposición recalculadas y la compilación candidata correspondiente. Una cadena, un archivo ausente, un escenario, resultado o captura ausente, un hash de compilación obsoleto, `pending` o un resultado sin revisar no satisface el requisito de pruebas.

`platformInvariantUtilities` y `moduleLocalProperties` pueden estar vacíos. Nunca invente `gap-2`, `w-10`, `rounded-md` u otra utilidad fija solo para que un campo del contrato no quede vacío. En particular, un equivalente de ToggleSwitch no puede reclasificar anchura, altura, radio, geometría de foco o movimiento como invariantes cuando su contrato equivalente seleccionado clasifica esas propiedades como `shared-runtime`.

El manifiesto del equivalente clasifica las propiedades así:

- `shared-runtime`: cada equivalente personalizado asigna y consume el token publicado o la utilidad semántica respaldada en runtime.
- `platform-invariant`: solo se permite un valor fijo para esta propiedad exacta.
- `implementation-private`: los mecanismos internos de PrimeVue no se convierten en requisitos para un equivalente personalizado.

Si no existe la semántica de runtime necesaria, corrija primero el contrato de tema compartido. Nunca copie las dimensiones actuales del equivalente ni invente un nombre de token.

`sharedAppearanceMappings` es exhaustivo, no ilustrativo: contiene exactamente una asignación por cada propiedad `shared-runtime` del contrato equivalente seleccionado, ningún id de propiedad adicional, la parte del contrato, un selector estable del módulo y el tipo y nombre exactos del origen publicado. La implementación de conformidad seleccionada debe usar el selector, la parte, la propiedad CSS y el origen publicado para demostrar estructuralmente la asignación con PostCSS; un nombre de token en un comentario o selector no relacionado no cuenta. Una asignación respaldada por Tailwind también registra `utilityClasses` únicos y exactos; tras la normalización, ese conjunto debe ser igual al conjunto de orígenes del contrato equivalente seleccionado. `platformInvariantUtilities` contiene registros `{ "contractProperty": "...", "utility": "..." }` cuya utilidad coincide con el origen del contrato equivalente seleccionado. Cuando no está vacío, `moduleLocalProperties` contiene ids de propiedades estructurados y motivos de revisión, no una bolsa de CSS libre.

No se crea un paquete compartido `@wippy-fe/ui` para una sola excepción. La promoción solo es elegible después de que un segundo consumidor independiente demuestre los mismos requisitos de comportamiento y portabilidad.
