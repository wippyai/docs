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

El candidato combinado aprobado de Web Host 1.0.63 tiene como URL prevista de
instantánea `https://web-host.wippy.ai/webcomponents-1.0.63/import-map.json`.
Confirme el tag después de la publicación. No sustituya la URL por la aplicación
local, una URL `latest` sin fijar ni una lista reconstruida manualmente.

Las entradas de PrimeVue 4.5.5 del candidato se generan a partir de sus patrones
públicos de exportación. El archivo de Host `primevue-export-inventory.json`
registra los destinos concretos de runtime. Use sus especificadores exactos; no
use un comodín ni mantenga un subconjunto manual. Consulte [Paquetes de Host](../web-host/packages.md).

### URLs de Host y rutas de despliegue

La compilación del paquete Web Host requiere `APP_URL`. Defina el origen HTTP(S)
público y, si corresponde, la ruta de despliegue. La compilación rechaza valores
ausentes o no válidos, incluidas credenciales, consultas, fragmentos y segmentos
que permiten subir directorios. Conserve rutas como `/wippy`; Host las usa al
crear URLs absolutas en `dist/import-map.json`.

Para compilar la versión de producción bajo una ruta, use la URL de despliegue y
la compilación completa. Deje `APP_IGNORE_TAG` sin definir para conservar la
etiqueta de versión:

```powershell
$env:APP_URL = 'https://cdn.example/wippy'
Remove-Item Env:APP_IGNORE_TAG -ErrorAction SilentlyContinue
pnpm run build
```

Para una compilación local sin etiqueta, defina ambas variables:

```powershell
$env:APP_URL = 'http://localhost:5173'
$env:APP_IGNORE_TAG = '1'
pnpm run build
```

`APP_IGNORE_TAG=1` elimina el prefijo de versión. Úselo en pruebas locales, no
en despliegues de producción versionados. `APP_URL` sigue siendo obligatorio.
La compilación completa `pnpm run build` también genera los artefactos de proxy,
las bibliotecas y los tipos. Use `pnpm run build:site` solo para cambios
incrementales propios del sitio cuando esos requisitos ya estén preparados.
`build:site` usa `${APP_URL}/${tagPrefix}` como base absoluta de Vite;
`build:site:relative` usa el prefijo de versión como base relativa de Vite, pero
los valores del import map siguen siendo URLs absolutas.

Para el candidato, `APP_URL=https://cdn.example/wippy` con la etiqueta
`webcomponents-1.0.63` produce
`https://cdn.example/wippy/webcomponents-1.0.63/import-map.json`. Las URLs de
vendor y de chunks dinámicos deben conservar el origen, la ruta y la etiqueta.
Después de compilar, compruebe que todos los valores de `imports` en
`dist/import-map.json` sean URLs HTTP(S) absolutas bajo el origen y la ruta
configurados y que ninguno contenga `/undefined/`. Luego solicite el mapa y sus
recursos por la ruta real de despliegue. Una compilación correcta no verifica el
enrutamiento.

## URLs de AppConfig importMap

Las URL relativas del mapa se resuelven respecto a la URL base del documento creado. Prefiere URL absolutas con versión y ruta de despliegue fijadas, como `https://cdn.example/wippy/vendor/` o `http://localhost:5173/vendor/`. Si un módulo CDN importa otro bare specifier, añade su entrada o usa un módulo CDN autocontenido. El mapa en ejecución no reescribe imports ya incluidos en un bundle. Consulta [Secuencia de arranque](../web-host/bootstrap.md#appconfig-import-map).

Usa este campo solo con una versión desplegada del Host que documente su compatibilidad.

## Release tag source

La etiqueta de compilación procede de `CI_COMMIT_TAG`; si no está definida, se usa `APP_TAG`. Define `APP_TAG` al crear un artefacto versionado fuera de CI.
