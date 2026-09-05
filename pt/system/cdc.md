---
title: "Change Data Capture"
description: "Faça streaming de mudanças em nível de linha a partir da replicação lógica do Postgres ou do SQLite com db.cdc.postgres e db.cdc.sqlite."
---

# Change Data Capture

Faça streaming de mudanças em nível de linha a partir de um banco de dados. Uma fonte CDC captura inserções, atualizações e exclusões, opcionalmente entrega antes a cada assinante um snapshot consistente das linhas existentes, e entrega tudo como eventos de mudança neutros em relação ao driver. As fontes são endereçáveis pelo seu ID de entrada e consumidas a partir de Lua via o [módulo `cdc`](lua/storage/cdc.md).

## Tipos de Entradas

| Tipo | Descrição |
|------|-------------|
| `db.cdc.postgres` | Replicação lógica do Postgres (plugin `pgoutput`) |
| `db.cdc.sqlite` | Escritas do SQLite observadas através de um recurso `db.sql.sqlite` |

Ambos os tipos expõem a mesma API Lua, o mesmo registro de informações da fonte e o mesmo formato de evento de mudança. O que difere é o conjunto de garantias, publicado por fonte como [capacidades](#capabilities).

## Configuração do Postgres

```yaml
- name: pg_cdc
  kind: db.cdc.postgres
  host: ${env:DB_HOST}
  port: 5432
  database: app
  username: ${env:DB_USER}
  password: ${env:app.secrets:db_password}
  slot_name: wippy_slot
  publication: wippy_pub
  tables:
    - public.users
    - public.orders
  snapshot: true
  streaming: true
  standby_interval: "10s"
  status_interval: "10s"
  lifecycle:
    auto_start: true
```

| Campo | Tipo | Padrão | Descrição |
|-------|------|---------|-------------|
| `host` | string | obrigatório | Host do Postgres |
| `port` | int | obrigatório | Porta do Postgres (deve ser > 0) |
| `database` | string | obrigatório | Nome do banco de dados |
| `username` | string | obrigatório | Usuário de replicação (deve ter o privilégio `REPLICATION`) |
| `password` | string | obrigatório | Senha (inline ou `${env:NAME}`) |
| `slot_name` | string | obrigatório | Nome do slot de replicação lógica |
| `publication` | string | - | Publicação do Postgres; obrigatória quando `tables` está vazio |
| `tables` | []string | - | Tabelas a capturar (`schema.table`); omita para usar as tabelas da publicação |
| `snapshot` | bool | false | Padrão da entrada para a entrega de snapshot por assinante |
| `streaming` | bool | false | Usa a versão de streaming do protocolo `pgoutput` |
| `temporary` | bool | false | Usa um slot de replicação temporário (removido na desconexão) |
| `failover` | bool | false | Habilita o modo de slot de failover (mutuamente exclusivo com `temporary`) |
| `standby_interval` | duration | - | Intervalo das mensagens de status de standby (ex.: `10s`) |
| `status_interval` | duration | - | Intervalo de atualização de status enviado ao servidor |
| `snapshot_fetch_size` | int | - | Linhas buscadas por lote de snapshot (deve ser >= 0) |
| `max_transaction_changes` | int | 1000000 | Máximo de mudanças em buffer durante a decodificação de uma transação |
| `max_transaction_bytes` | int | 268435456 | Máximo de bytes lógicos em buffer durante a decodificação de uma transação (256 MiB) |
| `max_inflight_changes` | int | 1000000 | Máximo de mudanças mantidas em todas as transações em andamento |
| `max_inflight_bytes` | int | 268435456 | Máximo de bytes lógicos mantidos em todas as transações em andamento (256 MiB) |
| `subscriptions` | object | - | Limites de admissão de assinaturas, veja [Limites de Assinatura](#subscription-limits) |
| `options` | map | - | Opções extras de conexão |
| `lifecycle` | object | - | Configuração de ciclo de vida |

Zero em qualquer campo `max_*` seleciona o padrão; o decodificador nunca é ilimitado. Valores negativos são rejeitados.

As credenciais resolvem os placeholders `${env:NAME}` através do [registro de ambiente](system/env.md) no momento da decodificação.

## Configuração do SQLite

Uma fonte SQLite não abre seu próprio banco de dados. Ela toma emprestado um recurso [`db.sql.sqlite`](system/database.md) existente e assina o observador de mutações confirmadas desse recurso, capturando assim exatamente as escritas feitas através daquele recurso SQL do Wippy — escritas por outro processo, outra conexão ou uma ferramenta externa não são observadas.

```yaml
- name: cdcdb
  kind: db.sql.sqlite
  file: /var/data/app.db
  lifecycle:
    auto_start: true

- name: changes
  kind: db.cdc.sqlite
  db_resource: app:cdcdb
  tables:
    - users
    - orders
  snapshot: true
  status_interval: "30s"
  lifecycle:
    auto_start: true
```

| Campo | Tipo | Padrão | Descrição |
|-------|------|---------|-------------|
| `db_resource` | string | obrigatório | ID de entrada do recurso `db.sql.sqlite` a observar |
| `name` | string | - | Aceito; o nome da fonte é sempre o ID da entrada |
| `tables` | []string | - | Tabelas a capturar; omita para todas as tabelas |
| `snapshot` | bool | false | Padrão da entrada para a entrega de snapshot por assinante |
| `status_interval` | duration | `30s` | Intervalo de atualização de status |
| `subscriptions` | object | - | Limites de admissão de assinaturas, veja [Limites de Assinatura](#subscription-limits) |
| `lifecycle` | object | - | Configuração de ciclo de vida |

A fonte declara o recurso SQL como um requisito de ciclo de vida, então o supervisor inicia o banco de dados primeiro e reinicia a fonte quando a geração do banco de dados é substituída.

<note>
A captura no SQLite exige um runtime construído com a build tag <code>sqlite_preupdate_hook</code>. As builds oficiais a incluem. Sem a tag, o driver falha fechado: criar uma entrada <code>db.cdc.sqlite</code> retorna <code>sqlite cdc requires the sqlite_preupdate_hook build tag</code> em vez de iniciar uma fonte que não captura nada.
</note>

## Limites de Assinatura

Cada fonte admite um número limitado de assinantes e reserva antecipadamente o backlog de pior caso deles. Um slot de snapshot permanece reservado até que o stream com snapshot habilitado seja fechado.

```yaml
subscriptions:
  max_subscriptions: 1024
  max_snapshot_subscriptions: 4
  max_bytes: 268435456
```

| Campo | Tipo | Padrão | Descrição |
|-------|------|---------|-------------|
| `max_subscriptions` | int | 1024 | Assinaturas concorrentes admitidas pela fonte |
| `max_snapshot_subscriptions` | int | 4 | Assinaturas concorrentes com snapshot habilitado |
| `max_bytes` | int | 268435456 | Total de bytes de backlog de assinantes reservados (256 MiB) |

Zero seleciona o padrão; valores negativos são rejeitados. Esgotar um limite faz a assinatura falhar com um `errors.UNAVAILABLE` passível de nova tentativa.

## Como Funciona

1. Uma fonte Postgres conecta-se como usuário de replicação e cria (ou retoma) o slot nomeado por `slot_name`. Uma fonte SQLite toma emprestado seu `db_resource` e assina o observador de mutações confirmadas desse recurso.
2. Mudanças de linha são decodificadas em eventos de mudança neutros em relação ao driver, com `op` igual a `insert`, `update`, `delete` ou `truncate`.
3. Um assinante cujo stream tem `snapshot` habilitado — pelo campo `snapshot` da entrada ou por `opts.snapshot` no stream — recebe primeiro as linhas existentes como eventos com `op = "snapshot"`, e então continua nas mudanças ao vivo sem lacuna entre os dois.
4. Uma fonte Postgres reconhece periodicamente o LSN para que o servidor possa liberar segmentos do WAL (`standby_interval`).
5. A fonte é registrada sob seu ID de entrada; o código Lua assina com [`cdc.stream`](lua/storage/cdc.md).

## Capacidades

Toda fonte publica o que ela garante, de modo que os consumidores ramificam sobre capacidades em vez do tipo da entrada.

| Capacidade | `db.cdc.postgres` | `db.cdc.sqlite` | Significado |
|------------|:-----------------:|:---------------:|---------|
| `snapshot` | sim | sim | Suporta a entrega atômica snapshot/ao vivo |
| `capture_resume` | sim, exceto com `temporary` | não | O progresso da fonte sobrevive a uma reconexão |
| `replayable` | não | não | Assinantes individuais podem reproduzir eventos passados |
| `captures_external_writes` | sim | não | Captura escritas feitas fora deste runtime |
| `before_images` | não | sim | Entrega a imagem da linha antes da mudança |
| `coalesced` | não | sim | Escritas repetidas em uma linha dentro de uma transação podem chegar agrupadas |

As flags de capacidade descrevem o progresso da fonte, não a entrega durável: nenhum driver reproduz eventos para um assinante individual que ficou para trás ou se desconectou.

## Informações da Fonte

Cada fonte é descrita por um registro de informações, retornado por `cdc.source` e `cdc.list_sources`.

| Campo | Tipo | Descrição |
|-------|------|-------------|
| `id` | string | ID da entrada |
| `kind` | string | `db.cdc.postgres` ou `db.cdc.sqlite` |
| `name` | string | Nome da fonte (o ID da entrada) |
| `state` | string | `unknown`, `starting`, `running`, `faulted` ou `stopped` |
| `generation` | string | Geração atual da fonte; muda quando a fonte é substituída |
| `epoch` | string | Mesmo valor de `generation` |
| `engine` | string | Nome do engine (`sqlite`) |
| `db_resource` | string | ID de entrada do recurso SQL observado (`db.cdc.sqlite`) |
| `slot` | string | Nome do slot de replicação (`db.cdc.postgres`) |
| `publication` | string | Publicação do Postgres, quando configurada |
| `tables` | []string | Tabelas capturadas, quando configuradas |
| `streaming` | bool | Se a fonte está atualmente em execução |
| `failover` | bool | Modo de slot de failover (`db.cdc.postgres`) |
| `temporary` | bool | Slot temporário (`db.cdc.postgres`) |
| `snapshot` | bool | Padrão de snapshot no nível da entrada |
| `faulted` | bool | Se a fonte está no estado `faulted` |
| `error` | string | Último erro da fonte, quando há um registrado |
| `admission` | object | `active`, `snapshots`, `reserved_bytes`, `rejected` |
| `capabilities` | object | Veja [Capacidades](#capabilities) |

`admission` conta reservas, não preenchimento de fila: `active` é a contagem de assinaturas admitidas, `snapshots` o subconjunto com snapshot habilitado, `reserved_bytes` o orçamento de backlog reservado e `rejected` o número acumulado de assinaturas recusadas pelos limites.

## Permissões

| Ação | Recurso | Descrição |
|--------|----------|-------------|
| `cdc.source` | ID de entrada da fonte | Ler informações da fonte; também filtra `cdc.list_sources` |
| `cdc.subscribe` | ID de entrada da fonte | Abrir um stream de mudanças |

A autoridade de CDC é separada do acesso ao banco de dados: uma fonte pode expor cada linha capturada, incluindo as imagens anteriores. Filtros de stream apenas restringem a entrega; eles nunca concedem acesso a uma fonte.

```yaml
- name: cdc_reader
  kind: security.policy
  policy:
    effect: allow
    actions: [cdc.source, cdc.subscribe]
    resources: [app:changes]
```

## Veja Também

- [Módulo CDC](lua/storage/cdc.md) - API de streaming em Lua
- [Banco de Dados](system/database.md) - Serviços de banco de dados SQL
- [Ambiente](system/env.md) - Resolução de credenciais via `${env:NAME}`
- [Segurança](system/security.md) - Políticas e ações
