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

승인된 통합 Web Host 1.0.63 후보의 예상 스냅샷 URL은
`https://web-host.wippy.ai/webcomponents-1.0.63/import-map.json`입니다. 배포 후
태그를 확인하세요. 로컬 애플리케이션 URL, 고정되지 않은 `latest` URL, 수동으로
재구성한 패키지 목록으로 바꾸지 마세요.

후보의 PrimeVue 4.5.5 항목은 공개 export 패턴에서 생성됩니다. Host의
`primevue-export-inventory.json`은 구체적인 런타임 대상을 기록합니다. 와일드카드나
수동 부분집합을 사용하지 말고 정확한 스펙파이어를 사용하세요. [Host 패키지](../web-host/packages.md)를 참조하세요.

### Host URL과 배포 경로

Web Host 패키지 빌드에는 `APP_URL`이 필요합니다. 공개 HTTP(S) origin과 선택적
배포 경로를 설정하세요. 누락되거나 잘못된 URL, 인증 정보, query, fragment,
경로 traversal은 빌드에서 거부됩니다. `/wippy` 같은 경로를 유지하세요. Host는
`dist/import-map.json`의 절대 URL을 만들 때 이 경로를 사용합니다.

경로 아래로 프로덕션 빌드를 만들려면 배포 URL로 전체 패키지 빌드를 실행하세요.
release tag를 유지하려면 `APP_IGNORE_TAG`를 설정하지 않습니다.

```powershell
$env:APP_URL = 'https://cdn.example/wippy'
Remove-Item Env:APP_IGNORE_TAG -ErrorAction SilentlyContinue
pnpm run build
```

tag 없는 로컬 빌드에서는 두 환경 변수를 명시적으로 설정합니다.

```powershell
$env:APP_URL = 'http://localhost:5173'
$env:APP_IGNORE_TAG = '1'
pnpm run build
```

`APP_IGNORE_TAG=1`은 release-tag 접두사를 제거합니다. 로컬 테스트에 사용하고
versioned production deployment에는 사용하지 마세요. `APP_URL`은 항상 필요합니다.
전체 `pnpm run build`는 proxy, library, type artifact도 준비합니다.
`pnpm run build:site`는 이러한 선행 조건이 갖춰진 뒤 site 코드만 변경했을 때의
incremental build에만 사용하세요.
`build:site`는 Vite absolute base에 `${APP_URL}/${tagPrefix}`를 사용합니다.
`build:site:relative`는 Vite relative asset base에 tag prefix를 사용하지만,
import-map 값은 계속 absolute URL입니다.

후보에서 `APP_URL=https://cdn.example/wippy`와 tag `webcomponents-1.0.63`은
`https://cdn.example/wippy/webcomponents-1.0.63/import-map.json`을 생성합니다.
vendor와 dynamic chunk URL도 origin, 배포 경로, tag를 유지해야 합니다. 빌드 후
`dist/import-map.json`에서 모든 `imports` 값이 설정한 origin과 경로 아래의 absolute
HTTP(S) URL인지, `/undefined/`가 없는지 확인하세요. 이어 실제 배포 경로로 map과
참조된 리소스를 요청하세요. 빌드 성공만으로 routing이 확인되지는 않습니다.

## AppConfig import map URL

상대 map 대상 URL은 새 문서의 base URL을 기준으로 해석됩니다. CDN과 로컬 mirror에는 버전과 배포 경로를 고정한 절대 URL을 사용하세요. 예를 들면 `https://cdn.example/wippy/vendor/`와 `http://localhost:5173/vendor/`입니다. CDN module이 다른 bare specifier를 가져오면 그 의존성도 map에 추가해야 합니다. 런타임 map은 이미 bundle에 포함된 import를 바꾸지 않습니다. [부트스트랩 순서](../web-host/bootstrap.md#appconfig-import-map)를 참조하세요.

이 필드는 지원이 문서화된 Host 릴리스에서만 사용하세요.

## Release tag source

빌드 태그는 `CI_COMMIT_TAG`에서 가져오며, 값이 없으면 `APP_TAG`를 사용합니다. CI 외부에서 버전이 지정된 산출물을 빌드할 때는 `APP_TAG`를 설정하세요.
