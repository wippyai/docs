---
title: "Por que o Wippy usa Lua"
description: "As restrições da runtime, as escolhas envolvidas e os papéis complementares de Lua e WebAssembly no Wippy."
---

# Por que o Wippy usa Lua

O Wippy usa Lua como sua principal linguagem de runtime porque ela atende aos requisitos de isolamento de processos e incorporação da plataforma. Esta página explica essa decisão de projeto e suas implicações; não é uma classificação geral de linguagens de programação.

Esta é uma nota conceitual de projeto, não um tutorial executável. Ela descreve propriedades da runtime e aponta para as páginas de referência que definem as APIs concretas.

## Requisitos da runtime

O Wippy executa lógica definida pelo usuário em processos isolados. Cada processo tem sua própria memória e recebe apenas as capacidades expostas pela runtime. Como muitos processos podem ser executados simultaneamente, a linguagem incorporada precisa oferecer:

- **Baixo custo por processo.** O uso de memória precisa continuar viável à medida que a quantidade de processos aumenta.
- **Isolamento por capacidades.** A runtime precisa controlar os módulos, as funções e as operações de sistema disponíveis para cada processo.
- **Incorporação no processo.** O núcleo do Wippy em Go precisa conseguir criar, configurar e encerrar um ambiente de linguagem para cada processo.
- **Carregamento controlado de módulos.** Os módulos devem vir da lista de permissões da runtime ou de imports declarados no registry, e não de caminhos arbitrários do sistema de arquivos.
- **Uma superfície de linguagem pequena.** O código da aplicação deve permanecer legível e simples de gerar, revisar e analisar estaticamente.

## Alternativas consideradas

### Python

Python oferece um amplo ecossistema para aplicações e dados, mas seu interpretador, modelo de imports e pressupostos de pacotes não correspondem ao modelo de incorporação e capacidades por processo do Wippy. Serviços em Python ainda podem se integrar ao Wippy por limites de serviço explícitos.

### JavaScript

As runtimes JavaScript oferecem várias opções de incorporação. No entanto, seus ecossistemas de módulos e pacotes exigem uma camada de integração separada para fornecer o modelo de carregamento limitado pelo registry usado pelo Wippy. Para código de aplicação, o Wippy escolheu a superfície menor e controlada pelo host oferecida por Lua.

### Go

Go é usado no núcleo da runtime do Wippy. Código Go compilado e plugins não oferecem o mesmo ambiente incorporado, isolado e por processo exigido pela lógica de aplicação definida pelo usuário.

### WebAssembly

WebAssembly exerce um papel complementar, em vez de substituir Lua como a principal linguagem de autoria. A divisão de responsabilidades é descrita em [Lua e WebAssembly](#lua-e-webassembly).

## Por que Lua se encaixa

### Incorporação controlada pelo host

Lua foi projetada para ser executada dentro de uma aplicação host. O Wippy cria um ambiente para cada processo, conecta-o ao scheduler e ao registry e controla seus globais e seu carregador de módulos. `require` lê apenas módulos já instalados nesse ambiente: módulos básicos e bibliotecas padrão sempre disponíveis, o módulo ambiente `process` do entry executável, módulos integrados da runtime permitidos por `modules:` e bibliotecas do registry declaradas por `imports:`. Ele não pesquisa caminhos do sistema de arquivos nem instala pacotes pela rede. Entrys diferentes podem, portanto, receber conjuntos diferentes de módulos sem regras de carregamento no nível da aplicação.

### Superfície da linguagem

Lua tem uma sintaxe compacta e um ambiente padrão pequeno. O Wippy acrescenta anotações de tipo e lint para que o código possa ser verificado de forma incremental sem alterar o modelo de execução subjacente.

### Agendamento cooperativo

As corrotinas de Lua correspondem ao modelo de agendamento cooperativo do Wippy. Um processo pode ceder durante operações de channel ou I/O enquanto o scheduler executa outro trabalho.

## Limitações e escolhas

Lua não oferece um ecossistema de pacotes no processo comparável a pip ou npm. O Wippy disponibiliza módulos integrados da runtime por meio de uma lista de permissões e bibliotecas da aplicação por imports do registry, em vez de instalar pacotes pela rede. Cargas de trabalho que dependem de grandes bibliotecas externas podem ser executadas como serviços ou componentes WebAssembly.

Lua também pode ser pouco familiar para quem vem de outras linguagens. A sintaxe é compacta, mas equipes ainda precisam de convenções, revisão e lint para código de produção.

## Lua e WebAssembly

O Wippy oferece duas runtimes complementares:

- **Lua** é a runtime principal para lógica de aplicação, ferramentas e agentes.
- **WebAssembly** executa cargas de trabalho compiladas e código existente que possa ter WASM como destino.

Entrys de processo Lua e WASM usam o modelo de processos do Wippy; funções Lua e WASM são expostas por meio de entries de função registrados. Ambas as integrações são configuradas pelo registry e pelas políticas de segurança da runtime. Código Lua pode chamar funções WASM registradas, e processos WASM podem chamar funções Lua registradas.

## Consulte também

- [Visão geral da runtime Lua](./overview.md) - A runtime Lua e seus módulos
- [Tipos](./types.md) - Anotações de tipo, genéricos e uniões
- [Linter](../guides/linter.md) - Análise estática para Lua
- [Runtime WASM](../wasm/overview.md) - Execução de código compilado no sandbox
