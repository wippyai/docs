---
title: "Dynamisches Routing"
description: "Der Router des Web Hosts ist nicht statisch konfiguriert. Beim Start holt er die aktuelle Menge der Page-Mount-Routen vom Backend und fügt sie dem…"
---

# Dynamisches Routing

Der Router des Web Hosts ist nicht statisch konfiguriert. Beim Start holt er die aktuelle Menge der Page-Mount-Routen vom Backend und fügt sie der Vue-Router-Instanz hinzu. Das bedeutet, dass ein neuer `view.page`-Eintrag mit einem `mountRoute`-Anspruch wirksam wird, ohne dass sich das Web-Host-Bundle selbst ändert.

![Mount route sync](../diagrams/mountroute-sync.svg)

## Mount-Route-Sync beim Start

Wenn die Web-Host-Anwendung initialisiert wird, ruft sie auf, bevor sie irgendeine Navigation rendert:

```
GET /api/public/pages/routes
```

Die Antwort ist ein Envelope `{ success, count, routes }`, wobei `routes` eine Map von Mount-Route-Muster → Page-ID ist (sie enthält auch versteckte/nicht angekündigte Pages, die dennoch eine URL beanspruchen). Für jeden Eintrag registriert der Host eine Vue-Router-Route, die den deklarierten Pfad auf die Page-Loader-Komponente abbildet, und fügt sie als Child der Parent-Route `'app'` hinzu.

```typescript
// Vereinfacht aus dem Web-Host-Bootstrap
const { routes } = await api.get('/api/public/pages/routes')
for (const [mountRoute, pageId] of Object.entries(routes)) {
  router.addRoute('app', {
    path: mountRoute,
    component: MountRoutePage,
    props: () => ({ pageId }),
  })
}
```

Ab diesem Punkt führt die Navigation zu `/home/anything` dazu, dass der Router den iframe der Page `main` rendert, und die Navigation zu `/demo/anything` dazu, dass er den iframe der Page `iframe-demo` rendert — ohne dass das Host-Bundle diese Pfade fest verdrahtet kennt.

## Einen Pfad mit `mountRoute` beanspruchen

Ein `view.page`-Eintrag beansprucht einen Router-Pfad des Hosts, indem er `mountRoute` in seinem `meta`-Block in `_index.yaml` setzt:

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
    mountRoute: /home/:part(.*)*
    ...
```

`mountRoute` ist die aktuelle Kompatibilitätsschreibweise für einen
Groß-/Kleinschreibungsfehler im Backend. Der beabsichtigte Backend-Key ist
`mount_route`; schreiben Sie weiterhin `mountRoute`, bis die Backend-Korrektur
ausgeliefert wird.

`mountRoute` akzeptiert nur die Catch-all-Formen `/:part(.*)*` (Root) oder `/<literal-prefix>/:part(.*)*`, wobei der Präfix aus einem oder mehreren literalen Segmenten aus Kleinbuchstaben, Ziffern und Bindestrichen besteht und mit dem erforderlichen Platzhalter `:part(.*)*` endet. Beliebige Vue-Router-Muster — benannte Parameter, eigene reguläre Ausdrücke oder abweichende Parameternamen (z. B. `/home/:id`, `/users/:userId(\d+)`) — werden zurückgewiesen: Der Host meldet einen `syntax`-Mount-Route-Konflikt, das `validate_mount_route_syntax` des Backends schlägt fehl und `GET /api/public/pages/routes` liefert HTTP 500 (dargestellt als fataler Vollbildfehler). Das Platzhaltersegment `:part(.*)*` erlaubt es der Child-Anwendung, ihre eigenen Unterrouten zu verwalten (z. B. `/home/settings`, `/home/profile/edit`), während der Host den Präfix `/home` besitzt.

Zwei Einträge dürfen nicht dieselbe Route beanspruchen. Wenn zwei `view.page`-Einträge **dieselbe** `mountRoute` beanspruchen, trägt der Backend-Validator (`validate_mount_routes` in `page_registry.lua`) einen Duplicate-Route-Konflikt in dieselbe Issues-Liste ein wie Syntaxfehler, sodass `GET /api/public/pages/routes` HTTP 500 liefert und der Web Host ein fatales Vollbild-`<wippy-error>` rendert — genau wie bei einer fehlerhaften `mountRoute`. Es wird **nicht** stillschweigend ignoriert.

Das einzige First-wins-Verhalten ist die Laufzeitpriorität des Vue Routers zwischen einem Root-Catch-all (`/:part(.*)*`) und einer spezifischeren Systemroute (`chat`, `c`, `web`, `page`, `keeper`, `login`, `logout`) oder einem längeren Mount mit literalem Präfix — die spezifischere Route greift zuerst. Das ist Vorrang bei der Routenauflösung, keine Behandlung doppelter Routen.

## Die URL-Sync-Schleife

Sobald eine Page in ihrem iframe geladen ist, navigiert die Child-Anwendung intern mit ihrem eigenen Router. Diese internen Navigationen müssen sich in der URL-Leiste des Hosts widerspiegeln, damit der Zurück-Button des Browsers, Lesezeichen und das Kopieren der URL korrekt funktionieren. Das geschieht über ein PostMessage-Paar.

![Frontend Registry](../diagrams/frontend-registry.svg)

### Child → Host: `CmdRouteChanged`

Wenn der Router der Child-Anwendung eine Navigation abschließt (z. B. der Benutzer wechselt von `/home/settings` zu `/home/profile`), sendet das Child eine Nachricht an sein Parent-Window:

```typescript
// In der Child-Anwendung, bei internem Routenwechsel.
// App-Code darf diese Nachrichten nie direkt senden — nutzen Sie die Proxy-API:
import { host } from '@wippy-fe/proxy'

host.onRouteChanged('/profile', navId)   // nur interne Route; der Host stellt den Mount-Präfix voran. navId ist eine optionale Zahl
```

Der Proxy serialisiert das über einen internen Wire-Envelope. Dieses Protokoll ist keine Anwendungs-API: Kopieren Sie es nicht und rufen Sie `window.parent.postMessage` nicht direkt auf.

Der Message-Handler des Hosts fängt das ab, ruft `router.push(path)` auf, um die URL-Leiste über einen SPA-Routenwechsel zu aktualisieren (mit einem Eintrag in der Browser-History), ohne ein vollständiges Neuladen der Seite auszulösen, und sendet dann zurück:

### Host → Child: `UrlWasUpdatedInParent`

Nachdem der Host seine URL-Leiste aktualisiert hat, gibt der Proxy `@history` an das Child aus. `@wippy-fe/router` konsumiert dieses Event und gleicht den Memory-Router ab.

Der Host sendet die **interne** Route des Childs zurück (den Unterpfad nach dem Mount-Präfix), nicht den vollen Host-Pfad — der Rundlauf ist also symmetrisch: Das Child sendet `internalRoute: '/profile'`, der Host setzt seine URL-Leiste auf `/home/profile` und schickt `path: '/profile'` zurück, was der Memory-Router des Childs wortgetreu pusht. Das Child hört über den Event-Kanal `@history` mit und behandelt es als Bestätigung, dass die URL des Hosts nun mit seinem internen Zustand übereinstimmt.

Der Rundlauf hält die URL-Leiste des Hosts, den Child-Router und den Browser-History-Eintrag synchron, ohne dass der Host irgendetwas über die interne Routing-Struktur des Childs wissen muss.

## `classifyLink`

Wenn eine Page `preventLinkClicks: true` in ihren Proxy-Injections hat (siehe [view.page](./view-page.md)), fängt der Host Klicks auf `<a>` innerhalb des iframes ab, bevor der Browser sie behandelt. Jeder abgefangene Link wird an `classifyLink` übergeben, das entscheidet, wie damit umzugehen ist:

| `LinkKind` | Bedingung | Aktion |
|---|---|---|
| `host-nav` | Das oberste Pfadsegment passt zu einem bekannten `mountRoute`-Literal, zu einer eingebauten Systemroute (`chat`, `c`, `web`, `page`, `keeper`, `login`, `logout`) oder zu einem Root-Mount-Catch-all | `preventDefault` + `host.navigate(normalizedPath)` |
| `child-nav` | Der eigene Router des iframes löst den Pfad zu einer echten (Nicht-Catch-all-)Route auf, oder nichts anderes hat ihn beansprucht | Der `RouterLink` der Subapp entscheidet in-app; der Host ruft NICHT `preventDefault` auf und lädt den iframe NICHT neu |
| `external` | Anderer Origin oder ein Nicht-`http`-Schema (`javascript`/`mailto`/`tel`/`sms`/`ftp`/`file`/`data`/`blob`) | Browser-Standardverhalten (öffnet z. B. in einem neuen Tab) |
| `ignore` | Leeres `href` oder reiner Hash (`#…`) | `preventDefault` |

Der Klassifizierer prüft zuerst den lokalen Router des iframes, damit ein Link, den das Child selbst auflösen kann, in der App bleibt.

`classifyLink` zieht dieselbe Routenliste heran, die beim Start geholt wurde. Ein Link auf `/demo/step-2` wird als `host-nav` klassifiziert, weil `/demo/:part(.*)*` eine registrierte Mount-Route ist — der Host navigiert zur Page `iframe-demo`, statt die Seite vollständig neu zu laden.

Das bedeutet, dass eine Child-Anwendung nichts über andere Pages im System wissen muss. Sie kann gewöhnliche `<a href="/demo/step-2">`-Links rendern, und der Link-Klassifizierer des Hosts behandelt die Navigation korrekt.
