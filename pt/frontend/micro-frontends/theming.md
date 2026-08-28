---
title: "Criação de temas"
description: "Como a facade cria um tema PrimeVue e como os módulos permanecem portáveis."
---

# Criação de temas

**Classificação: referência de propriedade do tema e contrato de runtime.** O bloco de troca de modo demonstra um fluxo de API pública; ele presume um Host em execução e não configura uma facade nem compila um módulo sozinho.

A facade cria um tema PrimeVue. Os módulos o consomem em vez de definir um sistema de design independente.

O Wippy atualmente executa PrimeVue com `theme: 'none'`. A aparência dos componentes é fornecida pelo CSS PrimeVue do Wippy criado com Tailwind, por variáveis públicas de runtime e pela personalização da facade.

## Onde o estilo deve ficar

| Aspecto de estilo | Proprietário |
|---|---|
| Aparência de componentes PrimeVue compartilhada no produto | Tema PrimeVue da facade em `custom_css` e variáveis públicas do tema |
| Somente o chrome do shell do Host | CSS da facade limitado a `.wippy-host-app` |
| Regra `.p-*` compartilhada destinada ao host e aos roots dos children | `custom_css` global da facade; não precisa de escopo do host |
| Substituição de tema somente da página | Configuração da página com o casing frontend compatível |
| Layout de domínio ou estrutura inédita | CSS ou Tailwind do módulo |
| Parte personalizada necessária e não fornecida por PrimeVue | CSS do módulo, reutilizando tokens públicos e utilities invariantes documentadas |
| A mesma parte não PrimeVue necessária em vários módulos próprios | Pacote compartilhado; consulte [A camada de design](../design-layer.md) |
| Classe arbitrária esperada de uma facade | Não portável; proibida por FE-STYLE-001 |

Uma regra global `.p-drawer-content` é uma implementação de tema válida quando se destina a todos os Drawers nos roots do host e dos children. `.wippy-host-app .p-drawer-content` é adequada somente quando a regra é específica do host.

Mover CSS duplicado dos módulos para o CSS da facade não elimina a dependência. Se o seletor não fizer parte do vocabulário de tema PrimeVue compartilhado, ele cria um contrato privado da facade. O lugar para um vocabulário compartilhado por seus módulos, mas ausente do tema, é um pacote publicado: consulte [A camada de design](../design-layer.md).

## Igualdade semântica

Controles semanticamente equivalentes devem ter aparência equivalente. Prefira diretamente componentes PrimeVue. Quando um controle realmente personalizado for necessário, identifique seu equivalente visual PrimeVue e use as mesmas propriedades públicas de runtime para cor, borda, foco, estado e qualquer geometria classificada como variável de tema.

A parte personalizada pode controlar somente a estrutura nova que o equivalente não fornece. Reutilize contratos documentados de padding, dimensões, tipografia, raio, sombra, foco e movimento do tema onde existirem. Um literal copiado do CSS gerado de um componente não herda futuras alterações do tema.

## Propriedades de runtime e invariantes

Cada propriedade de aparência compartilhada tem uma política:

- `theme-variable`: precisa ser resolvida por uma variável pública de runtime documentada.
- `platform-invariant`: o valor Tailwind compartilhado e compilado é deliberadamente estável em todos os temas compatíveis.

Não adicione tokens de runtime por flexibilidade teórica. Adicione ou adote um token somente quando uma lacuna real da runtime, um caminho exato compatível, um consumidor real e evidência de mutação estiverem documentados.

## Transporte de CSS não é permissão

O transporte de estilo de página segue o engine de renderização selecionado: páginas iframe usam o pipeline de injeção proxy, enquanto páginas Web Fragment recebem o CSS da plataforma pelo gateway fragment e substituições de página no head refletido. Web components podem receber estilos dentro de um shadow root. Esses mecanismos explicam onde o CSS pode produzir efeito; não autorizam um módulo a depender de seletores arbitrários da facade.

## Troca do modo em runtime

O contrato público do modo de tema é AppConfig mais `@wippy-fe/proxy`:

```typescript
import { host, on } from '@wippy-fe/proxy'

async function setThemeMode(mode: 'auto' | 'light' | 'dark') {
  if (host.getThemeMode() === mode) return

  await new Promise<void>((resolve, reject) => {
    let settled = false
    let stop = () => {}
    const finish = (error?: unknown) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      stop()
      if (error) reject(error)
      else resolve()
    }
    const timeout = window.setTimeout(
      () => finish(new Error(`Timed out waiting for theme mode: ${mode}`)),
      5_000,
    )

    stop = on('@theme', (appliedMode) => {
      if (appliedMode !== mode) return
      finish()
    })

    try {
      host.setThemeMode(mode)
    } catch (error) {
      finish(error)
    }
  })
}

await setThemeMode('dark')
```

Use somente `auto`, `light` ou `dark`. O host controla a propagação para a aplicação e seus children recursivos; a facade/embedder controla a persistência. Editar diretamente `w-theme-dark`/`w-theme-light`, chamar helpers internos de tema, gravar globals do AppConfig ou publicar mensagens para o host contorna esse contrato e não é compatível. Evidência visual só é válida depois que a API pública informa o modo propagado.

Consulte [Contrato Tailwind](./tailwind-contract.md), [Catálogo de tokens](./token-catalogue.md) e [Contrato de UI portável](../portable-ui-contract.md).
