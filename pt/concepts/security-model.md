---
title: Modelo de Segurança - Isolamento de Processos, Controle de Capacidades e Limites de Dados
description: Como o Wippy controla o que seu código pode acessar, o que não pode e quem impõe esses limites. Cobre isolamento de processos, controle de capacidades baseado no registro, imposição multi-tenant e segurança de agentes.
---

# Modelo de Segurança

O modelo de segurança do Wippy define o que seu código pode acessar, o que não pode e quem impõe esses limites. Vale a pena lê-lo antes de construir, porque ele opera em duas camadas que a maioria dos frameworks funde em uma só: o runtime isola cada processo de modo que capacidades perigosas simplesmente não existem, e uma camada de políticas baseada em atributos governa quais capacidades do registro um processo tem permissão de usar. Entender ambas muda a forma como você estrutura uma aplicação.

## Modelo de Confiança

A camada de isolamento do Wippy não dá ao processo nenhuma autoridade ambiente. Um processo Lua ou WASM recém-criado não pode tocar o sistema de arquivos, a rede, o SO hospedeiro ou a memória de outros processos, porque essas capacidades não estão presentes em seu ambiente. Capacidades chegam apenas através do registro: funções, ferramentas, conexões e configurações que o processo recebe explicitamente.

Além disso, o acesso a capacidades do registro é governado por controle de acesso baseado em atributos (ABAC). Toda operação protegida é verificada contra o escopo de segurança do ator atual, um conjunto de políticas que permite ou nega uma ação sobre um recurso, opcionalmente condicionada aos metadados do ator e do recurso. Isso é declarativo: você define políticas na configuração, não no código da aplicação.

Quando um processo executa com um ator e um escopo, o acesso é negado por padrão: uma requisição só é permitida se uma política a permitir explicitamente e nenhuma a negar. O **modo estrito** governa o caso incompleto, quando nenhum ator ou escopo está estabelecido. Ele está **ativo por padrão**, então um contexto incompleto é negado; definir `security.strict_mode: false` na configuração do runtime opta pelo comportamento permissivo. A consequência a planejar é que um processo sem contexto de segurança declarado falha em toda verificação sob o padrão — dê a esse processo um bloco `security:` em sua entrada, ou inicie-o por um caminho que forneça um. Combinado com políticas de menor privilégio, isso lhe dá autorização fail-closed sobre o isolamento por ausência. Veja a [referência de Segurança](system/security.md) para sintaxe de políticas, regras de avaliação e o formato do bloco `security:`.

## Isolamento de Processos

Toda unidade de execução no Wippy roda em um processo isolado com seu próprio interpretador embarcado (Lua ou WASM).

**O que um processo tem:** seu próprio espaço de memória (uma sobrecarga base de ~13 KB para Lua). Uma visão com escopo do registro. Uma identidade de ator e um escopo de segurança. Um ciclo de vida supervisionado com recuperação de falhas e limites de reinício.

**O que um processo não tem:** acesso ao sistema de arquivos (exceto através de entradas de filesystem controladas pelo registro). Acesso à rede (exceto através de módulos de cliente HTTP ou de ferramentas concedidos). Acesso à memória de outros processos. Acesso ao runtime Go que o hospeda. Acesso a variáveis de ambiente (exceto através de entradas de ambiente concedidas).

**Como o isolamento é imposto:** cada processo Lua parte de uma biblioteca padrão mínima. E/S de arquivos, acesso a processos do SO, carregamento dinâmico de código e rede nunca são carregados, então não estão presentes no ambiente, e o processo não pode restaurar o que não existe. O carregamento de módulos é restrito: `require` resolve apenas os módulos e entradas de registro explicitamente concedidos ao processo, sem caminho de busca no sistema de arquivos. Processos WASM alcançam isolamento equivalente através do WASI: apenas as funções do hospedeiro e as entradas de filesystem montadas configuradas para aquela entrada são alcançáveis.

Isso não é sandboxing via permissões de runtime (como seccomp ou AppArmor). É sandboxing por ausência. Capacidades perigosas nunca são carregadas, então não podem ser exploradas, contornadas ou escaladas.

## Controle de Capacidades

O registro é o armazenamento de capacidades do Wippy, e as políticas de segurança são sua camada de autorização.

**Toda capacidade é uma entrada de registro.** Funções, ferramentas, definições de agentes, conexões de banco de dados, referências de ambiente, valores de configuração e tarefas agendadas são todos entradas de registro com um tipo, esquema e metadados declarados. As entradas são validadas pelo handler do seu tipo no momento do registro.

**IDs de entrada têm namespace.** Um ID tem a forma `namespace:name` com um único dois-pontos, e namespaces são hierárquicos via segmentos separados por ponto, por exemplo `tenant_acme.tools:read` (namespace `tenant_acme.tools`, nome `read`). Políticas casam ações e recursos, e padrões de recurso podem alvejar um prefixo de namespace, de modo que uma única regra pode cobrir um namespace inteiro.

**Políticas decidem o acesso.** Cada acesso a capacidade (uma busca no registro, uma chamada de função, um handle de banco de dados, a abertura de um arquivo) é verificado contra o escopo do ator. Uma política declara as ações e recursos que cobre, um efeito de permitir ou negar e condições opcionais sobre metadados do ator e do recurso. A avaliação acontece a cada acesso, não uma única vez na inicialização: se qualquer política negar, o acesso é negado; se ao menos uma permitir e nenhuma negar, ele é permitido; se nenhuma política casar, o acesso é negado. (Quando o contexto não tem ator nem escopo algum, esse caso incompleto é resolvido pelo modo estrito, e não pela avaliação de políticas.)

**Um contexto é declarado, não herdado do nada.** Funções herdam o ator e o escopo de quem as chama. Um processo criado também os herda: seu frame é bifurcado a partir do frame de quem o criou, e o bloco `security:` de sua própria entrada então modifica esse contexto herdado — um `actor` que ele nomeia substitui o ator herdado, e as políticas e grupos de políticas que ele lista por ID de registro são mesclados ao escopo herdado. A resolução é atômica — se qualquer política ou grupo nomeado estiver ausente, a criação falha em vez de prosseguir com um escopo parcial. Um comando de CLI pode adicionalmente declarar `meta.command.security`, aplicado apenas no caminho de lançamento confiável em que o operador iniciou o comando por conta própria.

**Argumentos de ferramentas seguem um esquema.** Uma ferramenta declara um JSON Schema para suas entradas. Esse esquema é entregue ao modelo para que ele gere argumentos em conformidade, e o acesso à ferramenta é verificado por política antes de a chamada executar.

## Limites de Dados

**Conexões de banco de dados são entradas de registro.** Um processo não monta sua própria string de conexão. Ele solicita uma conexão por ID de registro, e essa solicitação é verificada por política antes que um handle seja retornado. Um processo cujas políticas não concedem a entrada de banco de dados do Tenant B não consegue obter um handle para ela.

**Chaves de API de LLM vivem no sistema de ambiente.** Chaves para Claude, GPT e outros provedores são lidas do sistema de ambiente (por exemplo, variáveis de ambiente do SO expostas através de uma entrada `env.storage.os`, referenciadas por entradas `env.variable` cujas leituras são verificadas por política via a ação `env.get`). O provedor as lê internamente; elas não são passadas em argumentos de processo nem retornadas ao código chamador.

**Armazenamento de arquivos e blobs segue o mesmo modelo.** Um processo lê ou escreve através de entradas de registro de filesystem ou de armazenamento em nuvem, cada acesso verificado por política. Processos WASM acessam arquivos apenas através de entradas de filesystem explicitamente montadas para aquela entrada.

## Segurança de Agentes

Agentes são processos movidos por LLM com uso de ferramentas. Eles tomam decisões em tempo de execução que seu código não controla diretamente, então seus limites importam. O Wippy lida com isso através dos mesmos mecanismos de registro e políticas que qualquer outro processo.

**Acesso a ferramentas.** Um agente só pode invocar ferramentas listadas em sua definição, e cada execução de ferramenta passa por `funcs.call`, que é verificado por política. Uma chamada negada falha antes de a função da ferramenta executar. Um agente projetado para ler dados de clientes mas não excluí-los ou não tem ferramenta de exclusão em sua definição, ou tem essa ação negada por política.

**Ferramentas externas e MCP.** O Wippy pode consumir ferramentas externas e expor as suas próprias sobre o Model Context Protocol. Ferramentas consumidas passam pelo mesmo caminho de chamada de função e pelas mesmas verificações de política que ferramentas nativas. Ferramentas que o Wippy expõe a clientes MCP externos são protegidas por tokens de acesso com escopo e revogáveis, que limitam quais ações um cliente pode realizar.

**Saída estruturada.** O módulo de LLM pode solicitar saída restrita por esquema (estruturada) usando o suporte nativo de saída estruturada do provedor, de modo que a saída de um agente pode ser mantida em um formato declarado.

**Observabilidade.** Com o OpenTelemetry habilitado, chamadas ao provedor de LLM e invocações de ferramentas são rastreadas, e o uso de tokens é registrado através do contrato do usage-tracker. Isso lhe dá uma trilha de auditoria do que um agente chamou e do que gastou. Veja [Observabilidade](guides/observability.md).

**Limites de automodificação.** Um agente autorizado a criar ferramentas em um namespace pode ter negado o acesso de escrita à sua própria definição em outro. Escritas no registro são ações verificadas por política, então uma política de negação sobre o próprio namespace do agente impede que ele se edite ou conceda a si mesmo novo acesso.

## Imposição Multi-Tenant

Para implantações em que múltiplos clientes compartilham uma única instância Wippy, o isolamento é imposto pela avaliação de políticas antes de qualquer operação executar, não por código de aplicação verificando IDs de tenant.

**O isolamento de tenants é imposto por política.** Dê a cada tenant um ator e um escopo cujas políticas cubram apenas os namespaces daquele tenant. Com o modo estrito ativo, o processo de um tenant tem o acesso negado a recursos fora do seu escopo antes de seu código executar. O isolamento efetivo depende de escrever essas políticas por tenant; o runtime as impõe, mas não infere a tenancy por você.

**Acesso entre tenants é explícito.** Uma capacidade compartilhada entre tenants vive em um namespace compartilhado que as políticas de cada tenant permitem. O compartilhamento é opt-in por namespace.

**A concorrência é limitada no host.** Hosts de processo limitam a concorrência através de worker pools. Grupos de processos (`pg.scope`) fornecem namespaces isolados de membership e broadcast em todo o cluster e podem limitar a contagem de grupos e de membros. Tetos de CPU ou memória por tenant não são um recurso nativo do runtime; imponha-os na camada de infraestrutura.

Um guia dedicado de Arquitetura Multi-Tenant está planejado.

## Escopo e Limitações

O modelo de segurança do Wippy cobre isolamento de processos, controle de capacidades e limites de dados. Os itens a seguir estão fora do escopo do runtime e permanecem responsabilidade da sua infraestrutura.

**Criptografia de dados em repouso.** Criptografia de banco de dados, disco e armazenamento de blobs é tratada pela infraestrutura subjacente (PostgreSQL TDE, criptografia de disco e similares). O Wippy assume que a camada de armazenamento cuida da criptografia.

**Isolamento em nível de rede.** O isolamento de processos acontece na camada de aplicação. A segmentação de rede entre o Wippy e suas dependências (banco de dados, APIs de LLM, serviços externos) é tratada pela infraestrutura: VPCs, security groups, firewalls.

**Gestão de identidade.** A autenticação (verificar quem é um usuário) é tratada pela sua camada de auth. O modelo de segurança do Wippy começa após a autenticação: ele controla o que os processos de um usuário autenticado podem fazer, não quem o usuário é. Tokens que carregam um ator e um escopo podem ser emitidos e validados através de um token store.

**Logs de auditoria de infraestrutura.** O tracing do Wippy cobre operações em nível de processo: chamadas de função, chamadas de ferramentas, atividade de processos. Acesso em nível de infraestrutura (SSH ao servidor, operações de administração de banco de dados) deve ser auditado por ferramentas de infraestrutura.

## Perguntas Comuns

**O agente de um tenant pode acessar os dados de outro tenant?**
Não quando os recursos de cada tenant têm escopo definido por política. Com políticas por tenant e modo estrito, o runtime nega acesso a recursos fora do escopo do tenant antes de o código do agente executar.

**Um agente pode escalar suas próprias permissões?**
Apenas se suas políticas permitirem escrever em sua própria definição. Escritas no registro são verificadas por política, então uma política de negação sobre o próprio namespace do agente impede a automodificação. Um agente que pode criar ferramentas em um namespace não pode conceder a si mesmo acesso a namespaces que seu escopo ainda não cobre.

**Como vejo o que um agente fez?**
Com o OpenTelemetry habilitado, chamadas de LLM e de ferramentas são rastreadas, e o uso de tokens é registrado através do contrato do usage-tracker. Veja [Observabilidade](guides/observability.md).

**O que acontece se um agente se comportar de forma inesperada?**
Ele é contido pelo sandbox: sem sistema de arquivos, sem rede, sem SO, sem acesso a outros processos além do que lhe foi concedido. Ele só pode chamar ferramentas de sua definição que a política permita, e essas chamadas são registradas em log.

**O isolamento de tenants é imposto pelo meu código ou pelo runtime?**
Pelo runtime. O motor de políticas avalia cada acesso antes de a operação executar. Seu trabalho é escrever as políticas por tenant; o runtime as impõe.

**Como as ferramentas MCP externas são protegidas?**
Ferramentas consumidas sobre MCP passam pelo mesmo caminho de chamada de função e pelas mesmas verificações de política que ferramentas nativas. Ferramentas que o Wippy expõe a clientes MCP externos são protegidas por tokens de acesso com escopo e revogáveis. Conectar um serviço MCP não contorna o modelo de segurança.

## Referência de Segurança

| Preocupação | Abordagem do Wippy |
|---------|------------------|
| Isolamento de processos | Interpretador separado por processo (Lua ou WASM), sem memória compartilhada |
| Acesso padrão | Políticas sem correspondência negam quando um ator e um escopo estão definidos; o modo estrito, ativo por padrão, nega quando nenhum ator ou escopo está estabelecido |
| Declaração de contexto | Bloco `security:` na entrada (ator, políticas, grupos); a resolução é atômica e fail-closed |
| Cadeia de suprimentos | Packs de módulos verificados por digest na instalação e no boot; uma divergência recusa o módulo |
| Confiança entre nós | Malha internode mutuamente autenticada; identidade ed25519 por nó, mapa explícito de peers confiáveis |
| Propagação em workflows | Ator e escopo levados ao Temporal como um header assinado e vinculado à audiência; falha de verificação faz a execução falhar |
| Controle de capacidades | Entradas de registro governadas por políticas de segurança baseadas em atributos (ator, escopo, ação, recurso) |
| Limites de dados | Conexões e armazenamento são entradas de registro; cada acesso é verificado por política por ID de entrada |
| Gestão de chaves de API | Armazenadas no sistema de ambiente, lidas internamente pelos provedores, não expostas ao código do processo |
| Controle de ferramentas do agente | Ferramentas limitadas à definição do agente; cada chamada verificada via política de `funcs.call` |
| Ferramentas externas (MCP) | Mesmo caminho de chamada de função e mesmas verificações de política; ferramentas expostas protegidas por tokens com escopo |
| Trilha de auditoria de agentes | Tracing com OpenTelemetry (quando habilitado) mais registros do usage-tracker |
| Isolamento multi-tenant | Políticas e escopos por tenant avaliados pelo runtime antes de cada operação |
| Limites de concorrência | Limitados por worker pools do host; sem tetos nativos de CPU/memória por tenant |
| Automodificação | Políticas de negação sobre ações de escrita no registro impedem que agentes editem suas próprias definições |

## Veja Também

- [Referência de Segurança](system/security.md) - Políticas, escopos, atores, token stores e o bloco `security:`
- [Gerenciamento de Dependências](guides/dependency-management.md#integrity-verification) - Verificação de digest de módulos
- [Cluster](guides/cluster.md#internode-identity) - Identidade internode e confiança entre peers
- [Workflows Temporal](temporal/workflows.md#security-context) - Propagação de contexto assinado
- [Registro](concepts/registry.md) - O armazenamento de capacidades
- [Modelo de Processos](concepts/process-model.md) - Isolamento e ciclo de vida de processos
- [Agentes](framework/agents.md) - Definições de agentes e uso de ferramentas
