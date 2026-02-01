# Sobre o Wippy

Wippy é uma plataforma e runtime agêntico para software que precisa mudar enquanto está em execução — sistemas de automação, agentes de IA, arquiteturas de plugins e aplicações similares onde o núcleo é projetado uma vez e depois adaptado repetidamente sem reconstruir ou reimplantar.

A base é o modelo de atores. O código executa em processos isolados que se comunicam através de mensagens, cada um gerenciando seu próprio estado. Quando algo falha, falha de forma isolada. Árvores de supervisão tratam a recuperação automaticamente, reiniciando processos quando eles travam.

```lua
local worker = process.spawn("app.workers:handler", "app:processes")
process.send(worker, "task", {id = 1, data = payload})
process.monitor(worker)
```

A configuração reside em um registro central que propaga mudanças como eventos. Atualize um arquivo de configuração, e os processos em execução recebem as alterações. Eles se adaptam sem reiniciar — novas conexões, comportamento atualizado, o que você precisar — enquanto o sistema continua rodando.

```lua
local db = registry.get("app.db:postgres")
local cache = registry.get("app.cache:redis")
```

Para operações que devem sobreviver a falhas de infraestrutura — fluxos de pagamento, workflows de múltiplas etapas, tarefas de agentes de longa duração — o runtime persiste o estado automaticamente. O servidor morre no meio da operação? O workflow retoma em outra máquina, exatamente de onde parou.

O sistema inteiro roda a partir de um único arquivo. Sem containers para orquestrar, sem serviços para coordenar. Um binário, uma configuração, e o runtime cuida do resto.

## Contexto

O modelo de atores vem do Erlang, onde tem rodado switches de telecomunicações desde os anos 1980. A filosofia "deixe falhar" — isolar falhas, reiniciar rápido — também vem de lá. Go mostrou que canais e passagem de mensagens podem tornar o código concorrente legível. Temporal provou que workflows duráveis não precisam significar lutar contra o framework.

Construímos o Wippy porque agentes de IA precisam de infraestrutura que pode mudar enquanto estão em execução. Novas ferramentas, prompts atualizados, modelos diferentes — estes não podem esperar por um ciclo de deploy. Quando um agente precisa tentar uma nova abordagem, essa mudança deve funcionar em segundos, não após um release.

Como os agentes rodam como atores com acesso ao registro, eles podem fazer essas mudanças por conta própria — gerando código, registrando novos componentes, ajustando seus próprios workflows. Com permissões suficientes, um agente pode melhorar como funciona sem intervenção humana. O sistema pode escrever a si mesmo.
