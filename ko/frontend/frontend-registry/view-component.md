---
title: "웹 컴포넌트(view.component)"
description: "재사용 가능한 view.component 사용자 정의 요소를 Web Host에 선언하고 제공하고 등록하는 방법입니다."
---

# 웹 컴포넌트(view.component)

`view.component` 엔트리는 Web Host가 자동으로 발견하고 주입하고 등록할 수 있는 재사용 가능한 사용자 정의 요소를 설명합니다. 페이지와 달리 컴포넌트에는 자체 iframe이 없습니다. 페이지 또는 호스트 템플릿이 배치하는 어느 곳에나 나타날 수 있는 사용자 정의 HTML tag입니다.

컴포넌트 구현 작성법은 [웹 컴포넌트](../micro-frontends/web-component.md)를 참고하십시오.

## 프런트엔드 필드(package.json wippy 블록)

FE 개발자는 `package.json`의 `wippy` 블록에 이 필드를 작성합니다. vite plugin은 빌드 시 `wippy-meta.json`에 포함하고 `wippy/views`가 기본값으로 읽습니다.

> **YAML은 `meta.tag_name`, `meta.props`, `meta.events`를 통해 `tagName`, `props`, `events`를 재정의할 수 있습니다.** 빌드 구성은 `wippyComponentPlugin()`을 선택합니다. 선택적 패키지 `type`은 값이 있을 때 선택된 plugin이 검증하는 메타데이터이며 별도의 YAML 재정의는 없습니다.

| 필드 | 유형 | 기본값 | 설명 |
|---|---|---|---|
| `type` | string | 런타임 descriptor의 `"widget"` | 선택 사항. 있으면 `"component"` 또는 `"widget"`이어야 함. 이 필드가 아니라 빌드 구성이 Vite plugin을 선택함 |
| `tagName` | string | — | 사용자 정의 요소 이름. 0.0.56 plugin은 문자로 시작하고 하이픈을 포함하며 문자·숫자·하이픈만 사용하고 HTML 예약 사용자 정의 요소 이름이 아닌 소문자 ASCII 이름을 요구함 |
| `props` | object | — | 컴포넌트가 받는 attribute를 설명하는 JSON Schema |
| `events` | object | — | 컴포넌트가 내보내는 사용자 정의 DOM event를 설명하는 JSON Schema |

### `package.json`의 `wippy.type`

웹 컴포넌트 패키지는 `wippy` 블록에 `"type": "widget"` 또는 `"type": "component"`를 설정할 수 있습니다(`"page"` 아님). 앱 템플릿은 `"widget"`을 사용합니다. component plugin은 두 값 또는 생략을 허용하고 page 메타데이터는 거부합니다.

```json
{
  "specification": "wippy-component-1.0",
  "wippy": {
    "tagName": "example-reaction-bar",
    "type": "widget",
    "props": {
      "type": "object",
      "properties": {}
    },
    "events": {
      "type": "object",
      "properties": {}
    }
  }
}
```

배포 시 운영자의 YAML `meta.tag_name`이 권위 있으며 번들 값을 재정의합니다. `package.json`에서 `wippy-meta.json`으로 포함된 `wippy.tagName`은 YAML 엔트리가 `tag_name`을 생략할 때 fallback입니다(해석 순서: YAML `meta.tag_name` → 번들 `wippy.tagName`). 두 값을 동기화하십시오. 다르면 YAML이 이깁니다.

### Props 스키마

`package.json`의 `wippy.props` 키는 컴포넌트가 받는 attribute를 설명하는 JSON Schema 객체입니다. vite plugin은 이를 `wippy-meta.json`에 포함하고, Web Host는 채팅 아티팩트 renderer나 tag sanitizer 같은 소비자에게 컴포넌트 메타데이터를 노출할 때 사용합니다. sanitizer는 정당한 attribute를 알아야 제거하지 않을 수 있습니다.

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

`properties`의 attribute 이름은 HTML attribute 관례(kebab-case)를 사용합니다. attribute가 없으면 web-component prop parser가 schema의 `default` 값도 런타임에 적용합니다.

### 이벤트 스키마

`wippy.events` 키는 props 형태를 따르지만 컴포넌트가 `useEvents()`로 내보내는 사용자 정의 DOM event를 설명합니다. 각 키는 event 이름이고 값은 event detail payload의 JSON Schema입니다.

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

Web Host의 채팅 메시지 sanitizer는 투영된 descriptor의 `wippy.props.properties`에서 컴포넌트 attribute allowlist를 만듭니다. 레지스트리 `meta.props`는 descriptor가 Host에 도달하기 전에 번들 `wippy.props` 값을 재정의합니다. event schema는 도구와 소비자를 위해 내보내는 사용자 정의 event를 문서화하며, 정리된 채팅 콘텐츠에서 DOM event listener attribute를 허용하는 데 쓰이지 않습니다.

## 운영자 구성(_index.yaml)

운영자는 `_index.yaml` 레지스트리 엔트리의 `meta` 블록에 이 필드를 설정합니다. 대부분은 배포 시점에만 의미가 있고 `package.json` 작성 surface가 없는 순수 배포 정책(`announced`, `secure`, `url`, `auto_register`)입니다. `tag_name`과 `entry_point`는 다릅니다. `package.json`에서 **FE가 작성**해 `wippy-meta.json`에 포함되며 YAML 키는 번들 값에 대한 **선택적 배포별 재정의**일 뿐입니다.

| 필드 | 유형 | 기본값 | 설명 |
|---|---|---|---|
| `tag_name` | string | `wippy.tagName` | `package.json`의 `wippy.tagName`으로 FE가 작성(vite plugin 필수). YAML 키가 번들 값을 재정의함. 브라우저에서 유효하고 plugin이 허용하는 작성 이름과 동기화할 것 |
| `announced` | boolean | `false` | `/api/public/components/list`에 나타나려면 `true`여야 함. 설정되어 있으면 `meta.public`을 대체값으로 사용 |
| `auto_register` | boolean | `false` | `true` → 시작 시 Web Host가 컴포넌트를 autoload하고 등록 |
| `secure` | boolean | `false` | 인증 필요 |
| `url` | string | — | 컴포넌트 빌드 번들의 정적 마운트 경로 |
| `base_path` | string | `""` | 프로젝트 root를 만들기 위해 `url`에 추가하는 선택적 하위 경로. 번들 URL은 `<url>/<base_path>/<entry_point>`로 조합됨. 현재 app-template 컴포넌트 엔트리는 생략하지만 페이지와 동일하게 적용 |
| `entry_point` | string | `wippy.browser` → `index.js` | `package.json` 최상위 `browser` 필드로 FE가 작성(`wippy-meta.json`에 포함). YAML 키가 번들 값을 재정의하며 대체값은 `index.js`. 호스트가 `<script type="module">`로 주입하는 엔트리 모듈 파일 |

최소 엔트리 예제:

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

## Autoload의 세 관문

Web Host가 컴포넌트를 autoload하려면 다음 세 조건이 동시에 충족되어야 합니다.

1. **`announced: true`** — `wippy/views`는 `list_components.lua`에서 서버 측으로 이 flag를 필터링합니다. 우회할 query parameter가 없습니다. `announced: false`인 컴포넌트는 다른 설정과 관계없이 `/api/public/components/list`에 나타나지 않습니다.

2. **`auto_register: true`** — 호스트의 `loadGlobalAutoloadWidgets` 함수가 `?auto_register=true`로 목록 endpoint를 조회합니다. 이 flag가 없는 컴포넌트는 필터링된 응답에서 제외됩니다.

3. **tag가 아직 등록되지 않음** — script를 주입하기 전 호스트는 `customElements.get(tagName)`을 검사합니다. 이전 탐색 등으로 tag가 이미 정의되어 있다면 중복 정의를 피하기 위해 주입을 건너뜁니다.

관문 하나라도 없으면 컴포넌트는 별도 오류 없이 보이지 않습니다. 검증하려면 `curl /api/public/components/list?auto_register=true`를 실행해 응답에 tag가 나타나는지 확인합니다.

## Autoload 순서

Web Host 런타임 초기화 중 전역 autoload를 소유한 각 컨텍스트가 다음 순서를 실행합니다. 페이지를 마운트할 때마다 실행되지는 않습니다.

1. `GET /api/public/components/list?auto_register=true` — announced되고 auto-register되는 모든 컴포넌트를 가져옵니다.

2. `customElements.get(tagName)`이 `undefined`인 각 컴포넌트에 대해 호스트가 `document.head`에 다음을 추가합니다.

   ```html
   <script type="module" src="/app/wc/reaction-bar/index.js?declare-tag=example-reaction-bar"></script>
   ```

   `?declare-tag=` query parameter는 엔트리 chunk에 어떤 사용자 정의 요소 이름으로 등록할지 알리는 채널입니다.

3. 엔트리 chunk가 `define(import.meta.url, ElementClass)`을 호출합니다. 컴포넌트 작성자는 proxy의 `define`을 다시 export하는 `@wippy-fe/webcomponent-vue`(또는 `@wippy-fe/webcomponent-core`)에서 `define`을 import합니다. 런타임에는 import map이 단일 `@wippy-fe/proxy` 인스턴스로 해석합니다. `define` 도우미는 `new URL(import.meta.url).searchParams.get('declare-tag')`을 읽고 `customElements.define(tagName, ElementClass)`를 호출합니다.

4. Vue(또는 다른 framework)가 `<example-reaction-bar>` 요소를 렌더링합니다. 브라우저가 요소를 upgrade하고 `connectedCallback`이 실행되며 `WippyVueElement`가 shadow root 안에 Vue 앱을 마운트합니다.

## `auto_register: false`를 사용할 때

`auto_register: false`는 컴포넌트를 전역 autoload sweep에서 제외합니다. 다음 경우에 적합합니다.

- 컴포넌트가 커서 명시적으로 필요한 페이지에서만 불러와야 할 때.
- 호출 지점에서 `@wippy-fe/proxy`의 `loadByTagName('example-heavy-chart')`을 통해 프로그래밍 방식으로 등록할 때.
- 독립 사용자 정의 요소가 아니라 다른 번들 내부에서만 사용하는 구성 요소일 때.

```ts
import { loadByTagName } from '@wippy-fe/proxy'

await loadByTagName('example-heavy-chart')
```

지연 등록은 초기 페이지 load를 가볍게 유지합니다. `loadByTagName()`이 API로 해석하려면 컴포넌트에는 여전히 `announced: true`가 필요합니다. flag가 `false`이면 `GET /components/by-tag/{tag}` endpoint가 `404 "Component is not announced"`를 반환합니다.
