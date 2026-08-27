---
title: "Contrato de compilación y dependencias"
description: "Comandos canónicos de salida, wrappers de Windows, instantáneas del mapa de importación de Web Host y dependencias externas."
---

# Contrato de compilación y dependencias

Esta es una referencia de contrato para repositorios existentes. Los bloques de Makefile, PowerShell, batch y Vite siguientes son fragmentos específicos; no forman una estructura de proyecto independiente.

## Contrato canónico de compilación de producción de Wippy

Para un artefacto de producción de una aplicación o repositorio de módulo Wippy iniciado por `wippy.exe`, invoque el target de Make del repositorio. Los comandos locales de modo watch, como `npm run dev`, siguen siendo válidos cuando el repositorio los documenta, pero no sustituyen la compilación de despliegue.

La receta del Makefile para cada target frontend de producción usa:

```text
npm run build -- --outDir <target> --emptyOutDir
```

La compilación de despliegue controla `<target>`. `vite.config.ts` no debe fijar un directorio de salida de despliegue.

Los repositorios fuente de plataforma o paquetes que no inicia `wippy.exe`, como el código fuente de Web Host, usan los scripts y argumentos exactos declarados por el `package.json` de ese repositorio. La receta de módulo Wippy con directorio de salida limpio no se aplica a repositorios fuente de paquetes, salvo que su propio script declarado documente expresamente esos argumentos.

### Makefile

```makefile
FRONTEND_OUTPUT := $(abspath app/src/app/static/example)

.PHONY: frontend-example
frontend-example:
	cd frontend/example && npm run build -- --outDir "$(FRONTEND_OUTPUT)" --emptyOutDir
```

### make.ps1

Los usuarios de Windows invocan el target correspondiente mediante `make.bat`. `make.ps1` implementa el target del Makefile para Windows; no es una interfaz pública de compilación independiente.

```powershell
param(
  [Parameter(Position = 0)]
  [string]$Target = "help"
)

$ErrorActionPreference = "Stop"
$targets = @("frontend-example")
if ($Target -notin $targets) {
  throw "Unknown target '$Target'. Available targets: $($targets -join ', ')"
}

$Output = "app/src/app/static/example"
$resolvedOutput = [System.IO.Path]::GetFullPath(
  [System.IO.Path]::Combine($PSScriptRoot, $Output)
)
Push-Location (Join-Path $PSScriptRoot "frontend/example")
try {
  npm.cmd run build -- --outDir $resolvedOutput --emptyOutDir
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
  Pop-Location
}
```

### make.bat

`make.bat` solo delega en su equivalente de PowerShell, reenvía los argumentos y devuelve su código de salida. Para el target de ejemplo, los usuarios de Windows ejecutan `make.bat frontend-example`.

```bat
@powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0make.ps1" %*
@exit /b %ERRORLEVEL%
```

## Algoritmo de instantánea del mapa de importación

La versión objetivo de Web Host define los módulos proporcionados por el host.

1. Resuelva la etiqueta de la versión objetivo de Web Host.
2. Obtenga `https://web-host.wippy.ai/<release-tag>/import-map.json` una vez durante el desarrollo.
3. Almacene la etiqueta de versión, la URL resuelta exacta, el objeto `imports` completo y el SHA-256 en minúsculas de los bytes exactos del payload del mapa de importación obtenido.
4. Marque como externa cada clave de ese objeto `imports`.
5. Use la misma instantánea completa en el modo sin host.
6. Vuelva a obtenerla cuando cambie la versión del host o cuando una dependencia recién añadida pueda estar ahora proporcionada por el host.
7. Inspeccione la salida compilada y rechace imports simples que no figuren en la instantánea.

No mantenga una lista de paquetes escrita a mano. No replique el conjunto completo de dependencias externas en las peer dependencies.

Para compilaciones de entrada de componentes web, conserve el efecto secundario de registro del módulo de entrada:

```ts
export default {
  build: {
    rollupOptions: {
      preserveEntrySignatures: 'strict',
    },
  },
}
```

Usar `false` puede sacar `define(import.meta.url, Component)` del chunk de entrada, de modo que el import `?declare-tag=` del Host no registre el elemento.

```ts
import hostImportMap from './wippy-import-map.json'

export default {
  build: {
    rollupOptions: {
      external: Object.keys(hostImportMap.imports),
    },
  },
}
```

La instantánea debe incluir su procedencia y hash. Una dependencia ausente de la instantánea se incluye en el bundle, salvo que se aplique otra regla de compilación documentada.

Para la versión de referencia Web Host 1.0.56, la URL canónica de la instantánea es `https://web-host.wippy.ai/webcomponents-1.0.56/import-map.json`. No la sustituya por la URL de la aplicación local, una URL `latest` sin fijar ni una lista de paquetes reconstruida manualmente.

Esta versión del Host se coordina con los paquetes públicos `@wippy-fe/*` 0.0.56. `@wippy-fe/vite-plugin` 0.0.56 admite Vite 5, 6 y 7. Los ejemplos de esta documentación usan Vite 7 con Node 22.12 o posterior; quienes decidan permanecer en Vite 5 o 6 deben seguir los requisitos de Node de esa versión de Vite. El repositorio fuente de Web Host declara por separado Node 22+ y usa Vite 7.
