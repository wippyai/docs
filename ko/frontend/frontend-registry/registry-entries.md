---
title: "레지스트리 엔트리"
description: "레지스트리 엔트리는 Wippy 백엔드가 프론트엔드 아티팩트 — 마이크로 프론트엔드 앱 또는 재사용 가능한 웹 컴포넌트 — 를 선언하여 Web Host가…"
---

# 레지스트리 엔트리

레지스트리 엔트리는 Wippy 백엔드가 프론트엔드 아티팩트 — 마이크로 프론트엔드 앱 또는 재사용 가능한 웹 컴포넌트 — 를 선언하여 Web Host가 이를 발견하고 서빙할 수 있게 하는 방법입니다. 이 문서는 모듈의 `_index.yaml`, 해당 `package.json`의 `wippy` 블록, 그리고 이 둘을 연결하는 `wippy-meta.json` 파일 사이의 계약을 설명합니다.

런타임에 이 엔트리들을 처리하는 `wippy/views` 모듈 설정은 [Views](../../framework/views.md)를 참고하세요.

## 레지스트리 엔트리란

모든 프론트엔드 아티팩트는 모듈의 `_index.yaml`에서 `registry.entry`로 선언됩니다. `kind: registry.entry` 마커는 이 엔트리가 Lua 컴포넌트를 직접 정의하는 것이 아니라 다른 모듈이 소비하는 메타데이터를 담고 있음을 Wippy 레지스트리에 알립니다.

> **흔한 함정:** `view.page`와 `view.component`는 `kind` 값이 **아닙니다**. 항상 `kind: registry.entry`를 작성하고 프론트엔드 아티팩트 타입은 `meta.type`에 넣으세요. `kind: view.page`와 `kind: view.component`는 유효하지 않은 형태입니다.

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

`meta` 블록이 `wippy/views`가 읽는 부분입니다. `meta.type` 필드는 지원되는 두 가지 아티팩트 종류를 구분합니다.

## `meta.type` 판별자

| 값 | 의미 |
|---|---|
| `view.page` | 마이크로 프론트엔드 앱(완전한 SPA)으로, Web Host 내부의 iframe에 렌더링됩니다 |
| `view.component` | 페이지 어디에나 임베드할 수 있는 Web Component(커스텀 엘리먼트)입니다 |

`meta`의 다른 모든 필드는 이 타입의 맥락에서 해석됩니다. 한쪽 타입에만 적용되는 필드는 타입별 레퍼런스 페이지([view.page](./view-page.md), [view.component](./view-component.md))에서 설명합니다.

## `specification` 마커

레지스트리에 참여하는 모든 프론트엔드 패키지는 `package.json` 최상위에 `"specification": "wippy-component-1.0"`을 선언합니다. 이 문자열은 해당 패키지가 wippy-component 계약을 따른다는 것 — 알려진 형태의 `wippy` 블록을 가지며 `@wippy-fe/vite-plugin`으로 빌드되었다는 것 — 을 Wippy(및 툴링)에 알리는 핸드셰이크입니다.

```json
{
  "name": "@wippy/app-main",
  "version": "1.0.0",
  "specification": "wippy-component-1.0",
  "wippy": { ... }
}
```

`specification`의 존재 자체가 런타임 동작을 바꾸지는 않지만, `wippy/views`는 레지스트리에서 로드한 엔트리를 검증할 때 이를 사용합니다.

## `wippy-meta.json` 계약

`@wippy-fe/vite-plugin`은 빌드된 번들 옆에 `wippy-meta.json` 파일을 생성합니다. 이 파일은 아티팩트의 런타임 메타데이터 — props 스키마, events 스키마, title, icon, proxy 주입 설정 — 에 대한 정식 소스 오브 트루스입니다.

에이전트와 툴링을 위한 요약:

- **생성 주체:** `view.page` 앱은 `wippyPagePlugin()`, `view.component` 웹 컴포넌트는 `wippyComponentPlugin()`.
- **작성 주체:** `wippy-meta.json`을 손으로 작성하는 사람은 없습니다. vite 플러그인이 `package.json`에서 생성합니다.
- **소비 주체:** `wippy/views`가 페이지/컴포넌트 디스크립터와 API 응답을 구성할 때 서빙된 번들 루트에서 이를 읽습니다.
- **YAML의 역할:** `_index.yaml`은 배포 정책과 명시적으로 오버라이드하는 모든 필드에 대해 권위를 유지합니다.

`wippy/views`가 `registry.entry`를 로드할 때, 아티팩트의 서빙된 번들 루트에서 `wippy-meta.json`을 읽습니다. 페이지의 경우 그 루트는 페이지의 `url + base_path`이며, 웹 컴포넌트의 경우 현재 엔트리들은 컴포넌트를 `url`에서 직접 서빙합니다. YAML이 항상 우선합니다: `_index.yaml`은 자신이 선언하는 모든 필드에 대해 우선권을 가집니다. `wippy-meta.json`은 특정 필드에 YAML 오버라이드가 없을 때 `wippy/views`가 읽는 기본값을 제공합니다. 배포 정책 필드 — `announced`, `secure`, `url`, `mountRoute`, `base_path` — 는 컴포넌트 작성이 아니라 운영자의 결정을 표현하므로 `_index.yaml`에 설정해야 합니다. 이들에 대한 `package.json`/`wippy-meta.json` 작성 표면은 존재하지 않습니다. (`base_path`는 페이지와 컴포넌트 모두에서 인정되며, 현재 app-template 컴포넌트 엔트리들은 단지 이를 생략할 뿐입니다.)

반면 `entry_point`는 FE에서 작성하면서 *동시에* YAML로 오버라이드할 수 있습니다. 이는 패키지의 `wippy` 블록에서 `wippy-meta.json`으로 구워집니다 — 페이지는 `wippy.path`(`@wippy-fe/vite-plugin`이 **필수**로 요구하며, 생략하면 플러그인이 `wippy.path is required for a page package`를 던집니다), 컴포넌트는 `wippy.tagName`/`browser`입니다. `_index.yaml`의 `meta.entry_point` 필드는 그 작성된 기본값 위에 얹히는 배포별 선택적 오버라이드이며, YAML 전용 필드가 아닙니다.

이 분리 덕분에 컴포넌트 작성자는 표시 메타데이터를 `package.json`의 `wippy` 블록에 한 번만 작성하고, vite 플러그인이 빌드 시점에 이를 작성자 기본값으로 `wippy-meta.json`에 굽습니다. 컴포넌트를 배포하는 운영자는 라우팅과 접근 정책을 YAML에 설정하며, 표시 수준의 필드도 거기서 오버라이드할 수 있습니다.

## 공통 필드

다음 필드들은 `view.page`와 `view.component` 엔트리 모두의 `meta` 블록에 나타납니다.

| 필드 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `type` | string | — | `view.page` 또는 `view.component` (필수) |
| `name` | string | 엔트리 이름 | API 응답에서 사용되는 식별자 |
| `title` | string | — | 사람이 읽을 수 있는 표시 이름 |
| `icon` | string | — | Iconify 참조, 예: `tabler:layout-dashboard` |
| `announced` | boolean | — | 목록 API에서의 노출을 제어합니다. 의미는 타입별로 다릅니다(아래 참고) |
| `secure` | boolean | `false` | 접근에 인증이 필요합니다 |
| `url` | string | — | 정적 파일 서빙을 위한 기본 URL 접두사(CDN 오리진 또는 로컬 마운트 경로) |
| `entry_point` | string | `index.html` / `index.js` | 정적 디렉터리 내의 엔트리 파일 이름 |

### 타입별 `announced` 의미

`announced` 플래그는 `meta.type`에 따라 다른 결과를 가집니다:

- **`view.page`**: 페이지가 내비게이션 사이드바(`GET /api/public/pages/list`)에 나타나는지를 제어합니다. `announced: false`로 설정하면 내비게이션에서 페이지가 숨겨지지만, 직접 접근하면 페이지는 여전히 로드됩니다. 임베드용 또는 보조 페이지에 적합한 정당한 패턴입니다.

- **`view.component`**: `GET /api/public/components/list`에 포함될지를 결정합니다. `announced: false`이면 컴포넌트는 해당 엔드포인트에서 완전히 제외되며, 이는 Web Host가 그 스크립트 태그를 결코 주입하지 않고 `customElements.get(tagName)`이 undefined로 남는다는 뜻입니다. 자동 로드가 필요한 컴포넌트에는 `announced: true`가 필수입니다 — 자세한 내용은 [view.component](./view-component.md)를 참고하세요.

## 서빙 필드의 조합 방식

마이크로 프론트엔드 앱의 경우, 세 필드가 조합되어 Web Host가 로드하는 HTML URL을 만듭니다:

```
<url>/<base_path>/<entry_point>
```

예를 들어 `url: /app`, `base_path: app/main`, `entry_point: app.html`이면 호스트는 `/app/app/main/app.html`을 가져옵니다.

`base_path`와 `entry_point`의 분리는 의도적입니다. Web Host는 로드된 페이지에 `<url>/<base_path>/`를 HTML `<base>` 태그로 주입하며, 이는 브라우저가 그 페이지 내의 모든 상대 URL을 해석하는 방식을 결정합니다. 엔트리 파일은 베이스의 하위 디렉터리에 있어도 됩니다 — 중요한 것은 베이스가 모든 리소스에 상대 경로로 도달할 수 있는 공통 루트를 가리켜야 한다는 점입니다.

예를 들어 번들이 다음과 같은 레이아웃을 가진다면:

```
static/
  shared/
    vendor.js
  app/
    index.html    ← entry_point: app/index.html
    app.js
```

그리고 `index.html`이 `../shared/vendor.js`를 참조한다면, `base_path`는 `app/`이 아니라 `static/`(즉 `app/`과 `shared/`를 모두 포함하는 디렉터리)를 가리켜야 합니다. `base_path: app`으로 설정하면 `../shared/vendor.js`가 서빙 디렉터리 밖으로 해석되어 404가 됩니다.

모든 에셋이 엔트리 파일과 같은 위치에 있는 일반적인 경우에는 `base_path`와 `entry_point`가 있는 디렉터리가 같은 레벨이므로 이 구분이 드러나지 않습니다. 번들이 형제 디렉터리 간에 리소스를 공유할 때만 문제가 됩니다.

웹 컴포넌트의 경우에도 호스트는 서빙 URL을 같은 방식으로 구성합니다:

```
<url>/<base_path>/<entry_point>
```

현재 app-template 컴포넌트 엔트리들은 `base_path`를 생략하지만, 이는 지원되며 동일하게 조합됩니다(`<url>/<base_path>/<entry_point>`) — 따라서 그런 엔트리에서는 URL이 `<url>/<entry_point>`로 축약됩니다. 페이지와의 차이는 컴포넌트가 자체 HTML `<base>` 태그를 주입받는 대신 `<script type="module">`로 주입된다는 점입니다.
