---
title: "빌드 시점 아티팩트"
description: "사용 프로젝트를 위한 format-aware 파일 시스템 artifact를 선언, 검증, 게시, materialize합니다."
---

# 빌드 시점 아티팩트

모듈은 다른 모듈이 compile할 때 사용하는 package처럼 런타임이 아니라 **빌드 시점**에 consumer가 사용할 directory를 포함할 수 있습니다. Wippy는 `meta.artifact.format`으로 표시한 WAPP 파일 시스템 resource를 **artifact**라고 부릅니다.

artifact를 사용하면 repository-local path alias로 resolve할 수 없는 공유 package를 모듈과 함께 repository 경계를 넘어 전달할 수 있습니다.

[Design Layer](../frontend/design-layer.md)는 이런 package에 *무엇을* 넣어야 하고 무엇을 넣지 않아야 하는지 설명합니다. 이 페이지는 package를 전달하는 mechanism을 다룹니다.

## Artifact 선언

producer는 일반 `fs.directory`를 선언하고 format을 표시합니다.

```yaml
# src/_index.yaml
entries:
  - name: package_fs
    kind: fs.directory
    meta:
      comment: The npm package consumers materialize at build time.
      artifact:
        format: node-package
    directory: ./package
```

marker만으로 directory content가 포함되지는 않습니다. producer manifest의 `embed:` 목록 또는 publish/pack의 `--embed` flag로 `fs.directory` 엔트리를 선택하십시오. 선택하면 엔트리는 packed resource로 변환되고 artifact format을 검증합니다. 형식이 잘못된 선택 artifact는 WAPP 생성 전에 실패합니다.

## Format

format adapter는 directory 검증 방식, identity, 출력 위치를 결정합니다. Wippy에는 다음 built-in format이 있습니다.

| Format | Owns subtree | Validates |
|---|---|---|
| `node-package` | `npm/` | `package.json` |

`node-package`에는 `name`과 semantic `version`이 필요하며 **`preinstall`, `install`, `postinstall`, `prepare` lifecycle script를 거부합니다.** materialize된 package는 install 시 어떤 것도 실행할 수 없습니다. materialization root 아래 `npm/<package name>`에 기록합니다.

작업을 수행하는 binary에 format이 등록되어 있어야 합니다. host는 format을 추가로 등록할 수 있으며 중복 이름과 겹치는 root는 거부됩니다.

## Materialization

materialize된 출력은 다음 작업 중 자동으로 reconcile됩니다.

- 전체 및 targeted `wippy install`, `wippy update`
- cold boot
- Hub 기반 dynamic install, update, uninstall

전체 install, update, cold boot, runtime dependency reconciliation은 *exact*하므로 stale output을 prune합니다. **targeted** install은 선택된 모듈만 overlay하고 선택하지 않은 모듈의 output은 보존합니다.

local module replacement도 packed resource와 같은 validation 및 materialization lifecycle을 거치므로 replaced module의 artifact는 published artifact와 같은 방식으로 동작합니다.

### 명시적 materialization

런타임이 관여하기 전에 artifact가 필요한 build step에서는 CLI를 직접 사용할 수 있습니다.

```bash
wippy artifacts materialize <pack.wapp> <namespace:name> [--root <directory>]
```

`--root` 기본값은 `.wippy`입니다. resource는 `meta.artifact.format`을 선언해야 하고 해당 format이 이 CLI에 등록되어 있어야 합니다.

이 command는 모듈 dependency를 resolve하지 않고 `wippy.lock`을 변경하지 않으며 package manager를 호출하거나 runtime composition에 참여하지 않습니다. WAPP 하나에서 artifact 하나를 검증해 disk에 기록합니다.

### 출력 위치

`artifact.materialization_root`는 애플리케이션이 소유하는 output root를 설정합니다. 기본값은 dependency vendor directory의 parent입니다. 각 format은 그 아래 겹치지 않는 subtree를 소유하므로 `node-package` output은 항상 `<root>/npm/` 아래에 있습니다.

materialization은 transactional합니다. content를 검증하고 staging하며 process lock 아래에서 managed root를 atomic하게 교체합니다. 실패하면 주변 registry transaction과 함께 rollback되고 중단된 swap은 다음 실행에서 복구됩니다.

## 통합 예제: 공유 frontend package

이 절의 `kickside/ui-kit` 이름, Make target, 환경 변수, repository path는 하나의 통합 pattern을 예시합니다. Wippy가 제공하는 command나 helper script가 아니므로 artifact와 build system을 소유한 producer에 맞게 조정하십시오.

producer module은 runtime resource를 serve하지 않고 package를 publish할 수 있습니다.

```yaml
# platform/ui-kit/src/_index.yaml
version: "1.0"
namespace: kickside.ui_kit

entries:
  - name: package_fs
    kind: fs.directory
    meta:
      artifact:
        format: node-package
    directory: ./package
```

consumer는 dependency를 install하기 전에 자신의 tree에 materialize합니다.

```bash
wippy artifacts materialize kickside-ui-kit-1.5.0.wapp \
  kickside.ui_kit:package_fs --root ./.wippy
```

이 command는 `./.wippy/npm/@kickside/ui-kit`을 기록합니다. consumer는 일반 workspaces glob으로 이를 가져오며 이후 resolution은 평범한 node resolution입니다.

```json
{
  "workspaces": ["./.wippy/npm/@*/*"]
}
```

```bash
npm install
```

이 구성에는 두 가지 중요한 속성이 있습니다.

- **package는 더 큰 모듈 안의 directory가 아니라 자체 모듈입니다.** artifact는 자체 `package.json` version을 가지며, 관련 없는 이유로 변경되는 모듈에 묶으면 어느 한쪽이 바뀔 때마다 다른 쪽도 release해야 합니다.
- **consumer는 일반 dependency로 resolve합니다.** materialize 이후 Wippy 전용 import path가 없으므로 같은 source를 monorepo 안과 밖에서 build할 수 있습니다.

## End-to-end workflow

### Producer 작성

package artifact에서는 directory 자체가 deliverable이 될 수 있습니다. CSS vocabulary package는 file과 manifest로 구성됩니다.

```text
platform/ui-kit/
├── wippy.yaml           # selects package_fs for embedding
├── src/_index.yaml      # declares package_fs as the artifact
└── package/             # the directory that becomes the npm package
    ├── package.json
    ├── kx-card.css
    └── kx-state.css
```

publish, local pack, CI가 같은 resource set을 사용하도록 producer manifest에 embed selection을 유지하십시오.

```yaml
# platform/ui-kit/wippy.yaml
embed:
  - package_fs
```

```json
{
  "name": "@kickside/ui-kit",
  "version": "1.5.0",
  "type": "module",
  "sideEffects": ["*.css"],
  "exports": {
    "./kx-card.css": "./kx-card.css",
    "./kx-state.css": "./kx-state.css"
  },
  "files": ["kx-card.css", "kx-state.css", "package.json"]
}
```

CSS-only package에서는 `sideEffects`가 중요합니다. 이 설정이 없으면 bundler가 import한 stylesheet를 dead code로 보고 제거할 수 있습니다.

**package version은 module version과 같아야 합니다.** `wippy publish`는 이를 검증하고 불일치를 거부하므로 둘을 함께 bump하십시오. 공유 package에 자체 모듈을 제공해야 하는 이유이기도 합니다. 더 큰 모듈 안에 넣으면 host module의 관련 없는 변경이 package release를 강제하고 그 반대도 마찬가지입니다.

### Publishing

```bash
# validate without publishing
wippy publish --dry-run --version 1.5.0

# publish
wippy publish --create --module-type library --module-visibility public --version 1.5.0
```

producer manifest가 `package_fs`를 embedding 대상으로 선택하므로 publish 중 artifact를 포함하고 검증합니다. format 규칙에 맞지 않는 `package.json`은 consumer build가 아니라 여기에서 거부됩니다.

### 개발 loop

개발 중에는 producer를 로컬로 pack하고 consumer materialization step이 그 file을 가리키게 합니다.

```bash
# from the producer module
wippy pack /tmp/ui-kit-dev.wapp

# consumers materialize from the local pack rather than the published one
UI_KIT_WAPP=/tmp/ui-kit-dev.wapp make ui-kit MOD=workflows
```

개발과 CI의 유일한 차이를 pack-file override로 유지하십시오. 환경 변수로 local pack을 선택하면서 downstream materialization과 build step은 바꾸지 않을 수 있습니다.

### Build 및 CI 통합

materialization을 **consumer build의 prerequisite**로 만드십시오.

```make
UI_KIT_WAPP ?=

build:
	@case " $(UI_KIT_CONSUMERS) " in *" $(MOD) "*) $(MAKE) ui-kit MOD=$(MOD);; esac
	cd $(call fe_dir,$(MOD)) && npm run build
```

그러면 CI도 별도 artifact step 없이 같은 `make build`를 실행할 수 있습니다. `UI_KIT_WAPP`이 설정되지 않았으므로 fetch-and-materialize 경로는 `build-inputs`에 pin된 published version을 사용합니다. fresh checkout은 stale 또는 누락된 package로 compile할 수 없으며 artifact를 모르는 contributor도 올바른 build를 얻습니다.

## Consumer 통합 단계

`wippy artifacts materialize`는 pack 하나의 resource 하나를 처리하므로 consumer build가 다음 네 단계를 조율해야 합니다.

**1. `.wapp` 가져오기.** command는 module reference가 아니라 *pack file path*를 받으며 dependency를 resolve하지 않습니다. 한 가지 방식은 producer를 pin하고 download하는 작은 Wippy project를 사용하는 것입니다.

```yaml
# build-inputs/wippy.lock — a project that exists only to fetch
modules:
  - name: kickside/ui-kit
    version: 1.5.0
    hash: be1eafd5…
```

```bash
( cd build-inputs && wippy install )
wapp=$(ls build-inputs/.wippy/vendor/kickside/ui-kit-*.wapp | grep -v sha256 | sort | tail -1)
```

application lock이 아니라 여기에 pin하면 build-time input을 runtime dependency graph 밖에 둘 수 있습니다.

**2. consumer마다 한 번 materialize**하여 package manager가 볼 수 있는 root에 놓습니다.

```bash
wippy artifacts materialize "$wapp" kickside.ui_kit:package_fs --root ./ui/.wippy
```

**3. consumer의 `package.json` 연결.** materialization은 file을 기록하지만 manifest를 수정하지 않습니다. consumer가 workspace glob과 dependency를 **모두** 선언해야 npm이 package를 link합니다.

```json
{
  "workspaces": ["./.wippy/npm/@*/*"],
  "dependencies": { "@kickside/ui-kit": "*" }
}
```

materialize된 package가 자체 version을 가지므로 version은 `*`입니다. 이 단계를 자동화하고 idempotent하게 만드십시오. manifest wiring이 없으면 build는 누락된 dependency 설정 대신 나중에 stylesheet `ENOENT`를 보고할 수 있습니다.

**4. package manager 실행.** `materialize`는 package manager를 호출하지 않으므로 3단계 이후 `npm install`을 실행합니다.

consumer module을 parameter로 받는 target에서는 다음처럼 결합할 수 있습니다.

```make
ui-kit:
	@set -e; \
	( cd build-inputs && $(WIPPY) install ); \
	wapp=$$(ls build-inputs/.wippy/vendor/kickside/ui-kit-*.wapp | grep -v sha256 | sort | tail -1); \
	test -n "$$wapp" || { echo "no ui-kit .wapp; is the module published?"; exit 1; }; \
	$(WIPPY) artifacts materialize "$$wapp" kickside.ui_kit:package_fs --root $(DIR)/.wippy; \
	cd $(DIR) && node ../../scripts/wire-ui-kit.mjs && npm install --no-audit --no-fund
```

fresh checkout이 stale 또는 없는 package로 compile하지 않도록 전체 target을 consumer build의 prerequisite로 만드십시오.

## 범위 밖

artifact는 의도적으로 두 번째 resolver, package registry, archive format, lock schema, Hub API, module manifest를 도입하지 않습니다. build-only dependency semantics, redistribution policy, host ABI validation은 별도 관심사이며 여기에서 해결하지 않습니다.

## 관련 문서

- [Dependency 관리](./dependency-management.md) — 모듈 및 local replacement resolve
- [Publishing](./publishing.md) — published module의 내용
- [Design Layer](../frontend/design-layer.md) — 공유 frontend vocabulary가 package로 제공되는 이유
