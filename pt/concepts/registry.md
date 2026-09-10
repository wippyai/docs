---
title: "Registro"
description: "Como o Wippy armazena entradas tipadas, inicializa recursos do runtime e propaga mudanças de configuração."
---

# Registro

O registro é o armazenamento versionado do Wippy para pontos de entrada, serviços, recursos e outras definições do runtime. A maioria dos kinds de entrada do runtime é reconciliada por meio de transações do barramento de eventos; kinds internos, como `registry.entry` e metadados de namespace, não passam pelo despacho de eventos por padrão.

## Entradas

O registro contém **entradas** — definições tipadas com IDs exclusivos:

```
app.api:get_user          → HTTP handler
app.workers:email_sender  → Background process
app:database              → Database connection
app:templates             → Template set
```

Cada entrada possui um `ID` (no formato namespace:nome), um `kind` que determina seu handler, campos `meta` arbitrários e `data` específicos do kind.

Além desse conteúdo autorado, o registry mantém sua própria proveniência para cada entrada: o `owner`, ou seja, a origem de deployment de onde a entrada veio, e `root`, que marca uma declaração de dependência selecionada pelo deployment. Esse estado é atribuído pelo registry, não escrito pelo autor da entrada, e é mantido separado de `meta` para que os dois nunca sejam confundidos. Ele é lido através da API de estado do snapshot, e não pelas APIs comuns de entrada — veja [Módulo Registry](lua/core/registry.md#snapshot-state).

## Handlers de Kind

Quando uma entrada é submetida, seu `kind` determina qual handler a processa. O handler valida a configuração e cria recursos de runtime — uma entrada `http.service` inicia um servidor HTTP, uma entrada `function.lua` cria um pool de funções, uma entrada `db.sql.postgres` estabelece um pool de conexões. Veja o [Guia de Tipos de Entradas](guides/entry-kinds.md) para kinds disponíveis e [Tipos de Entradas Personalizados](internals/kinds.md) para implementar handlers.

Quando uma entrada despachada é enviada, seu `kind` seleciona o handler registrado. O handler valida e reconcilia o recurso correspondente no runtime: uma entrada `http.service` gerencia um servidor HTTP, uma entrada `function.lua` gerencia um pool de funções e uma entrada `db.sql.postgres` gerencia um pool de conexões. Consulte o [Guia de Tipos de Entrada](guides/entry-kinds.md) para conhecer os kinds disponíveis e [Tipos de Entrada Personalizados](internals/kinds.md) para a implementação de handlers.

## Atualizações em tempo real

Entradas podem ser adicionadas, atualizadas ou removidas enquanto o sistema está em execução. Para kinds despachados, uma transação do registro solicita que os handlers participantes aceitem ou rejeitem cada operação antes do commit. Uma rejeição descarta a transação e aplica a transição inversa. Mudanças de topologia relacionadas produzem uma nova versão do registro.

O histórico de versões permite transições para trás e para frente quando está habilitado. O histórico em memória é o padrão e dura pelo tempo de vida do processo; os backends SQLite e PostgreSQL persistem o histórico entre reinicializações.

Arquivos de definição YAML e JSON são manifests de origem que o boot loader converte em entradas. Eles não são snapshots serializados do registro. Consulte o [módulo Registry](lua/core/registry.md) para acesso programático.

## Consulte também

- [YAML e Estrutura do Projeto](start/structure.md) — Arquivos de definição
- [Tipos de Entrada Personalizados](internals/kinds.md) — Implementação de handlers de kind
- [Modelo de Processos](concepts/process-model.md) — Entenda a execução de processos
