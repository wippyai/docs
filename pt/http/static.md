# Arquivos Estáticos

Serve arquivos estáticos de qualquer sistema de arquivos usando `http.static`. Handlers estáticos montam diretamente no servidor e podem servir SPAs, assets ou uploads de usuário de qualquer caminho.

## Configuração

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

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `meta.server` | ID do Registro | Servidor HTTP pai |
| `path` | string | Caminho de montagem URL (deve começar com `/`) |
| `fs` | ID do Registro | Entrada de sistema de arquivos para servir |
| `directory` | string | Subdiretório dentro do sistema de arquivos |
| `static_options.spa` | bool | Modo SPA - serve index para caminhos não correspondidos |
| `static_options.index` | string | Arquivo index (obrigatório quando spa=true) |
| `static_options.cache` | string | Valor do header Cache-Control |
| `middleware` | []string | Cadeia de middleware |
| `options` | map | Opções de middleware (notação de ponto) |

<tip>
Handlers estáticos podem ser montados em qualquer caminho no servidor. Múltiplos handlers podem coexistir - monte assets em <code>/static</code> e uma SPA em <code>/</code>.
</tip>

## Integração com Sistema de Arquivos

Arquivos estáticos são servidos de entradas de sistema de arquivos. Qualquer tipo de sistema de arquivos funciona:

```yaml
entries:
  # Diretório local
  - name: public
    kind: fs.directory
    directory: ./public

  # Handler estático
  - name: static
    kind: http.static
    meta:
      server: gateway
    path: /static
    fs: public
```

Requisição `/static/css/style.css` serve `./public/css/style.css`.

O campo `directory` seleciona um subdiretório dentro do sistema de arquivos:

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

| Requisição | Resposta |
|------------|----------|
| `/app.js` | Serve `app.js` (arquivo existe) |
| `/users/123` | Serve `index.html` (fallback SPA) |
| `/api/data` | Serve `index.html` (fallback SPA) |

<note>
Quando <code>spa: true</code>, o arquivo <code>index</code> é obrigatório. Arquivos existentes são servidos diretamente; todos os outros caminhos retornam o arquivo index.
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

Padrões comuns de cache:
- **Assets versionados**: `public, max-age=31536000, immutable`
- **HTML/index**: `public, max-age=0, must-revalidate`
- **Uploads de usuário**: `private, max-age=3600`

## Middleware

Aplique middleware para compressão, CORS ou outro processamento:

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

Middleware encapsula o handler estático em ordem - requisições passam por cada middleware antes de alcançar o servidor de arquivos.

<warning>
Match de caminho é baseado em prefixo. Um handler em <code>/</code> captura todas as requisições não correspondidas. Use roteadores para endpoints de API para evitar conflitos.
</warning>

## Veja Também

- [Servidor](http/server.md) - Configuração do servidor HTTP
- [Roteamento](http/router.md) - Roteadores e endpoints
- [Sistema de Arquivos](lua/storage/filesystem.md) - Módulo de sistema de arquivos
- [Middleware](http/middleware.md) - Middleware disponível
