---
title: "Modelo de segurança: isolamento de processos e verificações de política"
description: "Como o Wippy limita ambientes de execução Lua e WASM e autoriza operações protegidas da runtime com atores, escopos e políticas."
---

# Modelo de segurança

O Wippy combina isolamento de execução com controle de acesso baseado em atributos (ABAC). O isolamento determina quais módulos e recursos do host o código pode alcançar. O ABAC determina se uma operação protegida é permitida para o ator e o escopo de políticas atuais. Ambos os limites importam: importar um módulo não concede suas permissões, e uma política não torna um módulo não declarado disponível para código Lua.

## Regras de autorização

Um contexto de segurança pode conter um **ator** e um **escopo**. O ator identifica o principal e pode incluir metadados. O escopo é um conjunto imutável de políticas. Uma política corresponde a uma ação e a um recurso, pode inspecionar metadados do ator ou do recurso e retorna `allow`, `deny` ou `undefined`.

Quando ator e escopo estão presentes:

1. Qualquer `deny` correspondente prevalece.
2. Pelo menos um `allow`, sem nenhum `deny`, permite a operação.
3. Se nenhuma política corresponder, o resultado é `undefined`, tratado como negação pelas operações protegidas da runtime.

`security.strict_mode` se aplica apenas quando o contexto está incompleto porque falta o ator ou o escopo. A runtime v0.3.32a inicia com o modo estrito ativo. Desative-o somente quando código legado ou de transição precisar manter o comportamento permissivo para um contexto incompleto:

```yaml
# .wippy.yaml
security:
  strict_mode: false
```

| Contexto | `strict_mode: false` | `strict_mode: true` |
|----------|----------------------|---------------------|
| Ator e escopo presentes | Avalia políticas; somente `allow` permite o acesso | Igual |
| Ator ou escopo ausente | Permite a operação protegida | Nega a operação protegida |

Mantenha o modo estrito ativo em implantações que devem falhar de forma fechada e garanta que os serviços iniciem com o ator e o escopo necessários para seu trabalho. Desativar o modo estrito não transforma o resultado `undefined` de um escopo completo em permissão.

Consulte a [referência de segurança](../system/security.md) para sintaxe de políticas, atores, escopos e stores de tokens.

## Isolamento Lua

Cada processo de ator Lua possui um estado Lua, e entries de função são executados por pools de estados isolados. A runtime abre um ambiente básico restrito em vez do ambiente completo do host Lua:

- as bibliotecas ambientes são `table`, `math`, `os`, `coroutine`, `string` e `errors` restritas, além de globais essenciais como `channel`, `payload` e `print`;
- `package.path` e `package.cpath` ficam vazios, e `package.loadlib` é desativado;
- módulos e bibliotecas apoiados pelo registry ficam visíveis apenas aos chunks que os declaram por `modules:` ou `imports:`;
- `require()` resolve esse conjunto limitado e falha para um módulo do registry não declarado.

Consequentemente, código Lua não tem acesso direto ao sistema de arquivos, sockets, processos nativos ou variáveis de ambiente do host. Ele alcança esses recursos apenas por módulos da runtime, como `fs`, `http_client`, `exec` e `env`, e suas operações protegidas ainda executam verificações de política.

Uma biblioteca importada não expõe seus imports ao chamador. Cada biblioteca e entrypoint recebe seu próprio ambiente limitado; uma capacidade usada internamente por uma biblioteca não fica automaticamente disponível para a função que a importa.

## Isolamento WASM

Código WASM é executado por imports de host e configurações WASI definidos. Valores de ambiente e mounts de sistema de arquivos precisam ser declarados no entry WASM. Antes da instanciação, a runtime verifica `env.get` para cada entry de ambiente configurado e `fs.get` para cada mount. Mounts de sistema de arquivos são reenraizados no sistema configurado, sem expor a raiz do host.

Funções de host para sockets WASM e HTTP de saída também fazem verificações específicas, como `socket.connect`, `socket.listen`, `socket.resolve` e `http_client.request`.

## Aquisição e uso de capacidades

Muitos recursos da runtime são entries do registry. Os módulos adquirem esses recursos pelo ID do entry e verificam uma ação correspondente. Na v0.3.32a, alguns exemplos são:

| Operação | Verificação | Recurso |
|----------|-------------|---------|
| Ler um entry do registry | `registry.get` | ID do entry |
| Chamar uma função | `funcs.call` | ID da função |
| Obter um handle de banco SQL | `db.get` | ID do entry de banco |
| Obter um sistema de arquivos | `fs.get` | ID do entry de sistema de arquivos |
| Ler um valor de ambiente | `env.get` | Nome ou ID da variável |
| Iniciar um processo | `process.spawn` | ID do entry de processo |
| Selecionar um host de processo | `process.host` | ID do entry de host |

Essas verificações não ocorrem todas na mesma granularidade. Por exemplo, `db.get` autoriza a aquisição de um handle de banco; consultas SQL individuais feitas por esse handle não repetem `db.get`. Da mesma forma, `fs.get` autoriza a aquisição de um handle de sistema de arquivos, em vez de aplicar uma decisão ABAC a cada operação de arquivo. Não passe um handle adquirido a um contexto menos confiável, a menos que esse contexto deva conservar a autoridade do handle.

Módulos de rede executam verificações adicionais para cada requisição, conexão ou listener quando documentado. Consulte a referência do módulo para conhecer a ação e o recurso exatos usados por uma operação.

## Herança de contexto

Ator e escopo são valores herdáveis do contexto de frame. Chamadas de função e processos iniciados os herdam, a menos que o chamador construa um contexto substituto. Definir explicitamente um ator ou escopo para um processo iniciado exige a permissão `process.security`, além das permissões de spawn aplicáveis.

Essa herança mantém a autorização ligada à cadeia de chamadas, mas também significa que um processo pai privilegiado deve restringir deliberadamente o contexto do trabalho delegado a código menos confiável.

## Alterações no registry

Ler entries e alterar o registry exigem permissões diferentes. Changesets duráveis padrão exigem `registry.apply`; na v0.3.32a, essa verificação usa um recurso vazio e não representa uma decisão de escrita por entry ou namespace. Não conceda `registry.apply` a um agente não confiável presumindo que um padrão de namespace limitará suas escritas.

Overlays locais ao processo têm uma superfície de permissão mais restrita. Eles verificam o owner do overlay e ações específicas como `registry.overlay.create.<kind>`, `registry.overlay.update.<kind>` e `registry.overlay.delete.<kind>` em relação ao ID afetado. Consulte [Registry de entries](../lua/core/registry.md).

## Limites de dados

Use IDs de registry distintos para bancos de dados, sistemas de arquivos, funções e variáveis de ambiente específicos de cada tenant e escreva políticas que permitam apenas os IDs pretendidos. Isso impede que um contexto obtenha o recurso protegido de outro tenant quando todos os caminhos de acesso usam os módulos verificados da runtime.

Referências de ambiente mantêm credenciais de providers fora dos manifests de origem. Um provider pode resolver internamente um `env.variable` configurado, mas isso não torna o valor inerentemente ilegível para o código da aplicação: código que importa `env` e tem permissão `env.get` para a mesma variável pode lê-lo. Proteja segredos tanto pelo escopo de módulos quanto por políticas.

O modo estrito é importante em implantações multi-tenant porque impede que trabalho sem ator ou escopo ignore a avaliação de políticas. Ele não deduz a identidade do tenant nem gera políticas; a aplicação deve estabelecer ator, escopo, recursos e cobertura de políticas corretos.

## Limites de agentes e ferramentas

Agentes do framework compilam as ferramentas selecionadas por suas definições e traits. Schemas de ferramentas limitam e validam os argumentos passados a elas. Implementações de ferramentas apoiadas pelo registry são executadas pelo caminho de chamada `funcs`, portanto `funcs.call` é verificado em relação ao ID da função de destino.

A lista de ferramentas e o escopo de políticas são complementares:

- omitir uma ferramenta impede que o modelo a selecione pela interface normal do agente;
- negar `funcs.call` impede a execução mesmo que a ferramenta esteja na lista compilada;
- conceder `funcs.call` não adiciona uma ferramenta não declarada à lista do modelo.

Trate wrappers de ferramentas e integrações externas como código adicional da aplicação. Eles não substituem as verificações da runtime, e suas próprias credenciais de rede e regras de autorização ainda precisam ser revisadas.

## Responsabilidades da implantação

Os limites de execução e de políticas do Wippy não substituem controles de infraestrutura:

- criptografia de armazenamento e política de backup pertencem ao banco, disco ou object store configurado;
- VPCs, firewalls e políticas de serviço controlam a alcançabilidade no nível da rede;
- autenticação estabelece a identidade do usuário ou serviço antes da autorização do Wippy;
- administração do host, acesso SSH e ações de administrador do banco exigem logs de auditoria da infraestrutura;
- cotas de CPU e memória por tenant exigem controles de recursos no nível da implantação.

OpenTelemetry pode rastrear operações configuradas da runtime e do framework, mas a cobertura depende da instrumentação ativada. Consulte [Observabilidade](../guides/observability.md).

## Checklist de revisão

- Mantenha `security.strict_mode` ativo onde contextos incompletos devem falhar de forma fechada.
- Dê a cada serviço um ator e um escopo intencionais.
- Revise tanto os módulos/imports Lua declarados quanto as políticas das operações protegidas.
- Não conceda `registry.apply` a código não confiável, salvo quando a alteração durável completa do registry for intencional.
- Não compartilhe handles adquiridos de banco de dados ou sistema de arquivos entre limites de confiança.
- Separe recursos de tenants por ID do registry e teste a negação fora do escopo de cada tenant.
- Proteja segredos de ambiente com escopo de imports e políticas `env.get`.
- Verifique tracing e controles de infraestrutura independentemente da autorização da runtime.

## Consulte também

- [Referência de segurança](../system/security.md) — Políticas, escopos, atores, modo estrito e stores de tokens
- [Registry de entries](../lua/core/registry.md) — Permissões de leitura, alteração e overlays do registry
- [Gerenciamento de processos](../lua/core/process.md) — Spawn, contexto e permissões de segurança de processo
- [Modelo de processos](./process-model.md) — Isolamento e ciclo de vida dos processos
- [Agentes](../framework/agents.md) — Definições de agentes e seleção de ferramentas
