---
title: "Build- und Abhängigkeitsvertrag"
description: "Kanonische Ausgabebefehle, Windows-Wrapper, Snapshots der Web-Host-Import-Map und Externals."
---

# Build- und Abhängigkeitsvertrag

Dies ist ein Referenzvertrag für vorhandene Repositories. Die folgenden
Makefile-, PowerShell-, Batch- und Vite-Blöcke sind gezielte Fragmente, kein
eigenständiges Projektscaffold.

## Kanonischer Produktions-Build für Wippy

Ein Produktionsartefakt in einem durch `wippy.exe` gestarteten Wippy-Anwendungs-
oder Modulrepository wird über das Make-Ziel des Repositories gebaut. Lokale
Watch-Befehle wie `npm run dev` bleiben gültig, wenn das Repository sie
dokumentiert, ersetzen aber nicht den Deployment-Build.

Das Makefile-Rezept jedes Produktions-Frontend-Ziels verwendet:

```text
npm run build -- --outDir <target> --emptyOutDir
```

Der Deployment-Build besitzt `<target>`. `vite.config.ts` darf kein
Deployment-Ausgabeverzeichnis fest eintragen.

Plattform-/Paketquell-Repositories, die nicht von `wippy.exe` gestartet werden,
beispielsweise der Web-Host-Quellcode, verwenden exakt die in ihrer
`package.json` deklarierten Skripte und Argumente. Das Wippy-Modulrezept
`--outDir <target> --emptyOutDir` gilt dort nur, wenn das eigene Skript es
ausdrücklich dokumentiert.

### Makefile

```makefile
FRONTEND_OUTPUT := $(abspath app/src/app/static/example)

.PHONY: frontend-example
frontend-example:
	cd frontend/example && npm run build -- --outDir "$(FRONTEND_OUTPUT)" --emptyOutDir
```

### make.ps1

Unter Windows wird das passende Ziel über `make.bat` aufgerufen. `make.ps1`
implementiert das Makefile-Ziel für Windows und ist keine eigene öffentliche
Buildschnittstelle.

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

`make.bat` delegiert lediglich an PowerShell, leitet Argumente weiter und gibt
den Exitcode zurück. Für das Beispiel lautet der Windows-Aufruf
`make.bat frontend-example`.

```bat
@powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0make.ps1" %*
@exit /b %ERRORLEVEL%
```

## Algorithmus für den Import-Map-Snapshot :id=importmap-snapshot-algorithmus

Der Zielrelease des Web Hosts definiert die vom Host bereitgestellten Module.

1. Ziel-Release-Tag des Web Hosts bestimmen.
2. `https://web-host.wippy.ai/<release-tag>/import-map.json` einmal während der Entwicklung abrufen.
3. Release-Tag, exakt aufgelöste URL, vollständiges `imports`-Objekt und kleingeschriebenen SHA-256 der exakten Payloadbytes speichern.
4. Jeden Schlüssel dieses `imports`-Objekts externalisieren.
5. Denselben vollständigen Snapshot im Host-less-Modus verwenden.
6. Bei geändertem Hostrelease oder möglicherweise neu vom Host bereitgestellter Abhängigkeit erneut abrufen.
7. Buildausgabe untersuchen und bare Imports ablehnen, die im Snapshot fehlen.

Pflegen Sie keine Paketliste von Hand und kopieren Sie nicht die gesamte
External-Menge in Peer Dependencies.

Bei Web-Component-Einstiegsbuilds muss der Registrierungseffekt des Einstiegsmoduls erhalten bleiben:

```ts
export default {
  build: {
    rollupOptions: {
      preserveEntrySignatures: 'strict',
    },
  },
}
```

Mit `false` kann `define(import.meta.url, Component)` aus dem Entry-Chunk
verschoben werden, sodass der Hostimport mit `?declare-tag=` das Element nicht
registriert.

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

Der Snapshot muss Herkunft und Hash enthalten. Eine fehlende Abhängigkeit wird
gebündelt, sofern keine andere dokumentierte Buildregel gilt.

Für Web Host 1.0.56 ist die kanonische URL
`https://web-host.wippy.ai/webcomponents-1.0.56/import-map.json`. Ersetzen Sie
sie nicht durch eine lokale Anwendungs-URL, `latest` oder eine rekonstruierte Liste.

Dieser Hostrelease gehört zur öffentlichen Paketfamilie `@wippy-fe/*` 0.0.56.
`@wippy-fe/vite-plugin` 0.0.56 unterstützt Vite 5, 6 und 7. Die Beispiele
verwenden Vite 7 mit Node 22.12 oder neuer; Nutzer von Vite 5/6 müssen dessen
Node-Anforderungen beachten. Das Web-Host-Quellrepository verlangt separat
Node 22+ und nutzt Vite 7.
