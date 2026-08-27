---
title: "Internals do Registro"
description: "Armazenamento versionado do registro, changesets, transações, resolução de dependências, histórico e busca de entradas."
---

# Internals do Registro

O registro armazena o estado versionado das entradas, oferece transações e histórico e propaga mudanças pelo event bus.

Os fragmentos de Go e de consultas desta página documentam estruturas de dados internas e a sintaxe do finder; não são exemplos de aplicação independentes.

## Armazenamento de Entradas

As entradas são armazenadas como um slice ordenado, com um índice em hash map para consultas O(1):

```go
type Entry struct {
    ID   ID              // namespace:name
    Kind Kind            // Entry type
    Meta attrs.Bag       // Metadata
    Data payload.Payload // Content
}
```

Os IDs das entradas usam o pacote `unique` do Go para interning — IDs idênticos compartilham memória.

## Cadeia de Versões

Cada versão aponta para sua versão pai. O cálculo do caminho usa um algoritmo de grafos para encontrar a rota mais curta entre duas versões:

```mermaid
flowchart LR
    v0[v0] --> v1[v1] --> v2[v2] --> v3[v3] --> vN[vN]
```

## ChangeSets

Um changeset é uma lista ordenada de operações transformando um estado em outro:

| Operação | OriginalEntry | Propósito |
|----------|---------------|-----------|
| Create | nil | Adicionar nova entrada |
| Update | valor antigo | Modificar existente |
| Delete | valor deletado | Remover entrada |

`OriginalEntry` permite reverter as operações — updates armazenam o valor anterior, e deletes armazenam o que foi removido.

### Construindo Deltas

`BuildDelta(oldState, newState)` gera operações mínimas:

1. Comparar estados, identificar mudanças
2. Ordenar deletes em ordem reversa de dependência (dependentes primeiro)
3. Ordenar creates/updates em ordem direta de dependência (dependências primeiro)

### Squashing

Múltiplos changesets mesclam rastreando estado final por entrada:

```
Create + Update = Create (with updated value)
Create + Delete = ∅ (cancel out)
Update + Delete = Delete
Delete + Create = Update
```

## Transações

```mermaid
sequenceDiagram
    participant R as Registry
    participant B as EventBus
    participant H as Handlers

    R->>B: registry.begin
    loop Each Operation
        R->>B: entry.create/update/delete
        B->>H: dispatch to listeners
        H-->>B: accept or reject
        B-->>R: confirmation
    end
    alt All accepted
        R->>B: registry.commit
    else Any rejected
        R->>B: registry.discard
        R->>R: rollback
    end
```

Por padrão, o registro espera 30 segundos para que os listeners aceitem ou rejeitem cada operação. `registry.event_wait_timeout` altera esse timeout por operação. Em caso de rejeição, o registro faz rollback calculando e aplicando o delta inverso.

### Entradas que Não Propagam

Os tipos a seguir ignoram o event bus por padrão:
- `registry.entry` - Configs de aplicação
- `ns.requirement` - Requirements de namespace
- `ns.dependency` - Dependências de módulo
- `ns.definition` - Metadados do módulo (readme, wiki, licença, autores)

`registry.dispatch_internal_kinds` substitui essa lista padrão.

## Resolução de Dependências

Entradas podem declarar dependências de outras entradas. O resolver extrai dependências via padrões registrados:

```go
resolver.RegisterPattern(registry.DependencyPattern{
    Path:          "meta.server",
    AllowWildcard: true,
})
```

As dependências são extraídas dos campos Meta e Data da entrada e usadas na ordenação topológica durante as transições de estado.

## Histórico de Versões

Backends de histórico:

| Implementação | Caso de Uso |
|---------------|-------------|
| SQLite | Persistência de produção |
| PostgreSQL | Persistência de produção, compartilhada entre nós |
| Memory | Padrão quando `history_type` não está definido; testes |
| Nil | Sem histórico |

SQLite usa o modo WAL com tabelas para versões, changesets (codificados em MessagePack) e metadados. PostgreSQL é selecionado com `registry.history_type: postgres` e `history_dsn`/`history_schema` (consulte [Configuração](../guides/configuration.md#registro)).

O histórico também persiste a resolução exata de dependências de cada versão: quando uma mudança de `ns.dependency` é aplicada, o grafo de módulos resolvido é armazenado por conteúdo junto ao changeset. Boot e rollback reproduzem o grafo armazenado em vez de resolvê-lo novamente; assim, uma versão sempre é reconciliada com as versões usadas em sua resolução. O esquema do histórico migra automaticamente no primeiro boot após uma atualização; uma versão preexistente é resolvida uma única vez na primeira visita e registrada como checkpoint.

### Navegação

Computação de caminho encontra a rota mais curta entre versões:

```go
Path(v0, v3) = [v1, v2, v3]  // Apply changesets forward
Path(v3, v1) = [v2, v1]      // Apply reversed changesets
```

`LoadState()` reproduz o histórico a partir de uma baseline sem criar novas versões — ele é usado durante o boot.

## Finder

Motor de consultas com cache LRU para pesquisar entradas:

| Operador | Prefixo | Exemplo |
|----------|---------|---------|
| Glob de campo raiz | `.` no campo raiz | `.kind=function.*` |
| Regex | `~` | `~meta.path=/api/.*` |
| Contains | `*` | `*meta.tags=backend` |
| Prefix | `^` | `^meta.name=user` |
| Suffix | `$` | `$meta.path=Handler` |

O cache é invalidado quando a versão muda.

A correspondência glob se aplica aos campos raiz `.kind`, `.name`, `.ns` e `.id`. Critérios `meta.*` sem prefixo usam correspondência por igualdade.

## Consulte também

- [Registro](../concepts/registry.md) — Conceitos de alto nível
- [Eventos](./events.md) — Detalhes do event bus
