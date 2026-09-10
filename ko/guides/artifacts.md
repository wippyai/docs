---
title: "빌드 타임 아티팩트"
description: "파일 시스템 리소스를 포맷 인식 아티팩트로 선언하고, 이를 소비 프로젝트로 구체화하며, 런타임이 자동으로 조정하는 것들을 설명합니다."
---

# 빌드 타임 아티팩트

모듈은 소비자가 런타임이 아니라 **빌드 타임에** 사용하는 디렉터리를 제공할 수
있습니다. 가장 유용한 사례는 다른 모듈이 컴파일 대상으로 삼는 패키지입니다. Wippy는
이를 **아티팩트**라고 부릅니다. `meta.artifact.format`으로 표시된 평범한 WAPP 파일
시스템 리소스입니다.

공유 패키지가 다른 저장소의 모듈에 도달하는 방식이 바로 이것입니다. 경로 별칭은 한
저장소 안에서만 해석되지만, 아티팩트는 모듈과 함께 이동합니다.

[디자인 레이어](../frontend/design-layer.md)는 그런 패키지에 *무엇이* 들어가고 무엇이
들어가지 않는지를 설명합니다. 이 페이지는 그것을 전달하는 메커니즘입니다.

## 아티팩트 선언

생산자는 일반적인 `fs.directory`를 선언하고 포맷으로 표시합니다:

```yaml
# src/_index.yaml
entries:
  - name: package_fs
    kind: fs.directory
    meta:
      comment: 소비자가 빌드 타임에 구체화하는 npm 패키지.
      artifact:
        format: node-package
    directory: ./package
```

그 외에는 달라지는 것이 없습니다. 리소스는 다른 `fs.directory`와 마찬가지로 WAPP에
임베드됩니다. `wippy.yaml`의 `embed:`에 나열하거나 `wippy publish`와 `wippy pack`에
`--embed`를 전달하십시오. 임베드되지 않은 디렉터리는 패킹되지도, 검증되지도 않습니다.
선언된 아티팩트는 **모듈 게시와 애플리케이션 패킹 중에 검증되므로**, 잘못된 아티팩트는
소비자 쪽이 아니라 게시 시점에 실패합니다.

## 포맷

포맷 어댑터는 디렉터리를 어떻게 검증할지, 어떤 신원을 갖는지, 어디에 놓일지를
결정합니다. Wippy는 하나를 기본 제공합니다:

| 포맷 | 소유 하위 트리 | 검증 대상 |
|---|---|---|
| `node-package` | `npm/` | `package.json` |

`node-package`는 `name`과 시맨틱 `version`을 요구하며, **`preinstall`, `install`,
`postinstall`, `prepare` 라이프사이클 스크립트를 거부합니다**. 구체화된 패키지는
설치 시 어떤 것도 실행해서는 안 됩니다. 출력은 구체화 루트 아래
`npm/<package name>`에 씁니다.

포맷은 작업을 수행하는 바이너리에 등록되어 있어야 합니다. 호스트는 추가 포맷을
등록할 수 있으며, 이름 중복과 하위 트리 겹침은 거부됩니다.

## 구체화

대부분의 경우 아무것도 실행하지 않습니다. 구체화된 출력은 다음 과정에서 자동으로
조정됩니다:

- 전체 및 대상 지정 `wippy install`과 `wippy update`
- 콜드 부트
- Hub 기반 동적 설치, 업데이트, 제거

전체 설치, 업데이트, 콜드 부트, 런타임 의존성 조정은 *정확합니다*. 오래된 출력은
정리됩니다. **대상 지정** 설치는 선택된 모듈만 덮어쓰며, 선택하지 않은 모듈에
속하는 출력은 보존합니다.

로컬 모듈 대체(replacement)도 패킹된 리소스와 동일한 검증 및 구체화 라이프사이클을
거치므로, 대체된 모듈의 아티팩트는 게시된 것과 똑같이 동작합니다.

### 명시적으로 구체화하기

런타임이 개입하기 전에 아티팩트가 필요한 빌드 단계를 위해 CLI가 이를 직접
노출합니다:

```bash
wippy artifacts materialize <pack.wapp> <namespace:name> [--root <directory>]
```

`--root`의 기본값은 `.wippy`입니다. 리소스는 `meta.artifact.format`을 선언해야
하고, 그 포맷은 이 CLI에 등록되어 있어야 합니다.

이 명령이 의도적으로 **하지 않는** 일을 분명히 해 두겠습니다. 모듈 의존성을 해석하지
않고, `wippy.lock`을 변경하지 않으며, 패키지 매니저를 호출하지 않고, 런타임 구성에
참여하지 않습니다. 하나의 WAPP에서 하나의 아티팩트를 검증해 디스크에 쓸 뿐입니다.

### 출력이 놓이는 위치

`artifact.materialization_root`는 애플리케이션이 소유하는 출력 루트를 구성합니다.
기본값은 의존성 vendor 디렉터리의 상위입니다. 각 포맷은 그 아래 겹치지 않는 하위
트리를 소유하므로, `node-package` 출력은 항상 `<root>/npm/` 아래에 있습니다.

구체화는 트랜잭션적입니다. 콘텐츠가 검증되고 스테이징되며, 관리되는 루트는 프로세스
락 아래에서 원자적으로 교체되고, 실패하면 주변 레지스트리 트랜잭션과 함께 롤백되며,
중단된 교체는 다음 실행에서 복구됩니다.

## 실습 예제: 공유 프론트엔드 패키지

패키지를 게시하는 것이 유일한 임무인 생산자 모듈입니다. 런타임에는 아무것도
서빙하지 않습니다:

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

소비자는 의존성을 설치하기 전에 이를 자신의 트리로 구체화합니다:

```bash
wippy artifacts materialize kickside-ui-kit-1.5.0.wapp \
  kickside.ui_kit:package_fs --root ./.wippy
```

이는 `./.wippy/npm/@kickside/ui-kit`를 씁니다. 소비자는 평범한 workspaces glob으로
이를 집어 들며, 그 이후로는 순수한 node 해석이 이루어집니다:

```json
{
  "workspaces": ["./.wippy/npm/@*/*"]
}
```

```bash
npm install
```

이 형태에서 따라 할 만한 두 가지가 있습니다:

- **패키지는 더 큰 모듈 안의 디렉터리가 아니라 그 자체로 하나의 모듈입니다.**
  아티팩트는 자체 `package.json` 버전을 갖는데, 무관한 이유로 바뀌는 모듈에 이를
  묶어 두면 한쪽이 움직일 때마다 다른 쪽의 릴리스가 강제됩니다.
- **소비자는 이를 평범한 의존성으로 해석합니다.** 일단 구체화되면 Wippy 고유의
  import 경로가 없으며, 덕분에 동일한 소스가 모노레포 안팎에서 똑같이 빌드됩니다.

## 처음부터 끝까지: 작성, 개발 루프, CI

### 생산자 작성

패키지 아티팩트에는 보통 **빌드할 것이 없습니다**. 디렉터리 자체가 산출물입니다.
CSS 어휘 패키지는 파일 몇 개와 매니페스트가 전부입니다:

```text
platform/ui-kit/
├── src/_index.yaml      # package_fs를 아티팩트로 선언
└── package/             # npm 패키지가 되는 디렉터리
    ├── package.json
    ├── kx-card.css
    └── kx-state.css
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

`sideEffects`는 CSS 전용 패키지에 중요합니다. 이것이 없으면 번들러가 import된
스타일시트를 죽은 코드로 취급해 제거해도 무방합니다.

**패키지 버전은 모듈 버전과 같아야 합니다.** `wippy publish`가 이를 검증하고
불일치를 거부하므로 둘을 함께 올리십시오. 이것이 공유 패키지를 더 큰 모듈 안에
중첩하지 않고 *자체* 모듈로 두어야 하는 이유이기도 합니다. 그렇지 않으면 호스트
모듈의 무관한 변경 하나하나가 패키지 릴리스를 강제하고, 그 반대도 마찬가지입니다.

### 게시

```bash
# 게시하지 않고 검증
wippy publish --dry-run --version 1.5.0 --embed package_fs

# 게시
wippy publish --create --module-type library --module-visibility public --version 1.5.0 --embed package_fs
```

선언된 아티팩트는 게시 과정의 일부로 검증되므로, 포맷 규칙을 통과하지 못하는
package.json은 소비자의 빌드가 아니라 여기서 거부됩니다.

### 개발 루프

편집할 때마다 게시하는 것은 개발 루프가 아닙니다. 생산자를 로컬에서 패킹하고
소비자의 구체화 단계가 그 파일을 가리키게 하십시오:

```bash
# 생산자 모듈에서
wippy pack /tmp/ui-kit-dev.wapp --embed package_fs

# 소비자는 게시된 팩 대신 로컬 팩에서 구체화
UI_KIT_WAPP=/tmp/ui-kit-dev.wapp make ui-kit MOD=workflows
```

이 오버라이드를 개발 경로와 CI 사이의 *유일한* 차이로 유지하십시오. 팩 파일을
선택하는 환경 변수 하나만 다르고 그 이후는 전부 동일해야 합니다. CI와 다르게
구체화하는 개발 루프는 CI를 예측하지 못하게 됩니다.

### make와 CI에 연결하기

구체화 단계를 사람이 기억해서 실행하는 것이 아니라 **소비자 빌드의 선행 조건**으로
만드십시오:

```make
UI_KIT_WAPP ?=

build:
	@case " $(UI_KIT_CONSUMERS) " in *" $(MOD) "*) $(MAKE) ui-kit MOD=$(MOD);; esac
	cd $(call fe_dir,$(MOD)) && npm run build
```

그러면 CI에는 아티팩트 전용 단계가 전혀 필요 없습니다. 동일한 `make build`를
실행하고, `UI_KIT_WAPP`이 설정되지 않았으므로 `build-inputs`에 고정된 게시 버전에
대해 가져오기-구체화 경로가 실행됩니다. 새로 체크아웃한 트리가 오래되었거나 없는
패키지에 대해 컴파일할 수 없고, 아티팩트라는 말을 들어 본 적 없는 기여자도 올바른
빌드를 얻습니다.

## 아직 직접 만들어야 하는 것

`wippy artifacts materialize`는 의도적으로 범위가 좁아서, 아티팩트를 소비하는
빌드는 현재 네 단계를 직접 이어 붙여야 합니다. 어떤 네 단계인지 알아 두면 다시
찾아낼 필요가 없습니다:

**1. `.wapp` 가져오기.** 이 명령은 모듈 참조가 아니라 *팩 파일 경로*를 받으며
의존성을 해석하지 않으므로, 무언가가 먼저 생산자를 가져와야 합니다. 실용적인 패턴은
고정하고 내려받는 것만이 임무인 작은 Wippy 프로젝트입니다:

```yaml
# build-inputs/wippy.lock — 가져오기 위해서만 존재하는 프로젝트
directories:
  modules: .wippy
  src: ./src
modules:
  - name: kickside/ui-kit
    version: 1.5.0
    hash: be1eafd5…
```

```bash
( cd build-inputs && wippy install )
wapp=$(ls build-inputs/.wippy/vendor/kickside/ui-kit-*.wapp | grep -v sha256 | sort | tail -1)
```

애플리케이션 락이 아니라 여기서 고정하면 빌드 타임 입력이 런타임 의존성 그래프
밖에 머무릅니다.

**2. 소비자마다 한 번씩 구체화하기.** 소비자의 패키지 매니저가 볼 수 있는 루트로
구체화합니다:

```bash
wippy artifacts materialize "$wapp" kickside.ui_kit:package_fs --root ./ui/.wippy
```

**3. 소비자의 `package.json` 연결하기.** 구체화는 파일을 쓸 뿐 매니페스트를 편집하지
않습니다. npm은 소비자가 workspace glob과 의존성을 *둘 다* 선언해야 패키지를
연결합니다:

```json
{
  "workspaces": ["./.wippy/npm/@*/*"],
  "dependencies": { "@kickside/ui-kit": "*" }
}
```

구체화된 패키지가 자체 버전을 갖고 있으므로 버전은 `*`입니다. 이 과정을
스크립트로 만들고 멱등하게 유지하십시오. 연결이 빠져 있으면 빌드는 한참 뒤에
스타일시트에 대한 맨 `ENOENT`로 실패하는데, 이는 연결 누락이 아니라 파일 누락처럼
보입니다.

**4. 패키지 매니저 실행하기.** `materialize`는 패키지 매니저를 호출하지 않으므로,
3단계 이후 `npm install`은 여러분이 호출해야 합니다.

소비 모듈을 매개변수로 받는 타깃 하나에 모두 모으면 다음과 같습니다:

```make
ui-kit:
	@set -e; \
	( cd build-inputs && $(WIPPY) install ); \
	wapp=$$(ls build-inputs/.wippy/vendor/kickside/ui-kit-*.wapp | grep -v sha256 | sort | tail -1); \
	test -n "$$wapp" || { echo "no ui-kit .wapp; is the module published?"; exit 1; }; \
	$(WIPPY) artifacts materialize "$$wapp" kickside.ui_kit:package_fs --root $(DIR)/.wippy; \
	cd $(DIR) && node ../../scripts/wire-ui-kit.mjs && npm install --no-audit --no-fund
```

이 타깃 전체를 소비자 빌드의 선행 조건으로 만들어, 새로 체크아웃한 트리가
오래되었거나 없는 패키지에 대해 컴파일할 수 없게 하십시오.

## 범위 밖

아티팩트는 의도적으로 두 번째 리졸버, 패키지 레지스트리, 아카이브 포맷, 락 스키마,
Hub API, 모듈 매니페스트를 도입하지 않습니다. 빌드 전용 의존성 의미론, 재배포 정책,
호스트 ABI 검증은 별개의 관심사이며 여기서 해결하지 않습니다.

## 관련 항목

- [의존성 관리](./dependency-management.md) — 모듈 해석과 로컬 대체
- [게시](./publishing.md) — 게시된 모듈에 담기는 것
- [디자인 레이어](../frontend/design-layer.md) — 공유 프론트엔드 어휘가 애초에
  패키지로 전달되는 이유
