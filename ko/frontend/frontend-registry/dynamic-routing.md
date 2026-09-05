---
title: "동적 라우팅"
description: "웹 호스트의 라우터는 정적으로 구성되지 않습니다. 시작 시 백엔드에서 현재 페이지 마운트 라우트 집합을 가져와…"
---

# 동적 라우팅

웹 호스트의 라우터는 정적으로 구성되지 않습니다. 시작 시 백엔드에서 현재 페이지 마운트 라우트 집합을 가져와 Vue Router 인스턴스에 추가합니다. 즉, `mountRoute`를 선언한 새 `view.page` 엔트리는 웹 호스트 번들 자체를 전혀 변경하지 않아도 적용됩니다.

![마운트 라우트 동기화](../diagrams/mountroute-sync.svg)

## 시작 시 마운트 라우트 동기화

웹 호스트 애플리케이션은 초기화될 때, 어떤 내비게이션도 렌더링하기 전에 다음을 호출합니다:

```
GET /api/public/pages/routes
```

응답은 `{ success, count, routes }` 형태의 엔벨로프이며, `routes`는 마운트 라우트 패턴 → 페이지 id의 맵입니다(URL을 선언하고 있는 숨겨진/비공개 페이지도 포함합니다). 각 항목에 대해 호스트는 선언된 경로를 페이지 로더 컴포넌트에 매핑하는 Vue Router 라우트를 등록하고, 이를 `'app'` 부모 라우트의 자식으로 추가합니다.

```typescript
// 웹 호스트 부트스트랩에서 단순화한 코드
const { routes } = await api.get('/api/public/pages/routes')
for (const [mountRoute, pageId] of Object.entries(routes)) {
  router.addRoute('app', {
    path: mountRoute,
    component: MountRoutePage,
    props: () => ({ pageId }),
  })
}
```

이 시점 이후 `/home/anything`으로 이동하면 라우터가 `main` 페이지의 iframe을 렌더링하고, `/demo/anything`으로 이동하면 `iframe-demo` 페이지의 iframe을 렌더링합니다 — 호스트 번들에 그 경로들에 대한 하드코딩된 지식이 전혀 없어도 그렇습니다.

## `mountRoute`로 경로 선언하기

`view.page` 엔트리는 `_index.yaml`의 `meta` 블록에 `mountRoute`를 설정하여 호스트 라우터 경로를 선언합니다:

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
    mountRoute: /home/:part(.*)*
    ...
```

`mountRoute`는 백엔드의 대소문자 표기 버그에 대한 현재의 호환 표기입니다.
의도된 백엔드 키는 `mount_route`입니다. 백엔드 수정이 배포될 때까지는 계속
`mountRoute`로 작성하세요.

`mountRoute`는 캐치올 형태인 `/:part(.*)*`(루트) 또는 `/<literal-prefix>/:part(.*)*`만 허용합니다. 여기서 접두사는 소문자·숫자·하이픈으로 이루어진 하나 이상의 리터럴 세그먼트이며 필수 와일드카드 `:part(.*)*`로 끝나야 합니다. 임의의 Vue Router 패턴 — 이름 있는 파라미터, 커스텀 정규식, 다른 파라미터 이름(예: `/home/:id`, `/users/:userId(\d+)`) — 은 거부됩니다. 호스트는 `syntax` 마운트 라우트 충돌을 발생시키고, 백엔드의 `validate_mount_route_syntax`가 실패하며, `GET /api/public/pages/routes`가 HTTP 500을 반환합니다(치명적 전체 화면 오류로 렌더링됨). 와일드카드 세그먼트 `:part(.*)*` 덕분에 자식 애플리케이션은 자신의 하위 라우트(예: `/home/settings`, `/home/profile/edit`)를 직접 관리하고, 호스트는 `/home` 접두사를 소유합니다.

두 엔트리가 같은 라우트를 선언해서는 안 됩니다. 두 `view.page` 엔트리가 **같은** `mountRoute`를 선언하면 백엔드 검증기(`page_registry.lua`의 `validate_mount_routes`)가 구문 오류와 동일한 이슈 목록에 중복 라우트 충돌을 기록하므로, `GET /api/public/pages/routes`는 HTTP 500을 반환하고 웹 호스트는 잘못된 `mountRoute`와 똑같이 치명적 전체 화면 `<wippy-error>`를 렌더링합니다. 조용히 무시되지 **않습니다**.

먼저 선언한 쪽이 이기는 동작은 오직 하나, 루트 캐치올(`/:part(.*)*`)과 더 구체적인 시스템 라우트(`chat`, `c`, `web`, `page`, `keeper`, `login`, `logout`) 또는 더 긴 리터럴 접두사 마운트 사이의 Vue Router 런타임 우선순위뿐입니다 — 더 구체적인 라우트가 먼저 매칭됩니다. 이는 라우트 해석 우선순위이지 중복 라우트 처리가 아닙니다.

## URL 동기화 루프

페이지가 iframe에 로드되고 나면, 자식 애플리케이션은 자신의 라우터로 내부 내비게이션을 수행합니다. 브라우저의 뒤로 가기 버튼, 북마크, URL 복사가 모두 올바로 동작하려면 그 내부 내비게이션이 호스트의 URL 바에 반영되어야 합니다. 이는 PostMessage 한 쌍을 통해 이루어집니다.

![프론트엔드 레지스트리](../diagrams/frontend-registry.svg)

### 자식 → 호스트: `CmdRouteChanged`

자식 애플리케이션의 라우터가 내비게이션을 커밋하면(예: 사용자가 `/home/settings`에서 `/home/profile`로 이동), 자식은 부모 윈도우로 메시지를 보냅니다:

```typescript
// 자식 애플리케이션에서 내부 라우트가 변경될 때.
// 애플리케이션 코드는 이 메시지를 절대 직접 보내면 안 됩니다 — 프록시 API를 사용하세요:
import { host } from '@wippy-fe/proxy'

host.onRouteChanged('/profile', navId)   // 내부 라우트만 전달; 호스트가 마운트 접두사를 붙입니다. navId는 선택적 숫자입니다
```

프록시는 이를 내부 와이어 엔벨로프로 직렬화합니다. 그 프로토콜은 애플리케이션 API가 아닙니다. 복사하거나 `window.parent.postMessage`를 직접 호출하지 마세요.

호스트의 메시지 핸들러가 이를 가로채 `router.push(path)`를 호출하여 전체 페이지 리로드 없이 SPA 라우트 변경으로 URL 바를 갱신하고(브라우저 히스토리 항목 추가), 그다음 응답을 보냅니다:

### 호스트 → 자식: `UrlWasUpdatedInParent`

호스트가 URL 바를 갱신한 뒤, 프록시는 자식에게 `@history`를 방출합니다. `@wippy-fe/router`가 그 이벤트를 소비하여 메모리 라우터를 일치시킵니다.

호스트는 전체 호스트 경로가 아니라 자식의 **내부** 라우트(마운트 접두사 뒤의 하위 경로)를 되돌려 보냅니다 — 따라서 왕복은 대칭적입니다. 자식이 `internalRoute: '/profile'`을 보내면 호스트는 URL 바를 `/home/profile`로 설정하고 `path: '/profile'`을 되돌려 보내며, 자식의 메모리 라우터는 이를 그대로 push합니다. 자식은 `@history` 이벤트 채널로 이를 수신하고, 호스트의 URL이 이제 자신의 내부 상태와 일치한다는 확인으로 취급합니다.

이 왕복은 호스트 URL 바, 자식 라우터, 브라우저 히스토리 항목을 동기 상태로 유지하며, 호스트는 자식의 내부 라우팅 구조에 대해 아무것도 알 필요가 없습니다.

## `classifyLink`

페이지의 프록시 주입 설정에 `preventLinkClicks: true`가 있으면([view.page](./view-page.md) 참조), 호스트는 브라우저가 처리하기 전에 iframe 내부의 `<a>` 클릭을 가로챕니다. 가로챈 각 링크는 `classifyLink`에 전달되어 처리 방식이 결정됩니다:

| `LinkKind` | 조건 | 동작 |
|---|---|---|
| `host-nav` | 최상위 경로 세그먼트가 알려진 `mountRoute` 리터럴, 내장 시스템 라우트(`chat`, `c`, `web`, `page`, `keeper`, `login`, `logout`), 또는 루트 마운트 캐치올과 일치 | `preventDefault` + `host.navigate(normalizedPath)` |
| `child-nav` | iframe 자체 라우터가 해당 경로를 실제(캐치올이 아닌) 라우트로 해석하거나, 다른 어떤 것도 그 경로를 선언하지 않음 | 서브앱의 `RouterLink`가 앱 내에서 결정. 호스트는 `preventDefault`도 하지 않고 iframe을 리로드하지도 않음 |
| `external` | 다른 오리진이거나 `http`가 아닌 스킴(`javascript`/`mailto`/`tel`/`sms`/`ftp`/`file`/`data`/`blob`) | 브라우저 기본 동작(예: 새 탭에서 열기) |
| `ignore` | 빈 `href` 또는 순수 해시(`#…`) | `preventDefault` |

분류기는 iframe 자체의 로컬 라우터를 먼저 확인하므로, 자식이 스스로 해석할 수 있는 링크는 앱 안에 머무릅니다.

`classifyLink`는 시작 시 가져온 것과 동일한 라우트 목록을 참조합니다. `/demo/step-2`로의 링크는 `/demo/:part(.*)*`가 등록된 마운트 라우트이므로 `host-nav`로 분류됩니다 — 호스트는 전체 페이지 리로드 대신 `iframe-demo` 페이지로 이동합니다.

즉, 자식 애플리케이션은 시스템의 다른 페이지들에 대해 알 필요가 없습니다. 평범한 `<a href="/demo/step-2">` 링크를 렌더링하면 호스트의 링크 분류기가 내비게이션을 올바로 처리합니다.
