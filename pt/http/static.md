# Arquivos Estaticos

Serve arquivos estaticos de qualquer sistema de arquivos usando `http.static`. Handlers estaticos montam diretamente no servidor e podem servir SPAs, assets ou uploads de usuario de qualquer caminho.

## Configuracao

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

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `meta.server` | ID do Registro | Servidor HTTP pai |
| `path` | string | Caminho de montagem URL (deve comecar com `/`) |
| `fs` | ID do Registro | Entrada de sistema de arquivos para servir |
| `directory` | string | Subdiretorio dentro do sistema de arquivos |
| `static_options.spa` | bool | Modo SPA - serve index para caminhos nao correspondidos |
| `static_options.index` | string | Arquivo index (obrigatorio quando spa=true) |
| `static_options.cache` | string | Valor do header Cache-Control |
| `middleware` | []string | Cadeia de middleware |
| `options` | map | Opcoes de middleware (notacao de ponto) |

<tip>
Handlers estaticos podem ser montados em qualquer caminho no servidor. Multiplos handlers podem coexistir - monte assets em <code>/static</code> e uma SPA em <code>/</code>.
</tip>

## Integracao com Sistema de Arquivos

Arquivos estaticos sao servidos de entradas de sistema de arquivos. Qualquer tipo de sistema de arquivos funciona:

```yaml
entries:
  # Diretorio local
  - name: public
    kind: fs.directory
    directory: ./public

  # Handler estatico
  - name: static
    kind: http.static
    meta:
      server: gateway
    path: /static
    fs: public
```

Requisicao `/static/css/style.css` serve `./public/css/style.css`.

O campo `directory` seleciona um subdiretorio dentro do sistema de arquivos:

```yaml
- name: docs
  kind: http.static
  meta:
    server: gateway
  path: /docs
  fs: app:content
  directory: documentation/html
```

## Modo SPA

Single Page Applications precisam que todas as rotas sirvam o mesmo arquivo index para roteamento client-side:

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

| Requisicao | Resposta |
|------------|----------|
| `/app.js` | Serve `app.js` (arquivo existe) |
| `/users/123` | Serve `index.html` (fallback SPA) |
| `/api/data` | Serve `index.html` (fallback SPA) |

<note>
Quando <code>spa: true</code>, o arquivo <code>index</code> e obrigatorio. Arquivos existentes sao servidos diretamente; todos os outros caminhos retornam o arquivo index.
</note>

## Controle de Cache

Defina cache apropriado para diferentes tipos de assets:

```yaml
entries:
  - name: app_fs
    kind: fs.directory
    directory: ./dist

  # Assets versionados - cache para sempre
  - name: assets
    kind: http.static
    meta:
      server: gateway
    path: /assets
    fs: app_fs
    directory: assets
    static_options:
      cache: "public, max-age=31536000, immutable"

  # HTML - cache curto, deve revalidar
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

Padroes comuns de cache:
- **Assets versionados**: `public, max-age=31536000, immutable`
- **HTML/index**: `public, max-age=0, must-revalidate`
- **Uploads de usuario**: `private, max-age=3600`

## Middleware

Aplique middleware para compressao, CORS ou outro processamento:

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

Middleware encapsula o handler estatico em ordem - requisicoes passam por cada middleware antes de alcancar o servidor de arquivos.

<warning>
Match de caminho e baseado em prefixo. Um handler em <code>/</code> captura todas as requisicoes nao correspondidas. Use roteadores para endpoints de API para evitar conflitos.
</warning>

## Veja Tambem

- [Servidor](http-server.md) - Configuracao do servidor HTTP
- [Roteamento](http-router.md) - Roteadores e endpoints
- [Sistema de Arquivos](lua-fs.md) - Modulo de sistema de arquivos
- [Middleware](http-middleware.md) - Middleware disponivel
