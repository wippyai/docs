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

O candidato combinado aprovado do Web Host 1.0.63 prevê o snapshot em
`https://web-host.wippy.ai/webcomponents-1.0.63/import-map.json`. Confirme a tag
após a publicação. Não substitua essa URL pela aplicação local, por uma URL
`latest` sem fixação ou por uma lista de pacotes reconstruída manualmente.

As entradas PrimeVue 4.5.5 do candidato são geradas a partir dos padrões públicos
de exportação. O arquivo do Host `primevue-export-inventory.json` registra os
destinos concretos de runtime. Use os especificadores exatos, sem curinga ou
subconjunto manual. Consulte [Pacotes do Host](../web-host/packages.md).

### URLs do Host e caminhos de implantação

A compilação do pacote Web Host exige `APP_URL`. Defina a origem HTTP(S) pública
e, se necessário, o caminho de implantação. A compilação rejeita URLs ausentes ou
inválidas, incluindo credenciais, query, fragmento e segmentos de travessia de
caminho. Preserve caminhos como `/wippy`; o Host os usa nas URLs absolutas de
`dist/import-map.json`.

Para compilar a versão de produção sob um caminho, defina a URL de implantação e
execute a compilação completa do pacote. Deixe `APP_IGNORE_TAG` sem definição
para manter a etiqueta de versão:

```powershell
$env:APP_URL = 'https://cdn.example/wippy'
Remove-Item Env:APP_IGNORE_TAG -ErrorAction SilentlyContinue
pnpm run build
```

Para uma compilação local sem etiqueta, defina as duas variáveis:

```powershell
$env:APP_URL = 'http://localhost:5173'
$env:APP_IGNORE_TAG = '1'
pnpm run build
```

`APP_IGNORE_TAG=1` remove o prefixo da etiqueta. Use-o em testes locais, não em
uma implantação de produção versionada. `APP_URL` continua obrigatório.
A compilação completa `pnpm run build` também prepara os artefactos de proxy,
bibliotecas e tipos. Use `pnpm run build:site` apenas para uma alteração
incremental do site depois de esses pré-requisitos existirem.
`build:site` usa `${APP_URL}/${tagPrefix}` como base absoluta do Vite;
`build:site:relative` usa o prefixo da etiqueta como base relativa do Vite, mas
os valores do import map continuam sendo URLs absolutas.

Para o candidato, `APP_URL=https://cdn.example/wippy` e a etiqueta
`webcomponents-1.0.63` produzem
`https://cdn.example/wippy/webcomponents-1.0.63/import-map.json`. As URLs de
vendor e dos chunks dinâmicos devem manter a mesma origem, caminho e etiqueta.
Após a compilação, confira `dist/import-map.json`: todos os valores de `imports`
devem ser URLs HTTP(S) absolutas sob a origem e o caminho configurados, sem
`/undefined/`. Depois, solicite o mapa versionado e seus recursos pela rota real
de implantação. Uma compilação bem-sucedida não verifica o roteamento.

## URLs de AppConfig importMap

URLs relativas do mapa são resolvidas em relação à URL base do documento criado. Prefira URLs absolutas com versão e caminho de implantação fixos, como `https://cdn.example/wippy/vendor/` ou `http://localhost:5173/vendor/`. Se um módulo de CDN importar outro bare specifier, mapeie também essa dependência ou use um módulo autocontido. O mapa em execução não reescreve imports já incluídos em um bundle. Consulte [Sequência de inicialização](../web-host/bootstrap.md#appconfig-import-map).

Use este campo somente com uma versão implantada do Host cuja documentação confirme o suporte.

## Release tag source

A tag de build vem de `CI_COMMIT_TAG`; se não estiver definida, `APP_TAG` será usada. Defina `APP_TAG` ao criar um artefato versionado fora do CI.
