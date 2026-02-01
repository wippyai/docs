# Sobre o Wippy

Wippy e uma plataforma e runtime agentico para software que precisa mudar enquanto esta em execucao - sistemas de automacao, agentes de IA, arquiteturas de plugins e aplicacoes similares onde o nucleo e projetado uma vez e depois adaptado repetidamente sem reconstruir ou reimplantar.

A base e o modelo de atores. O codigo executa em processos isolados que se comunicam atraves de mensagens, cada um gerenciando seu proprio estado. Quando algo falha, falha de forma isolada. Arvores de supervisao tratam a recuperacao automaticamente, reiniciando processos quando eles travam.

```lua
local worker = process.spawn("app.workers:handler", "app:processes")
process.send(worker, "task", {id = 1, data = payload})
process.monitor(worker)
```

A configuracao reside em um registro central que propaga mudancas como eventos. Atualize um arquivo de configuracao, e os processos em execucao recebem as alteracoes. Eles se adaptam sem reiniciar - novas conexoes, comportamento atualizado, o que voce precisar - enquanto o sistema continua rodando.

```lua
local db = registry.get("app.db:postgres")
local cache = registry.get("app.cache:redis")
```

Para operacoes que devem sobreviver a falhas de infraestrutura - fluxos de pagamento, workflows de multiplas etapas, tarefas de agentes de longa duracao - o runtime persiste o estado automaticamente. O servidor morre no meio da operacao? O workflow retoma em outra maquina, exatamente de onde parou.

O sistema inteiro roda a partir de um unico arquivo. Sem containers para orquestrar, sem servicos para coordenar. Um binario, uma configuracao, e o runtime cuida do resto.

## Contexto

O modelo de atores vem do Erlang, onde tem rodado switches de telecomunicacoes desde os anos 1980. A filosofia "deixe falhar" - isolar falhas, reiniciar rapido - tambem vem de la. Go mostrou que canais e passagem de mensagens podem tornar o codigo concorrente legivel. Temporal provou que workflows duraveis nao precisam significar lutar contra o framework.

Construimos o Wippy porque agentes de IA precisam de infraestrutura que pode mudar enquanto estao em execucao. Novas ferramentas, prompts atualizados, modelos diferentes - estes nao podem esperar por um ciclo de deploy. Quando um agente precisa tentar uma nova abordagem, essa mudanca deve funcionar em segundos, nao apos um release.

Como os agentes rodam como atores com acesso ao registro, eles podem fazer essas mudancas por conta propria - gerando codigo, registrando novos componentes, ajustando seus proprios workflows. Com permissoes suficientes, um agente pode melhorar como funciona sem intervencao humana. O sistema pode escrever a si mesmo.
