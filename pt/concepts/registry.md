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

Os IDs do registro também são usados como recursos por muitas verificações de autorização. O registro armazena as definições; o escopo de segurança decide se as operações protegidas podem acessá-las. Consulte o [Modelo de Segurança](./security-model.md).

## Handlers de kind

Quando uma entrada despachada é enviada, seu `kind` seleciona o handler registrado. O handler valida e reconcilia o recurso correspondente no runtime: uma entrada `http.service` gerencia um servidor HTTP, uma entrada `function.lua` gerencia um pool de funções e uma entrada `db.sql.postgres` gerencia um pool de conexões. Consulte o [Guia de Tipos de Entrada](../guides/entry-kinds.md) para conhecer os kinds disponíveis e [Tipos de Entrada Personalizados](../internals/kinds.md) para a implementação de handlers.

## Atualizações em tempo real

Entradas podem ser adicionadas, atualizadas ou removidas enquanto o sistema está em execução. Para kinds despachados, uma transação do registro solicita que os handlers participantes aceitem ou rejeitem cada operação antes do commit. Uma rejeição descarta a transação e aplica a transição inversa. Mudanças de topologia relacionadas produzem uma nova versão do registro.

O histórico de versões permite transições para trás e para frente quando está habilitado. O histórico em memória é o padrão e dura pelo tempo de vida do processo; os backends SQLite e PostgreSQL persistem o histórico entre reinicializações.

Arquivos de definição YAML e JSON são manifests de origem que o boot loader converte em entradas. Eles não são snapshots serializados do registro. Consulte o [módulo Registry](../lua/core/registry.md) para acesso programático.

## Consulte também

- [YAML e Estrutura do Projeto](../start/structure.md) — Arquivos de definição
- [Tipos de Entrada Personalizados](../internals/kinds.md) — Implementação de handlers de kind
- [Modelo de Processos](./process-model.md) — Entenda a execução de processos
