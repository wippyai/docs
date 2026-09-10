---
title: "Receita de Página"
description: "Uma receita portável de view.page com roteamento suportado, entrega de tema, dependências e propriedade do build."
---

# Receita de Página

Uma página é uma aplicação compilada com Vite e renderizada em um iframe `about:srcdoc`. Sua rota e seu contexto de host vêm do AppConfig e dos pacotes do Wippy, não da location do navegador.

## Configuração obrigatória

1. Registre uma `view.page` e suas entradas de filesystem/router de serving.
2. Habilite a entrega de CSS necessária. Mantenha o bloco de CSS `iframe` habilitado para a consistência padrão de scrollbar.
3. Use `@wippy-fe/router` para o roteamento Vue.
4. Instale o PrimeVue e o plugin PrimeVue do Wippy quando a página renderizar qualquer controle no estilo PrimeVue.
5. Use o preset Tailwind compartilhado do Wippy quando a página escrever utilitários Tailwind.
6. Gere os externals a partir do snapshot fixado de import-map do Web Host.
7. Compile para o diretório de saída selecionado pelo deployment.

```ts
import { createApp } from 'vue'
import PrimeVue from '@wippy-fe/theme/primevue-plugin'
import { createAppRouter } from '@wippy-fe/router'
import App from './App.vue'
import { routes } from './routes'

const app = createApp(App)
app.use(PrimeVue)
app.use(createAppRouter(routes))
app.mount('#app')
```

Verifique as assinaturas exatas exportadas contra a versão de pacote selecionada. Não crie uma camada local de sincronização de router.

## Injeção de tema

A página consome o tema da facade entregue em seu iframe. Use componentes públicos do PrimeVue, variáveis públicas de tema, utilitários Tailwind documentados e apoiados em runtime, e utilitários de tempo de compilação explicitamente invariantes.

Não use um parâmetro de query do host como fixture de aplicação. O AppConfig é dono do contexto do host.

## Build

Invoque o alvo de Make do repositório de módulos do Wippy. Sua receita fornece a
saída de deployment com:

```text
npm run build -- --outDir <target> --emptyOutDir
```

O `vite.config.ts` mantém o comportamento relativo de assets e não fixa o `outDir` de deployment no código.

Não invoque diretamente o gerenciador de pacotes subjacente nem o comando de build do Vite.
No Windows, invoque `make.bat`; ele delega para a implementação `make.ps1`
do alvo.

Veja [Contrato de Build e Dependências](./build-system.md), [Topologia da Plataforma](../platform-topology.md) e [Configuração e Casing](./configuration-casing.md).
