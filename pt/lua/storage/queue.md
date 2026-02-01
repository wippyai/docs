# Message Queue
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Publique e consuma mensagens de filas distribuidas. Suporta multiplos backends incluindo RabbitMQ e outros brokers compativeis com AMQP.

Para configuracao de fila, veja [Queue](system-queue.md).

## Carregamento

```lua
local queue = require("queue")
```

## Publicando Mensagens

Enviar mensagens para uma fila por ID:

```lua
local ok, err = queue.publish("app:tasks", {
    action = "send_email",
    user_id = 456,
    template = "welcome"
})
if err then
    return nil, err
end
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `queue_id` | string | Identificador da fila (formato: "namespace:name") |
| `data` | any | Dados da mensagem (tabelas, strings, numeros, booleans) |
| `headers` | table | Headers opcionais da mensagem |

**Retorna:** `boolean, error`

### Headers de Mensagem

Headers habilitam roteamento, prioridade e rastreamento:

```lua
queue.publish("app:notifications", {
    type = "order_shipped",
    order_id = order.id
}, {
    priority = "high",
    correlation_id = request_id
})
```

## Acessando Contexto de Entrega

Dentro de um consumer de fila, acessar a mensagem atual:

```lua
local msg, err = queue.message()
if err then
    return nil, err
end

local msg_id = msg:id()
local priority = msg:header("priority")
local all_headers = msg:headers()
```

**Retorna:** `Message, error`

Disponivel apenas ao processar mensagens de fila em contexto de consumer.

## Metodos de Message

| Metodo | Retorna | Descricao |
|--------|---------|-----------|
| `id()` | `string, error` | Identificador unico da mensagem |
| `header(key)` | `any, error` | Valor de header unico (nil se ausente) |
| `headers()` | `table, error` | Todos os headers da mensagem |

## Padrao de Consumer

Consumers de fila sao definidos como entry points que recebem o payload diretamente:

```yaml
entries:
  - kind: queue.consumer
    id: email_worker
    queue: app:emails
    method: handle_email
```

```lua
function handle_email(payload)
    local msg = queue.message()

    logger:info("Processing", {
        message_id = msg:id(),
        to = payload.to
    })

    local ok, err = email.send(payload.to, payload.template, payload.data)
    if err then
        return nil, err  -- Mensagem sera reenfileirada ou dead-lettered
    end
end
```

## Permissoes

Operacoes de fila estao sujeitas a avaliacao de politica de seguranca.

| Acao | Recurso | Descricao |
|------|---------|-----------|
| `queue.publish` | - | Permissao geral para publicar mensagens |
| `queue.publish.queue` | ID da Fila | Publicar em fila especifica |

Ambas as permissoes sao verificadas: primeiro a permissao geral, depois a especifica da fila.

## Erros

| Condicao | Tipo | Retentavel |
|----------|------|------------|
| ID da fila vazio | `errors.INVALID` | nao |
| Dados da mensagem vazios | `errors.INVALID` | nao |
| Sem contexto de entrega | `errors.INVALID` | nao |
| Permissao negada | `errors.PERMISSION_DENIED` | nao |
| Publicacao falhou | `errors.INTERNAL` | sim |

Veja [Error Handling](lua/core/errors.md) para trabalhar com erros.

## Veja Tambem

- [Queue Configuration](system/queue.md) - Drivers de fila e definicoes de entrada
- [Queue Consumers Guide](guides/queue-consumers.md) - Padroes de consumer e pools de workers
- [Process Management](lua/core/process.md) - Criacao de processos e comunicacao
- [Channels](lua/core/channel.md) - Padroes de comunicacao entre processos
- [Functions](lua/core/funcs.md) - Invocacao de funcoes assincronas
