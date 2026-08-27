---
title: "Contrato frontend: comece aqui"
description: "O ponto de entrada para páginas, web components, builds, roteamento e integração de tema portáveis no Wippy."
---

# Contrato frontend: comece aqui

Esta página é um guia de orientação e uma referência de navegação. Ela identifica os contratos que um módulo frontend deve seguir; não é um tutorial de build nem um exemplo completo de aplicação.

Módulos frontend do Wippy são portáveis por padrão. Um módulo deve continuar funcionando quando for importado em outro projeto Wippy cuja facade forneça um tema PrimeVue compatível diferente e nenhum CSS privado do projeto.

## Escolha o caminho correto

1. Use um `view.page` para uma aplicação renderizada pelo engine de página configurado: um iframe legado `about:srcdoc` ou um Web Fragment.
2. Use um `view.component` para um custom element renderizado no documento do host, normalmente com um shadow root.
3. Se a interface renderiza botão, input, campo de formulário, menu, overlay ou outro controle semelhante ao PrimeVue, use PrimeVue, salvo quando ele não puder fornecer a semântica e affordance necessárias.
4. Um componente apenas de conteúdo, como uma visualização Chart.js sem controles, pode omitir PrimeVue e Tailwind.
5. Se um controle personalizado for necessário, siga o [Contrato de UI portável](./portable-ui-contract.md) e [Composições personalizadas](./micro-frontends/custom-composites.md).

PrimeVue é o vocabulário de componentes compartilhado. O preset Tailwind do Wippy é um vocabulário de build compatível. Apenas utilities documentadas como apoiadas pela runtime continuam respondendo a alterações do tema da facade após a compilação.

## Mapa de responsabilidades

```text
module source
  -> build command
  -> emitted artifact
  -> registry owner
  -> served URL
  -> Web Host
  -> page surface (srcdoc iframe or Web Fragment) or component shadow root
  -> AppConfig / router / theme delivery
```

Não deduza uma etapa a partir de outra. Antes de diagnosticar um asset ausente, identifique o pacote de origem, o destino do build, o arquivo emitido, o entry do registry, o mount do sistema de arquivos e a URL servida.

## Páginas do contrato

- [Topologia da plataforma](./platform-topology.md): limites da runtime, roteamento, entrega de CSS, overlays e responsabilidades.
- [Contrato de UI portável](./portable-ui-contract.md): regras normativas de componentes e estilo.
- [Criação de temas](./micro-frontends/theming.md): o que pertence ao `custom_css` da facade, ao CSS do tema PrimeVue ou a um módulo.
- [Contrato Tailwind](./micro-frontends/tailwind-contract.md): utilities apoiadas pela runtime em comparação com constantes compiladas.
- [Catálogo de tokens](./micro-frontends/token-catalogue.md): referência gerada de tokens e procedência.
- [A camada de design](./design-layer.md): onde colocar algo usado por vários módulos próprios quando o tema não oferece o componente.
- [Receita de página](./micro-frontends/micro-frontend-app.md) e [receita de Web Component](./micro-frontends/web-component.md).
- [Contrato de build e dependências](./micro-frontends/build-system.md).
- [Configuração e casing](./micro-frontends/configuration-casing.md).
- [Índice de regras de conformidade](./micro-frontends/compliance-checklist.md).

## Verificações obrigatórias

- Nunca invente uma prop, API de componente, variável CSS ou utility semântica Tailwind do PrimeVue. Verifique no código-fonte do pacote selecionado e no catálogo gerado.
- Nunca construa um nome de token `--p-*` por analogia.
- Nunca exija em um módulo portável uma classe arbitrária da facade.
- Nunca deduza o contexto de rota do host pela localização do navegador. Páginas recebem o contexto do host por AppConfig e usam `@wippy-fe/router`.
- Recompile exatamente o pacote proprietário para a saída servida antes da verificação no navegador.
- Verifique o console do navegador após navegar e interagir de forma relevante.

Módulos vinculados a um projeto ficam fora do contrato portável. Eles são documentados somente em [Módulos vinculados ao projeto não compatíveis](./micro-frontends/unsupported-project-bound.md); a conformidade padrão retorna `UNSUPPORTED` e o CI padrão falha.
