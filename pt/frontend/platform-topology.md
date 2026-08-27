---
title: "Topologia da plataforma"
description: "Como o código-fonte frontend do Wippy se torna uma página roteada ou web component e recebe contexto e CSS da runtime."
---

# Topologia da plataforma

Esta página é uma referência de arquitetura e diagnóstico. A cadeia de entrega e os diagramas descrevem limites do sistema; eles não fornecem um projeto executável.

## Cadeia de entrega

| Etapa | Responsável | Verificação |
|-------|-------------|-------------|
| Código-fonte e build do pacote | Módulo frontend | O build do pacote emite o arquivo de entrada esperado. |
| Local do artefato | Destino do build da implantação | O comando de build recebe `--outDir`; o Vite não o fixa no código. |
| Entry do registry | Módulo backend | `view.page` ou `view.component` aponta para o entry emitido. |
| URL servida | Entrys de sistema de arquivos e HTTP | Uma requisição direta ao asset retorna o JavaScript ou HTML compilado. |
| Contêiner da runtime | Web Host | Uma página usa o engine configurado: iframe legado `about:srcdoc` ou Web Fragment. Um componente usa um custom element, normalmente com shadow DOM. |
| Contexto | AppConfig e pacotes Wippy | Roteamento, acesso à API e dados de tema chegam por pacotes compatíveis. |

A presença do código-fonte, um build bem-sucedido ou um entry válido no registry não comprova a etapa seguinte. Verifique cada limite.

## Páginas

Um `view.page` é executado por um de dois engines: iframe legado `about:srcdoc` ou Web Fragment. A configuração global `hostConfig.renderEngine` seleciona a base; `wippy.renderEngine` da página pode segui-la, optar por `iframe` ou solicitar `fragment` quando a implantação oferecer suporte. O código da aplicação permanece independente do engine. Em nenhum engine a localização do navegador é o contrato de rota do child. Use AppConfig e `@wippy-fe/router`; o pacote cuida da integração com as rotas do Wippy.

A injeção CSS de `iframe` atualmente oferece estilo padrão de scrollbar com tema. Seu nome é histórico e mais amplo que sua finalidade atual. Mantenha-a ativa para a consistência da scrollbar; não a descreva como reset de layout.

## Web components

Um `view.component` é executado no documento do host e normalmente possui um shadow root. Seletores CSS não atravessam um limite de shadow. O Web Host pode entregar stylesheets aprovados e CSS da facade nesse root conforme a configuração do componente.

Herança de variáveis CSS e injeção de stylesheets são mecanismos diferentes:

- Variáveis públicas herdadas podem atravessar o limite entre host e shadow.
- Regras de seletores afetam um shadow root apenas quando entregues dentro dele.
- A entrega não transforma um seletor arbitrário em API portável.

## Tema e overlays

A facade fornece o tema PrimeVue. Regras `.p-*` compartilhadas no `custom_css` da facade são uma implementação válida do tema e podem ser globais quando destinadas ao host e aos children. Use `.wippy-host-app` apenas para chrome específico do host.

O modo do tema é estado do AppConfig, não uma API de classes CSS. Aplicações, componentes, fixtures e testes de navegador mudam o modo com `host.setThemeMode('auto' | 'light' | 'dark')` de `@wippy-fe/proxy`, esperam por `@theme` e verificam `host.getThemeMode()`. O AppConfig transporta a alteração do host para o child. O host atualiza seu documento, retransmite o AppConfig aos realms ativos de iframe e Web Fragment e espelha o modo nos roots de web components. Nunca force diretamente as classes `w-theme-dark` ou `w-theme-light`.

Overlays PrimeVue podem usar teleport. Verifique o root real do overlay no documento principal, nos documentos iframe e em shadow roots descobertos recursivamente. Não presuma o posicionamento genérico do PrimeVue.

## Ordem de diagnóstico da runtime

1. Confirme que o backend está ouvindo.
2. Inspecione os logs do backend em busca de respostas 5xx inesperadas.
3. Confirme o proprietário no registry e a URL do asset servido.
4. Confirme que o build do pacote exato emitiu esse asset.
5. Carregue a raiz do host antes de navegar pela SPA quando deep links diretos não forem compatíveis.
6. Inspecione erros de console e rede após a navegação e a interação.
7. Em cenários de tema, chame o método público do proxy, observe `@theme` e verifique `host.getThemeMode()` antes de aceitar uma captura de tela.
