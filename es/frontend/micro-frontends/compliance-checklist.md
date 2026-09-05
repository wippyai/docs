---
title: "Índice de Reglas de Conformidad de Frontend"
description: "Índice conciso de las reglas canónicas de frontend y de la propiedad de los verificadores deterministas."
---

# Índice de Reglas de Conformidad de Frontend

Esta página es un índice, no una segunda copia del contrato. El
[Contrato de UI Portable](../portable-ui-contract.md) es dueño de los enunciados
normativos de las reglas; los enlaces de abajo aportan orientación detallada de
implementación.

| Regla | Orientación detallada | Resultado determinista |
|---|---|---|
| FE-PORT-001 | [Contrato de UI Portable](../portable-ui-contract.md) | Rechazar suposiciones privadas de portabilidad |
| FE-UI-001 | [Contrato de UI Portable](../portable-ui-contract.md) | Rechazar controles estándar crudos o hechos a mano |
| FE-UI-002 | [Contrato de UI Portable](../portable-ui-contract.md) | Exigir análisis de affordance |
| FE-UI-003 | [Contrato de UI Portable](../portable-ui-contract.md) | Exigir contrato de hermanos y evidencia de tema alternativo |
| FE-UI-004 | [Contrato de UI Portable](../portable-ui-contract.md) | Exigir la configuración de PrimeVue cuando existan controles |
| FE-UI-005 | [Contrato de UI Portable](../portable-ui-contract.md) | Rechazar props y APIs inventadas |
| FE-TW-001 | [Contrato de Tailwind](./tailwind-contract.md) | Resolver el preset de Wippy seleccionado |
| FE-TW-002 | [Contrato de Tailwind](./tailwind-contract.md) | Rechazar valores de tiempo de compilación documentados como de runtime |
| FE-TW-003 | [Contrato de Tailwind](./tailwind-contract.md) | Rechazar valores fijos de hermanos sin clasificación de invariante |
| FE-TW-004 | [Contrato de Tailwind](./tailwind-contract.md) | Rechazar overrides de mapeos protegidos |
| FE-TOKEN-001 | [Catálogo de Tokens](./token-catalogue.md) | Rechazar referencias `--p-*` no declaradas |
| FE-TOKEN-002 | [Catálogo de Tokens](./token-catalogue.md) | Rechazar nombres de token deducidos o inventados |
| FE-STYLE-001 | [Autoría de Temas](./theming.md) | Rechazar clases privadas del facade y temas `.p-*` locales al módulo |
| FE-A11Y-001 | [Contrato de UI Portable](../portable-ui-contract.md) | Rechazar controles personalizados inválidos o inaccesibles |

## Grupos de verificadores obligatorios

- CSS de tokens parseado con PostCSS; snapshot de tokens generado comparado byte a byte.
- Configuración real de Tailwind resuelta y utilidades representativas compiladas.
- Declaraciones emitidas clasificadas como variable de runtime, constante compilada, literal arbitrario o interna/transitoria.
- Controles crudos, configuración de PrimeVue ausente, overrides de mapeos protegidos, tokens no declarados, dependencias privadas del facade y deriva del hash del contrato: rechazados.
- Externals del import map comparados con el snapshot completo fijado.
- Salida del build comprobada contra el registry configurado y el asset servido.
- El cambio de tema usa `host.setThemeMode()` y verifica el estado propagado de
  AppConfig; la manipulación directa de clases de tema y los cables internos del
  proxy se rechazan.
- Catálogos generados comprobados en cuanto a procedencia, tupla de versión y hashes de origen.
- Ejemplos copiables parseados, compilados cuando proceda y comprobados en busca de contenido interactivo anidado.
- El modo ligado al proyecto devuelve exactamente `UNSUPPORTED`, y el CI estándar falla.

Promptmap puede generar pistas. No es evidencia de la existencia de un token, de la resolución de una utilidad, de la alcanzabilidad ni del borrado.

## Puertas de publicación de contenido generado

Las secciones generadas de tokens y de Tailwind no pueden contener un marcador pendiente en el momento de la publicación. Cada nuevo token de runtime necesita un consumidor CSS real de Wippy, una prueba de mutación de estilo computado y un propósito documentado para consumidores portables.

La publicación mantiene la evidencia de runtime fuera del repositorio. Establezca:

- `WIPPY_THEME_ROOT` al paquete `@wippy-fe/theme` seleccionado.
- `WIPPY_FE_EVIDENCE_ROOT` al directorio de evidencia de la release que contiene
  `runtime-acceptance-evidence.json`, `visual-evidence-index.json`, sus
  manifiestos de escenario relativos y las capturas de pantalla.
- `WIPPY_FE_RUNTIME_EVIDENCE_SHA256` al SHA-256 en minúsculas de los bytes exactos
  de `runtime-acceptance-evidence.json`.

`FRONTEND_DOCS_PUBLICATION=1 node scripts/check-frontend-docs.mjs` invoca el
verificador canónico de aceptación del tema seleccionado con esa ruta de
evidencia y ese hash, y después valida y recalcula la evidencia visual. Las
comprobaciones normales de frescura de la documentación no requieren evidencia
local de release.

## Verificación visual determinista

Cada componente afectado por un cambio de apariencia tiene un manifiesto de
escenario y evidencia inmutable de antes/después/diff. La línea base y la
candidata usan el mismo build de navegador, ratio de píxeles del dispositivo,
fuentes, datos de fixture, tema, viewport, ajuste de movimiento reducido y regla
de estabilización. Capture todos los estados aplicables, incluidos los temas
claro y oscuro, los estados de interacción, los overlays, los estados
deshabilitado/error y los layouts de escritorio que el producto soporta. No
invente un requisito estrecho o móvil para un producto solo de escritorio.

Cada escenario captura el recorte del componente y el contexto de aplicación
circundante. También captura la página completa cuando un overlay, un overflow o
el layout de la página pueden verse afectados. Un índice de componente declara la
matriz aplicable completa y apunta a un manifiesto inmutable por escenario:

```json
{
  "schemaVersion": "1.0.0",
  "componentId": "module.component",
  "applicability": {
    "themes": ["light", "dark"],
    "viewports": [{ "id": "desktop", "width": 1440, "height": 900 }],
    "states": ["default"],
    "overlay": false
  },
  "finalBuild": {
    "candidateCommit": "generated-candidate-commit",
    "candidateBuildHash": "sha256:generated-candidate-build-hash",
    "recapturedAfterBuild": true
  },
  "scenarios": [
    {
      "scenarioId": "module.component.light.default",
      "theme": "light",
      "viewport": "desktop",
      "state": "default",
      "manifest": "scenarios/module.component.light.default.json"
    },
    {
      "scenarioId": "module.component.dark.default",
      "theme": "dark",
      "viewport": "desktop",
      "state": "default",
      "manifest": "scenarios/module.component.dark.default.json"
    }
  ]
}
```

El verificador expande el producto cruzado de aplicabilidad y falla si algún tema,
viewport o estado declarado no tiene un escenario único. Cuando `overlay` es
true, todo escenario requiere además el alcance de captura `full-page`. El commit
y el hash del build final deben coincidir con la candidata de cada escenario y
`recapturedAfterBuild` debe ser true.

Cada manifiesto de escenario registra hashes en lugar de confiar en los nombres de archivo:

```json
{
  "schemaVersion": "1.0.0",
  "scenarioId": "module.component.light.default",
  "componentId": "module.component",
  "state": {
    "theme": "light",
    "viewport": { "width": 1440, "height": 900 },
    "interaction": "default"
  },
  "runtime": {
    "browserVersion": "pinned-browser-version",
    "devicePixelRatio": 1,
    "fontsHash": "sha256:generated-font-set-hash",
    "fixtureHash": "sha256:generated-fixture-hash"
  },
  "baseline": {
    "commit": "generated-baseline-commit",
    "buildHash": "sha256:generated-baseline-build-hash"
  },
  "candidate": {
    "commit": "generated-candidate-commit",
    "buildHash": "sha256:generated-candidate-build-hash",
    "recapturedAfterBuild": true
  },
  "requiredScopes": ["component", "context"],
  "captures": [
    {
      "scope": "component",
      "before": {
        "artifactId": "component-before",
        "path": "screenshots/component-before.png",
        "sha256": "sha256:generated-before-hash"
      },
      "after": {
        "artifactId": "component-after",
        "path": "screenshots/component-after.png",
        "sha256": "sha256:generated-after-hash"
      },
      "diff": {
        "artifactId": "component-diff",
        "path": "screenshots/component-diff.png",
        "sha256": "sha256:generated-diff-hash"
      }
    },
    {
      "scope": "context",
      "before": {
        "artifactId": "context-before",
        "path": "screenshots/context-before.png",
        "sha256": "sha256:generated-before-hash"
      },
      "after": {
        "artifactId": "context-after",
        "path": "screenshots/context-after.png",
        "sha256": "sha256:generated-after-hash"
      },
      "diff": {
        "artifactId": "context-diff",
        "path": "screenshots/context-diff.png",
        "sha256": "sha256:generated-diff-hash"
      }
    }
  ],
  "diff": {
    "changedPixels": 0,
    "totalPixels": 1296000,
    "changedRatio": 0,
    "pixelDeltaThreshold": 8,
    "changedRatioThreshold": 0.001,
    "disposition": "within-threshold",
    "result": "passed",
    "waiver": null
  },
  "console": { "unexpectedErrors": [] },
  "fixtureCleanup": { "temporaryArtifactsRemaining": [], "verified": true }
}
```

Los valores anteriores muestran la forma requerida, no evidencia válida. La
publicación falla cuando un componente cambiado o un estado obligatorio no tiene
escenario, falta un alcance de captura obligatorio, falta una imagen o un hash
referenciado, los builds están obsoletos, quedan errores inesperados en consola,
queda código temporal de fixture o el diff excede la tolerancia sin una exención
de diseño revisada. Una exención registra los píxeles cambiados exactos, la razón
de diseño, el revisor y el escenario afectado; no puede eximir capturas
faltantes, errores de consola ni la limpieza de fixtures.
