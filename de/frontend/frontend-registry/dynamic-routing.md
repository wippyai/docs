---
title: "Dynamisches Routing"
description: "Wie der Web Host Backend-Mount-Routen registriert, Kindnavigation synchronisiert und Links zur Laufzeit klassifiziert."
---

# Dynamisches Routing

Der Web Host kombiniert statisch definierte Systemrouten mit Page-Mount-Routen, die er beim Start vom Backend abruft. Ein neuer `view.page`-Eintrag mit einer `mountRoute`-Angabe wird daher ohne Änderung des Web-Host-Bundles wirksam.

![Mount route sync](../diagrams/mountroute-sync.svg)

## Synchronisierung der Mount-Routen beim Start

Wenn die Web-Host-Anwendung initialisiert wird, ruft sie vor dem Rendern der Navigation Folgendes auf:

```
GET /api/public/pages/routes
```

Die Antwort ist ein Envelope `{ success, count, routes }`, wobei `routes` eine Map aus Mount-Routenmuster → Seiten-ID ist. Sie enthält auch verborgene beziehungsweise nicht angekündigte Seiten, die dennoch eine URL beanspruchen. Für jeden Eintrag registriert der Host eine Vue-Router-Route, die den deklarierten Pfad auf die Page-Loader-Komponente abbildet und als Kind der Elternroute `'app'` hinzufügt.

```typescript
// Simplified from the Web Host bootstrap
const { data } = await api.get('/api/public/pages/routes')
for (const [mountRoute, pageId] of Object.entries(data.routes)) {
  router.addRoute('app', {
    path: mountRoute,
    component: MountRoutePage,
    props: () => ({ pageId }),
  })
}
```

Danach rendert eine Navigation zu `/home/anything` die Seite `main` über ihre ausgewählte Engine; `/demo/anything` verhält sich für `iframe-demo` ebenso — ohne fest codiertes Wissen über diese Pfade im Host-Bundle.

## Einen Pfad mit `mountRoute` beanspruchen

Ein `view.page`-Eintrag beansprucht einen Host-Router-Pfad, indem er `mountRoute` im Block `meta` seiner `_index.yaml` setzt:

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
    mountRoute: /home/:part(.*)*
```

Das aktuelle Registry-Schema liest das erstellte Feld als `mountRoute`, speichert es intern in der Registry als `mount_route` und gibt in der API `mountRoute` aus. Verwenden Sie die oben gezeigte Lower-Camel-Case-Schreibweise.

`mountRoute` akzeptiert ausschließlich die Catch-all-Formen `/:part(.*)*` für den Root oder `/<literal-prefix>/:part(.*)*`. Das Präfix besteht aus mindestens einem literalen Segment aus Kleinbuchstaben, Ziffern und Bindestrichen und endet mit dem erforderlichen Wildcard-Segment `:part(.*)*`. Beliebige Vue-Router-Muster — benannte Parameter, benutzerdefinierte reguläre Ausdrücke oder andere Parameternamen wie `/home/:id` oder `/users/:userId(\d+)` — werden abgewiesen. Bei Backend-Einträgen vom Typ `view.page` führt `validate_mount_route_syntax` dazu, dass `GET /api/public/pages/routes` HTTP 500 zurückgibt; der Hoststart stoppt, bevor diese Einträge seinen Router erreichen. Nach einer erfolgreichen Antwort und dem Zusammenführen der Konfiguration validiert der Host die resultierende Routenmenge nochmals, einschließlich Syntax und Konflikten mit Systemrouten. Das Wildcard-Segment `:part(.*)*` erlaubt der Kindanwendung, eigene Unterrouten wie `/settings` oder `/profile/edit` zu verwalten, während der Host das Präfix `/home` besitzt.

Zwei Einträge dürfen nicht dieselbe Route beanspruchen. Beanspruchen zwei `view.page`-Einträge dieselbe `mountRoute`, trägt der Backend-Validator `validate_mount_routes` in `page_registry.lua` einen Konflikt durch eine doppelte Route in dieselbe Problemliste wie Syntaxfehler ein. `GET /api/public/pages/routes` gibt dann HTTP 500 zurück, der Hoststart stoppt und der Fehler wird über den Host-Error-Handler weitergegeben. Das Duplikat wird **nicht** stillschweigend ignoriert.

Zwischen einem Root-Catch-all (`/:part(.*)*`) und einer spezifischeren Systemroute (`chat`, `c`, `web`, `page`, `keeper`, `login`, `logout`) oder einem längeren Mount mit literalem Präfix gilt weiterhin die Auflösungspriorität von Vue Router: Die spezifischere Route trifft zu. Diese Priorität ist keine Behandlung doppelter Routen.

## URL-Synchronisierungsschleife

Nach dem Laden einer Seite in ihrem Laufzeitkontext navigiert die Kindanwendung intern mit ihrem eigenen Router. Der Host spiegelt diese Navigationen in seiner URL-Leiste, damit Zurück-Schaltfläche, Lesezeichen und kopierte URLs korrekt funktionieren. Die Proxy-Bridge synchronisiert beide Router für beide Page Engines.

![Frontend Registry](../diagrams/frontend-registry.svg)

### Kind → Host: `CmdRouteChanged`

Wenn der Router der Kindanwendung eine Navigation bestätigt, etwa von `/settings` nach `/profile` unter dem Mount `/home`, meldet er die interne Route über die Proxy-Bridge. Der iframe-Adapter postet an `window.parent`; der Fragment-Adapter leitet dasselbe Protokoll an sein erfasstes Hostfenster:

```typescript
// In the child application, on internal route change.
// App code must never post these messages directly — use the proxy API:
import { host } from '@wippy-fe/proxy'

host.onRouteChanged('/profile', navId)   // internal route only; the host prepends the mount prefix. navId is an optional number
```

Der Proxy serialisiert dies in einem internen Wire-Envelope. Dieses Protokoll ist keine Anwendungs-API: Kopieren Sie es nicht und rufen Sie `window.parent.postMessage` nicht direkt auf.

Der Message-Handler des Hosts fängt die Nachricht ab, ruft `router.push(path)` auf, um die URL-Leiste durch einen SPA-Routenwechsel ohne vollständiges Neuladen der Seite zu aktualisieren und dabei einen Eintrag im Browserverlauf hinzuzufügen, und sendet anschließend zurück:

### Host → Kind: `UrlWasUpdatedInParent`

Nachdem der Host seine URL-Leiste aktualisiert hat, gibt der Proxy `@history` an das Kind aus. `@wippy-fe/router` konsumiert dieses Ereignis und gleicht den Memory Router ab.

Der Host sendet die **interne** Route des Kinds zurück, also den Unterpfad hinter dem Mount-Präfix, nicht den vollständigen Hostpfad. Der Roundtrip ist dadurch symmetrisch: Das Kind sendet `internalRoute: '/profile'`, der Host setzt seine URL-Leiste auf `/home/profile` und gibt `path: '/profile'` zurück, das der Memory Router des Kinds unverändert übernimmt. Das Kind hört über den Ereigniskanal `@history` und behandelt dies als Bestätigung, dass die Host-URL mit seinem internen Zustand übereinstimmt.

Der Roundtrip hält Host-URL-Leiste, Kindrouter und Browserverlauf synchron, ohne dass der Host die interne Routingstruktur des Kinds kennen muss.

## `classifyLink`

In der iframe-Engine installiert `preventLinkClicks: true` einen Hook auf Dokumentebene, der rohe `<a>`-Klicks abfängt, bevor der Browser sie verarbeitet; siehe [view.page](./view-page.md). Der Web-Fragment-Adapter in Web Host 1.0.56 installiert diesen Hook für rohe Klicks nicht. Verwenden Sie für portable Vue-Navigation `AutoRouterLink` aus `@wippy-fe/router`; es ruft in beiden Engines dieselbe API `classifyLink` auf.

Der Klassifizierer gibt eines von vier Ergebnissen zurück:

| `LinkKind` | Bedingung | Aktion |
|------------|-----------|--------|
| `host-nav` | Oberstes Pfadsegment entspricht einem bekannten literalen `mountRoute`, einer integrierten Systemroute (`chat`, `c`, `web`, `page`, `keeper`, `login`, `logout`) oder einem Root-Mount-Catch-all | `preventDefault` + `host.navigate(normalizedPath)` |
| `child-nav` | Der Kindrouter löst den Pfad zu einer echten Route auf, die kein Catch-all ist, oder nichts anderes hat ihn beansprucht | Der Router der Unteranwendung entscheidet intern; der Host ruft **nicht** `preventDefault` auf und lädt den Seitenkontext nicht neu |
| `external` | Andere Origin oder ein Schema, das nicht `http` ist (`javascript`/`mailto`/`tel`/`sms`/`ftp`/`file`/`data`/`blob`) | Browserverhalten (zum Beispiel Öffnen in einem neuen Tab) |
| `ignore` | Leeres `href` oder reiner Hash (`#…`) | `preventDefault` |

Der Klassifizierer prüft zuerst den lokalen Router der Seite; ein Link, den das Kind selbst auflösen kann, bleibt dadurch anwendungsintern.

`classifyLink` verwendet dieselbe beim Start geladene Routenliste. Wenn der Kindrouter `/demo/step-2` nicht beansprucht, wird der Link als `host-nav` klassifiziert, weil `/demo/:part(.*)*` eine registrierte Mount-Route ist. Der Host navigiert zur Seite `iframe-demo`, statt die Seite vollständig neu zu laden.

Eine Kindanwendung muss andere Seiten des Systems daher nicht kennen. In einem iframe mit `preventLinkClicks: true` wird ein gewöhnliches `<a href="/demo/step-2">` abgefangen und klassifiziert. Verwenden Sie `AutoRouterLink`, wenn dieselbe Navigation in beiden Page Engines funktionieren muss.
