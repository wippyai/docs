---
title: "Contrato de Build e Dependências"
description: "Comandos canônicos de saída, wrappers para Windows, snapshots de import map do Web Host e externals."
---

# Contrato de Build e Dependências

## Contrato canônico de build de projeto Wippy

Em um repositório de aplicação ou módulo Wippy iniciado por `wippy.exe`, invoque
o target Make do repositório. Não execute comandos de build do gerenciador de
pacotes ou do Vite diretamente.

A receita do Makefile para todo target de frontend de produção usa:

```text
npm run build -- --outDir <target> --emptyOutDir
```

O build de deploy é dono de `<target>`. O `vite.config.ts` não deve ter um diretório de saída de deploy hard-coded.

Repositórios de código-fonte de plataforma/pacotes que não são iniciados por
`wippy.exe`, como o código-fonte do Web Host, usam exatamente os scripts e
argumentos declarados no `package.json` daquele repositório. A receita de módulo
Wippy `--outDir <target> --emptyOutDir` não se aplica a repositórios de
código-fonte de pacotes, a menos que o próprio script declarado deles documente
explicitamente esses argumentos.

### Makefile

```makefile
FRONTEND_OUTPUT := $(abspath app/src/app/static/example)

.PHONY: frontend-example
frontend-example:
	cd frontend/example && npm run build -- --outDir "$(FRONTEND_OUTPUT)" --emptyOutDir
```

### make.ps1

Usuários de Windows invocam o target correspondente através do `make.bat`. O
`make.ps1` implementa o target do Makefile para Windows; ele não é uma interface
pública de build separada.

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

O `make.bat` apenas delega ao seu equivalente em PowerShell, repassa argumentos e retorna o código de saída dele.
Para o target de exemplo, usuários de Windows executam `make.bat frontend-example`.

```bat
@powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0make.ps1" %*
@exit /b %ERRORLEVEL%
```

## Algoritmo de snapshot do import map

A release-alvo do Web Host define os módulos fornecidos pelo host.

1. Resolva a tag da release-alvo do Web Host.
2. Busque
   `https://web-host.wippy.ai/<release-tag>/import-map.json` uma vez durante o
   desenvolvimento.
3. Armazene a tag da release, a URL exata resolvida, o objeto `imports` completo
   e o SHA-256 em minúsculas dos bytes exatos do payload do import map buscado.
4. Externalize todas as chaves desse objeto `imports`.
5. Use o mesmo snapshot completo para o modo host-less.
6. Busque novamente quando a release do host mudar ou quando uma dependência recém-adicionada puder agora ser fornecida pelo host.
7. Inspecione a saída compilada e rejeite imports bare ausentes do snapshot.

Não mantenha uma lista de pacotes escrita à mão. Não espelhe o conjunto completo de externals nas peer dependencies.

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

O snapshot precisa incluir sua proveniência e seu hash. Uma dependência ausente do snapshot é empacotada no bundle, a menos que outra regra de build documentada se aplique.

Por exemplo, se a tag de release selecionada for `v1.2.3`, a única URL canônica
de snapshot é
`https://web-host.wippy.ai/v1.2.3/import-map.json`. Não substitua pela URL da
aplicação local, por uma URL `latest` sem pin, nem por uma lista de pacotes
reconstruída manualmente.
