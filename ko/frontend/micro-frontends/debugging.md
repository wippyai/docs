---
title: "Wippy FE 디버깅"
description: "무언가 깨졌을 때 여기서 시작하세요. 각 섹션은 가장 흔한 원인을 가능성이 높은 순서대로 나열하고 각각에 대한 구체적인 DevTools 확인 방법을 제시합니다."
---

# Wippy FE 디버깅

무언가 깨졌을 때 여기서 시작하세요. 각 섹션은 가장 흔한 원인을 가능성이 높은 순서대로 나열하고 각각에 대한 구체적인 DevTools 확인 방법을 제시합니다.

## 로드 시 빈 화면

**1. 먼저 Console 확인:**
- `Failed to resolve module specifier 'vue'` — 페이지가 활성 import map이 제공하지 않는 스페시파이어를 external로 처리했습니다. 호스팅 모드에서는 대상 Web Host 릴리스가 실제로 서빙하는 import map을 검사하고, host-less 모드에서는 `app.html`의 map을 검사하세요. 정식 패키지 목록이나 병합 우선순위를 가정하지 말고 모든 Rollup external을 그 정확한 map과 비교하세요.
- `Proxy globals not found` (또는 `@wippy-fe/proxy` import가 undefined로 돌아옴) — 앱 스크립트가 실행되기 전에 `proxy.js` / `dev-proxy.js`가 로드되지 않아 런타임이 내부 전역을 설치하지 못했습니다. `app.html`에서 `dev-proxy.js`가 `data-role="@wippy/scripts"`로 참조되고 있는지 확인하세요.
- 조용한 멈춤(에러도 앱도 없음) — 설정은 `proxy.js`가 실행되기 전에 `window.__WIPPY_APP_CONFIG__`로 동기적으로 주입되므로 `@wippy-fe/proxy` 게터는 즉시 해석되거나(`Proxy globals not found`를 던지거나) 합니다. 게터는 `SetConfig`를 기다리지 않습니다. 진짜 멈춤은 런타임이 마운트되지 않았다는 뜻입니다 — `proxy.js` / `dev-proxy.js`가 로드되어 전역을 설치하는 데 실패했거나(위의 `Proxy globals not found` 항목 참고), host-less 모드에서 **Accept**를 클릭하지 않아 개발 오버레이가 "waiting" 상태로 있는 것입니다. 개발 오버레이 FAB(플로팅 버튼)이 나타났는지 확인하세요. 나타나지 않았다면 proxy 스크립트가 로드되지 않은 것입니다. (`SetConfig` / `GetConfig` 핸드셰이크는 호스트 수준의 수동 `iframe.html?waitForCustomConfig` 임베딩에만 적용되며, 호스팅되거나 host-less인 마이크로 프론트엔드에는 적용되지 않습니다.)

**2. Network 탭 확인:**
- `dev-proxy.js`(host-less) 또는 `proxy.js`(호스팅)가 상태 200으로 로드되었는지 확인하세요.
- 404라면: `<script data-role="@wippy/scripts">` 태그의 `src`가 잘못된 URL을 가리키고 있습니다.

**3. 런타임이 전역을 설치했는지 확인(내부 진단):**
```javascript
// 내부 전역 — 앱 코드는 이를 절대 읽지 않습니다. proxy 런타임이 마운트되었는지
// 확인하는 콘솔 스모크 테스트일 뿐입니다. 앱/WC 코드는 `import { ... } from '@wippy-fe/proxy'`를 사용합니다.
window.$W              // undefined가 아니라 객체여야 합니다
window.__WIPPY_APP_API__ // 해석된 proxy 인스턴스 — 런타임이 설치되면 존재합니다
```
`@wippy-fe/proxy` 게터는 이 전역들을 읽습니다(`window.__WIPPY_APP_API__`는 살아 있는 호스트 인스턴스입니다). 이는 모듈 URL이 어떻게 해석되는지와는 별개입니다. 전역은 존재하는데 import가 실패한다면, 활성 import map과 정확한 `@wippy-fe/proxy` 스페시파이어에 대한 네트워크 응답을 검사하세요. 페이지를 서빙하는 환경에서 map이나 externalization 결정을 고치세요. host-less 부팅이 성공했다고 해서 호스팅 동작을 추론하지 마세요.

## 웹 컴포넌트가 나타나지 않음

**1. 세 가지 관문 검증:**

백엔드에서 실행:
```bash
curl /api/public/components/list?auto_register=true
```
응답에 컴포넌트의 `tag_name`이 나타나야 합니다. 그렇지 않다면:
- `_index.yaml`에 `announced: true`가 없음 → 추가하세요
- `auto_register: true`가 없음 → 추가하세요
- 컴포넌트가 `wippy/views`에 등록되지 않음 → 모듈 의존성을 확인하세요

**2. Console 확인:**
```javascript
customElements.get('your-tag-name')  // undefined는 엘리먼트가 등록되지 않았다는 뜻입니다
```

**3. Network 탭 확인:**
- 컴포넌트의 `index.js` URL로 필터링하세요
- URL에 `?declare-tag=your-tag-name`이 포함되어야 합니다 — 이것이 엘리먼트가 자신을 등록하는 방식입니다
- URL에 `?declare-tag=` 쿼리가 없다면: `define(import.meta.url, MyElement)`가 엔트리 청크에 없었던 것입니다. 이것이 `preserveEntrySignatures: false` 문제입니다 — [Build System](./build-system.md)을 참고하세요

## API 호출 실패 / 401

**1. host-less 모드에서:**
- proxy 설정의 `dev-token` 스텁은 실제 자격 증명이 아닙니다 — 실제 백엔드에서는 항상 401을 받습니다
- 개발 오버레이 열기 → JSON 설정에서 `auth.token` 필드 찾기 → 실제 bearer 토큰 붙여넣기
- 오버레이 설정의 `APP_API_URL`이 실행 중인 백엔드를 가리키는지 확인하세요(백엔드가 다른 곳에 있다면 localhost가 아니어야 합니다)

**2. 호스팅 모드에서:**
- 401은 `host.handleError('auth-expired', error)`를 호출해 처리하세요 — 이는 호스트의 재인증 흐름을 트리거합니다
- 모든 API 호출이 401이라면: 호스트의 세션 토큰이 올바르게 주입되고 있는지 확인하세요(proxy가 `api.get(...)`을 통해 자동으로 처리합니다)

## 테마가 이상하게 보임

**1. host-less 모드에서:**
개발 오버레이는 `themeConfig`, `primevue`, `markdown`, `iframe` 주입이 **기본적으로 비활성화**된 상태로 시작합니다. 이를 활성화하기 전까지 앱은 플랫폼 CSS 없이 렌더링됩니다.

개발 오버레이 FAB 열기 → 필요한 CSS 주입 토글 → "Auto-accept on reload" 체크.

**2. 완전한 유효 체인 비교:**

토큰이 비어 있지 않다는 것만으로는 충분하지 않습니다. 기본 팔레트로의 리셋이나 우발적인 패밀리 별칭이 드러나도록 서로 다른 값을 사용하세요:

```yaml
css_variables:
  "--p-primary": "#dc2626"
  "--p-secondary": "#7c3aed"
  "--p-accent": "#0d9488"
  "--p-danger": "#be123c"
  "--p-success": "#15803d"
  "--p-warn": "#c2410c"
  "--p-info": "#0369a1"
  "--p-help": "#9333ea"
  "--theme-diagnostic-sentinel": "#123456"
```

그런 다음 이 순서로 비교하세요:

1. **유효한 설정 맵:** `config.theming.global.cssVariables`를 검사하고 기본값과 활성 `@light` / `@dark` 대체를 확인하세요.
2. **페이지 루트:** `getComputedStyle(document.documentElement).getPropertyValue(name).trim()`으로 정확한 토큰을 읽으세요.
3. **WC 호스트:** `getComputedStyle(customElement)`에서 같은 토큰을 읽으세요.
4. **WC 내부 루트:** `getComputedStyle(customElement.shadowRoot.querySelector('[data-wippy-theme-root]'))`에서 읽으세요.
5. **렌더링된 시맨틱 색상:** 프로브에 `background-color: var(--p-<family>-color)`를 넣고 계산된 `backgroundColor`를 비교하세요. 이는 `color-mix()`를 물리적으로 해석합니다.

Auto-light, Auto-dark, 강제 Light, 강제 Dark에서 반복하세요. 설정된 각 패밀리에 대해 기본값, 50–950 전체 음영, `color`, `contrast-color`, `hover-color`, `active-color`를 검증하고, 직접적인 음영/별칭 오버라이드, 서피스 토큰, 센티널도 검증하세요. 페이지, 호스트, 내부 값이 일치해야 합니다.

첫 번째 불일치를 해석하세요: 유효 맵이 틀렸다면 설정/병합 문제, 페이지 루트가 틀렸다면 변수 컴파일/주입 문제, 페이지는 맞는데 WC 호스트가 틀렸다면 호스트 전파 문제, WC 호스트는 맞는데 내부 루트가 틀렸다면 강제 테마 브리지 또는 로컬 기본값 문제, 토큰은 같은데 렌더링된 색상이 틀렸다면 소비하는 셀렉터나 시맨틱 별칭이 잘못된 것입니다.

**3. 웹 컴포넌트 특유의 문제:**
- 플랫폼 기본값이 없다면 `hostCssKeys`에 `'themeConfigUrl'`이 포함되어 있는지 확인하세요.
- 호스트는 올바른데 내부 루트가 기본 값으로 리셋된다면 최신 `@wippy-fe/webcomponent-core`인지 확인하세요. 팔레트를 컴포넌트 CSS로 복사하지 마세요.
- PrimeVue 컴포넌트가 스타일 없이 렌더링된다면 `hostCssKeys`에 `'primeVueCssUrl'`을 추가하세요.

전체 주입 파이프라인은 [Theming: Micro Frontend Apps](./micro-frontend-app-theming.md) 또는 [Theming: Web Components](./web-component-theming.md)를 참고하세요.

## 호스트 URL 바가 업데이트되지 않음

이식 가능한 마이크로 프론트엔드 앱은 `@wippy-fe/router`의 `createAppRouter()` 팩토리를 사용해야 합니다. 이 패키지가 호스트 동기화의 양방향을 모두 소유하며, 애플리케이션 코드가 `router.afterEach`와 `@history` 배선을 재현해서는 안 됩니다.

**확인:**
```typescript
import { createAppRouter } from '@wippy-fe/router'
import { config } from '@wippy-fe/proxy'
import { routes } from './routes'

const router = createAppRouter(routes, {
  initialPath: config.context?.route ?? '/',
})
```

그래도 호스트 URL이 업데이트되지 않는다면, 현재 `@wippy-fe/router` 패밀리가 일관되게 설치되어 있고 로컬 래퍼가 팩토리를 대체하지 않는지 확인하세요. host-less 모드에서는 개발 오버레이의 Monitor 탭에 패키지가 보고하는 라우트가 표시됩니다.

## 로컬에서는 동작하는데 호스팅하면 깨짐

**1. `document.baseURI` 확인:**
```javascript
document.baseURI  // 레지스트리 엔트리의 <url>/<base_path>/ 여야 합니다
```
비어 있거나 잘못되었다면: `<base>` 태그가 주입되지 않은 것입니다. `_index.yaml`의 `base_path`가 빌드 산출물의 실제 디렉터리 구조와 일치하는지 확인하세요.

**2. proxy 전역 확인(내부 진단):**
```javascript
window.__WIPPY_PROXY_CONFIG__  // 내부용 — iframe 호스팅 모드에서 반드시 존재해야 합니다
```
undefined라면 앱이 실행되기 전에 proxy가 주입되지 않은 것입니다. 앱 코드는 이를 직접 읽지 않습니다. [Proxy & Isolation § Internals](../web-host/proxy-isolation.md#internals--do-not-read-or-override)를 참고하세요.

**3. vite.config.ts에서 `base: ''` 확인:**
`base: ''`가 없으면 Vite는 절대 에셋 경로를 생성합니다. 앱은 로컬 개발 서버(`/`에서 서빙)에서는 잘 로드되지만 CDN 하위 디렉터리에서 서빙될 때 404가 납니다.

**4. import map 불일치:**
`fe_facade_url`이 고정한 Web Host 릴리스에서 `<version-tag>/import-map.json`을
다시 가져오세요. host-less `app.html`의 `imports` 객체 전체를 교체하고
그 모든 키에서 Vite external을 다시 생성하세요. host-less map을 제거하거나
개별 엔트리를 패치하지 마세요. 새로 import한 정확한 스페시파이어는 가져온 map에
없을 때만 번들에 포함하세요.

## 로거를 디버깅 도구로 사용하기

`logger.debug()`와 `logger.info()` 출력은 프로덕션 트랜스포트뿐 아니라 개발 중 브라우저 Console에도 나타납니다. 부팅 시퀀스를 추적하는 데 사용하세요:

```typescript
import { logger, config, host, api } from '@wippy-fe/proxy'

export function createMainApp() {
  logger.debug('App bootstrap started')
  logger.debug('Host services resolved', { hasConfig: !!config })
  // ... config, host, api를 직접 사용
}
```

`logger.captureException(error)`도 개발 모드에서 Console에 로그를 남기며 프로덕션에서는 호스트의 에러 캡처 시스템에 포착됩니다.
