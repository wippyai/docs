---
title: "Local CDN Assets"
description: "Configure local Iconify collections and font files with the Wippy CDN module family."
keywords:
  - CDN
  - Iconify
  - fonts
  - offline assets
---

> Draft for an unpublished local candidate. This page describes the current source contracts. It is not a released support guarantee.

The Wippy CDN module family stores validated icon collections and font files in the application. It lets a host serve selected assets from its own origin after setup. It does not make every frontend bundle or service offline-ready.

The family has three parts: wippy/cdn stores revisions and handles management, wippy/cdn-iconify serves the supported Iconify API subset, and wippy/cdn-fonts serves font metadata, CSS, and WOFF2 files. The modules serve data. The host or facade owns AppConfig and CSS settings. Installing the modules does not change online defaults, create a UI route, or add a navigation item.

## Bind the modules

Install wippy/cdn, wippy/cdn-iconify, and wippy/cdn-fonts. Bind the core database requirement to the application's existing SQL resource. The current implementation and its recovery queries support SQLite only. PostgreSQL support is unverified. Bind data_directory to a persistent writable volume outside artifact-managed output. Keep both resources stable across restarts. The database stores committed bytes, manifests, settings, and selections. The volume keeps manual source files and reconstructible serving data.

The writer process uses app:processes by default. The public adapter routers use app:gateway by default. Bind the management API to the host's existing token-authenticated router and set management_security_scope to an authorized group. The host must apply endpoint_firewall(access) to the full management scope, with deny rules taking precedence. Requests also require the exact wippy.cdn:management_access policy marker in their preserved request scope.

The adapters do not create another listener. The host controls whether and where to mount a management client. No UI route or navigation item is added automatically. Inspector and template integration is a separate later task.

## Store manual assets

The persistent data root uses these physical input paths:

    <cdn-data-root>/
      iconify/library/<prefix>.json
      fonts/library/<family-id>/
        fontset.json
        files/latin.woff2
        files/latin-ext.woff2
        notices/license.txt

For icons, write <prefix>.json.part, close it, then rename it to <prefix>.json. The final file must be a complete supported Iconify collection, and its prefix must match the filename.

For fonts, copy both WOFF2 faces and the complete OFL-1.1 notice, then write fontset.json last. The physical input manifest has only schemaVersion, id, metadata, and files at the top level. Each file entry has only path, size, and sha256. Its metadata describes the family and exactly two variable faces. The face paths in the input manifest are files/latin.woff2 and files/latin-ext.woff2. The core maps them to faces/latin.woff2 and faces/latin-ext.woff2 in its committed manifest. The committed manifest format is internal output and is not the physical input format. Use the exact sizes and lowercase SHA-256 digests of the copied files.

Each font face can be up to 20 MiB, the notice can be up to 1 MiB, and all three files together can be up to 100 MiB. The validator checks both WOFF2 files and requires the notice to be UTF-8 text that contains the expected OFL marker.

The core copies input bytes to private staging and validates the copied content before it can replace an active revision. It preserves the last committed valid revision and the original user files when an input is incomplete or invalid. The content-copy guarantee covers the validated copied bytes. It does not promise to detect every filesystem link encoding.

## Built-in assets

The Iconify adapter includes Tabler from @iconify/json 2.2.460, based on Tabler 3.41.1 with its MIT notice.

The fonts adapter includes Inter Variable and Outfit Variable with weights 100 to 900, and JetBrains Mono Variable with weights 100 to 800. Each has normal Latin and Latin-ext WOFF2 faces and an OFL-1.1 notice. The embedded defaults remain available without acquisition.

## Apply local providers explicitly

Product defaults stay online. To use the local Iconify endpoint for the default provider, set this in the host's AppConfig:

    {
      "iconify": {
        "providers": {
          "": {
            "resources": ["https://your-wippy-origin.example"],
            "path": "/cdn/iconify/"
          }
        }
      }
    }

Replace the origin with the application's public origin. Named Iconify providers use the same local-origin and path pattern. Do not add a public origin as fallback when the app must work offline. The CDN modules do not write this setting.

The local font service provides CSS at /cdn/fonts/<family-id>.css. Add the selected stylesheet through the existing host or facade CSS configuration that owns global, host, or child styles. The module does not overwrite those settings or change font-family declarations. Use the generated local CSS and inspect it before applying.

After changing the Iconify provider, importing or replacing icons, or changing the selected font, reload affected documents. Current Iconify clients keep icons in memory, so a live provider change may leave existing pages using cached results until reload.

## Read and manage assets

Iconify routes include GET /cdn/iconify/<prefix>.json?icons=<comma-separated-names>, /cdn/iconify/collections, /cdn/iconify/collection, /cdn/iconify/search, and /cdn/iconify/last-modified. This is a supported subset, not the full upstream API.

Font routes include GET /cdn/fonts/families, /cdn/fonts/<family-id>.css, /cdn/fonts/<family-id>/<revision>/stylesheet.css, and revision-qualified WOFF2 files.

Management paths are relative to the host's management router. GET /cdn/catalog/{kind} lists assets and selection tokens. GET /cdn/inputs/{kind} lists discovered manual inputs. GET /cdn/settings returns schemaVersion set to 1, the boolean fields acquisition_enabled, icon_search_enabled, and local_serving_enabled, and retained_bytes_limit as an integer from 33554432 to 1073741824 inclusive. PATCH /cdn/settings accepts a nonempty subset of those four setting fields and does not accept schemaVersion. POST /cdn/rescan requests a rescan. DELETE /cdn/revisions/{kind}/{id}/{revision} requires a JSON body with expected_selection_token copied from that asset's catalog selection_token, for example { "expected_selection_token": "<catalog UUID>" }. It deletes eligible inactive revisions and refuses active and previous revisions. Select, rollback, and deactivate requests do not accept expected_selection_token. SVG import and acquisition requests have their own fields. Acquisitions require version and may include base_revision plus expected_selection_token when updating an existing selection. These actions require the host's authorized management scope.

Mutations return 202 and an operation_id. Poll GET /cdn/operations/{operation_id} to read the final result. Catalog and revision listings use limit and cursor. An icon miss, ordinary read, input scan, panel opening, startup, or restart does not acquire an asset or contact a provider. Provider acquisition is an explicit management action, limited to the configured npm registry origin, with archive integrity checks and no package scripts.

## Limits and verification

Current code bounds include 32 MiB per Iconify collection, 100,000 icons and aliases combined, 128 icon names per request, 20 MiB per font face, 100 MiB per font distribution, and a 512 MiB and 10,000-entry manual scan. The retained_bytes_limit setting counts each unique SHA-256 digest once across committed revisions and staged candidates. Its range is 32 MiB to 1 GiB. It does not limit database file size or total filesystem use. Active and previous revisions are protected from deletion. The DELETE endpoint removes eligible inactive revisions and reclaims content that no longer has a committed or staged reference. Input beyond a supported bound is rejected without replacing the active revision.

The current implementation prunes terminal operation records after 30 days. This is a routine implementation choice, not an approved numeric retention limit.

The local source candidate is unpublished. It describes selected CDN asset behavior only. It does not establish that the complete application is offline-ready.

For related frontend configuration, see [Frontend Facade](../framework/facade) and [Web Host entry point](web-host/entry-point).
