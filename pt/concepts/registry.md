# Registro

O registro é o armazenamento central de configuração do Wippy. Todas as definições — pontos de entrada, serviços, recursos — residem aqui, e as mudanças se propagam reativamente pelo sistema.

## Entradas

O registro armazena **entradas** — definições tipadas com IDs únicos:

```
app.api:get_user          → Handler HTTP
app.workers:email_sender  → Processo em segundo plano
app:database              → Conexão de banco de dados
app:templates             → Conjunto de templates
```

Cada entrada tem um `ID` (formato namespace:nome), um `kind` que determina seu handler, campos `meta` arbitrários, e `data` específico do kind.

## Handlers de Kind

Quando uma entrada é submetida, seu `kind` determina qual handler a processa. O handler valida a configuração e cria recursos de runtime — uma entrada `http.service` inicia um servidor HTTP, uma entrada `function.lua` cria um pool de funções, uma entrada `sql.database` estabelece um pool de conexões. Veja o [Guia de Tipos de Entradas](guides/entry-kinds.md) para kinds disponíveis e [Tipos de Entradas Personalizados](internals/kinds.md) para implementar handlers.

## Atualizações ao Vivo

O registro suporta mudanças em tempo de execução — adicionar, atualizar ou remover entradas enquanto o sistema executa. Mudanças fluem através do barramento de eventos onde listeners podem validar ou rejeitá-las, e transações garantem atomicidade. O histórico de versões permite rollback.

Arquivos de definição YAML são snapshots serializados do registro carregados na inicialização. Veja o [módulo Registry](lua/core/registry.md) para acesso programático.

## Veja Também

- [YAML e Estrutura do Projeto](start/structure.md) - Arquivos de definição
- [Tipos de Entradas Personalizados](internals/kinds.md) - Implementando handlers de kind
- [Modelo de Processos](concepts/process-model.md) - Como processos funcionam
