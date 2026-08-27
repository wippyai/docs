---
title: "Wippy FE 디버깅"
description: "일반적인 Wippy 프런트엔드 시작, 컴포넌트, API, 테마, 라우팅, 호스팅 런타임 오류를 확인하는 DevTools 절차입니다."
---

# Wippy FE 디버깅

애플리케이션 코드를 변경하기 전에 다음 점검으로 일반적인 Wippy 프런트엔드 오류의 원인을 좁히세요.

## 로드 시 빈 화면

**1. 먼저 Console 확인:**
- `Failed to resolve module specifier 'vue'` — 페이지가 external로 지정했지만 활성 import map이 제공하지 않는 지정자입니다. 호스팅 모드에서는 대상 Web Host 릴리스가 실제로 제공한 import map을 검사하고, 호스트 없는 모드에서는 `app.html`의 맵을 검사합니다. 정식 패키지 목록이나 병합 우선순위를 가정하지 말고 모든 Rollup external을 그 정확한 맵과 비교하세요.
- `Proxy globals not found` 또는 `@wippy-fe/proxy` import가 undefined — 앱 스크립트보다 먼저 `proxy.js`/`dev-proxy.js`가 로드되지 않아 런타임이 내부 전역을 설치하지 못했습니다. `app.html`에서 `dev-proxy.js`가 `data-role="@wippy/scripts"`로 참조되는지 확인하세요.
- 오류 없이 앱이 나타나지 않고 멈춤 — 호스트 없는 모드에서 개발 오버레이가 **Accept** 클릭을 기다리고 있을 수 있습니다. FAB(플로팅 버튼)가 표시되었는지 확인하세요. 없다면 `proxy.js`/`dev-proxy.js`가 로드되지 않았거나 전역 설치에 실패한 것이므로 위의 `Proxy globals not found` 점검을 따르세요.

호스팅된 iframe 페이지와 호스트 없는 페이지는 프록시 부팅 전에 설정을 동기식으로 받습니다. Web Fragment 페이지는 fragment adapter의 `GetConfig`/`SetConfig` 핸드셰이크를 사용하며 호스트 수준 수동 `iframe.html?waitForCustomConfig` 임베딩도 같습니다.

**2. Network 탭 확인:**
- `dev-proxy.js`(호스트 없음) 또는 `proxy.js`(호스팅)가 상태 200으로 로드되었는지 확인합니다.
- 404이면 `<script data-role="@wippy/scripts">` 태그의 `src`가 잘못된 URL을 가리킵니다.

**3. 런타임 전역 설치 확인(내부 진단):**
```javascript
// Internal globals — app code never reads these; this is only a console smoke test
// that the proxy runtime mounted. App/WC code uses `import { ... } from '@wippy-fe/proxy'`.
window.$W              // should be an object, not undefined
window.__WIPPY_APP_API__ // the resolved proxy instance — present once the runtime installed
```
`@wippy-fe/proxy` getter는 이 전역을 읽습니다(`window.__WIPPY_APP_API__`는 활성 호스트 인스턴스). 이는 모듈 URL 해석 방식과 별개입니다. 전역은 있지만 import가 실패한다면 활성 import map과 정확한 `@wippy-fe/proxy` 지정자의 네트워크 응답을 검사하세요. 페이지를 제공하는 환경에서 맵 또는 external 지정 결정을 고치고, 성공한 호스트 없는 부팅으로 호스팅 동작을 추론하지 마세요.

## 웹 컴포넌트가 나타나지 않음

**1. 세 게이트 확인:**

백엔드에서 실행합니다.
```bash
curl /api/public/components/list?auto_register=true
```
응답에 컴포넌트의 `tag_name`이 있어야 합니다. 없다면:
- `_index.yaml`에 `announced: true` 누락 → 추가
- `auto_register: true` 누락 → 추가
- 컴포넌트가 `wippy/views`에 등록되지 않음 → 모듈 의존성 확인

**2. Console 확인:**
```javascript
customElements.get('your-tag-name')  // undefined means the element was not registered
```

**3. Network 탭 확인:**
- 컴포넌트의 `index.js` URL로 필터링합니다.
- URL에는 `?declare-tag=your-tag-name`이 있어야 합니다. 이 쿼리로 엘리먼트가 자체 등록됩니다.
- URL에 `?declare-tag=` 쿼리가 없다면 진입 청크에 `define(import.meta.url, MyElement)`가 유지되지 않은 것입니다. `build.rollupOptions.preserveEntrySignatures`를 `'strict'`로 설정하세요. `false`는 등록 부작용을 진입 청크 밖으로 이동시킬 수 있습니다. [빌드 시스템](./build-system.md)을 참조하세요.

## API 호출 실패/401

**1. 호스트 없는 모드:**
- 프록시 설정의 `dev-token` 스텁은 실제 자격 증명이 아니며 인증 백엔드 호출 전 일반적으로 교체해야 합니다.
- 개발 오버레이를 열고 JSON 설정에서 `auth.token` 필드를 찾아 실제 bearer 토큰을 붙여 넣습니다.
- 오버레이 설정의 `APP_API_URL`이 실행 중인 백엔드를 가리키는지 확인합니다. 백엔드가 다른 곳에 있다면 localhost가 아니어야 합니다.

**2. 호스팅 모드:**
- 프록시 `api` 클라이언트를 사용합니다. 해당하는 동일 출처 401 응답에서는 요청을 단일화하고 `host.handleError('auth-expired', error)`를 자동으로 호출합니다.
- 모든 API 호출이 401이면 Host 설정과 세션 토큰 주입을 확인합니다. 표준 프록시 클라이언트를 의도적으로 우회하여 자동 처리를 받을 수 없는 요청 경로에서만 `host.handleError`를 직접 호출하세요.

## 테마가 잘못 보임

**1. 호스트 없는 모드:**
개발 오버레이는 `themeConfig`, `primevue`, `markdown`, `iframe` 주입을 기본적으로 **비활성화**하고 시작합니다. 따라서 활성화하기 전에는 기본 테마, PrimeVue, Markdown, 스크롤바 시트가 없습니다. `customCss`와 `customVariables`는 기본적으로 활성화되어 있습니다.

개발 오버레이 FAB를 열고 필요한 CSS 주입을 켠 뒤 "Auto-accept on reload"를 선택합니다.

**2. 계산된 전체 체인 비교:**

비어 있지 않은 토큰만으로는 충분하지 않습니다. 서로 다른 값을 사용해 기본 팔레트로 초기화되거나 변수군 별칭이 잘못된 경우를 명확히 드러내세요.

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

다음 순서로 비교합니다.

1. **계산된 설정 맵:** `config.theming.global.cssVariables`를 검사하고 기본값과 활성 `@light`/`@dark` 대체값을 확인합니다.
2. **페이지 루트:** `getComputedStyle(document.documentElement).getPropertyValue(name).trim()`으로 정확한 토큰을 읽습니다.
3. **WC 호스트:** `getComputedStyle(customElement)`에서 같은 토큰을 읽습니다.
4. **WC 내부 루트:** `getComputedStyle(customElement.shadowRoot.querySelector('[data-wippy-theme-root]'))`에서 읽습니다.
5. **렌더링된 의미 색상:** 프로브에 `background-color: var(--p-<family>-color)`를 적용하고 계산된 `backgroundColor`를 비교합니다. 이 단계에서 브라우저가 `color-mix()`를 해석합니다.

자동 밝게, 자동 어둡게, 강제 밝게, 강제 어둡게에서 반복합니다. 설정한 각 변수군의 기본값, 50–950 음영 전체, `color`, `contrast-color`, `hover-color`, `active-color`를 확인하고, 직접 재정의한 음영/별칭, surface 토큰, sentinel도 확인합니다. 페이지, 호스트, 내부 값은 같아야 합니다.

처음 갈라지는 지점을 해석합니다. 계산된 맵이 틀리면 설정/병합 문제, 페이지 루트가 틀리면 변수 컴파일/주입 문제, 페이지는 맞지만 WC 호스트가 틀리면 호스트 전파 문제, WC 호스트는 맞지만 내부 루트가 틀리면 강제 테마 브리지 또는 로컬 기본값 문제, 토큰은 같지만 렌더링 색상이 틀리면 소비 선택자 또는 의미 별칭 문제입니다.

**3. 웹 컴포넌트별 점검:**
- 플랫폼 기본값이 없다면 `hostCssKeys`에 `'themeConfigUrl'`이 있는지 확인합니다.
- 호스트는 맞지만 내부 루트가 기본값으로 초기화된다면 최신 `@wippy-fe/webcomponent-core`인지 확인합니다. 컴포넌트 CSS에 팔레트를 복사하지 마세요.
- PrimeVue 컴포넌트에 스타일이 없다면 `hostCssKeys`에 `'primeVueCssUrl'`을 추가합니다.

전체 주입 파이프라인은 [테마: 마이크로 프런트엔드 앱](./micro-frontend-app-theming.md) 또는 [테마: 웹 컴포넌트](./web-component-theming.md)를 참조하세요.

## Host URL 표시줄이 업데이트되지 않음

이식 가능한 마이크로 프런트엔드 앱은 `@wippy-fe/router`의 `createAppRouter()` 팩토리를 사용해야 합니다. 이 패키지가 호스트 동기화 양방향을 소유하며 애플리케이션 코드가 `router.afterEach`와 `@history` 연결을 재현하면 안 됩니다.

**확인:**
```typescript
import { createAppRouter } from '@wippy-fe/router'
import { config } from '@wippy-fe/proxy'
import { routes } from './routes'

const router = createAppRouter(routes, {
  initialPath: config.context?.route ?? '/',
})
```

호스트 URL이 여전히 업데이트되지 않는다면 현재 `@wippy-fe/router` 계열이 일관되게 설치되었는지, 로컬 래퍼가 팩토리를 대체하지 않는지 확인합니다. 호스트 없는 모드에서는 개발 오버레이 Monitor 탭에 패키지가 보고한 라우트가 표시됩니다.

## 로컬에서는 작동하지만 호스팅하면 실패함

**1. 선택 엔진의 상대 자산 해석 확인:**

iframe 전달에서는 다음을 검사합니다.

```javascript
document.baseURI  // should be <url>/<base_path>/ from your registry entry
```

잘못되었다면 `<base>` 태그가 올바르게 주입되지 않은 것입니다. `_index.yaml`의 `base_path`가 실제 빌드 출력 디렉터리 구조와 일치하는지 확인하세요.

Web Fragment 전달은 의도적으로 `<base>` 엘리먼트를 주입하지 않습니다. 대신 반영된 head와 body를 검사하세요. 상대 `href="./…"` 및 `src="./…"` 속성이 fragment gateway 자산 URL로 다시 작성되어 있어야 합니다.

**2. 프록시 전역 확인(내부 진단):**
```javascript
window.__WIPPY_PROXY_CONFIG__  // internal — must exist in iframe-hosted mode
```
undefined이면 앱 실행 전에 프록시가 주입되지 않은 것입니다. 애플리케이션 코드는 이를 직접 읽지 않습니다. [프록시 및 격리의 내부 항목](../web-host/proxy-isolation.md#내부-전용-읽거나-재정의하지-않기)을 참조하세요.

**3. vite.config.ts에서 `base: ''` 확인:**
이 설정이 없으면 Vite가 절대 자산 경로를 출력합니다. `/`에서 제공하는 로컬 개발 서버에서는 정상적으로 로드되지만 CDN 하위 디렉터리에서 제공할 때 404가 발생합니다.

**4. Import map 불일치:**
`fe_facade_url`에 고정된 Web Host 릴리스에서 `<version-tag>/import-map.json`을 다시 가져옵니다. 호스트 없는 `app.html`의 전체 `imports` 객체를 교체하고 그 모든 키에서 Vite externals를 다시 생성합니다. 호스트 없는 맵을 제거하거나 개별 항목만 패치하지 마세요. 새로 import한 정확한 지정자가 가져온 맵에 없을 때만 번들에 포함합니다.

## logger를 디버깅 도구로 사용

`logger.debug()`와 `logger.info()` 출력은 프로덕션 전송뿐 아니라 개발 중 브라우저 Console에도 나타납니다. 부팅 순서를 추적하는 데 사용하세요.

```typescript
import { logger, config, host, api } from '@wippy-fe/proxy'

export function createMainApp() {
  logger.debug('App bootstrap started')
  logger.debug('Host services resolved', { hasConfig: !!config })
  // ... use config, host, api directly
}
```

`logger.captureException(error)`도 개발 모드에서는 Console에 기록되고 프로덕션에서는 호스트 오류 캡처 시스템에 수집됩니다.
