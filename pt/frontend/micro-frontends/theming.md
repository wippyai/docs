---
title: "Autoria de Tema"
description: "Como a facade escreve um tema PrimeVue e como os módulos permanecem portáveis."
---

# Autoria de Tema

A facade escreve um tema PrimeVue. Os módulos consomem esse tema; eles não criam mini design systems paralelos.

O Wippy atualmente executa o PrimeVue com `theme: 'none'`. A aparência dos componentes é fornecida pelo CSS PrimeVue do Wippy escrito em Tailwind, por variáveis públicas de runtime e pela customização da facade.

## Onde a estilização pertence

| Questão de estilização | Responsável |
|---|---|
| Aparência de componentes PrimeVue compartilhada por todo o produto | Tema PrimeVue da facade em `custom_css` e variáveis públicas de tema |
| Apenas o chrome do shell do host | CSS da facade com escopo em `.wippy-host-app` |
| Uma regra `.p-*` compartilhada destinada às raízes do host e do filho | `custom_css` global da facade; nenhum escopo de host necessário |
| Sobrescrita de tema apenas para uma página | Configuração da página usando o casing de frontend suportado |
| Layout de domínio ou estrutura inédita | CSS ou Tailwind do módulo |
| Uma parte customizada não-PrimeVue necessária | CSS do módulo, reutilizando tokens públicos e utilitários invariantes documentados |
| A mesma parte não-PrimeVue necessária em vários módulos seus | Um pacote compartilhado — veja [A Camada de Design](../design-layer.md) |
| Uma classe arbitrária esperada de uma facade | Não portável; proibido pela FE-STYLE-001 |

Uma regra global `.p-drawer-content` é uma implementação de tema válida quando se destina a todo Drawer nas raízes do host e do filho. `.wippy-host-app .p-drawer-content` é apropriado apenas quando a regra é específica do host.

Mover CSS duplicado de módulo para o CSS da facade não elimina a dependência. Se o seletor não faz parte do vocabulário compartilhado do tema PrimeVue, ele cria um contrato privado com a facade. O lugar para vocabulário compartilhado entre seus próprios módulos, mas ausente do tema, é um pacote publicado: veja [A Camada de Design](../design-layer.md).

## Equivalência semântica

Controles semanticamente equivalentes devem parecer equivalentes. Prefira usar componentes PrimeVue diretamente. Quando um controle genuinamente customizado for necessário, identifique seu irmão visual no PrimeVue e use as mesmas propriedades públicas de runtime para cor, borda, foco, estado e qualquer geometria classificada como theme-variable.

A parte customizada pode ser dona apenas da estrutura inédita que o irmão não fornece. Reutilize os contratos documentados de padding, dimensões, tipografia, raio, sombra, foco e movimento do tema onde existirem. Não copie um literal atual do CSS gerado de componentes e chame isso de herança.

## Propriedades de runtime versus invariantes

Cada propriedade de aparência compartilhada tem uma política:

- `theme-variable`: deve resolver através de uma variável pública de runtime documentada.
- `platform-invariant`: o valor Tailwind compilado compartilhado é deliberadamente estável em todo tema conforme.

Não adicione tokens de runtime por flexibilidade teórica. Adicione ou adote um token apenas depois que o registro de contrato efetivo comprovar uma lacuna real de runtime, um caminho suportado exato, um consumidor real e evidência de mutação.

## Transporte de CSS não é permissão

Páginas recebem estilos em um iframe. Web components podem receber estilos dentro de um shadow root. Isso explica onde o CSS pode ter efeito; não autoriza um módulo a depender de seletores arbitrários da facade.

## Troca de modo em runtime

O contrato público de modo de tema é o AppConfig mais `@wippy-fe/proxy`:

```typescript
import { host, on } from '@wippy-fe/proxy'

async function setThemeMode(mode: 'auto' | 'light' | 'dark') {
  await new Promise<void>((resolve, reject) => {
    const stop = on('@theme', (appliedMode) => {
      if (appliedMode !== mode) return
      stop()
      const currentMode = host.getThemeMode()
      if (currentMode !== mode) {
        reject(new Error(`Theme propagation mismatch: ${currentMode}`))
        return
      }
      resolve()
    })
    host.setThemeMode(mode)
  })
}

await setThemeMode('dark')
```

Use apenas `auto`, `light` ou `dark`. O host é dono da aplicação e da propagação
recursiva aos filhos; a facade/embedder é dona da persistência. Editar diretamente
`w-theme-dark` / `w-theme-light`, chamar helpers internos de tema, escrever
globais de AppConfig ou postar mensagens para o host contorna esse contrato e é
não conforme. A evidência visual só é válida depois que a API pública reporta o
modo propagado.

Veja [Contrato Tailwind](./tailwind-contract.md), [Catálogo de Tokens](./token-catalogue.md) e [Contrato de UI Portável](../portable-ui-contract.md).
