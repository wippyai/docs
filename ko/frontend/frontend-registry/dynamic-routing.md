---
title: "동적 라우팅"
description: "Web Host가 백엔드 마운트 경로를 등록하고 자식 탐색을 동기화하며 런타임에 링크를 분류하는 방식입니다."
---

# 동적 라우팅

Web Host는 정적으로 정의된 시스템 경로와 시작 시 백엔드에서 가져온 페이지 마운트 경로를 결합합니다. 따라서 `mountRoute`를 선언한 새 `view.page` 엔트리는 Web Host 번들을 변경하지 않아도 적용됩니다.

![마운트 경로 동기화](../diagrams/mountroute-sync.svg)

## 시작 시 마운트 경로 동기화

Web Host 애플리케이션은 초기화할 때 탐색 UI를 렌더링하기 전에 다음을 호출합니다.

```
GET /api/public/pages/routes
```

응답은 `{ success, count, routes }` envelope이며 `routes`는 마운트 경로 패턴 → 페이지 ID 맵입니다. URL을 선언했지만 숨겨졌거나 announced되지 않은 페이지도 포함합니다. 호스트는 각 엔트리에 대해 선언 경로를 페이지 로더 컴포넌트에 매핑하는 Vue Router 경로를 `'app'` 부모 경로의 자식으로 등록합니다.

```typescript
// Simplified from the Web Host bootstrap
const { data } = await api.get('/api/public/pages/routes')
for (const [mountRoute, pageId] of Object.entries(data.routes)) {
  router.addRoute('app', {
    path: mountRoute,
    component: MountRoutePage,
    props: () => ({ pageId }),
  })
}
```

이 시점 이후 `/home/anything`으로 이동하면 router는 선택된 엔진으로 `main` 페이지를 렌더링하고, `/demo/anything`으로 이동하면 `iframe-demo` 페이지에 같은 작업을 수행합니다. 호스트 번들은 이 경로를 하드코딩해서 알 필요가 없습니다.

## `mountRoute`로 경로 선언

`view.page` 엔트리는 `_index.yaml`의 `meta` 블록에 `mountRoute`를 설정해 호스트 router 경로를 선언합니다.

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
    mountRoute: /home/:part(.*)*
```

현재 레지스트리 스키마는 작성 필드를 `mountRoute`로 읽고 레지스트리 내부 `mount_route` 필드에 저장한 뒤 API 출력에서는 `mountRoute`로 내보냅니다. 위와 같은 lower camel case를 사용하십시오.

`mountRoute`는 catch-all 형식인 `/:part(.*)*`(루트) 또는 `/<literal-prefix>/:part(.*)*`만 허용합니다. 접두사는 하나 이상의 소문자·숫자·하이픈 리터럴 세그먼트이고 필수 `:part(.*)*` wildcard로 끝나야 합니다. 이름 있는 param, 사용자 정의 regex, 다른 param 이름(예: `/home/:id`, `/users/:userId(\d+)`) 같은 임의의 Vue Router 패턴은 거부됩니다. 백엔드 `view.page` 엔트리의 `validate_mount_route_syntax`가 `GET /api/public/pages/routes`를 HTTP 500으로 만들므로 엔트리가 호스트 router에 도달하기 전에 Host 시작이 중단됩니다. 응답과 구성 병합이 성공하면 Host는 구문과 시스템 경로 충돌을 포함해 결과 경로 집합을 별도로 검증합니다. `:part(.*)*` wildcard를 통해 호스트는 `/home` 접두사를 소유하면서 자식 애플리케이션이 `/settings`, `/profile/edit` 같은 하위 경로를 관리할 수 있습니다.

두 엔트리가 같은 경로를 선언하면 안 됩니다. 두 `view.page` 엔트리가 **동일한** `mountRoute`를 선언하면 백엔드 validator(`page_registry.lua`의 `validate_mount_routes`)가 구문 오류와 같은 issue 목록에 중복 경로 충돌을 기록합니다. 그러면 `GET /api/public/pages/routes`가 HTTP 500을 반환하고 Host 시작이 중단되며 오류는 Host 오류 처리기를 통해 전달됩니다. 중복은 조용히 무시되지 않습니다.

루트 catch-all(`/:part(.*)*`)과 더 구체적인 시스템 경로(`chat`, `c`, `web`, `page`, `keeper`, `login`, `logout`) 또는 더 긴 리터럴 접두사 마운트 사이에는 Vue Router 경로 해석 우선순위가 계속 적용됩니다. 더 구체적인 경로가 일치합니다. 이 우선순위는 중복 경로 처리가 아닙니다.

## URL 동기화 루프

페이지가 런타임 컨텍스트에 로드되면 자식 애플리케이션은 자체 router로 내부 탐색을 수행합니다. 호스트는 이 탐색을 URL 표시줄에 반영하여 브라우저 뒤로 가기, 북마크, 복사한 URL이 올바르게 동작하도록 합니다. proxy bridge는 두 페이지 엔진 모두에서 두 router를 동기화합니다.

![프런트엔드 레지스트리](../diagrams/frontend-registry.svg)

### 자식 → 호스트: `CmdRouteChanged`

자식 애플리케이션 router가 탐색을 확정하면(예: `/home` 마운트 아래에서 `/settings`에서 `/profile`로 이동) proxy bridge를 통해 내부 경로를 보고합니다. iframe adapter는 `window.parent`로 post하고 Fragment adapter는 같은 프로토콜을 캡처한 호스트 window로 전달합니다.

```typescript
// In the child application, on internal route change.
// App code must never post these messages directly — use the proxy API:
import { host } from '@wippy-fe/proxy'

host.onRouteChanged('/profile', navId)   // internal route only; the host prepends the mount prefix. navId is an optional number
```

proxy는 이를 내부 wire envelope로 직렬화합니다. 이 프로토콜은 애플리케이션 API가 아닙니다. 복사하거나 `window.parent.postMessage`를 직접 호출하지 마십시오.

호스트의 메시지 처리기는 이를 가로채고 `router.push(path)`를 호출해 전체 페이지 reload 없이 SPA 경로 변경으로 URL 표시줄을 갱신하며 브라우저 history 엔트리를 추가한 다음 응답을 보냅니다.

### 호스트 → 자식: `UrlWasUpdatedInParent`

호스트가 URL 표시줄을 갱신하면 proxy는 자식에 `@history`를 내보냅니다. `@wippy-fe/router`가 해당 이벤트를 소비하고 memory router를 조정합니다.

호스트는 전체 호스트 경로가 아니라 자식의 **내부** 경로(마운트 접두사 뒤 하위 경로)를 되돌려 보냅니다. 따라서 왕복은 대칭입니다. 자식이 `internalRoute: '/profile'`을 보내면 호스트는 URL 표시줄을 `/home/profile`로 설정하고 `path: '/profile'`을 되돌려 보내며, 자식의 memory router는 이를 그대로 push합니다. 자식은 `@history` 이벤트 채널을 수신하고 이를 호스트 URL이 내부 상태와 일치한다는 확인으로 취급합니다.

이 왕복은 호스트가 자식의 내부 라우팅 구조를 알 필요 없이 호스트 URL 표시줄, 자식 router, 브라우저 history 엔트리를 동기화합니다.

## `classifyLink`

iframe 엔진에서 `preventLinkClicks: true`는 브라우저가 처리하기 전 raw `<a>` 클릭을 가로채는 문서 수준 hook을 설치합니다([view.page](./view-page.md) 참고). Web Host 1.0.56의 Web Fragment adapter는 이 raw-click hook을 설치하지 않습니다. 이식 가능한 Vue 탐색에는 `@wippy-fe/router`의 `AutoRouterLink`를 사용하십시오. 두 엔진 모두에서 같은 `classifyLink` API를 호출합니다.

분류기는 다음 네 결과 중 하나를 반환합니다.

| `LinkKind` | 조건 | 동작 |
|---|---|---|
| `host-nav` | 최상위 경로 세그먼트가 알려진 `mountRoute` 리터럴, 내장 시스템 경로(`chat`, `c`, `web`, `page`, `keeper`, `login`, `logout`) 또는 루트 마운트 catch-all과 일치 | `preventDefault` + `host.navigate(normalizedPath)` |
| `child-nav` | 자식 router가 경로를 실제(non-catch-all) 경로로 해석하거나 다른 곳에서 선언하지 않음 | 하위 앱 router가 앱 내부에서 결정하며 호스트는 `preventDefault`를 호출하거나 페이지 컨텍스트를 reload하지 않음 |
| `external` | 다른 origin 또는 `http`가 아닌 scheme(`javascript`/`mailto`/`tel`/`sms`/`ftp`/`file`/`data`/`blob`) | 브라우저 기본 동작(예: 새 탭에서 열기) |
| `ignore` | 빈 `href` 또는 순수 hash(`#…`) | `preventDefault` |

분류기는 페이지의 로컬 router를 먼저 검사하므로 자식이 자체적으로 해석할 수 있는 링크는 앱 내부에 남습니다.

`classifyLink`는 시작 시 가져온 동일한 경로 목록을 조회합니다. 자식 router가 `/demo/step-2`를 선언하지 않으면 `/demo/:part(.*)*`가 등록된 마운트 경로이므로 링크는 `host-nav`로 분류됩니다. 호스트는 전체 페이지 reload 대신 `iframe-demo` 페이지로 이동합니다.

따라서 자식 애플리케이션은 시스템의 다른 페이지를 알 필요가 없습니다. `preventLinkClicks: true`인 iframe에서는 일반 `<a href="/demo/step-2">`를 가로채 분류합니다. 같은 탐색이 두 페이지 엔진 모두에서 동작해야 한다면 `AutoRouterLink`를 사용하십시오.
