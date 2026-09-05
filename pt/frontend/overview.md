---
title: "Contrato de Frontend: Comece Aqui"
description: "O ponto de entrada para páginas Wippy portáveis, web components, builds, roteamento e integração de temas."
---

# Contrato de Frontend: Comece Aqui

Módulos de frontend do Wippy são portáveis por padrão. Um módulo deve continuar funcionando quando é importado em outro projeto Wippy cuja facade fornece um tema PrimeVue compatível diferente e nenhum CSS privado do projeto.

## Escolha o caminho correto

1. Use um `view.page` para uma aplicação renderizada em um iframe `about:srcdoc`.
2. Use um `view.component` para um custom element renderizado no documento host, normalmente com um shadow root.
3. Se a UI renderiza um botão, input, campo de formulário, menu, overlay ou outro controle no estilo PrimeVue, use PrimeVue, a menos que ele não consiga fornecer a semântica e a affordance necessárias.
4. Um componente apenas de conteúdo, como uma visualização Chart.js sem controles, pode omitir PrimeVue e Tailwind.
5. Se um controle customizado for necessário, siga o [Contrato de UI Portável](./portable-ui-contract.md) e [Composites Customizados](./micro-frontends/custom-composites.md).

PrimeVue é o vocabulário compartilhado de componentes. O preset Tailwind do Wippy é um vocabulário suportado em tempo de build. Apenas os utilitários documentados como runtime-backed permanecem responsivos a mudanças de tema da facade após a compilação.

## Mapa de propriedade

```text
código-fonte do módulo
  -> comando de build
  -> artefato emitido
  -> dono no registry
  -> URL servida
  -> Web Host
  -> iframe srcdoc da página ou shadow root do componente
  -> entrega de AppConfig / router / tema
```

Não deduza um estágio a partir de outro. Antes de depurar um asset ausente, identifique o pacote de origem, o alvo de build, o arquivo emitido, a entrada no registry, o mount no sistema de arquivos e a URL servida.

## Páginas do contrato

- [Topologia da Plataforma](./platform-topology.md): limites de runtime, roteamento, entrega de CSS, overlays e propriedade.
- [Contrato de UI Portável](./portable-ui-contract.md): regras normativas de componentes e estilização.
- [Autoria de Temas](./micro-frontends/theming.md): o que pertence ao `custom_css` da facade, ao CSS do tema PrimeVue ou a um módulo.
- [Contrato Tailwind](./micro-frontends/tailwind-contract.md): utilitários runtime-backed versus constantes compiladas.
- [Catálogo de Tokens](./micro-frontends/token-catalogue.md): referência gerada de tokens e sua proveniência.
- [A Camada de Design](./design-layer.md): onde algo pertence quando vários dos seus próprios módulos precisam dele e o tema não tem um componente para isso.
- [Receita de Página](./micro-frontends/micro-frontend-app.md) e [Receita de Web Component](./micro-frontends/web-component.md).
- [Contrato de Build e Dependências](./micro-frontends/build-system.md).
- [Configuração e Casing](./micro-frontends/configuration-casing.md).
- [Índice de Regras de Conformidade](./micro-frontends/compliance-checklist.md).

## Verificações inegociáveis

- Nunca invente uma prop do PrimeVue, uma API de componente, uma variável CSS ou um utilitário semântico do Tailwind. Verifique no código-fonte do pacote selecionado e no catálogo gerado.
- Nunca construa um nome de token `--p-*` por analogia.
- Nunca exija uma classe arbitrária da facade a partir de um módulo portável.
- Nunca deduza o contexto de rota do host a partir da location do navegador. Páginas recebem o contexto do host através do AppConfig e usam `@wippy-fe/router`.
- Reconstrua exatamente o pacote dono na saída servida antes da verificação no navegador.
- Verifique o console do navegador após a navegação e após interações relevantes.

Módulos vinculados a projeto estão fora do contrato portável. Eles são documentados apenas na página [Módulos Vinculados a Projeto Não Suportados](./micro-frontends/unsupported-project-bound.md); a conformidade padrão retorna `UNSUPPORTED` e o CI padrão falha.
