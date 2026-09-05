---
title: "빌드 및 의존성 계약"
description: "정식 출력 명령, Windows 래퍼, 웹 호스트 임포트 맵 스냅샷, 그리고 외부 모듈."
---

# 빌드 및 의존성 계약

## Wippy 프로젝트의 정식 빌드 계약

`wippy.exe`가 실행하는 Wippy 애플리케이션 또는 모듈 저장소에서는 저장소의 Make
타깃을 호출하세요. 패키지 매니저나 Vite 빌드 명령을 직접 실행하지 마세요.

모든 프로덕션 프론트엔드 타깃의 Makefile 레시피는 다음을 사용합니다:

```text
npm run build -- --outDir <target> --emptyOutDir
```

배포 빌드가 `<target>`을 소유합니다. `vite.config.ts`는 배포 출력 디렉터리를 하드코딩해서는 안 됩니다.

웹 호스트 소스처럼 `wippy.exe`가 실행하지 않는 플랫폼/패키지 소스 저장소는 해당
저장소의 `package.json`이 선언한 스크립트와 인자를 그대로 사용합니다. Wippy 모듈의
`--outDir <target> --emptyOutDir` 레시피는, 해당 저장소가 선언한 스크립트가 그
인자들을 명시적으로 문서화하지 않는 한 패키지 소스 저장소에는 적용되지 않습니다.

### Makefile

```makefile
FRONTEND_OUTPUT := $(abspath app/src/app/static/example)

.PHONY: frontend-example
frontend-example:
	cd frontend/example && npm run build -- --outDir "$(FRONTEND_OUTPUT)" --emptyOutDir
```

### make.ps1

Windows 사용자는 `make.bat`을 통해 대응하는 타깃을 호출합니다. `make.ps1`은
Windows용 Makefile 타깃 구현이며, 별도의 공개 빌드 인터페이스가 아닙니다.

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

`make.bat`은 PowerShell 대응 스크립트로 위임하고, 인자를 전달하고, 종료 코드를 반환하기만 합니다.
예시 타깃의 경우 Windows 사용자는 `make.bat frontend-example`을 실행합니다.

```bat
@powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0make.ps1" %*
@exit /b %ERRORLEVEL%
```

## 임포트 맵 스냅샷 알고리즘

대상 웹 호스트 릴리스가 호스트 제공 모듈을 정의합니다.

1. 대상 웹 호스트 릴리스 태그를 확정합니다.
2. 개발 중에 한 번
   `https://web-host.wippy.ai/<release-tag>/import-map.json`을 가져옵니다.
3. 릴리스 태그, 정확한 해석 URL, 완전한 `imports` 객체, 그리고 가져온 임포트 맵
   페이로드 바이트의 소문자 SHA-256을 저장합니다.
4. 그 `imports` 객체의 모든 키를 외부 모듈로 지정합니다.
5. 호스트리스 모드에도 동일한 완전 스냅샷을 사용합니다.
6. 호스트 릴리스가 바뀌거나, 새로 추가한 의존성이 이제 호스트 제공 대상일 수 있을 때 다시 가져옵니다.
7. 빌드 산출물을 검사하여 스냅샷에 없는 베어 임포트를 거부합니다.

손으로 작성한 패키지 목록을 유지하지 마세요. 전체 외부 모듈 집합을 peer 의존성에 그대로 옮기지 마세요.

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

스냅샷에는 출처와 해시가 포함되어야 합니다. 스냅샷에 없는 의존성은, 문서화된 다른 빌드 규칙이 적용되지 않는 한 번들에 포함됩니다.

예를 들어 선택한 릴리스 태그가 `v1.2.3`이라면 유일한 정식 스냅샷 URL은
`https://web-host.wippy.ai/v1.2.3/import-map.json`입니다. 로컬 애플리케이션 URL,
핀 고정되지 않은 `latest` URL, 수작업으로 재구성한 패키지 목록으로 대체하지 마세요.
