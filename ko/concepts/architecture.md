---
title: "애플리케이션 아키텍처"
description: "레지스트리 그래프가 성장하면서도 합성 가능하고, 테스트 가능하며, 부팅 가능하게 유지되도록 Wippy 애플리케이션을 네임스페이스, 슬라이스, 레이어로 나누는 방법."
---

# 애플리케이션 아키텍처

Wippy 애플리케이션은 소스 파일의 트리가 아니라 **레지스트리 엔트리의 그래프**입니다. 코드는 `function.lua`와 `process.lua` 엔트리에 살고, 이들을 연결하는 모든 것 — 어떤 함수가 HTTP 라우트에 응답하는지, 서비스가 어떤 프로세스를 감독하는지, 어떤 라이브러리가 어떤 라이브러리를 임포트하는지 — 은 `_index.yaml`에 선언됩니다. 앱을 구조화한다는 것은 그래프가 성장하면서도 합성 가능하고, 테스트 가능하며, 부팅 가능하게 유지되도록 **그 그래프를 네임스페이스로 나누는** 방법을 결정하는 일입니다.

이 페이지는 해당 graph를 구성하는 한 가지 방법을 설명합니다. file format, naming 및 `_index.yaml` 배치는 [YAML 및 프로젝트 구조](start/structure.md), entry definition은 [엔트리 종류 가이드](guides/entry-kinds.md)를 참조하십시오.

## 기능 슬라이스

유용한 기본값은 file type 대신 **기능**별로 구성하는 것입니다. slice는 database access, long-running process, HTTP surface 및 shared vocabulary까지 하나의 capability를 end-to-end로 소유하며 하나의 namespace prefix 아래에 있습니다.

```
src/app/jobs/          namespace: app.jobs
src/app/auth/          namespace: app.auth
src/app/billing/       namespace: app.billing
```

feature slice는 관련 동작을 한 folder에 유지하므로 top-level `handlers/`, `models/`, `services/` directory 전체를 추적하지 않고도 capability를 읽고, test하고, 변경하거나 제거하기 쉽습니다.

## 슬라이스 안의 레이어

슬라이스 내부는 **무엇이 바깥 세계에 닿는가**라는 축을 따라 나눕니다. 이것이 **하위 네임스페이스**로 표현된 포트와 어댑터(헥사고날) 아키텍처입니다:

```
src/app/jobs/                  namespace: app.jobs          ← shared vocabulary
  consts.lua  config.lua  types.lua
  persist/                     namespace: app.jobs.persist  ← database adapters (sql)
  service/                     namespace: app.jobs.service  ← processes, workers
  api/                         namespace: app.jobs.api      ← http.endpoints
```

임포트는 가장 바깥에서 가장 안쪽으로, **한 방향으로만** 흐릅니다:

```
api  →  service  →  persist  →  { consts, config, types }
```

slice root는 shared vocabulary를 포함하고 자신의 child를 import하지 않습니다. child는 root를 import할 수 있습니다. slice 간 direct import를 피하고 shared definition은 `app.core:types` 같은 common parent namespace에 두십시오.

<note>
namespace는 entry ID를 구성하지만 자체적으로 dependency 또는 injection seam을 만들지는 않습니다. 명시적 <code>imports</code>, kind-specific reference 및 <code>ns.requirement</code> target이 관계를 만듭니다. 일관된 방향은 결과 graph를 명시적으로 유지합니다. <a href="#why-this-shape">이 형태를 사용하는 이유</a>를 참조하십시오.
</note>

더 작은 슬라이스는 형식을 줄입니다 — 라이브러리와 엔드포인트 하나가 담긴 단일 `_index.yaml`이면 충분합니다. 어떤 크기에서도 살아남는 규칙은 폴더 개수가 아니라 **임포트 방향**입니다.

## 공유 어휘

잘 구조화된 슬라이스의 루트에는 세 파일이 반복해서 나타납니다. 모든 레이어가 읽지만 그 어느 레이어도 *아닌* 것을 담습니다:

| 파일 | 담는 것 | 능력 |
|------|--------|--------------|
| `consts.lua` | 상태 머신, 열거형, 큐 티어, 프로세스의 레지스트리 ID. 데이터베이스 `CHECK` 제약을 반영하는 값들. | 없음 |
| `config.lua` | `env.get(KEY)`가 `errors.NOT_FOUND`를 반환할 때만 code default를 적용하고 permission 또는 backend error는 전파하는 helper를 가진 env-tunable knob. 값이 선택 사항이 되기 위해 `env.variable` 엔트리가 필요하지 않음. | `env` |
| `types.lua` | 엔티티 형태(`type Job = { ... }`) — 영속 레이어가 반환하는 행들. | 없음 |

`consts`와 `types`는 **호스트 능력을 선언하지 않습니다** — 테이블을 반환하는 순수한 `library.lua`입니다. 이는 의도적입니다: 도메인 어휘는 I/O를 수행할 수 없으므로 비즈니스 로직으로 흘러갈 수 없고, 데이터베이스도 프로세스 호스트도 없이 단위 테스트가 가능합니다.

이 어휘는 **슬라이스 전용으로** 유지하세요. 슬라이스 간에 공유되는 상수와 타입은 공통 부모에 살고 그곳의 임포트를 통해 참조됩니다 — 각 슬라이스로 복사되지 않습니다.

## 능력은 레이어별로 정렬된다

Lua 엔트리는 non-ambient module을 `modules:`에, registry-backed dependency를 `imports:`에 선언합니다. layered slice는 dependency를 responsibility와 정렬할 수 있습니다.

- `persist/*`는 `sql`을 선언하여 database access를 persistence layer에 둡니다.
- `service/*`는 process orchestration과 service dependency를 service layer에 둡니다. `process`와 `channel` global은 ambient이므로 `modules:` 선언이 필요하지 않습니다.
- `api/*`는 `http` 같은 module을 선언하고 호출할 function 또는 library를 import합니다.
- root vocabulary에는 non-ambient module이나 infrastructure import가 필요하지 않습니다.

이는 module visibility를 알려진 layer로 제한합니다. authorization grant는 아닙니다. ABAC policy는 `db.get` 같은 guarded operation이 runtime에서 허용되는지 독립적으로 결정합니다. database handle을 요청할 수 있는 code를 검토하려면 `persist/`, 선언된 module 및 execution context에 연결된 policy를 inspect하십시오.

## 애플리케이션과 컴포넌트

같은 형태가 **누가 구멍을 채우는가**만 바꾸어 단일 앱에서 게시된 라이브러리까지 확장됩니다.

**애플리케이션**은 최상위의, 배포 가능한 그래프입니다. 구체적인 인프라 — `http.service`, `process.host`, 데이터베이스 연결 — 를 루트 네임스페이스(관례상 `app`) 아래에 소유하고, 모든 것을 스스로 배선합니다.

**컴포넌트**는 host에 mount되는 publishable module입니다. host의 database 또는 router ID를 알지 못하므로 host가 제공하는 `ns.requirement` entry interface를 선언합니다. 내부적으로 component는 application slice와 같은 layer, vocabulary 및 import direction을 사용할 수 있습니다.

이것은 두 범주가 아니라 스펙트럼입니다:

- **단일 앱, 내부 슬라이스** — 슬라이스가 `src/app/` 아래에 살고, `app:db`, `app:processes`를 참조하여 앱의 인프라를 직접 공유합니다. 요구사항 인터페이스가 필요 없습니다; 외부의 어떤 것도 이들을 마운트하지 않습니다. (집중된 서비스는 이렇게 만듭니다.)
- **다중 컴포넌트 합성** — 각 컴포넌트는 `ns.definition`과 `ns.requirement` 인터페이스를 가진 자체 게시 가능한 모듈이며, 호스트가 `ns.dependency`를 통해 합성합니다. 호스트는 각 요구사항(데이터베이스, 프로세스 호스트, 라우터)을 한 번씩 채웁니다. (재사용 가능한 부품의 플랫폼은 이렇게 만듭니다.)

슬라이스가 **당신이 통제하지 않는 무언가에 의해 소비될** 것인지로 선택하세요. 그렇다면 요구사항 인터페이스를 주고 게시하세요. 아니라면 앱의 인프라를 직접 참조하게 하고 형식을 생략하세요. 레이어링은 양 끝에서 불변이고, 패키징이 재사용에 따라 확장되는 부분입니다.

requirement/dependency mechanism은 [컴포넌트 구축](guides/components.md), lock-file 측면은 [의존성 관리](guides/dependency-management.md)를 참조하십시오.

## 이 형태를 사용하는 이유 :id=why-this-shape

위의 규율은 스타일이 아닙니다. 각 규칙은 런타임이 그래프를 합성하고 부팅하는 방식을 지탱합니다:

**requirement target이 injection seam입니다.** 별개 namespace는 target ID를 읽기 쉽게 하지만 injection은 `ns.requirement.targets`가 수행합니다. host는 database ID를 persistence 엔트리에, process-host ID를 service 엔트리에 제공할 수 있습니다. `app:db`를 직접 참조하면 component가 해당 host convention에 결합됩니다.

**one-way reference는 registry transition을 resolve 가능하게 유지합니다.** registry는 선언된 dependency path를 추출하고 dependency가 dependent보다 먼저 생성되고 나중에 삭제되도록 change를 topological order로 정렬합니다. `api → service → persist → root` 방향은 graph를 acyclic하게 유지하는 데 도움이 됩니다. parent namespace는 organizational convention일 뿐이며 shared entry에는 여전히 명시적 reference가 필요합니다.

**layer별로 scope된 module은 명확한 boundary를 가집니다.** 각 Lua chunk는 선언된 import와 non-ambient module을 resolve할 수 있으며 선언되지 않은 registry module은 module resolution에서 fail closed합니다. runtime policy check는 별도의 boundary입니다. persistence entry만 `sql`을 선언하면 database handle을 요청할 수 있는 code를 더 쉽게 식별하고 audit할 수 있습니다.

**레이어링은 테스트 가능성의 그라디언트를 만듭니다.** 순수 어휘는 아무 세계 없이 테스트됩니다. persist 테스트는 데이터베이스는 건드리지만 워커는 건드리지 않습니다. 그런 다음 모듈 전체의 **마운트 테스트**가 단위 테스트가 의도적으로 볼 수 없는 이음새를 감사합니다 — 모든 감독 서비스가 실제 프로세스를 가리키는지, 스폰되는 모든 ID가 해석되는지, 모든 요구사항이 채워지는지. 레이어가 실제로 분리 가능할 때만 이 그라디언트를 얻습니다.

## 참고

- [YAML 및 프로젝트 구조](start/structure.md) — file format, naming, namespace
- [컴포넌트 구축](guides/components.md) — `ns.definition`, `ns.requirement`, mounting
- [의존성 관리](guides/dependency-management.md) — lock file, module consuming
- [레지스트리](concepts/registry.md) — 엔트리가 저장되고 resolve되는 방식
- [엔트리 종류 가이드](guides/entry-kinds.md) — 모든 entry kind
- [프로세스 모델](concepts/process-model.md) — service, supervision, host
