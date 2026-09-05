---
title: "Build- und Abhängigkeitsvertrag"
description: "Kanonische Ausgabekommandos, Windows-Wrapper, Import-Map-Snapshots des Web Hosts und Externals."
---

# Build- und Abhängigkeitsvertrag

## Kanonischer Build-Vertrag für Wippy-Projekte

In einem Wippy-Anwendungs- oder Modul-Repository, das von `wippy.exe` gestartet
wird, rufen Sie das Make-Target des Repositories auf. Führen Sie keine
Paketmanager- oder Vite-Build-Kommandos direkt aus.

Das Makefile-Rezept für jedes Produktions-Frontend-Target verwendet:

```text
npm run build -- --outDir <target> --emptyOutDir
```

Der Deployment-Build besitzt `<target>`. `vite.config.ts` darf kein
Deployment-Ausgabeverzeichnis fest verdrahten.

Plattform- bzw. Package-Quell-Repositories, die nicht von `wippy.exe` gestartet
werden, etwa die Web-Host-Quellen, verwenden exakt die Skripte und Argumente,
die die `package.json` des jeweiligen Repositories deklariert. Das
Wippy-Modul-Rezept `--outDir <target> --emptyOutDir` gilt nicht für
Package-Quell-Repositories, sofern deren eigenes deklariertes Skript diese
Argumente nicht ausdrücklich dokumentiert.

### Makefile

```makefile
FRONTEND_OUTPUT := $(abspath app/src/app/static/example)

.PHONY: frontend-example
frontend-example:
	cd frontend/example && npm run build -- --outDir "$(FRONTEND_OUTPUT)" --emptyOutDir
```

### make.ps1

Windows-Benutzer rufen das passende Target über `make.bat` auf. `make.ps1`
implementiert das Makefile-Target für Windows; es ist keine separate
öffentliche Build-Schnittstelle.

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

`make.bat` delegiert lediglich an sein PowerShell-Gegenstück, reicht Argumente weiter und gibt dessen Exit-Code zurück.
Für das Beispiel-Target führen Windows-Benutzer `make.bat frontend-example` aus.

```bat
@powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0make.ps1" %*
@exit /b %ERRORLEVEL%
```

## Algorithmus für den Import-Map-Snapshot

Das Ziel-Release des Web Hosts definiert die vom Host bereitgestellten Module.

1. Lösen Sie das Release-Tag des Ziel-Web-Hosts auf.
2. Holen Sie
   `https://web-host.wippy.ai/<release-tag>/import-map.json` einmalig während
   der Entwicklung.
3. Speichern Sie das Release-Tag, die exakt aufgelöste URL, das vollständige
   `imports`-Objekt und den kleingeschriebenen SHA-256 der exakt geholten
   Import-Map-Payload-Bytes.
4. Externalisieren Sie jeden Key in diesem `imports`-Objekt.
5. Verwenden Sie denselben vollständigen Snapshot für den Host-less-Modus.
6. Holen Sie ihn erneut, wenn sich das Host-Release ändert oder wenn eine neu hinzugefügte Abhängigkeit nun vom Host bereitgestellt sein könnte.
7. Prüfen Sie die Build-Ausgabe und weisen Sie Bare Imports zurück, die im Snapshot fehlen.

Pflegen Sie keine handgeschriebene Paketliste. Spiegeln Sie nicht die vollständige Externals-Menge in die Peer Dependencies.

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

Der Snapshot muss seine Herkunft und seinen Hash enthalten. Eine Abhängigkeit, die im Snapshot fehlt, wird gebundelt, sofern keine andere dokumentierte Build-Regel greift.

Wenn das gewählte Release-Tag zum Beispiel `v1.2.3` ist, lautet die einzige
kanonische Snapshot-URL
`https://web-host.wippy.ai/v1.2.3/import-map.json`. Ersetzen Sie sie nicht durch
die lokale Anwendungs-URL, eine ungepinnte `latest`-URL oder eine manuell
rekonstruierte Paketliste.
