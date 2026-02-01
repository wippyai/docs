# Unidades de Computação

O Wippy fornece três formas de executar código: funções, processos e workflows. Eles compartilham a mesma maquinaria subjacente, mas diferem em quanto tempo vivem, onde seu estado vai, e o que acontece quando as coisas falham.

## Funções

Funções são o modelo mais simples. Você as chama, elas executam, elas retornam um resultado. Nenhum estado persiste entre chamadas.

```lua
local result = funcs.call("app.math:add", 2, 3)
```

Funções executam no contexto do chamador. Se o chamador cancela ou termina, quaisquer funções em execução são canceladas também. Isso mantém as coisas simples — você não precisa pensar em limpeza.

<tip>
Use funções para handlers HTTP, transformações de dados, e qualquer coisa que deva completar rapidamente e retornar um resultado.
</tip>

## Processos

Processos são atores. Eles mantêm estado através de múltiplas mensagens, executam independentemente de quem os iniciou, e se comunicam através de passagem de mensagens.

```lua
local pid = process.spawn("app.workers:handler", "app:processes")
process.send(pid, "job", {task = "process_data"})
```

Quando você cria um processo, ele continua executando mesmo após seu código terminar. Processos podem monitorar uns aos outros, vincular-se juntos, e formar árvores de supervisão que automaticamente reiniciam filhos que falharam.

O agendador multiplexa milhares de processos através de um pool de workers. Cada processo cede quando aguarda I/O, permitindo que outros executem.

<tip>
Use processos para jobs em segundo plano, daemons de serviço, e qualquer coisa que precise sobreviver ao seu criador ou manter estado através de mensagens.
</tip>

## Workflows

Workflows são para operações que absolutamente não podem falhar. Eles persistem seu estado em um provedor de workflow (Temporal ou outros) e podem retomar exatamente de onde pararam após crashes, reinicializações ou mudanças de infraestrutura.

```lua
-- Isso pode executar por dias, sobreviver a reinicializações, e nunca perder progresso
workflow.execute("app.orders:process", order_id)
```

O trade-off é latência. Cada passo é registrado, então workflows são mais lentos que funções ou processos. Mas para processos de negócio de múltiplas etapas ou orquestrações de longa duração, essa durabilidade vale a pena.

<note>
O Wippy trata o determinismo automaticamente para workflows. Você não precisa aprender nenhuma técnica especial — escreva código normal e o runtime garante que ele se comporte corretamente durante o replay.
</note>

## Como Eles se Comparam

| | Funções | Processos | Workflows |
|---|---|---|---|
| **Estado** | Nenhum | Em memória | Persistido |
| **Tempo de vida** | Chamada única | Até sair ou falhar | Sobrevive a tudo |
| **Comunicação** | Valor de retorno + mensagens | Passagem de mensagens | Chamadas de atividade + mensagens |
| **Tratamento de falhas** | Chamador trata | Árvores de supervisão | Retry automático |
| **Latência** | Mais baixa | Baixa | Mais alta |

## Mesmo Código, Comportamento Diferente

Muitos módulos se adaptam ao seu contexto automaticamente. Por exemplo, `time.sleep()` em uma função bloqueia o worker, em um processo ele cede para deixar outros executarem, e em um workflow ele registra um timer que é reproduzido corretamente na recuperação.
