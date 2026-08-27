---
title: "레지스트리 엔트리"
description: "레지스트리 YAML, 패키지 메타데이터, wippy-meta.json으로 프런트엔드 페이지와 웹 컴포넌트를 Web Host에 선언하는 방법입니다."
---

# 레지스트리 엔트리

레지스트리 엔트리는 Wippy 백엔드에 프런트엔드 아티팩트를 선언하여 Web Host가 이를 발견하고 제공할 수 있게 합니다. 아티팩트는 마이크로 프런트엔드 앱 또는 재사용 가능한 웹 컴포넌트일 수 있습니다. 선언은 모듈의 `_index.yaml`, `package.json`의 `wippy` 블록, 생성된 `wippy-meta.json` 파일에 걸쳐 있습니다.

런타임에 이 엔트리를 처리하는 `wippy/views` 모듈 설정은 [Views](../../framework/views.md)를 참고하십시오.

## 레지스트리 엔트리란

모든 프런트엔드 아티팩트는 모듈 `_index.yaml`의 `registry.entry`로 선언합니다. `kind: registry.entry` 표시는 이 엔트리가 Lua 컴포넌트를 직접 정의하는 대신 다른 모듈이 소비하는 메타데이터를 담는다는 것을 Wippy 레지스트리에 알립니다.

> **흔한 함정:** `view.page`와 `view.component`는 `kind` 값이 **아닙니다**. 항상 `kind: registry.entry`를 작성하고 프런트엔드 아티팩트 유형은 `meta.type`에 넣으십시오. `kind: view.page`와 `kind: view.component`는 잘못된 형태입니다.

최소한의 올바른 형태:

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
```

```yaml
version: "1.0"
namespace: app.views

entries:
  - name: main
    kind: registry.entry
    meta:
      type: view.page
      name: main
      title: Admin Panel
      icon: tabler:layout-dashboard
      order: 0
      announced: true
      secure: false
      url: /app
      base_path: app/main
      entry_point: app.html
      mountRoute: /home/:part(.*)*
```

`wippy/views`가 읽는 것은 `meta` 블록입니다. `meta.type` 필드가 지원하는 두 아티팩트 종류를 구분합니다.

## `meta.type` 구분자

| 값 | 의미 |
|---|---|
| `view.page` | 페이지에서 선택한 iframe 또는 Web Fragment 엔진으로 렌더링되는 마이크로 프런트엔드 앱(전체 SPA) |
| `view.component` | 페이지 어디에나 삽입할 수 있는 웹 컴포넌트(사용자 정의 요소) |

`meta`의 다른 필드는 이 유형의 컨텍스트에서 해석됩니다. 한 유형에만 적용되는 필드는 유형별 참조 문서([view.page](./view-page.md), [view.component](./view-component.md))에서 설명합니다.

## `specification` 표시

프런트엔드 패키지는 `package.json` 최상위에 `"specification": "wippy-component-1.0"`을 선언해야 합니다. 이 표시는 패키지 메타데이터와 API 응답 형태를 식별합니다. 값이 있으면 `@wippy-fe/vite-plugin`이 이를 검증합니다.

```json
{
  "name": "@wippy/example-widget",
  "version": "1.0.0",
  "specification": "wippy-component-1.0",
  "browser": "dist/index.js",
  "wippy": {
    "type": "component",
    "tagName": "example-widget"
  }
}
```

이 표시는 렌더링 동작을 바꾸지 않습니다. `wippy/views`는 번들 값을 페이지 및 컴포넌트 descriptor에 전달하거나 이를 생략한 레거시 번들에 `wippy-component-1.0`을 제공합니다. 레지스트리 YAML 검증은 이 필드에 의존하지 않습니다.

## `wippy-meta.json` 계약

`@wippy-fe/vite-plugin`은 빌드된 번들 옆에 `wippy-meta.json`을 출력합니다. props schema, events schema, title, icon, proxy 주입 설정처럼 아티팩트 작성자가 정의한 런타임 메타데이터의 정식 소스입니다.

메타데이터 책임:

- **출력 주체:** `view.page` 앱의 `wippyPagePlugin()`과 `view.component` 웹 컴포넌트의 `wippyComponentPlugin()`.
- **생성 원본:** `package.json`. `wippy-meta.json`을 직접 작성하지 마십시오.
- **소비 주체:** 제공 번들 root에서 이를 읽어 페이지/컴포넌트 descriptor와 API 응답을 만드는 `wippy/views`.
- **재정의 주체:** 배포 정책과 명시적으로 선언한 모든 필드에서 계속 권위 있는 `_index.yaml`.

`wippy/views`는 `registry.entry`를 불러올 때 페이지와 컴포넌트 모두에서 아티팩트의 제공 번들 root(`url + base_path`)에 있는 `wippy-meta.json`을 읽습니다. YAML이 항상 이깁니다. `_index.yaml`이 선언한 모든 필드에서 우선하며, 선언이 없을 때 `wippy-meta.json`이 기본값을 제공합니다. `announced`, `secure`, `url`, `mountRoute`, `base_path` 같은 배포 정책 필드는 컴포넌트 저작이 아니라 운영자 결정을 표현하므로 `_index.yaml`에 설정해야 하며 `package.json`/`wippy-meta.json` 작성 surface가 없습니다. (`base_path`는 페이지와 컴포넌트 모두에서 적용됩니다. 현재 app-template 컴포넌트 엔트리는 생략할 뿐입니다.)

반면 `entry_point`는 FE가 작성하며 YAML로 재정의할 수 있습니다. 페이지에서는 `wippy.path`에서 옵니다. `@wippy-fe/vite-plugin`이 이를 **필수**로 요구하므로 생략하면 `wippy.path is required for a page package` 오류가 납니다. 컴포넌트에서는 최상위 `browser` 필드에서 오며 `wippy.tagName`은 사용자 정의 요소 이름을 별도로 선언합니다. `_index.yaml`의 `meta.entry_point`는 작성된 기본값 위에 적용하는 선택적 배포별 재정의이며 YAML 전용 필드가 아닙니다.

컴포넌트 작성자는 표시 메타데이터를 `package.json`의 `wippy` 블록에 한 번 작성하고 vite plugin이 작성자 기본값으로 `wippy-meta.json`에 기록합니다. 운영자는 라우팅과 접근 정책을 YAML에 설정하고 표시 필드도 재정의할 수 있습니다.

## 공통 필드

다음 필드는 `view.page`와 `view.component` 엔트리의 `meta` 블록에 모두 나타납니다.

| 필드 | 유형 | 기본값 | 설명 |
|---|---|---|---|
| `type` | string | — | `view.page` 또는 `view.component`(필수) |
| `name` | string | 엔트리 이름 | API 응답에서 사용하는 식별자 |
| `title` | string | — | 사람이 읽을 수 있는 표시 이름 |
| `icon` | string | — | Iconify 참조. 예: `tabler:layout-dashboard` |
| `announced` | boolean | — | 목록 API 표시 여부. 유형에 따라 의미가 다름(아래 참고) |
| `secure` | boolean | `false` | 접근에 인증 필요 |
| `url` | string | — | 정적 파일 제공을 위한 기본 URL 접두사(CDN origin 또는 로컬 마운트 경로) |
| `entry_point` | string | `index.html` / `index.js` | 정적 디렉터리 안의 엔트리 파일 이름 |

### 유형별 `announced` 의미

- **`view.page`**: 탐색 사이드바(`GET /api/public/pages/list`)에 페이지가 나타나는지 제어합니다. `announced: false`는 탐색에서 숨길 뿐 직접 접근하면 여전히 불러옵니다. 삽입 페이지나 보조 페이지에 적합한 패턴입니다.

- **`view.component`**: `GET /api/public/components/list` 포함 여부를 결정합니다. `announced: false`이면 엔드포인트에서 완전히 제외되어 Web Host가 script tag를 주입하지 않고 `customElements.get(tagName)`은 undefined로 남습니다. autoload가 필요하면 `announced: true`가 필수입니다. 자세한 내용은 [view.component](./view-component.md)을 참고하십시오.

## 제공 필드의 조합 방식

마이크로 프런트엔드 앱에서는 세 필드가 결합되어 Web Host가 불러올 HTML URL을 만듭니다.

```
<url>/<base_path>/<entry_point>
```

예를 들어 `url: /app`, `base_path: app/main`, `entry_point: app.html`이면 호스트는 `/app/app/main/app.html`을 가져옵니다.

`base_path`와 `entry_point`의 분리는 의도적입니다. Web Host는 불러온 페이지에 `<url>/<base_path>/`를 HTML `<base>` tag로 주입하며, 이는 브라우저가 페이지 안의 모든 상대 URL을 해석하는 방식을 지배합니다. 엔트리 파일은 base 하위 디렉터리에 있을 수 있습니다. 중요한 것은 모든 리소스에 상대 경로로 도달할 수 있는 공통 root를 base가 가리키는 것입니다.

예를 들어 번들 레이아웃이 다음과 같다면:

```
static/
  shared/
    vendor.js
  app/
    index.html    ← entry_point: app/index.html
    app.js
```

`index.html`이 `../shared/vendor.js`를 참조한다면 `base_path`는 `app/`이 아니라 `static/`(즉 `app/`과 `shared/`를 모두 포함하는 디렉터리)을 가리켜야 합니다. `base_path: app`을 설정하면 `../shared/vendor.js`가 제공 디렉터리 밖으로 해석되어 404가 발생합니다.

모든 자산이 엔트리 파일 옆에 있는 일반적인 경우에는 `base_path`와 `entry_point`를 포함하는 디렉터리가 같은 수준이므로 차이가 드러나지 않습니다. 번들이 형제 디렉터리 사이에서 리소스를 공유할 때만 중요합니다.

웹 컴포넌트에서도 호스트는 같은 방식으로 제공 URL을 조합합니다.

```
<url>/<base_path>/<entry_point>
```

현재 app-template 컴포넌트 엔트리는 `base_path`를 생략하지만 지원되며 같은 방식(`<url>/<base_path>/<entry_point>`)으로 조합됩니다. 따라서 해당 엔트리의 URL은 `<url>/<entry_point>`로 줄어듭니다. 페이지와 달리 컴포넌트는 자체 주입 HTML `<base>` tag를 받지 않고 `<script type="module">`로 주입됩니다.
