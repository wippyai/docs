# Middleware HTTP

Middleware processa requisicoes HTTP antes e depois do tratamento de rotas.

## Como Middleware Funciona

Middleware encapsula handlers HTTP para adicionar logica de processamento. Cada middleware recebe um mapa de opcoes e retorna um wrapper de handler:

```yaml
middleware:
  - cors
  - ratelimit
options:
  cors.allow.origins: "https://example.com"
  ratelimit.requests: "100"
```

Opcoes usam notacao de ponto: `nome_middleware.opcao.nome`. Formato legado com underscore e suportado para compatibilidade retroativa.

## Pre-Match vs Pos-Match

<tip>
<b>Pre-match</b> executa antes do match de rota - para preocupacoes transversais como CORS e compressao.
<b>Pos-match</b> executa apos a rota ser correspondida - para autorizacao que precisa de info da rota.
</tip>

```yaml
middleware:        # Pre-match
  - cors
  - compress
options:
  cors.allow.origins: "*"

post_middleware:   # Pos-match
  - endpoint_firewall
post_options:
  endpoint_firewall.action: "access"
```

---

## Middleware Disponivel

### CORS {#cors}

<note>Pre-match</note>

Cross-Origin Resource Sharing para requisicoes de navegador.

```yaml
middleware:
  - cors
options:
  cors.allow.origins: "https://app.example.com"
  cors.allow.credentials: "true"
```

| Opcao | Padrao | Descricao |
|-------|--------|-----------|
| `cors.allow.origins` | `*` | Origens permitidas (separadas por virgula, suporta `*.example.com`) |
| `cors.allow.methods` | `GET,POST,PUT,DELETE,OPTIONS,PATCH` | Metodos permitidos |
| `cors.allow.headers` | `Origin,Content-Type,Accept,Authorization,X-Requested-With` | Headers de requisicao permitidos |
| `cors.expose.headers` | - | Headers expostos ao cliente |
| `cors.allow.credentials` | `false` | Permite cookies/auth |
| `cors.max.age` | `86400` | Cache de preflight (segundos) |
| `cors.allow.private.network` | `false` | Acesso a rede privada |

Requisicoes OPTIONS preflight sao tratadas automaticamente.

---

### Rate Limiting {#ratelimit}

<note>Pre-match</note>

Rate limiting com token bucket e rastreamento por chave.

```yaml
middleware:
  - ratelimit
options:
  ratelimit.requests: "100"
  ratelimit.window: "1m"
  ratelimit.key: "ip"
```

| Opcao | Padrao | Descricao |
|-------|--------|-----------|
| `ratelimit.requests` | `100` | Requisicoes por janela |
| `ratelimit.window` | `1m` | Janela de tempo |
| `ratelimit.burst` | `20` | Capacidade de burst |
| `ratelimit.key` | `ip` | Estrategia de chave |
| `ratelimit.cleanup_interval` | `5m` | Frequencia de limpeza |
| `ratelimit.entry_ttl` | `10m` | Expiracao de entrada |
| `ratelimit.max_entries` | `100000` | Max chaves rastreadas |

**Estrategias de chave:** `ip`, `header:X-API-Key`, `query:api_key`

Retorna `429 Too Many Requests` com headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

---

### Compressao {#compress}

<note>Pre-match</note>

Compressao Gzip para respostas.

```yaml
middleware:
  - compress
options:
  compress.level: "default"
  compress.min.length: "1024"
```

| Opcao | Padrao | Descricao |
|-------|--------|-----------|
| `compress.level` | `default` | `fastest`, `default`, ou `best` |
| `compress.min.length` | `1024` | Tamanho minimo de resposta (bytes) |

Comprime apenas quando cliente envia `Accept-Encoding: gzip`.

---

### Real IP {#real_ip}

<note>Pre-match</note>

Extrai IP do cliente de headers de proxy.

```yaml
middleware:
  - real_ip
options:
  real_ip.trusted.subnets: "10.0.0.0/8,172.16.0.0/12"
```

| Opcao | Padrao | Descricao |
|-------|--------|-----------|
| `real_ip.trusted.subnets` | Redes privadas | CIDRs de proxies confiaveis |
| `real_ip.trust_all` | `false` | Confia em todas as fontes (inseguro) |

**Prioridade de header:** `True-Client-IP` > `X-Real-IP` > `X-Forwarded-For`

---

### Token Auth {#token_auth}

<note>Pre-match</note>

Autenticacao baseada em token. Veja [Seguranca](system-security.md) para configuracao de token store.

```yaml
middleware:
  - token_auth
options:
  token_auth.store: "app:tokens"
```

| Opcao | Padrao | Descricao |
|-------|--------|-----------|
| `token_auth.store` | obrigatorio | ID do registro do token store |
| `token_auth.header.name` | `Authorization` | Nome do header |
| `token_auth.header.prefix` | `Bearer ` | Prefixo do header |
| `token_auth.query.param` | `x-auth-token` | Fallback de parametro query |
| `token_auth.cookie.name` | `x-auth-token` | Fallback de cookie |

Define ator e escopo de seguranca no contexto para middleware downstream. Nao bloqueia requisicoes - autorizacao acontece em middleware de firewall.

---

### Metricas {#metrics}

<note>Pre-match</note>

Metricas HTTP estilo Prometheus. Sem opcoes de configuracao.

```yaml
middleware:
  - metrics
```

| Metrica | Tipo | Descricao |
|---------|------|-----------|
| `wippy_http_requests_total` | Counter | Total de requisicoes |
| `wippy_http_request_duration_seconds` | Histogram | Latencia de requisicao |
| `wippy_http_requests_in_flight` | Gauge | Requisicoes concorrentes |

---

### Firewall de Endpoint {#endpoint_firewall}

<warning>Pos-match</warning>

Autorizacao baseada no endpoint correspondido. Requer ator do `token_auth`.

```yaml
post_middleware:
  - endpoint_firewall
post_options:
  endpoint_firewall.action: "access"
```

| Opcao | Padrao | Descricao |
|-------|--------|-----------|
| `endpoint_firewall.action` | `access` | Acao de permissao a verificar |

Retorna `401 Unauthorized` (sem ator) ou `403 Forbidden` (permissao negada).

---

### Firewall de Recurso {#resource_firewall}

<warning>Pos-match</warning>

Protege recursos especificos por ID. Util no nivel de roteador.

```yaml
post_middleware:
  - resource_firewall
post_options:
  resource_firewall.action: "admin"
  resource_firewall.target: "app:admin-panel"
```

| Opcao | Padrao | Descricao |
|-------|--------|-----------|
| `resource_firewall.action` | `access` | Acao de permissao |
| `resource_firewall.target` | obrigatorio | ID do registro do recurso |

---

### Sendfile {#sendfile}

<note>Pre-match</note>

Serve arquivos via header `X-Sendfile` de handlers.

```yaml
middleware:
  - sendfile
options:
  sendfile.fs: "app:downloads"
```

Handler define headers para disparar servico de arquivo:

| Header | Descricao |
|--------|-----------|
| `X-Sendfile` | Caminho do arquivo dentro do filesystem |
| `X-File-Name` | Nome do arquivo para download |

Suporta requisicoes de range para downloads resumiveis.

---

### Relay WebSocket {#websocket_relay}

<warning>Pos-match</warning>

Retransmite conexoes WebSocket para processos. Veja [Relay WebSocket](http-websocket-relay.md).

```yaml
post_middleware:
  - websocket_relay
post_options:
  wsrelay.allowed.origins: "https://app.example.com"
```

---

## Ordem de Middleware

Middleware executa na ordem listada. Sequencia recomendada:

```yaml
middleware:
  - real_ip       # 1. Extrai IP real primeiro
  - cors          # 2. Trata preflight CORS
  - compress      # 3. Configura compressao de resposta
  - ratelimit     # 4. Verifica limites de taxa
  - metrics       # 5. Registra metricas
  - token_auth    # 6. Autentica requisicoes

post_middleware:
  - endpoint_firewall  # Autoriza apos match de rota
```

## Veja Tambem

- [Roteamento](http-router.md) - Configuracao de roteador
- [Seguranca](system-security.md) - Token stores e politicas
- [Relay WebSocket](http-websocket-relay.md) - Tratamento de WebSocket
- [Terminal](system-terminal.md) - Servico de terminal
