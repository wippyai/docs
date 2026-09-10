---
title: "테마 영속화"
description: "기본적으로 Web Host는 thememode(파사드 기본값)에서 라이트/다크를 해석하고 이를 메모리에만 유지합니다. 따라서 사용자의 명시적 선택은 다음…"
---

# 테마 영속화

기본적으로 Web Host는 `theme_mode`(파사드 기본값)에서 라이트/다크를 해석하고 이를 메모리에만
유지합니다. 따라서 사용자의 명시적 선택은 다음 리로드에서 사라집니다. 테마 영속화는 그 선택을
**쿠키** 또는 **localStorage**에 저장해 리로드 이후에도 유지하고, 잘못된 테마가 번쩍이지 않도록
가능한 한 이른 시점에 이를 로드합니다.

영속화는 전적으로 파사드에 있습니다. Web Host는 저장소에 대해 중립을 유지하며, 파사드(또는 임의의
임베더)가 선택을 영속화하는 데 사용하는 `themeChanged` 이벤트만 발행합니다.

> **옵트인.** `theme_persist`의 기본값은 **`none`**입니다. 배포가 명시적으로 `cookie`나
> `localStorage`로 설정하지 않는 한 영속화는 **꺼져 있습니다**. 기본값에서는 동작이 이전과 정확히
> 동일합니다(테마는 항상 `theme_mode`에서 오고 리로드를 넘어 기억되지 않습니다). 아무것도 저장되지
> 않고, 쿠키도 기록되지 않으며, 옵트인하기 전까지 생성된 스크립트는 아무 동작도 하지 않습니다.

## 설정

두 개의 파사드 파라미터가 이를 제어합니다([프런트엔드 파사드](../../framework/facade.md) 참고):

| 파라미터 | 기본값 | 값 | 설명 |
|-----------|---------|--------|-------------|
| `theme_persist` | `none` | `none` \| `cookie` \| `localStorage` | 선택된 모드를 어디에 저장할지. `none` = 현재 동작. |
| `theme_storage_key` | `@wippy-theme-mode` | 문자열 | 쿠키 / localStorage 키. |

둘 다 공개 config 엔드포인트에서 `themePersist`와 `themeStorageKey`로 반환되므로, Web Host 바깥에서
서빙되는 페이지도 이를 읽을 수 있습니다.

```yaml
# 파사드 의존성 파라미터에서
- name: theme_persist
  value: cookie
- name: theme_storage_key
  value: "@wippy-theme-mode"
```

### cookie와 localStorage 비교

- **`cookie`** — Jet로 렌더링되는 호스트 셸이 쿠키를 **서버 측에서** 읽고 응답이 전송되기 전에
  `<html>`에 `w-theme-*` 클래스를 기록하므로, 최초 페인트부터 이미 테마가 적용되어 있습니다.
  **번쩍임 없음.** 가장 좋은 기본값입니다.
- **`localStorage`** — 서버가 localStorage를 읽을 수 없으므로, 저장된 값은 가능한 한 이른 시점에
  동기 인라인 스크립트로 적용됩니다. 짧은 번쩍임이 이론적으로 가능하지만 최소화됩니다.

## 생성되는 스크립트

영속화가 활성화되면 파사드가 다음 위치에 작은 스크립트를 **생성해 서빙합니다**:

```
GET /api/public/facade/theme-persist.js
```

설정된 키와 모드가 내장되어 있으므로 페이지에서 설정할 것이 없습니다. `<head>`에서 가능한 한 이른
시점에 한 번만 포함하십시오:

```html
<script src="/api/public/facade/theme-persist.js"></script>
```

로드 시 저장된 값을 읽어 `w-theme-*` 클래스를 적용한 다음, 작은 API를 노출합니다:

```js
window.wippyThemePersist = {
  mode,            // 'none' | 'cookie' | 'localStorage'
  key,             // 저장소 키
  read(),          // -> 'auto' | 'light' | 'dark' | null
  write(mode),     // 모드를 영속화 (mode === 'none'이면 아무 동작 없음)
  apply(mode),     // <html>의 w-theme-* 클래스를 토글
}
```

호스트 셸(`index.html` / Jet의 `index.jet`)은 이미 이 스크립트를 포함하고, 저장된 값을 앱에 주입하며,
변경 사항을 영속화합니다. 따로 손댈 필요가 없습니다. 아래 절들은 **다른** 페이지를 위한 내용입니다.

## 전체 흐름 (호스트 셸)

1. **최초 페인트** — cookie 모드: 서버가 `<html class="w-theme-dark">`를 설정했습니다. localStorage
   모드: 조기 적용 스크립트가 설정했습니다. 어느 쪽이든 번들이 로드되기 전에 페이지에 테마가 적용됩니다.
2. **부트스트랩** — 셸이 영속화된 값을 호스트에 주입합니다:
   `themeMode: window.wippyThemePersist.read() ?? cfg.themeMode`. 따라서 호스트도 같은 모드를 적용합니다.
3. **변경 시** — 호스트가 `themeChanged(mode)`를 발행하고, 셸이 이를 영속화합니다:
   `events.on('themeChanged', window.wippyThemePersist.write)`.

### `themeChanged` 호스트 이벤트

`window.initWippyApp(...)`이 반환하는 이미터인 `globalEvents`는 초기화 시점과 모든 테마 변경 시점에
`themeChanged(mode)`(`'auto' | 'light' | 'dark'`)를 발생시킵니다. 이는 영속화에 대해 중립적입니다.
호스트는 저장소를 전혀 건드리지 않으며, 무엇을 할지는 임베더가 결정합니다.

```js
const events = window.initWippyApp(config, '#app')
events.on('themeChanged', (mode) => {
  // 예: 영속화하거나 부모 윈도에 알림
})
```

## Wippy가 호스팅하지 않는 페이지

Wippy 이식 가능 모듈 계약 바깥에 있는 문서도 동일한 테마를 따르고 영속화할 수
있습니다. 아래의 네이티브 버튼은 그러한 외부 정적 문서에만 적절합니다.
이런 컨트롤을 갖는 Wippy 페이지나 컴포넌트는
[이식 가능한 UI 계약](../portable-ui-contract.md)에 따라 PrimeVue를 사용해야 합니다.
생성된 스크립트를 포함하고 직접 만든 스위처에서 `write()`를 호출하십시오:

```html
<head>
  <!-- 가능한 한 이른 시점에: 저장된 테마를 적용하고 window.wippyThemePersist를 노출 -->
  <script src="/api/public/facade/theme-persist.js"></script>
  <!-- 선택 사항: 파사드 브랜드 테마도 함께 재사용 -->
  <link rel="stylesheet" href="/api/public/facade/variables.css">
</head>
<body>
  <button type="button" data-mode="auto">Auto</button>
  <button type="button" data-mode="light">Light</button>
  <button type="button" data-mode="dark">Dark</button>

  <script>
    document.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode
        window.wippyThemePersist.apply(mode)   // 지금 <html>을 갱신
        window.wippyThemePersist.write(mode)   // 다음 로드 / 호스트를 위해 영속화
      })
    })
  </script>
</body>
```

키와 저장 모드가 공유되므로(스크립트가 동일한 파사드 설정에서 생성되므로), 로그인 페이지에서 한 선택이
그대로 Web Host로 이어지고 그 반대도 마찬가지입니다.

> 스크립트를 로드하고 싶지 않다면 `/api/public/facade/config`를 가져와 `themePersist` /
> `themeStorageKey`를 읽고 읽기/쓰기를 직접 구현할 수도 있습니다. 다만 생성된 스크립트는 저장 로직을
> 한곳에 모아 둡니다.

## 서버 측 쿠키 렌더링 (번쩍임 제로)

커스텀 서버 렌더링 페이지(예: Jet 로그인 템플릿)에서는 호스트 셸과 똑같이 테마를 서버 측에서
적용할 수 있습니다. 요청에서 `theme_storage_key`로 지정된 쿠키를 읽고 `<html>`에 해당 클래스를
출력하십시오:

```html
<html lang="en"{{ if hasTheme }} class="{{ themeClass }}" style="color-scheme: {{ colorScheme }};"{{ end }}>
```

여기서 핸들러는 쿠키를 기준으로 `themeClass`를 `w-theme-dark` / `w-theme-light`로(그리고
`colorScheme`을 `dark` / `light`로) 설정합니다. 페이지가 변경 사항을 되돌려 쓸 수 있도록
`theme-persist.js`도 함께 포함하십시오.
