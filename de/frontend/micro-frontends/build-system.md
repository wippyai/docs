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

Der genehmigte gemeinsame Web-Host-Kandidat 1.0.63 verwendet voraussichtlich
`https://web-host.wippy.ai/webcomponents-1.0.63/import-map.json`. Bestätigen Sie
das Tag nach der Veröffentlichung. Ersetzen Sie die URL nicht durch eine lokale
Anwendungs-URL, `latest` oder eine rekonstruierte Liste.

Die PrimeVue-4.5.5-Einträge dieses Kandidaten werden aus den öffentlichen
Exportmustern generiert. Die Host-Datei `primevue-export-inventory.json` enthält
die konkreten Runtime-Ziele. Verwenden Sie deren exakte Specifier statt eines
Wildcards oder einer handgepflegten Teilmenge. Siehe [Host-Pakete](../web-host/packages.md).

### Host-URLs und Bereitstellungspfade

Der Web-Host-Paketbuild benötigt `APP_URL`. Setzen Sie die öffentliche HTTP(S)-
Origin und optional den Bereitstellungspfad. Der Build weist fehlende oder
ungültige URLs zurück, darunter Zugangsdaten, Query, Fragment und Pfad-Traversal.
Behalten Sie einen Pfad wie `/wippy` bei. Der Host verwendet ihn in den absoluten
URLs in `dist/import-map.json`.

Für einen Produktionsbuild unter einem Pfad setzen Sie die URL und starten den
vollständigen Paketbuild. Lassen Sie `APP_IGNORE_TAG` unset, damit der Release-Tag
in den URLs bleibt:

```powershell
$env:APP_URL = 'https://cdn.example/wippy'
Remove-Item Env:APP_IGNORE_TAG -ErrorAction SilentlyContinue
pnpm run build
```

Für einen lokalen Build ohne Tag setzen Sie beide Variablen explizit:

```powershell
$env:APP_URL = 'http://localhost:5173'
$env:APP_IGNORE_TAG = '1'
pnpm run build
```

`APP_IGNORE_TAG=1` entfernt den Release-Tag-Präfix. Verwenden Sie dies für lokale
Tests, nicht für versionierte Produktion. `APP_URL` bleibt erforderlich.
Der vollständige Befehl `pnpm run build` erstellt auch Proxy-, Library- und
Type-Artefakte. Verwenden Sie `pnpm run build:site` nur für eine inkrementelle
Änderung an der Site, wenn diese Voraussetzungen bereits vorhanden sind.
`build:site` verwendet `${APP_URL}/${tagPrefix}` als absoluten Vite-Basis-Pfad.
`build:site:relative` verwendet den Tag-Präfix als relative Vite-Basis; die
Import-Map-Werte bleiben trotzdem absolut.

Für den Kandidaten erzeugen `APP_URL=https://cdn.example/wippy` und der Tag
`webcomponents-1.0.63` die Map-URL
`https://cdn.example/wippy/webcomponents-1.0.63/import-map.json`. Vendor- und
Dynamic-Chunk-URLs müssen Origin, Bereitstellungspfad und Tag beibehalten. Prüfen
Sie nach dem Build `dist/import-map.json`: Jeder `imports`-Wert muss eine absolute
HTTP(S)-URL unter Origin und Pfad sein und darf kein `/undefined/` enthalten.
Rufen Sie danach die versionierte Map und ihre Ressourcen über die echte
Bereitstellungsroute ab. Ein erfolgreicher Build prüft das Routing nicht.

## URLs in AppConfig-Import-Maps

Relative Ziele beziehen sich auf die Basis-URL des neuen Dokuments. Bevorzuge absolute URLs mit festgelegter Version und Bereitstellungspfad, zum Beispiel `https://cdn.example/wippy/vendor/` oder `http://localhost:5173/vendor/`. Importiert ein CDN-Modul weitere bare Specifier, ergänze dafür Map-Einträge oder nutze ein eigenständiges CDN-Modul. Eine Laufzeit-Map ändert keine bereits gebündelten Importe. Siehe [Bootstrap-Ablauf](../web-host/bootstrap.md#appconfig-import-map).

Verwende dieses Feld nur mit einem bereitgestellten Host-Release, dessen Dokumentation es unterstützt.

## Release tag source

Das Build-Tag stammt aus `CI_COMMIT_TAG`; falls nicht gesetzt, wird `APP_TAG` verwendet. Setze `APP_TAG` für versionierte Builds außerhalb von CI.
