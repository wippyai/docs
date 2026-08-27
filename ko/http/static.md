---
title: "정적 파일"
description: "filesystem entry와 http.static을 사용해 SPA, asset 및 user upload를 제공합니다."
---

# 정적 파일

`http.static` handler는 server에 직접 mount되어 filesystem entry의 SPA, asset 또는 user upload를 제공합니다.

**분류: static-handler reference.** YAML block은 지정된 HTTP server가 존재한다고 가정합니다. host-authored example에서 relative `fs.directory` path는 project working directory에서 resolve됩니다. module-owned entry는 `base: project`로 구성하지 않으면 owning module의 source root에서 relative path를 resolve합니다. referenced file은 별도로 생성해야 합니다.

## 설정

```yaml
- name: static
  kind: http.static
  meta:
    server: gateway
  path: /
  fs: app:public
  static_options:
    spa: true
    index: index.html
    cache: "public, max-age=3600"
```

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `meta.server` | 레지스트리 ID | 부모 HTTP 서버 |
| `path` | string | URL 마운트 경로 (`/`로 시작해야 함) |
| `fs` | 레지스트리 ID | 서빙할 파일시스템 엔트리 |
| `static_options.spa` | bool | SPA 모드 - 매칭되지 않는 경로에 인덱스 서빙 |
| `static_options.index` | string | 인덱스 파일 (`spa=true`일 때 필수) |
| `static_options.cache` | string | Cache-Control 헤더 값 |
| `middleware` | []string | 미들웨어 체인 |
| `options` | map | 미들웨어 옵션 (점 표기법) |

<tip>
정적 핸들러는 서버의 모든 경로에 마운트할 수 있습니다. 여러 핸들러가 공존할 수 있습니다—에셋은 <code>/static</code>에, SPA는 <code>/</code>에 마운트하세요.
</tip>

## 파일시스템 통합

정적 파일은 파일시스템 엔트리에서 서빙됩니다. 모든 파일시스템 타입이 작동합니다:

```yaml
entries:
  # Local directory
  - name: public
    kind: fs.directory
    directory: ./public

  # Static handler
  - name: static
    kind: http.static
    meta:
      server: gateway
    path: /static
    fs: public
```

`/static/css/style.css` 요청은 `./public/css/style.css`를 서빙합니다.

subdirectory를 제공하려면 해당 위치를 root로 하는 filesystem entry를 `fs` reference로 지정합니다. 예를 들어 `fs.directory`의 `directory:`를 subdirectory로 설정합니다.

```yaml
entries:
  - name: content
    kind: fs.directory
    directory: ./app/documentation/html

  - name: docs
    kind: http.static
    meta:
      server: gateway
    path: /docs
    fs: content
```

## SPA 모드

Single Page Application은 클라이언트 사이드 라우팅을 위해 모든 라우트에서 동일한 인덱스 파일을 서빙해야 합니다:

```yaml
- name: spa
  kind: http.static
  meta:
    server: gateway
  path: /
  fs: app:frontend
  static_options:
    spa: true
    index: index.html
```

| 요청 | 응답 |
|---------|----------|
| `/app.js` | `app.js` 서빙 (파일 존재) |
| `/users/123` | `index.html` 서빙 (SPA 폴백) |
| `/api/data` | `index.html` 서빙 (SPA 폴백) |

<note>
<code>spa: true</code>일 때 <code>index</code> 파일이 필수입니다. 존재하는 파일은 직접 서빙되고, 다른 모든 경로는 인덱스 파일을 반환합니다.
</note>

## 캐시 제어

다양한 에셋 타입에 적절한 캐싱 설정:

```yaml
entries:
  - name: app_fs
    kind: fs.directory
    directory: ./dist

  # Versioned assets - cache forever
  - name: assets
    kind: http.static
    meta:
      server: gateway
    path: /assets
    fs: app_fs
    static_options:
      cache: "public, max-age=31536000, immutable"

  # HTML - short cache, must revalidate
  - name: app
    kind: http.static
    meta:
      server: gateway
    path: /
    fs: app_fs
    static_options:
      spa: true
      index: index.html
      cache: "public, max-age=0, must-revalidate"
```

일반적인 캐시 패턴:
- **버전화된 에셋**: `public, max-age=31536000, immutable`
- **HTML/인덱스**: `public, max-age=0, must-revalidate`
- **사용자 업로드**: `private, max-age=3600`

## 미들웨어

압축, CORS, 또는 기타 처리를 위해 미들웨어 적용:

```yaml
- name: static
  kind: http.static
  meta:
    server: gateway
  path: /
  fs: app:public
  middleware:
    - compress
    - cors
  options:
    compress.level: "best"
    cors.allow.origins: "*"
```

미들웨어는 순서대로 정적 핸들러를 래핑합니다. 요청은 파일 서버에 도달하기 전에 각 미들웨어를 통과합니다.

<warning>
경로 매칭은 프리픽스 기반입니다. <code>/</code>의 핸들러는 모든 매칭되지 않은 요청을 잡습니다. 충돌을 피하기 위해 API 엔드포인트에는 라우터를 사용하세요.
</warning>

## 참고

- [서버](./server.md) - HTTP server configuration
- [라우팅](./router.md) - router 및 endpoint
- [파일시스템](../lua/storage/filesystem.md) - Filesystem module
- [미들웨어](./middleware.md) - available middleware
