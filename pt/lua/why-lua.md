---
title: "Por Que o Wippy Usa Lua - Decisão sobre a Linguagem de Runtime Embarcada"
description: "O Wippy usa Lua como sua linguagem de runtime principal. Eis o porquê: consumo de memória, capacidade total de sandbox, embedding limpo em Go, carregamento determinístico de módulos e sintaxe amigável a LLMs."
---

# Por Que o Wippy Usa Lua

Todo avaliador técnico faz essa pergunta, então aqui está a resposta direta.

## Requisitos do Runtime

O Wippy executa lógica definida pelo usuário dentro de processos isolados. Cada processo precisa do seu próprio espaço de memória, do seu próprio conjunto de capacidades disponíveis e de nenhuma forma de alcançar algo fora do seu limite a menos que o runtime permita explicitamente. A plataforma executa milhares desses processos concorrentemente em uma única instância, cada um potencialmente executando código diferente para tenants diferentes.

Isso significa que o runtime da linguagem embarcado dentro de cada processo deve ser:

- **Minúsculo.** Cada processo roda no seu próprio ambiente isolado. Com milhares de processos concorrentes, a memória por processo importa. O Wippy tem como alvo uma sobrecarga base de ~13 KB por processo.
- **Totalmente isolável em sandbox.** O runtime deve controlar exatamente quais módulos, funções e chamadas de sistema cada processo pode acessar. Sem autoridade ambiente. Sem estado global vazando entre processos.
- **Embarcável.** O runtime da linguagem deve ser uma biblioteca que o núcleo do Wippy (escrito em Go) possa instanciar, configurar e destruir por processo. Não pode ser um processo externo nem um binário separado.
- **Determinístico no carregamento de módulos.** Quando um processo inicia, o runtime decide qual código ele pode enxergar. Sem acesso ao sistema de arquivos. Sem um `require` que alcance caminhos arbitrários. As dependências vêm do registry, com escopo por processo.
- **Com sintaxe amigável a LLMs.** Agentes geram e modificam código. A linguagem deve ser simples o bastante para que um LLM consiga ler, escrever e raciocinar sobre ela de forma confiável, sem alucinar sintaxe.

## Linguagens Avaliadas: Python, JavaScript, Go e WASM

### Python

A escolha padrão para cargas de trabalho de IA. Nós a descartamos porque o consumo de memória do CPython é de 10-30 MB por interpretador, ordens de magnitude maior que um processo Lua. O sistema de import do Python dá ao código acesso ambiente ao sistema de arquivos, à rede e ao SO. Isolar Python em sandbox exige ou compilação para WASM (o que quebra a maioria das bibliotecas) ou remendos pesados no interpretador. O modelo de concorrência do Python (o GIL) também conflita com nosso modelo de isolamento por processo. O ecossistema é um ponto forte para scripts independentes, mas um passivo para um runtime em sandbox onde você precisa de controle determinístico sobre o que o código pode acessar.

### JavaScript (V8/QuickJS)

O V8 é rápido, mas enorme (dezenas de MB por isolate). O QuickJS é pequeno o bastante para ser embarcado, mas a cadeia de protótipos do JavaScript e seu sistema dinâmico de módulos tornam o sandboxing mais difícil do que parece. `import` e `require` querem alcançar o sistema de arquivos. O ecossistema espera o npm, que pressupõe acesso à rede e um sistema de arquivos gravável, nenhum dos quais existe dentro de um processo Wippy. Gastaríamos mais tempo lutando contra as premissas da linguagem do que construindo o produto.

### Go

O núcleo do Wippy é escrito em Go, então isso era tentador. Mas Go não se embarca. Você não pode instanciar um runtime Go como biblioteca dentro de outro programa Go. Plugins Go existem, mas são frágeis, compartilham memória com o processo hospedeiro e não podem ser isolados em sandbox. Go é a escolha certa para o runtime em si; é a escolha errada para código de usuário.

### WASM

Genuinamente forte para sandboxing, e nós o construímos como o segundo runtime do Wippy (veja abaixo). Mas WASM sozinho não é suficiente como linguagem principal para desenvolvimento de agentes. A experiência de desenvolvimento para escrever e depurar WASM diretamente ainda é rústica, e LLMs geram código voltado a WASM com menos confiabilidade do que geram Lua. WASM é a escolha certa quando você precisa executar código compilado de outras linguagens dentro do sandbox do Wippy. Lua é a escolha certa para a experiência principal de desenvolvimento e de autoria por agentes.

## Por Que Lua Atende aos Cinco Requisitos

Lua foi feita exatamente para este caso de uso. É a linguagem de script mais embarcada em produção, rodando dentro de World of Warcraft, Roblox, Redis, Nginx/OpenResty, equipamentos de rede da Cisco e da Juniper, Adobe Lightroom e centenas de motores de jogos. Está embarcada em ambientes hostis (jogos onde usuários executam código não confiável) há mais de 25 anos.

### Memória

Um processo Lua do Wippy tem uma sobrecarga base de ~13 KB. Com 10.000 processos concorrentes, isso representa cerca de 130 MB de sobrecarga base de processos. Em Python, a mesma quantidade exigiria 100-300 GB. Essa não é uma preocupação teórica; é a diferença entre rodar em uma única máquina e precisar de um cluster.

### Sandboxing

O sistema de módulos de Lua é uma única função (`require`) que o hospedeiro controla completamente. Substitua-a por um loader customizado que resolva apenas o que foi concedido ao processo, e o processo enxerga apenas o que você permite. Não existe `import os`, não existe `subprocess`, não existe acesso ambiente ao sistema de arquivos; essas funções não estão presentes no ambiente de um processo. O sandbox é o estado padrão, não um remendo sobre um sistema aberto.

### Embedding

A interface de Lua é notoriamente pequena. A API C canônica tem cerca de 60 funções, e implementações puras em Go tornam direto embarcá-la no núcleo Go do Wippy, sem cgo. Criar e destruir o ambiente Lua de um processo é barato; o Wippy faz isso a cada início de processo sem sobrecarga mensurável.

### Controle determinístico de módulos

No Wippy, o código que um processo pode carregar é determinado pelo seu escopo no registry. O loader Lua resolve módulos a partir do registry, não do sistema de arquivos. Se um módulo não foi concedido a um processo, esse módulo não existe da perspectiva do processo. É assim que o isolamento multi-tenant funciona no nível do código: tenants diferentes podem ter módulos diferentes disponíveis, imposto pelo runtime, não pela lógica da aplicação.

### Amigável a LLMs

A sintaxe de Lua é mínima: sem classes, sem decoradores, sem anotações de tipo embutidas na linguagem, sem async/await, sem resolução complexa de módulos. Um LLM que já viu Lua consegue gerar Lua correta de primeira com muito mais confiabilidade do que consegue gerar Python correto (com seus padrões de decoradores, gerenciadores de contexto e sistema de tipos) ou JavaScript (com sua cadeia de protótipos, vinculação de `this` e variantes de módulos). Para uma plataforma onde agentes escrevem e modificam suas próprias ferramentas, isso importa. O Wippy estende Lua com um sistema de anotações de tipo (genéricos, uniões, tipos de channel) e um linter integrado, então você obtém segurança de tipos sem a complexidade sintática.

### Corrotinas

Lua tem suporte nativo a corrotinas, que mapeia diretamente para o modelo de processos concorrentes do Wippy. Cada processo roda em uma corrotina que cede a vez ao escalonador. Sem threads. Sem locks. Sem condições de corrida entre processos. Milhares de processos concorrentes cooperam sem a complexidade da concorrência baseada em threads.

## O Que Você Perde

O ecossistema de Lua é pequeno. Não há equivalente a pip ou npm com dezenas de milhares de pacotes. Isso é intencional: no Wippy, dependências são entradas de registry com capacidades e políticas de segurança declaradas, não pacotes arbitrários puxados da internet. Mas isso significa que você não pode fazer `pip install pandas` dentro de um processo Wippy. Processamento de dados que exija suporte pesado de bibliotecas (inferência de modelos de ML, computação numérica complexa) deve rodar como serviços externos que os agentes Wippy chamam via ferramentas, ou rodar como funções WASM dentro do sandbox do Wippy.

Lua também é desconhecida para a maioria dos desenvolvedores. A curva de aprendizado é real, embora curta; toda a referência da linguagem Lua tem cerca de 30 páginas. A maioria dos desenvolvedores que conhece qualquer linguagem de programação consegue escrever Lua em um dia. O desconhecimento é um custo de atrito, mas os benefícios arquiteturais (sandboxing, memória, embedding) o superam para uma plataforma de runtime onde a maior parte do código de usuário é curta, orientada a ferramentas e cada vez mais gerada por IA.

## Lua + WASM: O Quadro Completo

O Wippy não é uma plataforma exclusivamente Lua. Ele entrega dois runtimes:

**Lua** é o runtime principal para desenvolvimento de agentes, autoria de ferramentas e lógica de aplicação. É onde a maior parte do código Wippy é escrita e onde os agentes geram código. O consumo reduzido, a capacidade total de sandbox e a sintaxe amigável a LLMs a tornam o padrão certo.

**WASM** é o runtime secundário para cargas de trabalho compiladas. Se você tem código existente em Rust, Go, C ou qualquer linguagem que compile para WebAssembly, pode executá-lo dentro do Wippy com o mesmo isolamento de processo e a mesma integração com o registry que Lua. Funções e processos WASM integram-se ao WASI para relógios, E/S, sistema de arquivos (via entradas de filesystem do Wippy montadas) e acesso ao ambiente. Isso significa que você pode trazer lógica de negócio existente para o sandbox do Wippy sem reescrevê-la em Lua.

Os dois runtimes compartilham o mesmo modelo de processos, o mesmo registry e as mesmas políticas de segurança. Um agente Lua pode chamar uma função WASM. Um processo WASM pode chamar funções Lua através do registry. Eles são pares no mesmo sistema.

## Veja Também

- [Visão Geral do Runtime Lua](lua/overview.md) - O runtime Lua e seus módulos
- [Tipos](lua/types.md) - Anotações de tipo, genéricos e uniões
- [Linter](guides/linter.md) - Análise estática para Lua
- [Runtime WASM](wasm/overview.md) - Executando código compilado no sandbox
