---
title: "Middleware HTTP"
---

# Middleware HTTP

Middleware processa requisições HTTP antes e depois do tratamento de rotas.

## Como Middleware Funciona

Middleware encapsula handlers HTTP para adicionar lógica de processamento. Cada middleware recebe um mapa de opções e retorna um wrapper de handler:

```yaml
middleware:
  - cors
  - ratelimit
options:
  cors.allow.origins: "https://example.com"
  ratelimit.requests: "100"
```

Opções usam notação de ponto: `nome_middleware.opcao.nome`. Formato legado com underscore é suportado para compatibilidade retroativa.

## Pre-Match vs Pós-Match

<tip>
<b>Pre-match</b> executa antes do match de rota - para preocupações transversais como CORS e compressão.
<b>Pós-match</b> executa após a rota ser correspondida - para autorização que precisa de info da rota.
</tip>

```yaml
middleware:        # Pre-match
  - cors
  - compress
options:
  cors.allow.origins: "*"

post_middleware:   # Pós-match
  - endpoint_firewall
post_options:
  endpoint_firewall.action: "access"
```

---

## Middleware Disponível

### CORS {#cors}

<note>Pre-match</note>

Cross-Origin Resource Sharing para requisições de navegador.

```yaml
middleware:
  - cors
options:
  cors.allow.origins: "https://app.example.com"
  cors.allow.credentials: "true"
```

| Opção | Padrão | Descrição |
|-------|--------|-----------|
| `cors.allow.origins` | `*` | Origens permitidas (separadas por vírgula, suporta `*.example.com`) |
| `cors.allow.methods` | `GET,POST,PUT,DELETE,OPTIONS,PATCH` | Métodos permitidos |
| `cors.allow.headers` | `Origin,Content-Type,Accept,Authorization,X-Requested-With` | Headers de requisição permitidos |
| `cors.expose.headers` | - | Headers expostos ao cliente |
| `cors.allow.credentials` | `false` | Permite cookies/auth |
| `cors.max.age` | `86400` | Cache de preflight (segundos) |
| `cors.allow.private.network` | `false` | Acesso a rede privada |

Requisições OPTIONS preflight são tratadas automaticamente.

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

| Opção | Padrão | Descrição |
|-------|--------|-----------|
| `ratelimit.requests` | `100` | Requisições por janela |
| `ratelimit.window` | `1m` | Janela de tempo |
| `ratelimit.burst` | `20` | Capacidade de burst |
| `ratelimit.key` | `ip` | Estratégia de chave |
| `ratelimit.cleanup_interval` | `5m` | Frequência de limpeza |
| `ratelimit.entry_ttl` | `10m` | Expiração de entrada |
| `ratelimit.max_entries` | `100000` | Max chaves rastreadas |

**Estratégias de chave:** `ip`, `header:X-API-Key`, `query:api_key`

Retorna `429 Too Many Requests` com headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

---

### Compressão {#compress}

<note>Pre-match</note>

Compressão Gzip para respostas.

```yaml
middleware:
  - compress
options:
  compress.level: "default"
  compress.min.length: "1024"
```

| Opção | Padrão | Descrição |
|-------|--------|-----------|
| `compress.level` | `default` | `fastest`, `default`, ou `best` |
| `compress.min.length` | `1024` | Tamanho mínimo de resposta (bytes) |

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

| Opção | Padrão | Descrição |
|-------|--------|-----------|
| `real_ip.trusted.subnets` | Redes privadas | CIDRs de proxies confiáveis |
| `real_ip.trust_all` | `false` | Confia em todas as fontes (inseguro) |

**Prioridade de header:** `True-Client-IP` > `X-Real-IP` > `X-Forwarded-For`

---

### Token Auth {#token_auth}

<note>Pre-match</note>

Autenticação baseada em token. Veja [Segurança](system/security.md) para configuração de token store.

```yaml
middleware:
  - token_auth
options:
  token_auth.store: "app:tokens"
```

| Opção | Padrão | Descrição |
|-------|--------|-----------|
| `token_auth.store` | obrigatório | ID do registro do token store |
| `token_auth.header.name` | `Authorization` | Nome do header |
| `token_auth.header.prefix` | `Bearer ` | Prefixo do header |
| `token_auth.query.param` | `x-auth-token` | Fallback de parâmetro query |
| `token_auth.cookie.name` | `x-auth-token` | Fallback de cookie |

Define ator e escopo de segurança no contexto para middleware downstream. Não bloqueia requisições - autorização acontece em middleware de firewall.

---

### Métricas {#metrics}

<note>Pre-match</note>

Métricas HTTP estilo Prometheus. Sem opções de configuração.

```yaml
middleware:
  - metrics
```

| Métrica | Tipo | Descrição |
|---------|------|-----------|
| `wippy_http_requests_total` | Counter | Total de requisições |
| `wippy_http_request_duration_seconds` | Histogram | Latência de requisição |
| `wippy_http_requests_in_flight` | Gauge | Requisições concorrentes |

---

### Firewall de Endpoint {#endpoint_firewall}

<warning>Pós-match</warning>

Autorização baseada no endpoint correspondido. Requer ator do `token_auth`.

```yaml
post_middleware:
  - endpoint_firewall
post_options:
  endpoint_firewall.action: "access"
```

| Opção | Padrão | Descrição |
|-------|--------|-----------|
| `endpoint_firewall.action` | `access` | Ação de permissão a verificar |

Retorna `401 Unauthorized` (sem ator) ou `403 Forbidden` (permissão negada).

---

### Firewall de Recurso {#resource_firewall}

<warning>Pós-match</warning>

Protege recursos específicos por ID. Útil no nível de roteador.

```yaml
post_middleware:
  - resource_firewall
post_options:
  resource_firewall.action: "admin"
  resource_firewall.target: "app:admin-panel"
```

| Opção | Padrão | Descrição |
|-------|--------|-----------|
| `resource_firewall.action` | `access` | Ação de permissão |
| `resource_firewall.target` | obrigatório | ID do registro do recurso |

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

Handler define headers para disparar serviço de arquivo:

| Header | Descrição |
|--------|-----------|
| `X-Sendfile` | Caminho do arquivo dentro do filesystem |
| `X-File-Name` | Nome do arquivo para download |

Suporta requisições de range para downloads resumíveis.

---

### Relay WebSocket {#websocket_relay}

<warning>Pós-match</warning>

Retransmite conexões WebSocket para processos. Veja [Relay WebSocket](http/websocket-relay.md).

```yaml
post_middleware:
  - websocket_relay
post_options:
  wsrelay.allowed.origins: "https://app.example.com"
```

---

### Relay SSE {#sse_relay}

<warning>Post-match</warning>

Transmite Server-Sent Events de processos. Veja [Server-Sent Events](http/sse.md).

```yaml
post_middleware:
  - sse_relay
post_options:
  sserelay.allowed.origins: "https://app.example.com"
```

---

### OpenTelemetry {#otel}

<warning>Pre-match</warning>

Registra spans e métricas OpenTelemetry para requisições recebidas. Registrado automaticamente quando OTel está habilitado; caso contrário atua como no-op.

```yaml
middleware:
  - otel
```

Não aceita opções. Funciona junto com o middleware `metrics`; habilite ambos quando precisar de contadores Prometheus e traces OTel.

---

## Ordem de Middleware

Middleware executa na ordem listada. Sequência recomendada:

```yaml
middleware:
  - real_ip       # 1. Extrai IP real primeiro
  - cors          # 2. Trata preflight CORS
  - compress      # 3. Configura compressão de resposta
  - ratelimit     # 4. Verifica limites de taxa
  - metrics       # 5. Registra métricas
  - token_auth    # 6. Autentica requisições

post_middleware:
  - endpoint_firewall  # Autoriza após match de rota
```

## Veja Também

- [Roteamento](http/router.md) - Configuração de roteador
- [Segurança](system/security.md) - Token stores e políticas
- [Relay WebSocket](http/websocket-relay.md) - Tratamento de WebSocket
- [Server-Sent Events](http/sse.md) - Streaming SSE
- [Terminal](system/terminal.md) - Serviço de terminal
