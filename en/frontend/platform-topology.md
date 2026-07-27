---
title: "Platform Topology"
description: "How Wippy frontend source becomes a routed page or web component and receives runtime context and CSS."
---

# Platform Topology

## Delivery chain

| Stage | Owner | Verification |
|---|---|---|
| Source and package build | Frontend module | The package build emits the expected entry file. |
| Artifact location | Deployment build target | The build command receives `--outDir`; Vite does not hardcode it. |
| Registry entry | Backend module | `view.page` or `view.component` points at the emitted entry. |
| Served URL | Filesystem and HTTP registry entries | A direct asset request returns the built JavaScript or HTML. |
| Runtime container | Web Host | A page uses `about:srcdoc`; a component uses a custom element, normally with shadow DOM. |
| Context | AppConfig and Wippy packages | Routing, API access, and theme data arrive through supported packages. |

The presence of source, a successful build, or a valid registry entry does not prove the next stage. Verify each boundary.

## Pages

A `view.page` runs in an `about:srcdoc` iframe. The iframe URL is not the host route. Do not inspect `window.location`, `window.parent.location`, or query parameters to discover host state. Use AppConfig and `@wippy-fe/router`; the package handles Wippy route integration.

The `iframe` CSS injection currently provides default themed scrollbar styling. Its name is historical and broader than its present purpose. Keep it enabled for scrollbar consistency; do not describe it as a layout reset.

## Web components

A `view.component` runs in the host document and normally owns a shadow root. CSS selectors do not cascade through a shadow boundary. The Web Host may deliver approved stylesheets and facade CSS into that root according to component configuration.

CSS variable inheritance and stylesheet injection are different mechanisms:

- Public inherited variables can cross the host-to-shadow boundary.
- Selector rules affect a shadow root only when delivered into that root.
- Delivery does not make an arbitrary selector a portable API.

## Theme and overlays

The facade supplies the PrimeVue theme. Shared `.p-*` rules in facade `custom_css` are valid theme implementation and may be global when intended for host and children. Use `.wippy-host-app` only for host-specific chrome.

Theme mode is AppConfig state, not a CSS-class API. Applications, components,
fixtures, and browser tests switch mode with
`host.setThemeMode('auto' | 'light' | 'dark')` from `@wippy-fe/proxy`, then wait
for `@theme` and verify `host.getThemeMode()`. AppConfig carries the change
through the host-to-child transport. The host updates its document,
re-broadcasts AppConfig to live `about:srcdoc` iframes, and mirrors the mode into
web-component roots. Never force `w-theme-dark` or `w-theme-light` classes
directly.

Never force `w-theme-dark` or `w-theme-light` classes directly.

PrimeVue overlays may be teleported. Verify the actual overlay root in the top document, iframe documents, and recursively discovered shadow roots. Do not assume generic PrimeVue placement.

## Runtime debugging order

1. Confirm the backend is listening.
2. Inspect backend logs for unexpected 5xx responses.
3. Confirm the registry owner and served asset URL.
4. Confirm the exact package build emitted that asset.
5. Load the host root before navigating through the SPA when direct deep links are unsupported.
6. Inspect console and network errors after navigation and interaction.
7. For theme scenarios, call the public proxy theme method, observe `@theme`,
   and verify `host.getThemeMode()` before accepting a screenshot.
