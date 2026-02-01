# Registro

O registro e o armazenamento central de configuracao do Wippy. Todas as definicoes - pontos de entrada, servicos, recursos - residem aqui, e as mudancas se propagam reativamente pelo sistema.

## Entradas

O registro armazena **entradas** - definicoes tipadas com IDs unicos:

```
app.api:get_user          → Handler HTTP
app.workers:email_sender  → Processo em segundo plano
app:database              → Conexao de banco de dados
app:templates             → Conjunto de templates
```

Cada entrada tem um `ID` (formato namespace:nome), um `kind` que determina seu handler, campos `meta` arbitrarios, e `data` especifico do kind.

## Handlers de Kind

Quando uma entrada e submetida, seu `kind` determina qual handler a processa. O handler valida a configuracao e cria recursos de runtime - uma entrada `http.service` inicia um servidor HTTP, uma entrada `function.lua` cria um pool de funcoes, uma entrada `sql.database` estabelece um pool de conexoes. Veja o [Guia de Tipos de Entradas](guide-entry-kinds.md) para kinds disponiveis e [Tipos de Entradas Personalizados](internal-kinds.md) para implementar handlers.

## Atualizacoes ao Vivo

O registro suporta mudancas em tempo de execucao - adicionar, atualizar ou remover entradas enquanto o sistema executa. Mudancas fluem atraves do barramento de eventos onde listeners podem validar ou rejeita-las, e transacoes garantem atomicidade. O historico de versoes permite rollback.

Arquivos de definicao YAML sao snapshots serializados do registro carregados na inicializacao. Veja o [modulo Registry](lua-registry.md) para acesso programatico.

## Veja Tambem

- [YAML e Estrutura do Projeto](getting-started-structure.md) - Arquivos de definicao
- [Tipos de Entradas Personalizados](internal-kinds.md) - Implementando handlers de kind
- [Modelo de Processos](concept-process-model.md) - Como processos funcionam
