---
title: "테마 지속성"
description: "facade가 light, dark 또는 자동 테마 모드를 cookie나 localStorage에 유지하도록 구성합니다."
---

# 테마 지속성

이 페이지는 facade 구성 안내서입니다. 외부 페이지 HTML 블록은 부분 통합 예제이며 facade endpoint가 이미 존재한다고 가정합니다.

기본적으로 Web Host는 `theme_mode`(facade 기본값)에서 light 또는 dark 모드를 해석하고 선택을 메모리에 유지합니다. 따라서 사용자의 명시적 선택은 reload할 때 사라집니다. 테마 지속성은 선택을 **cookie** 또는 **localStorage**에 저장하고 일찍 불러와 잘못된 테마가 번쩍이는 것을 방지합니다.

지속성은 전적으로 facade에 있습니다. Web Host는 저장소에 관여하지 않고 facade 또는 다른 embedder가 선택을 저장하는 데 쓰는 `themeChanged` event만 내보냅니다.

> **Opt-in.** `theme_persist`의 기본값은 **`none`**입니다. 배포가 `cookie` 또는 `localStorage`로 명시적으로 설정하지 않으면 지속성은 **꺼져 있습니다**. 기본값에서는 `theme_mode`에서 테마를 가져오고 reload 사이에 기억하지 않습니다. 아무것도 저장하지 않고 cookie도 쓰지 않으며 생성된 script는 아무 작업도 하지 않습니다.

## 구성

두 facade parameter가 이를 제어합니다([프런트엔드 Facade](../../framework/facade.md) 참고).

| 파라미터 | 기본값 | 값 | 설명 |
|-----------|---------|--------|-------------|
| `theme_persist` | `none` | `none` \| `cookie` \| `localStorage` | 선택한 모드를 저장할 위치. `none`은 현재 기본 동작 |
| `theme_storage_key` | `@wippy-theme-mode` | string | Cookie/localStorage 키 |

둘 다 public 구성 endpoint에서 `themePersist`와 `themeStorageKey`로 반환되므로 Web Host 밖에서 제공되는 페이지도 읽을 수 있습니다.

```yaml
# in your facade dependency parameters
- name: theme_persist
  value: cookie
- name: theme_storage_key
  value: "@wippy-theme-mode"
```

### Cookie와 localStorage

- **`cookie`** — Jet로 렌더링한 호스트 shell이 cookie를 **서버 측**에서 읽고 응답을 보내기 전에 `<html>`에 `w-theme-*` 클래스를 기록하므로 첫 paint부터 올바른 테마가 적용됩니다. 테마 flash를 피하며 첫 paint 일관성이 중요할 때 권장합니다.
- **`localStorage`** — 서버는 localStorage를 읽을 수 없으므로 제공되는 shell이 `<head>`의 첫 script로 `theme-persist.js`를 동기식으로 불러옵니다. brand 스타일시트, loading UI, Web Host 번들이 렌더링되기 전에 저장 클래스를 적용합니다.

## 생성되는 script

지속성을 활성화하면 facade가 다음 경로에 작은 script를 **생성하고 제공합니다**.

```
GET /api/public/facade/theme-persist.js
```

구성된 키와 모드가 포함되므로 페이지에서 별도 설정할 것이 없습니다. `<head>`에서 가능한 한 일찍 한 번 포함합니다.

```html
<script src="/api/public/facade/theme-persist.js"></script>
```

로드 시 저장된 값을 읽고 `w-theme-*` 클래스를 적용한 뒤 작은 API를 노출합니다.

```js
window.wippyThemePersist = {
  mode,            // 'none' | 'cookie' | 'localStorage'
  key,             // the storage key
  read(),          // -> 'auto' | 'light' | 'dark' | null
  write(mode),     // persist a mode (no-op when mode === 'none')
  apply(mode),     // toggle the w-theme-* class on <html>
}
```

호스트 shell(`index.html`/Jet `index.jet`)은 이미 이 script를 포함하고 저장 값을 애플리케이션에 주입하며 변경을 유지합니다. 아래 절은 **다른** 페이지에 적용됩니다.

## 결합 방식(호스트 shell)

1. **첫 paint** — cookie 모드에서는 서버가 `<html class="w-theme-dark">`를 설정합니다. localStorage 모드에서는 early-apply script가 설정합니다. 어느 쪽이든 번들이 로드되기 전에 페이지에 테마가 적용됩니다.
2. **Bootstrap** — shell이 저장된 값을 `themeMode: window.wippyThemePersist.read() ?? cfg.themeMode`로 호스트에 제공하므로 호스트도 같은 모드를 적용합니다.
3. **변경 시** — 호스트가 `themeChanged(mode)`를 내보내고 shell이 `events.on('themeChanged', window.wippyThemePersist.write)`로 저장합니다.

### `themeChanged` 호스트 event

`window.initWippyApp(...)`이 반환하는 emitter인 `globalEvents`는 초기화 및 모든 테마 변경 때 `themeChanged(mode)`(`'auto' | 'light' | 'dark'`)를 발생시킵니다. 지속성 방식과 무관하며 호스트는 저장소에 접근하지 않습니다. embedder가 처리 방법을 결정합니다.

```js
const events = window.initWippyApp(config, '#app')
events.on('themeChanged', (mode) => {
  // e.g. persist, or notify a parent window
})
```

## Wippy가 호스팅하지 않는 페이지

Wippy 이식 가능 모듈 계약 밖의 문서도 같은 테마를 존중하고 유지할 수 있습니다. 아래 네이티브 버튼은 그러한 외부 정적 문서에만 적합합니다. 이 컨트롤이 있는 Wippy 페이지나 컴포넌트는 [이식 가능한 UI 계약](../portable-ui-contract.md)에 따라 PrimeVue를 사용해야 합니다. 생성된 script를 포함하고 자체 switcher에서 `write()`를 호출합니다.

```html
<head>
  <!-- as early as possible: applies the stored theme + exposes window.wippyThemePersist -->
  <script src="/api/public/facade/theme-persist.js"></script>
  <!-- optional: reuse the facade brand theme too -->
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
        window.wippyThemePersist.apply(mode)   // update <html> now
        window.wippyThemePersist.write(mode)   // persist for next load / the host
      })
    })
  </script>
</body>
```

키와 저장 모드가 공유되므로 로그인 페이지에서 한 선택이 Web Host로 이어지고 그 반대도 같습니다. script는 같은 facade 구성에서 두 값을 모두 받습니다.

> 또는 `/api/public/facade/config`를 가져와 `themePersist`, `themeStorageKey`를 읽고 저장을 직접 구현할 수 있습니다. 생성된 script는 이 로직을 한곳에 유지합니다.

## 서버 측 cookie 렌더링(flash 없음)

사용자 정의 서버 렌더링 페이지(예: Jet 로그인 템플릿)에서는 호스트 shell과 똑같이 서버 측에서 테마를 적용할 수 있습니다. 요청에서 `theme_storage_key`로 지정된 cookie를 읽고 일치하는 클래스를 `<html>`에 출력합니다.

```html
<html lang="en"{{ if hasTheme }} class="{{ themeClass }}" style="color-scheme: {{ colorScheme }};"{{ end }}>
```

handler는 cookie를 기준으로 `themeClass`를 `w-theme-dark`/`w-theme-light`로, `colorScheme`을 `dark`/`light`로 설정합니다. 페이지가 변경을 다시 저장할 수 있도록 `theme-persist.js`도 계속 포함합니다.
