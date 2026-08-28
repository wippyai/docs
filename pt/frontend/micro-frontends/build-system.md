---
title: "Contrato de build e dependências"
description: "Comandos canônicos de saída, wrappers do Windows, snapshots do import map do Web Host e externals."
---

# Contrato de build e dependências

Esta é uma referência de contrato para repositórios existentes. Os blocos de Makefile, PowerShell, batch e Vite abaixo são trechos focados; não são um scaffold independente de projeto.

## Contrato canônico de build de produção do Wippy

Para um artefato de produção em um repositório de aplicação ou módulo Wippy iniciado por `wippy.exe`, invoque o target Make do repositório. Comandos locais em modo watch, como `npm run dev`, continuam válidos quando documentados pelo repositório, mas não substituem o build de implantação.

A receita Makefile de cada target frontend de produção usa:

```text
npm run build -- --outDir <target> --emptyOutDir
```

O build de implantação controla `<target>`. `vite.config.ts` não pode fixar um diretório de saída da implantação.

Repositórios de código-fonte de plataforma/pacote que não são iniciados por `wippy.exe`, como o código-fonte do Web Host, usam os scripts e argumentos exatos declarados pelo `package.json` desse repositório. A receita de módulo Wippy `--outDir <target> --emptyOutDir` não se aplica a repositórios de código-fonte de pacote, salvo se o script declarado por eles documentar explicitamente esses argumentos.

### Makefile

```makefile
FRONTEND_OUTPUT := $(abspath app/src/app/static/example)

.PHONY: frontend-example
frontend-example:
	cd frontend/example && npm run build -- --outDir "$(FRONTEND_OUTPUT)" --emptyOutDir
```

### make.ps1

Usuários do Windows invocam o target correspondente por `make.bat`. `make.ps1` implementa o target do Makefile no Windows; não é uma interface pública de build separada.

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

`make.bat` apenas delega ao correspondente PowerShell, encaminha argumentos e retorna seu exit code. No target de exemplo, usuários do Windows executam `make.bat frontend-example`.

```bat
@powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0make.ps1" %*
@exit /b %ERRORLEVEL%
```

## Algoritmo do snapshot do import map

A release alvo do Web Host define os módulos fornecidos pelo host.

1. Resolva a tag da release alvo do Web Host.
2. Busque `https://web-host.wippy.ai/<release-tag>/import-map.json` uma vez durante o desenvolvimento.
3. Armazene a tag da release, a URL exata resolvida, o objeto `imports` completo e o SHA-256 em minúsculas dos bytes exatos do payload do import map buscado.
4. Externalize todas as chaves desse objeto `imports`.
5. Use o mesmo snapshot completo no modo sem host.
6. Busque novamente quando a release do host mudar ou uma dependência recém-adicionada puder ser fornecida pelo host.
7. Inspecione a saída compilada e rejeite imports bare ausentes do snapshot.

Não mantenha uma lista de pacotes escrita à mão. Não replique todo o conjunto externo em peer dependencies.

Em builds de entry de web component, preserve o side effect de registro do módulo de entrada:

```ts
export default {
  build: {
    rollupOptions: {
      preserveEntrySignatures: 'strict',
    },
  },
}
```

Usar `false` pode mover `define(import.meta.url, Component)` para fora do chunk de entrada, impedindo o import `?declare-tag=` do Host de registrar o elemento.

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

O snapshot deve incluir procedência e hash. Uma dependência ausente do snapshot é incluída no bundle, salvo se outra regra de build documentada se aplicar.

Para a baseline do Web Host 1.0.56, a URL canônica do snapshot é `https://web-host.wippy.ai/webcomponents-1.0.56/import-map.json`. Não a substitua pela URL da aplicação local, uma URL `latest` não fixada ou uma lista de pacotes reconstruída manualmente.

Essa release do Host é coordenada com os pacotes públicos `@wippy-fe/*` 0.0.56. `@wippy-fe/vite-plugin` 0.0.56 é compatível com Vite 5, 6 e 7. Os exemplos desta documentação usam Vite 7 com Node 22.12 ou mais recente; consumidores que permanecerem deliberadamente no Vite 5 ou 6 precisam seguir os requisitos de Node dessa release do Vite. O repositório de código-fonte do Web Host declara separadamente Node 22+ e usa Vite 7.
