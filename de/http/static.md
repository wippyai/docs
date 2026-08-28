---
title: "Statische Dateien"
description: "SPAs, Assets und Benutzer-Uploads mit http.static aus Dateisystemeinträgen bereitstellen."
---

# Statische Dateien

Ein `http.static`-Handler wird direkt auf einem Server eingebunden und stellt SPAs, Assets oder Benutzer-Uploads aus einem Dateisystemeintrag bereit.

**Klassifikation: Referenz für statische Handler.** Die YAML-Blöcke setzen voraus, dass der genannte HTTP-Server existiert. In diesen vom Host definierten Beispielen werden relative Pfade von `fs.directory` ausgehend vom Arbeitsverzeichnis des Projekts aufgelöst. Einträge im Besitz eines Moduls lösen relative Pfade dagegen vom Quellstamm des besitzenden Moduls aus auf, sofern nicht `base: project` konfiguriert ist. Die referenzierten Dateien müssen separat erstellt werden.

## Konfiguration

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

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `meta.server` | Registry-ID | Übergeordneter HTTP-Server |
| `path` | string | URL-Mount-Pfad (muss mit `/` beginnen) |
| `fs` | Registry-ID | Dateisystem-Eintrag zum Bereitstellen |
| `static_options.spa` | bool | SPA-Modus - Index für nicht gematchte Pfade bereitstellen |
| `static_options.index` | string | Index-Datei (erforderlich wenn spa=true) |
| `static_options.cache` | string | Cache-Control-Header-Wert |
| `middleware` | []string | Middleware-Kette |
| `options` | map | Middleware-Optionen (Punkt-Notation) |

<tip>
Statische Handler können auf jedem Pfad des Servers gemountet werden. Mehrere Handler können koexistieren - mounten Sie Assets auf <code>/static</code> und eine SPA auf <code>/</code>.
</tip>

## Dateisystem-Integration

Statische Dateien werden aus Dateisystem-Einträgen bereitgestellt. Jeder Dateisystemtyp funktioniert:

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

Anfrage `/static/css/style.css` stellt `./public/css/style.css` bereit.

Um ein Unterverzeichnis bereitzustellen, verweisen Sie mit `fs` auf einen dort verwurzelten Dateisystemeintrag, beispielsweise auf ein `fs.directory`, dessen `directory` auf das Unterverzeichnis gesetzt ist:

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

## SPA-Modus

Single Page Applications benötigen, dass alle Routen dieselbe Index-Datei für clientseitiges Routing bereitstellen:

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

| Anfrage | Response |
|---------|----------|
| `/app.js` | Stellt `app.js` bereit (Datei existiert) |
| `/users/123` | Stellt `index.html` bereit (SPA-Fallback) |
| `/api/data` | Stellt `index.html` bereit (SPA-Fallback) |

<note>
Wenn <code>spa: true</code>, ist die <code>index</code>-Datei erforderlich. Existierende Dateien werden direkt bereitgestellt; alle anderen Pfade geben die Index-Datei zurück.
</note>

## Cache-Control

Setzen Sie angemessenes Caching für verschiedene Asset-Typen:

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

Gängige Cache-Muster:

- **Versionierte Assets**: `public, max-age=31536000, immutable`
- **HTML/Index**: `public, max-age=0, must-revalidate`
- **Benutzer-Uploads**: `private, max-age=3600`

## Middleware

Wenden Sie Middleware für Komprimierung, CORS oder andere Verarbeitung an:

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

Middleware umschließt den statischen Handler in der angegebenen Reihenfolge — Anfragen durchlaufen jede Middleware, bevor sie den Dateiserver erreichen.

<warning>
Der Pfadabgleich ist präfixbasiert. Ein Handler unter <code>/</code> fängt alle nicht abgeglichenen Anfragen ab. Verwenden Sie Router für API-Endpunkte, um Konflikte zu vermeiden.
</warning>

## Siehe auch

- [Server](http/server.md) – HTTP-Server-Konfiguration
- [Routing](http/router.md) – Router und Endpunkte
- [Dateisystem](lua/storage/filesystem.md) – Dateisystemmodul
- [Middleware](http/middleware.md) – Verfügbare Middleware
