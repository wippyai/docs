---
title: "Contrato de Build y Dependencias"
description: "Comandos de salida canónicos, wrappers de Windows, snapshots del import map del Web Host y externals."
---

# Contrato de Build y Dependencias

## Contrato canónico de build de un proyecto Wippy

En un repositorio de aplicación o módulo Wippy lanzado por `wippy.exe`, invoque
el target de Make del repositorio. No ejecute directamente comandos de build del
gestor de paquetes ni de Vite.

La receta del Makefile para cada target de frontend de producción usa:

```text
npm run build -- --outDir <target> --emptyOutDir
```

El build de despliegue es dueño de `<target>`. `vite.config.ts` no debe fijar en
duro un directorio de salida de despliegue.

Los repositorios fuente de plataforma o de paquetes que no se lanzan con
`wippy.exe`, como el código fuente del Web Host, usan exactamente los scripts y
argumentos declarados por el `package.json` de ese repositorio. La receta
`--outDir <target> --emptyOutDir` de los módulos Wippy no se aplica a
repositorios fuente de paquetes salvo que su propio script declarado documente
explícitamente esos argumentos.

### Makefile

```makefile
FRONTEND_OUTPUT := $(abspath app/src/app/static/example)

.PHONY: frontend-example
frontend-example:
	cd frontend/example && npm run build -- --outDir "$(FRONTEND_OUTPUT)" --emptyOutDir
```

### make.ps1

Los usuarios de Windows invocan el target equivalente a través de `make.bat`.
`make.ps1` implementa el target del Makefile para Windows; no es una interfaz de
build pública separada.

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

`make.bat` solo delega en su contraparte de PowerShell, reenvía los argumentos y devuelve su código de salida.
Para el target de ejemplo, los usuarios de Windows ejecutan `make.bat frontend-example`.

```bat
@powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0make.ps1" %*
@exit /b %ERRORLEVEL%
```

## Algoritmo del snapshot del import map

La release del Web Host de destino define los módulos provistos por el host.

1. Resuelva el tag de release del Web Host de destino.
2. Obtenga
   `https://web-host.wippy.ai/<release-tag>/import-map.json` una vez durante el
   desarrollo.
3. Almacene el tag de release, la URL exacta resuelta, el objeto `imports`
   completo y el SHA-256 en minúsculas de los bytes exactos del payload del
   import map obtenido.
4. Externalice cada clave de ese objeto `imports`.
5. Use el mismo snapshot completo para el modo host-less.
6. Vuelva a obtenerlo cuando cambie la release del host o cuando una dependencia
   recién añadida pueda estar ahora provista por el host.
7. Inspeccione la salida compilada y rechace los imports desnudos que no estén en
   el snapshot.

No mantenga una lista de paquetes escrita a mano. No replique el conjunto
completo de externals en las peer dependencies.

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

El snapshot debe incluir su procedencia y su hash. Una dependencia ausente del
snapshot se empaqueta en el bundle salvo que se aplique otra regla de build
documentada.

Por ejemplo, si el tag de release seleccionado es `v1.2.3`, la única URL canónica
del snapshot es
`https://web-host.wippy.ai/v1.2.3/import-map.json`. No sustituya por la URL local
de la aplicación, por una URL `latest` sin fijar ni por una lista de paquetes
reconstruida a mano.
