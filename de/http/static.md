# Statische Dateien

Stellen Sie statische Dateien aus jedem Dateisystem mit `http.static` bereit. Statische Handler mounten direkt auf dem Server und können SPAs, Assets oder Benutzer-Uploads aus jedem Pfad bereitstellen.

## Konfiguration

```yaml
- name: static
  kind: http.static
  meta:
    server: gateway
  path: /
  fs: app:public
  directory: dist
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
| `directory` | string | Unterverzeichnis innerhalb des Dateisystems |
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
  # Lokales Verzeichnis
  - name: public
    kind: fs.directory
    directory: ./public

  # Statischer Handler
  - name: static
    kind: http.static
    meta:
      server: gateway
    path: /static
    fs: public
```

Anfrage `/static/css/style.css` stellt `./public/css/style.css` bereit.

Das `directory`-Feld wählt ein Unterverzeichnis innerhalb des Dateisystems aus:

```yaml
- name: docs
  kind: http.static
  meta:
    server: gateway
  path: /docs
  fs: app:content
  directory: documentation/html
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

  # Versionierte Assets - für immer cachen
  - name: assets
    kind: http.static
    meta:
      server: gateway
    path: /assets
    fs: app_fs
    directory: assets
    static_options:
      cache: "public, max-age=31536000, immutable"

  # HTML - kurzer Cache, muss revalidiert werden
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

Middleware umhüllt den statischen Handler in Reihenfolge - Anfragen durchlaufen jede Middleware bevor sie den Datei-Server erreichen.

<warning>
Pfad-Matching ist präfixbasiert. Ein Handler auf <code>/</code> fängt alle nicht gematchten Anfragen ab. Verwenden Sie Router für API-Endpunkte um Konflikte zu vermeiden.
</warning>

## Siehe auch

- [Server](http-server.md) - HTTP-Server-Konfiguration
- [Routing](http-router.md) - Router und Endpunkte
- [Dateisystem](lua-fs.md) - Dateisystem-Modul
- [Middleware](http-middleware.md) - Verfügbare Middleware
