---
title: "Receita de página"
description: "Uma receita portável de view.page com roteamento, entrega de tema, dependências e propriedade do build compatíveis."
---

# Receita de página

Uma página é uma aplicação compilada com Vite e renderizada pelo engine legado de iframe `about:srcdoc` ou pelo engine Web Fragment. Sua rota e seu contexto de host vêm do AppConfig e dos pacotes Wippy, não da localização do navegador.

Esta é uma receita de integração para um projeto Vue/Vite existente. Ela identifica o código de entrada específico do Wippy e o contrato de implantação; não fornece um scaffold de projeto independente nem a configuração do backend.

## Configuração necessária

1. Registre um `view.page` e seus entries de sistema de arquivos/router de serving.
2. Ative a entrega de CSS necessária. Quando o engine de iframe puder ser selecionado, mantenha o bloco CSS `iframe` ativo para conservar a consistência padrão da scrollbar.
3. Use `@wippy-fe/router` para o roteamento Vue.
4. Instale PrimeVue e o plugin PrimeVue do Wippy quando a página renderizar algum controle semelhante ao PrimeVue.
5. Use o preset Tailwind compartilhado do Wippy quando a página criar utilities Tailwind.
6. Gere externals a partir do snapshot de import map do Web Host fixado.
7. Monte a aplicação em `#app`; Web Fragments dimensionados pelo conteúdo exigem exatamente esse id de root.
8. Compile para o diretório de saída selecionado pela implantação.

```ts
import { createApp } from 'vue'
import PrimeVue from '@wippy-fe/theme/primevue-plugin'
import { createAppRouter } from '@wippy-fe/router'
import { config } from '@wippy-fe/proxy'
import App from './App.vue'
import { routes } from './routes'

const app = createApp(App)
app.use(PrimeVue)
app.use(createAppRouter(routes, {
  initialPath: config.context?.route ?? '/',
}))
app.mount('#app')
```

Confirme as assinaturas exportadas exatas na versão de pacote selecionada. Não crie uma camada local de sincronização do router.

## Injeção do tema

A página consome o tema da facade entregue ao realm de página selecionado. Use componentes PrimeVue públicos, variáveis públicas do tema, utilities Tailwind documentadas e apoiadas pela runtime e utilities de build explicitamente invariantes.

Não use um parâmetro de query do host como fixture da aplicação. O AppConfig é o proprietário do contexto do host.

## Build

Invoque o target Make do repositório do módulo Wippy. A receita fornece a saída de implantação com:

```text
npm run build -- --outDir <target> --emptyOutDir
```

`vite.config.ts` mantém o comportamento relativo dos assets e não fixa `outDir` da implantação.

Não invoque diretamente o comando subjacente do gerenciador de pacotes ou do Vite. No Windows, invoque `make.bat`; ele delega à implementação `make.ps1` do target.

Consulte [Contrato de build e dependências](./build-system.md), [Topologia da plataforma](../platform-topology.md) e [Configuração e casing](./configuration-casing.md).
