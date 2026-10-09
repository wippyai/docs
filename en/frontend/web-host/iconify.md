---
title: "Iconify providers"
description: "Configure online Iconify sources or an explicit local collection for the Web Host."
---

# Iconify providers

The Web Host uses online Iconify sources by default. Configure `AppConfig.iconify.providers` only when the deployment needs a different source. The local Tabler collection described here is an explicit option for offline deployments. It does not change the default source.

## Configure a provider

`providers` is keyed by Iconify provider ID. Use the empty key (`""`) for the built-in provider, or a lowercase hyphenated ID for a named provider. Each value contains a non-empty ordered `resources` array of HTTP(S) origins. The Host tries those origins in order. It does not add a public source to the configured array.

```ts
interface IconifyConfig {
  providers?: Record<string, {
    resources: string[]
    path?: string
    timeout?: number
  } | null> | null
}
```

`path` defaults to `/` and is normalized with leading and trailing slashes. `timeout` defaults to 5000 milliseconds and accepts a positive integer up to 60000. Resource values are origins. Do not include credentials, a query, a fragment, or a base path.

## How to work with Wippy offline

An offline deployment must serve its own copy of the collection. The public Web Host CDN is an online host and does not make the application or its other services available offline. The Host release includes a complete static Tabler Iconify JSON collection at `iconify/tabler.json`. Copy that asset to a server reachable by the browser, then set the provider origin and path explicitly.

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

For local testing, serve the Host build output so `dist/iconify/tabler.json` is available at `/iconify/tabler.json`. The configured resource is an origin, and `path` supplies the endpoint directory. In a deployed environment, serve the asset from an origin and versioned path that you control:

```ts
const deploymentConfig = { iconify: { providers: { "": {
  resources: ["https://wippy-host.internal"],
  path: "/webcomponents-<host-release>/iconify/",
} } } }
```

Replace `<host-release>` with the pinned Host release used by the deployment. The server must return the JSON file with an `application/json` content type and allow browser requests from the application origin. Iconify sends an `?icons=...` query for selected names. The static mirror ignores that query and returns the full collection. Icon search is unsupported.

The collection is based on Tabler 3.41.1, distributed under MIT, by Paweł Kuna. Its metadata declares 6092 icons; the pinned source contains 6140 icon definitions and 184 aliases. The verified source SHA-256 is `cf18f905479c5ca5d0be13217e17d240deea3c457b70b2ae84bcaa0d5a98a51c`.

### Serve the mirror correctly

The static server is part of the offline setup. It must return the file as `application/json`, allow requests from the application origin with CORS, compress JSON when the browser accepts compression, and return a real 404 for a missing collection. Do not cache a missing file as a successful response. Versioned paths can use immutable caching; if you use an unversioned path, require revalidation with `ETag` or `Last-Modified`.

This Nginx example assumes files are laid out as `/srv/wippy/host/webcomponents-<host-release>/iconify/tabler.json`, the application uses exactly the origin shown below, and TLS certificates are configured elsewhere. Replace the origin and root with your deployment values. This snippet does not install Nginx modules or configure TLS:

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

For an unversioned path, replace the immutable cache policy with a revalidation policy such as `Cache-Control: no-cache` and enable an `ETag` or `Last-Modified` validator. Before relying on the mirror, confirm that the deployed server actually compresses JSON, applies the expected cache policy, and returns the correct CORS, MIME, and missing-file responses.

## Named providers and icon names

Use a named provider when different icon namespaces use different origins or paths:

```ts
const config = {
  iconify: {
    providers: {
      tenant: {
        resources: ["https://icons.example.internal"],
        path: "/tenant/",
      },
    },
  },
}
```

Reference a named provider with `@provider:prefix:name`. The Vue component and the custom element use the same Iconify name:

```vue
<script setup lang="ts">
import { Icon } from '@iconify/vue'
</script>

<template>
  <Icon icon="@tenant:tabler:home" />
  <iconify-icon icon="@tenant:tabler:settings"></iconify-icon>
</template>
```

The provider covers icon collection requests only. It does not make application APIs, fonts, other assets, or all Kickside resources available offline.

## Reset and update behavior

When `iconify` is omitted from the initial config, online defaults are used. Omitting it from a later update leaves the current Iconify config unchanged. `iconify: null` or `providers: null` resets the whole section to online built-ins and removes configured named providers. Setting the empty provider's value to `null` resets only the built-in provider. A named provider set to `null` disables that namespace. Omitted provider keys keep their current routes, and an empty `providers` object does not reset them.

The validator accepts only `providers`, and provider entries accept only `resources`, `path`, and `timeout`. An invalid initial section is ignored and leaves online defaults active. An invalid update keeps the last valid Iconify section while other valid AppConfig fields can still update. `timeout` sets one logical-request deadline shared by all configured origins. Each failover attempt uses the remaining time from that same deadline.

Only a byte-for-byte match for the pinned Tabler collection is recognized as a full-collection response, and only when Web Crypto SHA-256 is available. That response is cached by endpoint URL with the query removed. Other collection responses are cached by their full query URL. Without `crypto.subtle` (as can happen on insecure HTTP origins), the adapter uses query-scoped caching and the Iconify store can still use its native per-icon cache. The combined adapter caches hold at most 32 URL entries. Replacing a collection at the same URL does not clear cached responses, resolved icons, or negative icon results; start a fresh browser realm to load the replacement. Transport or invalid-response failures try the next configured origin. A valid response that lacks the requested icon is reported as not found.

The `iconifyIcons` setting controls whether the Host loads and registers the `<iconify-icon>` custom element. It does not control provider sources. Explicitly configured Iconify data is projected to child applications through AppConfig. The schema migration accepts `wippy-context-2.0` and `wippy-context-2.1` input and upgrades it to `wippy-context-2.2`. See [Bootstrap sequence](./bootstrap.md), [CSS injection](./css-injection.md), [Proxy API](../micro-frontends/proxy-api.md), and [Facade](../../framework/facade.md).

## Provider trust and updates

Use only provider origins you trust. The page renders icon bodies as SVG markup. Parent `SetConfig` updates must include the current `$schema` value, `wippy-context-2.2`, to use current validation. A provider change affects icons that have not loaded yet; cached responses and already rendered icons are not cleared. Open a fresh document to verify a replacement provider.
