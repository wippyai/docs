# Servidor HTTP

O servidor HTTP (`http.service`) escuta em uma porta e hospeda roteadores, endpoints e handlers de arquivos estáticos.

## Configuração

```yaml
- name: gateway
  kind: http.service
  addr: ":8080"
  timeouts:
    read: "5s"
    write: "30s"
    idle: "60s"
  host:
    buffer_size: 1024
    worker_count: 4
  lifecycle:
    auto_start: true
    security:
      actor:
        id: "http-gateway"
      policies:
        - app:http_policy
```

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `addr` | string | obrigatório | Endereço de escuta (`:8080`, `0.0.0.0:443`) |
| `timeouts.read` | duration | - | Timeout de leitura de requisição |
| `timeouts.write` | duration | - | Timeout de escrita de resposta |
| `timeouts.idle` | duration | - | Timeout de conexão keep-alive |
| `host.buffer_size` | int | 1024 | Tamanho do buffer de relay de mensagens |
| `host.worker_count` | int | NumCPU | Workers de relay de mensagens |

## Timeouts

Configure timeouts para prevenir exaustão de recursos:

```yaml
timeouts:
  read: "10s"    # Tempo máximo para ler headers da requisição
  write: "60s"   # Tempo máximo para escrever resposta
  idle: "120s"   # Timeout de keep-alive
```

- `read` - Curto (5-10s) para APIs, mais longo para uploads
- `write` - Corresponda ao tempo esperado de geração de resposta
- `idle` - Balance reutilização de conexão vs uso de recursos

<note>
Formato de duração: <code>30s</code>, <code>1m</code>, <code>2h15m</code>. Use <code>0</code> para desabilitar.
</note>

## Configuração do Host

A seção `host` configura o relay de mensagens interno do servidor usado por componentes como WebSocket relay:

```yaml
host:
  buffer_size: 2048
  worker_count: 8
```

| Campo | Padrão | Descrição |
|-------|--------|-----------|
| `buffer_size` | 1024 | Capacidade da fila de mensagens por worker |
| `worker_count` | NumCPU | Goroutines de processamento paralelo de mensagens |

<tip>
Aumente esses valores para aplicações WebSocket de alto throughput. O relay de mensagens trata entrega assíncrona entre componentes HTTP e processos.
</tip>

## Segurança

Servidores HTTP podem ter um contexto de segurança padrão aplicado através da configuração de ciclo de vida:

```yaml
lifecycle:
  auto_start: true
  security:
    actor:
      id: "gateway-service"
    policies:
      - app:http_access_policy
```

Isso define um ator e políticas base para todas as requisições. Para requisições autenticadas, o [middleware token_auth](http-middleware.md) sobrescreve o ator baseado no token validado, permitindo políticas de segurança por usuário.

## Ciclo de Vida

Servidores são gerenciados pelo supervisor:

```yaml
lifecycle:
  auto_start: true
  start_timeout: 30s
  stop_timeout: 60s
  depends_on:
    - app:database
```

| Campo | Descrição |
|-------|-----------|
| `auto_start` | Inicia quando a aplicação inicia |
| `start_timeout` | Tempo máximo de espera para servidor iniciar |
| `stop_timeout` | Tempo máximo para encerramento gracioso |
| `depends_on` | Inicia após essas entradas estarem prontas |

## Conectando Componentes

Roteadores e handlers estáticos referenciam o servidor via metadados:

```yaml
entries:
  - name: gateway
    kind: http.service
    addr: ":8080"

  - name: api
    kind: http.router
    meta:
      server: gateway
    prefix: /api

  - name: static
    kind: http.static
    meta:
      server: gateway
    path: /
    fs: app:public
```

## Múltiplos Servidores

Execute servidores separados para propósitos diferentes:

```yaml
entries:
  # API pública
  - name: public
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true

  # Admin (apenas localhost)
  - name: admin
    kind: http.service
    addr: "127.0.0.1:9090"
    lifecycle:
      auto_start: true
```

<warning>
Terminação TLS é tipicamente tratada por um proxy reverso (Nginx, Caddy, load balancer). Configure seu proxy para encaminhar ao servidor HTTP do Wippy.
</warning>

## Veja Também

- [Roteamento](http-router.md) - Roteadores e endpoints
- [Arquivos Estáticos](http-static.md) - Servindo arquivos estáticos
- [Middleware](http-middleware.md) - Middleware disponível
- [Segurança](system-security.md) - Políticas de segurança
- [Relay WebSocket](http-websocket-relay.md) - Mensagens WebSocket
