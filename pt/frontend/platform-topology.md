---
title: "Topologia da Plataforma"
description: "Como o código-fonte de frontend do Wippy se torna uma página roteada ou um web component e recebe contexto de runtime e CSS."
---

# Topologia da Plataforma

## Cadeia de entrega

| Estágio | Responsável | Verificação |
|---|---|---|
| Código-fonte e build do pacote | Módulo de frontend | O build do pacote emite o arquivo de entrada esperado. |
| Localização do artefato | Alvo de build do deployment | O comando de build recebe `--outDir`; o Vite não o fixa no código. |
| Entrada de registry | Módulo de backend | `view.page` ou `view.component` aponta para a entrada emitida. |
| URL servida | Entradas de registry de filesystem e HTTP | Uma requisição direta ao asset retorna o JavaScript ou HTML compilado. |
| Container de runtime | Web Host | Uma página usa `about:srcdoc`; um componente usa um elemento customizado, normalmente com shadow DOM. |
| Contexto | AppConfig e pacotes Wippy | Roteamento, acesso à API e dados de tema chegam através de pacotes suportados. |

A presença do código-fonte, um build bem-sucedido ou uma entrada de registry válida não comprovam o estágio seguinte. Verifique cada fronteira.

## Páginas

Uma `view.page` roda em um iframe `about:srcdoc`. A URL do iframe não é a rota do host. Não inspecione `window.location`, `window.parent.location` nem parâmetros de query para descobrir o estado do host. Use o AppConfig e o `@wippy-fe/router`; o pacote cuida da integração com as rotas do Wippy.

A injeção de CSS `iframe` fornece atualmente a estilização padrão de scrollbar tematizada. Seu nome é histórico e mais abrangente do que seu propósito atual. Mantenha-a habilitada para consistência de scrollbar; não a descreva como um reset de layout.

## Web components

Um `view.component` roda no documento do host e normalmente é dono de um shadow root. Seletores CSS não atravessam uma fronteira de shadow pela cascata. O Web Host pode entregar folhas de estilo aprovadas e CSS da facade dentro dessa raiz, de acordo com a configuração do componente.

Herança de variáveis CSS e injeção de folhas de estilo são mecanismos diferentes:

- Variáveis públicas herdadas podem atravessar a fronteira host-para-shadow.
- Regras de seletor afetam um shadow root apenas quando entregues dentro dessa raiz.
- A entrega não transforma um seletor arbitrário em uma API portável.

## Tema e overlays

A facade fornece o tema PrimeVue. Regras `.p-*` compartilhadas no `custom_css` da facade são implementação de tema válida e podem ser globais quando destinadas ao host e aos filhos. Use `.wippy-host-app` apenas para chrome específico do host.

O modo de tema é estado do AppConfig, não uma API de classes CSS. Aplicações, componentes,
fixtures e testes de navegador trocam o modo com
`host.setThemeMode('auto' | 'light' | 'dark')` de `@wippy-fe/proxy`, depois esperam
por `@theme` e verificam `host.getThemeMode()`. O AppConfig leva a mudança
através do transporte host-para-filho. O host atualiza seu documento,
retransmite o AppConfig para os iframes `about:srcdoc` vivos e espelha o modo nas
raízes de web components. Nunca force diretamente as classes `w-theme-dark` ou
`w-theme-light`.

Nunca force diretamente as classes `w-theme-dark` ou `w-theme-light`.

Overlays do PrimeVue podem ser teleportados. Verifique a raiz real do overlay no documento de topo, nos documentos de iframe e nos shadow roots descobertos recursivamente. Não presuma um posicionamento genérico do PrimeVue.

## Ordem de depuração em runtime

1. Confirme que o backend está escutando.
2. Inspecione os logs do backend em busca de respostas 5xx inesperadas.
3. Confirme o dono no registry e a URL do asset servido.
4. Confirme que o build exato do pacote emitiu aquele asset.
5. Carregue a raiz do host antes de navegar pela SPA quando deep links diretos não forem suportados.
6. Inspecione erros de console e de rede após a navegação e a interação.
7. Para cenários de tema, chame o método público de tema do proxy, observe `@theme`
   e verifique `host.getThemeMode()` antes de aceitar uma captura de tela.
