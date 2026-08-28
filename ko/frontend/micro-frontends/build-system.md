---
title: "빌드 및 의존성 계약"
description: "정식 출력 명령, Windows 래퍼, Web Host import-map 스냅샷, externals에 관한 계약입니다."
---

# 빌드 및 의존성 계약

이 문서는 기존 저장소를 위한 레퍼런스 계약입니다. 아래 Makefile, PowerShell, 배치, Vite 블록은 핵심 부분만 보여 주며 독립 실행형 프로젝트 스캐폴드가 아닙니다.

## 정식 Wippy 프로덕션 빌드 계약

`wippy.exe`가 실행하는 Wippy 애플리케이션 또는 모듈 저장소에서 프로덕션 아티팩트를 만들 때는 저장소 Make 대상을 호출합니다. 저장소가 문서화한 `npm run dev` 같은 로컬 감시 모드 명령은 여전히 유효하지만 배포 빌드를 대체하지 않습니다.

모든 프로덕션 프런트엔드 대상의 Makefile 레시피는 다음 명령을 사용합니다.

```text
npm run build -- --outDir <target> --emptyOutDir
```

배포 빌드가 `<target>`을 소유합니다. `vite.config.ts`에 배포 출력 디렉터리를 하드코딩하면 안 됩니다.

Web Host 소스처럼 `wippy.exe`가 실행하지 않는 플랫폼/패키지 소스 저장소는 해당 저장소의 `package.json`에 선언된 정확한 스크립트와 인수를 사용합니다. Wippy 모듈의 `--outDir <target> --emptyOutDir` 레시피는 자체 선언 스크립트에 이 인수가 명시적으로 문서화되지 않는 한 패키지 소스 저장소에 적용되지 않습니다.

### Makefile

```makefile
FRONTEND_OUTPUT := $(abspath app/src/app/static/example)

.PHONY: frontend-example
frontend-example:
	cd frontend/example && npm run build -- --outDir "$(FRONTEND_OUTPUT)" --emptyOutDir
```

### make.ps1

Windows 사용자는 `make.bat`를 통해 해당 대상을 호출합니다. `make.ps1`은 Windows용 Makefile 대상을 구현하지만 별도의 공개 빌드 인터페이스는 아닙니다.

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

`make.bat`는 해당 PowerShell 파일에 위임하고 인수를 전달한 뒤 종료 코드를 반환하기만 합니다. 예제 대상의 경우 Windows 사용자는 `make.bat frontend-example`을 실행합니다.

```bat
@powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0make.ps1" %*
@exit /b %ERRORLEVEL%
```

## Import-map 스냅샷 알고리즘

대상 Web Host 릴리스가 호스트 제공 모듈을 정의합니다.

1. 대상 Web Host 릴리스 태그를 확정합니다.
2. 개발 중 `https://web-host.wippy.ai/<release-tag>/import-map.json`을 한 번 가져옵니다.
3. 릴리스 태그, 정확히 해석된 URL, 전체 `imports` 객체, 가져온 import-map 페이로드 원본 바이트의 소문자 SHA-256을 저장합니다.
4. 그 `imports` 객체의 모든 키를 external로 지정합니다.
5. 호스트 없는 모드에서도 동일한 전체 스냅샷을 사용합니다.
6. 호스트 릴리스가 바뀌거나 새로 추가한 의존성을 이제 호스트가 제공할 가능성이 있을 때 다시 가져옵니다.
7. 빌드 출력을 검사하고 스냅샷에 없는 bare import를 거부합니다.

패키지 목록을 수동으로 관리하지 마세요. 전체 external 집합을 peer dependency에 그대로 복제하지 마세요.

웹 컴포넌트 진입 빌드에서는 진입 모듈의 등록 부작용을 보존합니다.

```ts
export default {
  build: {
    rollupOptions: {
      preserveEntrySignatures: 'strict',
    },
  },
}
```

`false`를 사용하면 `define(import.meta.url, Component)`가 진입 청크 밖으로 이동하여 Host의 `?declare-tag=` import가 엘리먼트를 등록하지 못할 수 있습니다.

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

스냅샷은 출처와 해시를 포함해야 합니다. 스냅샷에 없는 의존성은 다른 문서화된 빌드 규칙이 적용되지 않는 한 번들에 포함됩니다.

Web Host 1.0.56 기준의 정식 스냅샷 URL은 `https://web-host.wippy.ai/webcomponents-1.0.56/import-map.json`입니다. 로컬 애플리케이션 URL, 고정되지 않은 `latest` URL, 수동으로 재구성한 패키지 목록으로 바꾸지 마세요.

이 Host 릴리스는 공개 `@wippy-fe/*` 0.0.56 패키지와 조정되어 있습니다. `@wippy-fe/vite-plugin` 0.0.56은 Vite 5, 6, 7을 지원합니다. 이 문서의 예제는 Node 22.12 이상과 Vite 7을 사용합니다. 의도적으로 Vite 5 또는 6을 유지하는 소비자는 해당 Vite 릴리스의 Node 요구 사항을 따라야 합니다. Web Host 소스 저장소는 별도로 Node 22 이상을 선언하고 Vite 7을 사용합니다.
