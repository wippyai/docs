---
title: "Iconify 공급자"
description: "Web Host의 온라인 Iconify 소스 또는 명시적 로컬 컬렉션을 구성합니다."
---

# Iconify 공급자

Web Host는 기본적으로 온라인 Iconify 소스를 사용합니다. 배포에 다른 소스가 필요할 때만 `AppConfig.iconify.providers`를 구성하세요. 이 페이지의 로컬 Tabler 컬렉션은 오프라인 배포를 위한 명시적 선택 사항이며 기본 소스를 바꾸지 않습니다.

## 공급자 구성

`providers`는 Iconify 공급자 ID를 키로 사용합니다. 빈 키(`""`)는 기본 공급자에 사용하고, 이름이 있는 공급자에는 소문자와 하이픈으로 된 ID를 사용합니다. 각 값에는 비어 있지 않은 순서형 HTTP(S) origin 배열 `resources`가 필요합니다. Host는 순서대로 origin을 시도하며 공개 소스를 배열에 추가하지 않습니다.

```ts
interface IconifyConfig {
  providers?: Record<string, {
    resources: string[]
    path?: string
    timeout?: number
  } | null> | null
}
```

`path`의 기본값은 `/`이며 앞뒤 슬래시가 있도록 정규화됩니다. `timeout`의 기본값은 5000밀리초이며 60000 이하의 양의 정수를 받습니다. 리소스 값은 origin이어야 합니다. 인증 정보, 쿼리, fragment, base path는 포함하지 마세요.

## 오프라인에서 Wippy 사용하기

오프라인 배포에서는 브라우저가 접근할 수 있는 서버에 컬렉션 사본을 직접 제공해야 합니다. 공개 Web Host CDN은 온라인 호스트이며 앱이나 다른 서비스를 오프라인으로 제공하지 않습니다. Host 릴리스에는 전체 정적 Tabler Iconify JSON이 `iconify/tabler.json`에 포함됩니다.

```ts
const config = {
  iconify: {
    providers: {
      "": {
        resources: ["http://localhost:5173"],
        path: "/iconify/",
      },
    },
  },
}
```

로컬 테스트에서는 Host 빌드 결과를 제공해 `dist/iconify/tabler.json`을 `/iconify/tabler.json`으로 접근할 수 있게 합니다. 배포에서는 직접 관리하는 origin과 버전 경로를 사용하세요.

```ts
const deploymentConfig = { iconify: { providers: { "": { resources: ["https://wippy-host.internal"], path: "/webcomponents-<host-release>/iconify/" } } } }
```

`<host-release>`를 고정 Host 릴리스로 바꾸세요. 서버는 `application/json`으로 JSON을 반환하고 앱 origin의 브라우저 요청을 허용해야 합니다. Iconify는 `?icons=...`를 보내며 정적 미러는 쿼리를 무시하고 전체 컬렉션을 반환합니다. 검색은 지원하지 않습니다. 이 컬렉션은 MIT 라이선스 Tabler 3.41.1이며 작성자는 Paweł Kuna입니다. 메타데이터는 6092개를 선언하고 고정 원본은 아이콘 정의 6140개와 별칭 184개를 포함합니다. SHA-256: `cf18f905479c5ca5d0be13217e17d240deea3c457b70b2ae84bcaa0d5a98a51c`.

### 미러를 올바르게 제공하기

정적 서버 설정도 오프라인 구성의 일부입니다. 파일을 `application/json`으로 반환하고, 앱 origin의 브라우저 요청을 CORS로 허용하고, 브라우저가 지원하면 JSON을 압축하고, 컬렉션이 없으면 실제 404를 반환해야 합니다. 없는 파일을 성공 응답처럼 캐시하지 마세요. 버전 경로는 변경 불가 캐시를 사용할 수 있습니다. 버전이 없는 경로는 `ETag` 또는 `Last-Modified`를 사용해 재검증해야 합니다.

다음 Nginx 예시는 파일이 `/srv/wippy/host/webcomponents-<host-release>/iconify/tabler.json`에 있고, 앱 origin이 아래와 정확히 일치하며, TLS 인증서는 이 설정 조각 바깥에서 구성되었다고 가정합니다. 배포 값으로 바꾸세요. 이 조각은 Nginx 모듈을 설치하거나 TLS를 구성하지 않습니다.

```nginx
server {
    location ~ ^/webcomponents-[^/]+/iconify/ {
        root /srv/wippy/host;
        default_type application/json;
        add_header Access-Control-Allow-Origin "https://app.example.com" always;
        add_header Vary Origin always;
        add_header Cache-Control "public, max-age=31536000, immutable";
        gzip on;
        gzip_types application/json;
        gzip_vary on;
        try_files $uri =404;
    }
}
```

버전이 없는 경로에서는 변경 불가 캐시 정책을 `Cache-Control: no-cache` 같은 재검증 정책으로 바꾸고 `ETag` 또는 `Last-Modified`를 사용하세요. 미러를 사용하기 전에 배포 서버가 JSON을 실제로 압축하고 예상한 캐시, CORS, MIME 응답과 파일 누락 시 404를 반환하는지 확인하세요.

## 이름 있는 공급자와 아이콘 이름

이름 있는 공급자는 `@provider:prefix:name` 형식을 사용합니다. Vue와 사용자 지정 요소가 같은 이름을 사용합니다.

```ts
const namedConfig = { iconify: { providers: { tenant: { resources: ["https://icons.example.internal"], path: "/tenant/" } } } }
```

```vue
<script setup lang="ts">
import { Icon } from '@iconify/vue'
</script>

<Icon icon="@tenant:tabler:home" />
<iconify-icon icon="@tenant:tabler:settings"></iconify-icon>
```

이 소스는 아이콘 컬렉션 요청만 지원합니다. 앱 API, 폰트, 다른 Kickside 자산은 별도로 오프라인 지원이 필요합니다.

## 재설정 및 업데이트

초기 config에서 `iconify`를 생략하면 온라인 기본값을 사용합니다. 이후 update에서 생략하면 현재 Iconify config를 유지합니다. `iconify: null` 또는 `providers: null`은 전체 설정을 온라인 기본값으로 재설정하고 이름 있는 공급자를 제거합니다. 빈 키의 `null`은 기본 공급자만 재설정합니다. 이름 있는 공급자의 `null`은 해당 namespace를 비활성화합니다. 생략한 키는 현재 경로를 유지하며 빈 `providers` 객체는 재설정하지 않습니다.

검증기는 `providers`와 `resources`, `path`, `timeout`만 허용합니다. 잘못된 초기 값은 무시하고 잘못된 업데이트는 마지막 유효 설정을 유지합니다. `timeout`은 구성된 모든 origin이 공유하는 하나의 논리 요청 기한입니다. 각 failover 시도는 동일한 기한의 남은 시간을 사용합니다. 고정 Tabler 컬렉션과 바이트 단위로 일치하고 Web Crypto SHA-256을 사용할 수 있을 때만 전체 컬렉션 응답으로 인식합니다. 해당 응답은 쿼리를 제거한 endpoint URL을 키로 저장합니다. 그 외 응답은 쿼리를 포함한 전체 URL로 저장합니다. 안전하지 않은 HTTP 등으로 `crypto.subtle`을 사용할 수 없으면 adapter는 쿼리별 캐시를 사용하며 Iconify store의 아이콘별 native cache는 계속 사용할 수 있습니다. adapter 캐시의 합산 한도는 URL 32개입니다. 같은 URL의 컬렉션을 바꿔도 저장된 응답, 이미 해석된 아이콘, negative 결과는 지워지지 않습니다. 교체된 컬렉션을 불러오려면 새 브라우저 컨텍스트를 시작하세요. 전송 오류나 잘못된 응답은 다음 origin을 시도하고, 유효한 응답에 아이콘이 없으면 not found로 반환합니다. `iconifyIcons`는 `<iconify-icon>` 사용자 지정 요소를 불러오고 등록하며 소스를 선택하지 않습니다. 명시 설정은 AppConfig를 통해 하위 앱에 전달됩니다. Schema 2.0과 2.1은 2.2로 마이그레이션됩니다. [부트스트랩 순서](./bootstrap.md), [CSS 주입](./css-injection.md), [Proxy API](../micro-frontends/proxy-api.md), [Facade](../../framework/facade.md)를 참조하세요.

## Provider trust and updates

신뢰할 수 있는 provider origin만 사용하세요. 페이지는 아이콘 본문을 SVG 마크업으로 렌더링합니다. 현재 검증을 적용하려면 부모의 `SetConfig` 업데이트에 현재 `$schema` 값인 `wippy-context-2.2`가 포함되어야 합니다. provider 변경은 아직 로드되지 않은 아이콘에 적용됩니다. 캐시된 응답과 이미 렌더링된 아이콘은 지워지지 않습니다. 변경을 확인하려면 새 문서를 여세요.
