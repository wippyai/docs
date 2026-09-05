---
title: "웹 컴포넌트 (view.component)"
description: "view.component 엔트리는 웹 호스트가 자동으로 발견하고, 주입하고, 등록할 수 있는 재사용 가능한 커스텀 엘리먼트(웹 컴포넌트)를 기술합니다. 페이지와 달리…"
---

# 웹 컴포넌트 (view.component)

`view.component` 엔트리는 웹 호스트가 자동으로 발견하고, 주입하고, 등록할 수 있는 재사용 가능한 커스텀 엘리먼트(웹 컴포넌트)를 기술합니다. 페이지와 달리 컴포넌트는 자신의 iframe을 갖지 않습니다 — 페이지나 호스트의 템플릿이 배치하는 어디에든 나타날 수 있는 커스텀 HTML 태그입니다.

컴포넌트 구현 작성 지침은 [웹 컴포넌트](../micro-frontends/web-component.md)를 참고하세요.

## 프론트엔드 필드 (package.json의 wippy 블록)

이 필드들은 FE 개발자가 `package.json`의 `wippy` 블록에 작성합니다. vite 플러그인이 빌드 시점에 이를 `wippy-meta.json`에 굽고, `wippy/views`가 거기서 기본값으로 읽어옵니다.

> **이 섹션의 모든 필드는 운영자가 `_index.yaml`에서 오버라이드할 수 있습니다. YAML이 항상 우선합니다.**

| 필드 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `type` | string | — | `"component"` 또는 `"widget"`이어야 함. `"widget"`이 템플릿 관례 |
| `tagName` | string | — | 커스텀 엘리먼트 이름. HTML 명세에 따라 하이픈을 포함해야 함 |
| `props` | object | — | 컴포넌트가 받는 어트리뷰트를 기술하는 JSON 스키마 |
| `events` | object | — | 컴포넌트가 방출하는 커스텀 DOM 이벤트를 기술하는 JSON 스키마 |

### `package.json`의 `wippy.type`

웹 컴포넌트 패키지는 `wippy` 블록 안에 `"type": "widget"` 또는 `"type": "component"`를 설정합니다(`"page"`가 아님). app-template은 현재 `"widget"`을 사용하며, vite 플러그인은 이 런타임 계약에 대해 두 이름을 모두 허용합니다.

```json
{
  "specification": "wippy-component-1.0",
  "wippy": {
    "tagName": "example-reaction-bar",
    "type": "widget",
    "props": { ... },
    "events": { ... }
  }
}
```

배포 시점에는 운영자의 YAML `meta.tag_name`이 권위를 가지며 번들된 값을 오버라이드합니다. `wippy.tagName`(`package.json`에서 `wippy-meta.json`으로 구워짐)은 YAML 엔트리가 `tag_name`을 생략했을 때 `wippy/views`가 사용하는 폴백일 뿐입니다(해석 순서: YAML `meta.tag_name` → 번들된 `wippy.tagName`). 놀랄 일을 피하려면 둘을 동기화해 두되, 값이 다르면 YAML이 이깁니다.

### Props 스키마

`package.json`의 `wippy.props` 키는 컴포넌트가 받는 어트리뷰트를 기술하는 JSON 스키마 객체입니다. vite 플러그인이 이를 `wippy-meta.json`에 포함시키고, 웹 호스트는 채팅 아티팩트 렌더러나 태그 새니타이저(어떤 어트리뷰트가 정당한지 알아야 이를 제거하지 않습니다) 같은 소비자에게 컴포넌트 메타데이터를 노출할 때 이를 사용합니다.

```json
{
  "wippy": {
    "props": {
      "type": "object",
      "properties": {
        "reactions": {
          "type": "array",
          "items": { "type": "string" },
          "default": ["👍", "👎", "❤️", "🎉", "🤔"],
          "description": "Array of emoji reactions to display"
        },
        "allow-multiple": {
          "type": "boolean",
          "default": false,
          "description": "Whether multiple reactions can be active simultaneously"
        }
      }
    }
  }
}
```

`properties` 안의 어트리뷰트 이름은 HTML 어트리뷰트 관례(kebab-case)를 따릅니다. 스키마의 `default` 값은 어트리뷰트가 없을 때 웹 컴포넌트 prop 파서가 런타임에 적용하기도 합니다.

### Events 스키마

`wippy.events` 키는 props와 같은 형태를 따르되, 컴포넌트가 `useEvents()`를 통해 방출하는 커스텀 DOM 이벤트를 기술합니다. 각 키는 이벤트 이름이고, 값은 그 이벤트의 detail 페이로드에 대한 JSON 스키마입니다.

```json
{
  "wippy": {
    "events": {
      "type": "object",
      "properties": {
        "reaction": {
          "type": "object",
          "properties": {
            "emoji": { "type": "string" },
            "count": { "type": "number" },
            "active": { "type": "boolean" }
          },
          "description": "Fired when a reaction is toggled"
        }
      }
    }
  }
}
```

웹 호스트의 채팅 메시지 새니타이저는 `wippy-meta.json`의 `props.properties`에 있는 컴포넌트 어트리뷰트를 허용 목록에 넣습니다. 이벤트 스키마는 도구와 소비자를 위해 방출되는 커스텀 이벤트를 문서화하는 용도이며, 새니타이즈된 채팅 콘텐츠에서 DOM 이벤트 리스너 어트리뷰트를 통과시키는 데는 사용되지 않습니다.

## 운영자 설정 (_index.yaml)

이 필드들은 운영자가 `_index.yaml` 레지스트리 엔트리의 `meta` 블록에 설정합니다. 대부분은 순수한 배포 정책 — 라우팅, 접근 제어, 서빙 — 으로, 배포 시점에만 의미가 있고 `package.json`에 작성 지점이 없습니다(`announced`, `secure`, `url`, `auto_register`). 두 필드 `tag_name`과 `entry_point`는 다릅니다. 이들은 `package.json`에서 **FE가 작성**하며(`wippy-meta.json`으로 구워짐), YAML 키는 그 번들 값에 대한 **선택적 배포별 오버라이드**일 뿐입니다.

> **`announced`, `secure`, `url`, `auto_register`는 순수한 배포 정책이며 package.json에서 설정할 수 없습니다 — 각 환경마다 운영자가 설정합니다. `tag_name`과 `entry_point`는 FE가 작성한 기본값이며 운영자가 YAML에서 오버라이드할 수 있습니다.**

| 필드 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `tag_name` | string | `wippy.tagName` | `package.json`에서 `wippy.tagName`으로 FE가 작성(vite 플러그인이 요구). YAML 키가 번들 값을 오버라이드합니다. 커스텀 엘리먼트 이름이며 HTML 명세에 따라 하이픈을 포함해야 합니다 |
| `announced` | boolean | `false` | 컴포넌트가 `/api/public/components/list`에 나타나려면 `true`여야 합니다. 설정되어 있으면 `meta.public`으로 폴백합니다. |
| `auto_register` | boolean | `false` | `true` → 웹 호스트가 시작 시 컴포넌트를 자동 로드하고 등록합니다 |
| `secure` | boolean | `false` | 인증이 필요합니다 |
| `url` | string | — | 컴포넌트 빌드 번들의 정적 마운트 경로 |
| `base_path` | string | `""` | `url` 뒤에 붙여 프로젝트 루트를 구성하는 선택적 하위 경로. 해석된 번들 URL은 `<url>/<base_path>/<entry_point>`로 조합됩니다. 페이지와 동일하게 처리되지만, 현재 app-template의 컴포넌트 엔트리는 이를 생략합니다 |
| `entry_point` | string | `wippy.browser` → `index.js` | `package.json`의 최상위 `browser` 필드로 FE가 작성(`wippy-meta.json`에 구워짐). YAML 키가 번들 값을 오버라이드하며, 없으면 `index.js`로 폴백합니다. 엔트리 모듈 파일이며 호스트가 이를 `<script type="module">`로 주입합니다 |

최소 엔트리는 다음과 같습니다:

```yaml
- name: reaction-bar
  kind: registry.entry
  meta:
    type: view.component
    name: reaction-bar
    tag_name: example-reaction-bar
    announced: true
    secure: false
    auto_register: true
    url: /app/wc/reaction-bar
    entry_point: index.js
```

## 자동 로드를 위한 세 개의 관문

웹 호스트가 컴포넌트를 자동 로드하려면 세 조건이 동시에 성립해야 합니다:

1. **`announced: true`** — `wippy/views`가 `list_components.lua`에서 이 플래그로 서버 측 필터링을 합니다. 이를 우회하는 쿼리 파라미터는 없습니다. `announced: false`인 컴포넌트는 다른 설정과 무관하게 `/api/public/components/list`에 절대 나타나지 않습니다.

2. **`auto_register: true`** — 호스트의 `loadGlobalAutoloadWidgets` 함수는 목록 엔드포인트를 `?auto_register=true`로 조회합니다. 이 플래그가 없는 컴포넌트는 그 필터링된 응답에서 제외됩니다.

3. **태그가 아직 등록되지 않았을 것** — 스크립트를 주입하기 전에 호스트는 `customElements.get(tagName)`을 확인합니다. 태그가 이미 정의되어 있으면(예: 이전 내비게이션에서) 중복 정의를 피하기 위해 주입을 건너뜁니다.

관문 중 하나라도 빠지면 컴포넌트는 조용히 사라집니다. 확인 방법: `curl /api/public/components/list?auto_register=true` — 응답에 해당 태그가 나타나야 합니다.

## 자동 로드 시퀀스

웹 호스트 안의 페이지가 마운트를 마치면 호스트는 다음 시퀀스를 실행합니다:

1. `GET /api/public/components/list?auto_register=true` — announced 상태이면서 자동 등록되는 모든 컴포넌트를 가져옵니다.

2. `customElements.get(tagName)`이 `undefined`인 각 컴포넌트에 대해 호스트는 `document.head`에 다음을 추가합니다:

   ```html
   <script type="module" src="/app/wc/reaction-bar/index.js?declare-tag=example-reaction-bar"></script>
   ```

   `?declare-tag=` 쿼리 파라미터는 엔트리 청크에게 어떤 커스텀 엘리먼트 이름으로 등록할지 알려주는 통로입니다.

3. 엔트리 청크가 `define(import.meta.url, ElementClass)`를 호출합니다. 컴포넌트 작성자는 `@wippy-fe/webcomponent-vue`(또는 `@wippy-fe/webcomponent-core`)에서 `define`을 임포트하며, 이들은 프록시의 `define`을 재수출합니다. 런타임에는 임포트 맵이 이를 단일 `@wippy-fe/proxy` 인스턴스로 해석합니다. `define` 헬퍼는 `new URL(import.meta.url).searchParams.get('declare-tag')`를 읽고 `customElements.define(tagName, ElementClass)`를 호출합니다.

4. Vue(또는 임의의 프레임워크)가 `<example-reaction-bar>` 엘리먼트를 렌더링합니다. 브라우저가 엘리먼트를 업그레이드하고 `connectedCallback`이 발생하며, `WippyVueElement`가 섀도우 루트 안에 자신의 Vue 앱을 마운트합니다.

## `auto_register: false`가 유용한 이유

`auto_register: false`로 설정하면 컴포넌트가 전역 자동 로드 스윕에서 제외됩니다. 다음과 같은 경우에 적절합니다:

- 컴포넌트가 크고, 명시적으로 필요한 페이지에서만 로드되어야 할 때.
- 컴포넌트가 호출 지점에서 `loadByTagName('example-heavy-chart')`(`@wippy-fe/proxy`에서 임포트)로 프로그래밍 방식으로 등록될 때.
- 컴포넌트가 독립적인 커스텀 엘리먼트가 아니라 다른 번들 내부에서만 쓰이는 내부 구성 요소일 때.

```ts
import { loadByTagName } from '@wippy-fe/proxy'

await loadByTagName('example-heavy-chart')
```

지연 등록은 초기 페이지 로드를 가볍게 유지해줍니다. `loadByTagName()`이 API를 통해 컴포넌트를 해석하려면 여전히 `announced: true`가 필요합니다 — 플래그가 `false`이면 `GET /components/by-tag/{tag}` 엔드포인트는 `404 "Component is not announced"`를 반환합니다.
