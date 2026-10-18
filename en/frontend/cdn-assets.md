---
title: "Local CDN Assets"
description: "Configure local Iconify collections and font files with the Wippy CDN module family."
keywords:
  - CDN
  - Iconify
  - fonts
  - offline assets
---

Host 1.0.64 is available from the Web Host CDN, and its 14 public npm packages are published as 0.0.64. Facade 0.6.45 and the private CDN module family 0.0.2 are published. Access to the private modules requires an authorized Hub account. The npm engine and Views fragment fix remain outside this release.

The Wippy CDN module family stores validated icon collections and font files in the application. It lets a host serve selected assets from its own origin after setup. It does not make every frontend bundle or service offline-ready.

The family has three parts: wippy/cdn stores revisions and handles management, wippy/cdn-iconify serves the supported Iconify API subset, and wippy/cdn-fonts serves font metadata, CSS, and WOFF2 files. CDN core owns saved source preferences and discovers installed CDN adapters. Facade discovers generic configuration contributors without depending on CDN modules. Installing the modules preserves online defaults and does not create an application route or navigation item.

## Bind the modules

All three CDN modules require `wippy/facade >=0.6.45`. Facade 0.6.45 selects Host 1.0.64 by default. Facade has no dependency on the CDN modules.

Install wippy/cdn, wippy/cdn-iconify, and wippy/cdn-fonts at version 0.0.2 using a Hub account with access to the private packages. Bind the core `database` requirement to `app:db`, `management_router` to `app:api`, and `management_security_scope` to `app.security:admin`. Bind `data_directory` to a persistent writable volume outside artifact-managed output. Keep these resources stable across restarts. The database stores committed bytes, manifests, settings, and selections. The volume keeps manual source files and reconstructible serving data.

CDN core uses those same database and protected management-router bindings for source choices. It contributes selected module settings through Facade's generic configuration hook. Applications need no extra Facade CDN bindings, source contract or resolver shim. The current CDN storage and recovery queries support SQLite only. PostgreSQL support is unverified.

After changing dependency declarations, run `wippy update wippy/facade wippy/cdn wippy/cdn-iconify wippy/cdn-fonts`. Wippy resolves the published versions, writes their hashes to `wippy.lock`, and installs the packages. Keep that generated lock file. The released packages were verified in an existing application on Wippy 0.3.49a without source replacements.

The writer process uses app:processes by default. The public adapter routers use app:gateway by default. Bind the management API to the host's existing token-authenticated router and set management_security_scope to an authorized group. The host must apply endpoint_firewall(access) to the full management scope, with deny rules taking precedence. Requests also require the exact wippy.cdn:management_access policy marker in their preserved request scope.

The adapters do not create another listener. The host controls whether and where to mount a management client. No UI route or navigation item is added automatically. Version 0.0.2 includes optional lazy Inspector components.

## Inspector configuration

The optional `wippy-cdn-admin` component discovers installed CDN modules from the protected management API. It displays General and the settings panels declared by those modules. The core does not keep a fixed list of Icons and Fonts tabs. A module panel loads when its tab is opened.

The application registers its own page and navigation item, then lazy-loads `wippy-cdn-admin` through the existing Wippy component loader. API requests use `api` from `@wippy-fe/proxy`, which gets the backend URL and authentication from AppConfig. The standard component needs no API-base or public-base attributes, including when the Host and API have different origins.

Source choices use the CDN core endpoint at `/api/v1/cdn-config/sources`. The `source-settings-api` attribute remains an optional relative compatibility override. CDN core discovers installed adapter functions and saves the complete source form with PUT. General settings also submit all three visible fields with PUT. Existing live Icons setting updates continue to use PATCH.

General shows the saved choices and the effective Facade configuration separately. A saved choice does not prove that an already open application tab has reloaded. Reload affected documents after changing source choices.

In Icons, choose Download set, search by collection name or ID, select a result, and choose Review available version. Review the exact version before choosing Download. To add SVG files, choose Add SVG and select a saved set or Create a new set. For a new set, enter a New set ID. Drop SVG files into the upload area or use Choose files. Each selection adds to the list; remove individual files or choose Remove all before importing. Files are not sent to the server until you choose Import icons. Confirm replacement separately for each existing icon name. The server validates copied SVG content before activation. Saved sets show local previews and revision controls.

The SVG importer accepts only `svg`, `g`, `defs`, `path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `linearGradient`, `radialGradient`, `stop`, `clipPath`, `mask`, and `use`. It also checks element nesting and attributes, and it permits local resource references only. It rejects unsupported elements and attributes, external resource references, DTDs, comments, and processing instructions. For example, `cellphone-arrow-down-twotone` from `@iconify-json/line-md` version `1.2.16` contains `<animate>` elements, so import rejects it as an unsupported SVG element. Use static artwork that fits the supported subset.

In Fonts, choose Add font files to import your own normal WOFF2 faces. Drop the files into the upload area or use Choose files, then enter a family name and stable family ID. For each face, review its character group, static weight or variable range, and Unicode coverage. Add the family’s OFL-1.1 notice. Files are sent only after you choose Upload fonts. The form creates the internal manifest; you do not need to write fontset.json. Uploading a family does not change the application’s source choices or font-family.

Uploads stage one file at a time and activate the family only after validation and a guarded commit. A failed upload preserves the previous active revision. Cancel upload cancels pending admission or removes staged files; it does not undo a completed commit. If a response is lost, keep the saved operation and use the same pending-upload controls to check or cancel it. Closing the dialog does not establish completion. Browser file contents are not saved in local storage, so after a reload you may need to cancel the pending upload and select the files again. Physical-folder imports remain available below.

In Fonts, choose Download family, search by family name or ID, select a result, and review an exact version before downloading. The provider download recipe remains two normal variable faces, Latin and Latin-ext, including Polish characters. It does not download every style or subset in a Fontsource package. Saved families include embedded and manually imported assets. Select a family to preview its local files at normal and bold weights. A preview does not change the application font. Check for update reviews an available version; rollback and deactivate manage the saved selection.

The Fonts panel provides a copyable import for the stable active-family stylesheet and a separate `font-family` declaration with the exact family name from font metadata. Put the `@import` before other CSS rules, then add the family declaration to the selectors you choose. The import follows the active revision, so updates and rollbacks do not require a new URL. Revision previews stay pinned to the selected revision. Fonts has no source selector and does not change application CSS automatically.

The collection and family lists are pinned local catalogs. Opening a panel or selecting a name does not download assets. Review available version makes a protected metadata request. Downloading is a separate action and requires Allow downloads in General. Actions show pending, saved, or failed status. If a status request fails, Check operation status retries the same operation without starting another download. Advanced details contains request IDs, hashes, and diagnostic details.

## Store manual assets

The persistent data root uses these physical input paths:

    <cdn-data-root>/
      iconify/library/<prefix>.json
      fonts/library/<family-id>/
        fontset.json
        files/<face-id>.woff2
        notices/license.txt

For icons, write <prefix>.json.part, close it, then rename it to <prefix>.json. The final file must be a complete supported Iconify collection, and its prefix must match the filename.

For fonts, copy one or more normal WOFF2 faces to `files/<face-id>.woff2`, add the OFL-1.1 notice at `notices/license.txt`, and write `fontset.json` last. The physical manifest has only `schemaVersion`, `id`, `metadata`, and `files` at the top level. Each `files` entry has only `path`, `size`, and lowercase `sha256`, and the scanned folder must contain exactly the manifest and its declared files. The `metadata` object has `family`, `style: "normal"`, `fontDisplay: "swap"`, `license: "OFL-1.1"`, and one `faces` entry for every WOFF2 file. Each face uses `id`, `path`, `style`, `weight`, `fontDisplay`, and `unicodeRange`; variable faces also use `axes`. The input path `files/<face-id>.woff2` becomes `faces/<face-id>.woff2` in the committed manifest. The committed manifest format is internal output, not the physical input format.

Face IDs are 1 to 64 lowercase letters, digits, and single hyphens. Each ID must start and end with a letter or digit, and cannot contain consecutive hyphens. Use the same ID in the face path and metadata. Static faces use a decimal weight string such as `"400"` and omit `axes`. Variable faces use a weight range such as `"100 900"` and matching `axes.wght.min` and `axes.wght.max` values. The validator checks the WOFF2 header and table directory. Static files cannot contain `fvar`; variable files must contain `fvar` and declare the supported `wght` axis. It does not decompress the font to verify numeric axis bounds, static weight or glyph coverage. Supply accurate declarations for the copied font files.

Declare a comma-separated Unicode range using `U+HEX` code points or `U+HEX-HEX` ranges. The validator checks the range syntax and writes it into generated CSS. Choose ranges that match the glyph coverage of each subset. The manifest has no field for a CSS URL or a `local()` fallback.

The face example below shows a static face and a variable face inside `metadata.faces`. Put one file entry in `files` for each face and one for the notice, using the real byte size and SHA-256 digest of each copied file.

    {
      "id": "latin-regular",
      "path": "files/latin-regular.woff2",
      "style": "normal",
      "weight": "400",
      "fontDisplay": "swap",
      "unicodeRange": "U+0000-00FF"
    }

    {
      "id": "latin-variable",
      "path": "files/latin-variable.woff2",
      "style": "normal",
      "weight": "100 900",
      "axes": { "wght": { "min": 100, "max": 900 } },
      "fontDisplay": "swap",
      "unicodeRange": "U+0100-02FF"
    }

Each WOFF2 face can be up to 20 MiB. The notice can be up to 1 MiB and must be UTF-8 text containing the OFL-1.1 marker. A distribution can contain at most 512 files total, including the notice, so it can have up to 511 faces. The combined distribution limit is 100 MiB.

The core copies input bytes to private staging and validates the copied content before it can replace an active revision. It preserves the last committed valid revision and the original user files when an input is incomplete or invalid. The content-copy guarantee covers the validated copied bytes. It does not promise to detect every filesystem link encoding.

## Built-in assets

The Iconify adapter includes Tabler from @iconify/json 2.2.460, based on Tabler 3.41.1 with its MIT notice.

The fonts adapter includes Inter Variable and Outfit Variable with weights 100 to 900, and JetBrains Mono Variable with weights 100 to 800. Each has normal Latin and Latin-ext WOFF2 faces and an OFL-1.1 notice. The embedded defaults remain available without acquisition.

## Choose where files load from

Product defaults stay online. After binding CDN core, open **CDN configuration**, then **General**, then **Where files load from** and choose **This server** for Icons. Save the source form, then reload open app tabs. The standard `wippy-cdn-admin` component uses the CDN core endpoint by default. You do not need to edit AppConfig or copy endpoint URLs.

CDN core saves source choices in its existing database. It discovers installed adapters and calls their module-owned local-source functions when a user selects **This server**. The Iconify adapter supplies and validates its local default provider. The CDN contribution preserves named providers and existing fallback settings. An explicit application Iconify override stays authoritative, while import-map entries use local defaults, then static configuration, then application overrides. Applications do not need a source contract or resolver shim.

Choosing **Internet** restores the Facade defaults. Installing a CDN module does not select it automatically. Before choosing **This server**, install the assets the application needs and keep **Serve saved files** on. Existing custom sources and fallback remain configured, so this choice alone does not guarantee that every request stays local.

Facade invokes registered configuration contributors while it builds AppConfig. CDN core contributes selected local settings, and the adapters provide asset serving and module-specific rules. Facade has no CDN-specific storage, routes or provider rules. Fonts users copy the stable stylesheet import and exact family name into the Facade or application CSS settings they already use. The module does not insert font CSS or choose selectors for the application.

### Custom hosts without the source settings integration

If a custom host does not use the source settings integration, its configuration owner can supply the local default Iconify provider directly in AppConfig:

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

Replace the origin with the application’s public origin. Named Iconify providers use the same origin and path pattern. Do not add an internet source as fallback when the application must work offline. This JSON is an alternative for hosts that configure Iconify directly.

The local font service provides CSS at `/cdn/fonts/<family-id>.css`. A custom host can load the stable stylesheet through its existing CSS configuration. Generated WOFF2 URLs are relative to each stylesheet, so they keep the application’s deployment path prefix. The font router allows cross-origin GET requests without credentials. For a page-level link, use `<link rel="stylesheet" href="https://app.example/cdn/fonts/<family-id>.css" crossorigin="anonymous">`. In CSS, put `@import url("https://app.example/cdn/fonts/<family-id>.css");` before other rules. Use the exact `metadata.family` value in the declaration for the selectors you choose. Do not paste the response CSS into AppConfig. The active stylesheet revalidates and follows updates or rollbacks; revision-qualified preview CSS and WOFF2 files remain immutable.

After changing source choices or importing, replacing, or selecting assets, reload affected documents. Current Iconify clients keep icons in memory, so existing pages may keep cached results until reload.

## Read and manage assets

Iconify routes include GET /cdn/iconify/<prefix>.json?icons=<comma-separated-names>, /cdn/iconify/collections, /cdn/iconify/collection, /cdn/iconify/search, and /cdn/iconify/last-modified. This is a supported subset, not the full upstream API.

Font routes include GET /cdn/fonts/families, /cdn/fonts/<family-id>.css, /cdn/fonts/<family-id>/<revision>/stylesheet.css, and revision-qualified WOFF2 files. The active-family stylesheet revalidates on access. Revision stylesheets and WOFF2 files use immutable cache headers. Reload open pages after changing or deleting a selected family.

`GET /cdn/fonts/families` accepts an optional `limit` from 1 to 256, defaulting to 256, and an optional exclusive family ID `cursor`. Pass a non-null `next_cursor` from the response as `cursor` in the next request, and continue until `next_cursor` is null. A page can contain fewer entries than requested when selected entries lack valid font metadata, because each request reads at most two 128-entry core pages.

Management paths are relative to the host's management router. GET /cdn/catalog/{kind} lists assets and selection tokens. GET /cdn/inputs/{kind} lists discovered manual inputs. GET /cdn/settings returns schemaVersion set to 1, the boolean fields acquisition_enabled, icon_search_enabled, and local_serving_enabled, and retained_bytes_limit as an integer from 33554432 to 1073741824 inclusive. PUT /cdn/settings replaces the three visible General fields as one complete form. The existing PATCH /cdn/settings route remains available for live Icons setting updates. PATCH accepts a nonempty subset of the four setting fields and does not accept schemaVersion. CDN source choices use their separate complete-form PUT endpoint. POST /cdn/rescan requests a rescan. DELETE /cdn/revisions/{kind}/{id}/{revision} requires a JSON body with expected_selection_token copied from that asset's catalog selection_token, for example { "expected_selection_token": "<catalog UUID>" }. It deletes eligible inactive revisions and refuses active and previous revisions.

To delete a custom asset and all its revisions, send DELETE /cdn/assets/{kind}/{id} with exactly one body field, expected_selection_token, copied from the current catalog entry. For example:

    DELETE /cdn/assets/fonts/<family-id>
    Content-Type: application/json

    { "expected_selection_token": "<selection_token>" }

The request returns 202 and an operation_id. Poll GET /cdn/operations/{operation_id} until the operation completes. The service removes the selection and then cleans up every revision. It refuses deletion while the manual source folder exists, for embedded assets, or while a related operation is active. Move or remove a manual source folder before deleting its asset. Select, rollback, and deactivate requests do not accept expected_selection_token. SVG import and acquisition requests have their own fields. Acquisitions require version and may include base_revision plus expected_selection_token when updating an existing selection. These actions require the host's authorized management scope.

Browser font uploads use protected routes under `/cdn/fonts/{id}/uploads`. Start with `POST` and JSON metadata containing `request_id`, `family`, `faces`, and `notice`. Each face declares its ID, weight, Unicode range, byte size, SHA-256 digest, and optional variable-axis bounds. The notice declares its size and digest. For an existing family, also send the current `base_revision` and `expected_selection_token`. The server creates the validated internal manifest.

Send each file to `POST /cdn/fonts/{id}/uploads/{candidate_id}/files/{index}?request_id=<UUID>` with `Content-Type: application/octet-stream`. Indices start at one; faces precede the notice. Commit with `POST /cdn/fonts/{id}/uploads/{candidate_id}/commit` and `{ "request_id": "<UUID>" }`, or cancel with `DELETE /cdn/fonts/{id}/uploads/{candidate_id}` and the same JSON shape. Generate a separate request ID before each phase, retain it when the response is uncertain, and reuse it only with that phase’s identical payload. Each request returns an operation receipt. A committed start or file operation confirms only that phase; only a successful commit operation confirms activation. Exact replays can return terminal receipts with HTTP 200. All routes preserve the host’s management authorization and bind candidate access to the specified font family.

Mutations normally return 202 and an operation_id. Poll GET /cdn/operations/{operation_id} to read the final result. Catalog and revision listings use limit and cursor. An icon miss, ordinary read, input scan, panel opening, startup, or restart does not acquire an asset or contact a provider. Provider acquisition is an explicit management action, limited to the configured npm registry origin, with archive integrity checks and no package scripts.

## Limits and verification

Current code bounds include 32 MiB per Iconify collection, 100,000 icons and aliases combined, 128 icon names per request, 20 MiB per font face, 100 MiB per font distribution, and a 512 MiB manual scan with separate limits of 10,000 files and 10,000 directories across both library roots, including the roots, and at most 20,000 child entries. The retained_bytes_limit setting counts each unique SHA-256 digest once across committed revisions and staged candidates. Its range is 32 MiB to 1 GiB. It does not limit database file size or total filesystem use. Active and previous revisions are protected from individual revision deletion. The revision endpoint removes eligible inactive revisions. The custom-asset endpoint permanently removes all revisions, including active and previous ones. Both reclaim content that no longer has a committed or staged reference. Input beyond a supported bound is rejected without replacing the active revision.

The current implementation prunes terminal operation records after 30 days. This is a routine implementation choice, not an approved numeric retention limit.

Offline use applies only to CDN assets that the host has selected for local serving. It does not mean that the rest of the application works without a network connection.

For related frontend configuration, see [Frontend Facade](../framework/facade) and [Web Host entry point](web-host/entry-point).
