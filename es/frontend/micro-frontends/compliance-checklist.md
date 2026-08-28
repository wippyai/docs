---
title: "Comprobaciones de conformidad y publicación frontend"
description: "Reglas normativas de conformidad frontend, propiedad de comprobadores, comprobaciones de publicación y requisitos deterministas de pruebas visuales."
---

# Comprobaciones de conformidad y publicación frontend

**Clasificación: referencia normativa de conformidad y pruebas.** Los bloques JSON definen formas con placeholders para entradas de comprobadores; no son pruebas aprobadas ni un fixture de aplicación independiente.

Esta página controla los requisitos deterministas de comprobación y publicación siguientes. El [Contrato de UI portable](../portable-ui-contract.md) controla las reglas subyacentes de portabilidad y UI, mientras que las guías enlazadas proporcionan instrucciones detalladas de implementación. El índice asigna cada regla a su fuente y al resultado exigido del comprobador.

La familia de paquetes públicos `@wippy-fe/*` 0.0.56 no incluye una CLI de conformidad de módulos. El comprobador de documentación del repositorio valida los ejemplos de documentación y la vigencia del catálogo generado; el flujo de conformidad elegido por cada módulo debe implementar las comprobaciones orientadas a la aplicación que se indican a continuación.

| Regla | Instrucciones detalladas | Resultado determinista |
|---|---|---|
| FE-PORT-001 | [Contrato de UI portable](../portable-ui-contract.md) | Rechazar suposiciones privadas de portabilidad |
| FE-UI-001 | [Contrato de UI portable](../portable-ui-contract.md) | Rechazar controles estándar sin procesar o hechos a mano |
| FE-UI-002 | [Contrato de UI portable](../portable-ui-contract.md) | Exigir análisis de affordance |
| FE-UI-003 | [Contrato de UI portable](../portable-ui-contract.md) | Exigir contrato equivalente y pruebas con un tema alternativo |
| FE-UI-004 | [Contrato de UI portable](../portable-ui-contract.md) | Exigir configuración PrimeVue cuando existan controles |
| FE-UI-005 | [Contrato de UI portable](../portable-ui-contract.md) | Rechazar props y API inventadas |
| FE-TW-001 | [Contrato de Tailwind](./tailwind-contract.md) | Resolver el preset Wippy seleccionado |
| FE-TW-002 | [Contrato de Tailwind](./tailwind-contract.md) | Rechazar valores de tiempo de compilación documentados como runtime |
| FE-TW-003 | [Contrato de Tailwind](./tailwind-contract.md) | Rechazar valores fijos equivalentes sin clasificación invariante |
| FE-TW-004 | [Contrato de Tailwind](./tailwind-contract.md) | Rechazar overrides de asignaciones protegidas |
| FE-TOKEN-001 | [Catálogo de tokens](./token-catalogue.md) | Rechazar referencias `--p-*` no declaradas |
| FE-TOKEN-002 | [Catálogo de tokens](./token-catalogue.md) | Rechazar nombres de tokens deducidos o inventados |
| FE-STYLE-001 | [Creación de temas](./theming.md) | Rechazar clases privadas de fachada y temas `.p-*` locales al módulo |
| FE-A11Y-001 | [Contrato de UI portable](../portable-ui-contract.md) | Rechazar controles personalizados no válidos o inaccesibles |

## Grupos de comprobaciones obligatorios

- CSS de tokens analizado con PostCSS; instantánea generada de tokens comparada byte por byte.
- Configuración Tailwind real resuelta y utilidades representativas compiladas.
- Declaraciones emitidas clasificadas como variable de runtime, constante compilada, literal arbitrario o interno/transitorio.
- Controles sin procesar, falta de configuración PrimeVue, overrides de asignaciones protegidas, tokens no declarados, dependencias privadas de fachada y divergencia de hashes de contratos rechazados.
- Dependencias externas del mapa de importación comparadas con la instantánea completa fijada.
- Salida de compilación comprobada contra el registro configurado y el asset servido.
- Cambio de tema mediante `host.setThemeMode()` y verificación del estado propagado de AppConfig; se rechazan la manipulación directa de clases de tema y las conexiones internas del proxy.
- Catálogos generados comprobados en cuanto a procedencia, tupla de versiones y hashes de origen.
- Ejemplos copiables analizados, compilados cuando corresponda y comprobados para evitar contenido interactivo anidado.
- El modo ligado a proyecto devuelve exactamente `UNSUPPORTED` y la CI estándar falla.

Promptmap puede generar pistas. No constituye prueba de existencia de tokens, resolución de utilidades, accesibilidad ni eliminación.

## Comprobaciones de publicación generadas

Las secciones generadas de tokens y Tailwind no pueden contener un marcador pendiente al publicar. Cada token de runtime nuevo necesita un consumidor CSS real de Wippy, una prueba de mutación de estilo calculado y un propósito documentado para consumidores portables.

La publicación mantiene las pruebas de runtime fuera del repositorio. Defina:

- `WIPPY_THEME_ROOT` como el paquete `@wippy-fe/theme` seleccionado.
- `WIPPY_FE_EVIDENCE_ROOT` como el directorio de pruebas de la versión que contiene `runtime-acceptance-evidence.json`, `visual-evidence-index.json`, sus manifiestos relativos de escenarios y capturas.
- `WIPPY_FE_RUNTIME_EVIDENCE_SHA256` como el SHA-256 en minúsculas de los bytes exactos de `runtime-acceptance-evidence.json`.

Desde la raíz del repositorio Wippy Docs, ejecute la comprobación de publicación con Node.js 22 o posterior tras definir las cuatro variables anteriores. En PowerShell:

```powershell
$env:FRONTEND_DOCS_PUBLICATION = '1'
node scripts/check-frontend-docs.mjs
Remove-Item Env:FRONTEND_DOCS_PUBLICATION
```

En un shell POSIX:

```sh
FRONTEND_DOCS_PUBLICATION=1 node scripts/check-frontend-docs.mjs
```

La comprobación invoca el comprobador canónico de aceptación del tema seleccionado con la ruta y el hash de las pruebas; después valida y recalcula las pruebas visuales. Las comprobaciones ordinarias de vigencia de la documentación no requieren pruebas locales de la versión.

## Verificación visual determinista

Cada componente afectado por un cambio de apariencia tiene un manifiesto de escenario y pruebas inmutables de antes, después y diff. La referencia y el candidato usan la misma compilación de navegador, device-pixel ratio, fuentes, datos de fixture, tema, viewport, ajuste de movimiento reducido y regla de estabilización. Capture todos los estados aplicables, incluidos los temas claro y oscuro, estados de interacción, overlays, estados desactivados o de error y los layouts de escritorio admitidos por el producto. No invente un requisito estrecho o móvil para un producto exclusivo de escritorio.

Cada escenario captura el recorte del componente y el contexto circundante de la aplicación. También captura la página completa cuando pueda verse afectado un overlay, overflow o layout de página. Un índice del componente declara la matriz aplicable completa y apunta a un manifiesto inmutable por escenario:

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

El comprobador expande el producto cartesiano de aplicabilidad y falla si algún tema, viewport o estado declarado carece de un escenario único. Cuando `overlay` es true, cada escenario también requiere el ámbito de captura `full-page`. El commit y hash de la compilación final deben coincidir con el candidato de cada escenario, y `recapturedAfterBuild` debe ser true.

Cada manifiesto de escenario registra hashes en vez de confiar en nombres de archivo:

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

Los valores anteriores muestran la forma exigida, no pruebas válidas. La publicación falla cuando un componente modificado o estado requerido carece de escenario, falta un ámbito de captura requerido, falta una imagen o hash referenciado, las compilaciones están obsoletas, quedan errores inesperados de consola o código temporal de fixture, o el diff supera la tolerancia sin una dispensa de diseño revisada. Una dispensa registra los píxeles exactos modificados, el motivo de diseño, el revisor y el escenario afectado; no puede dispensar capturas ausentes, errores de consola ni limpieza de fixtures.
