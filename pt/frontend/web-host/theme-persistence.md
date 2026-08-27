---
title: "Persistência do tema"
description: "Configure a facade para persistir o modo claro, escuro ou automático em cookie ou localStorage."
---

# Persistência do tema

Esta página é um guia de configuração da facade. O bloco HTML de página externa é um exemplo parcial de integração e pressupõe que os endpoints da facade já existam.

Por padrão, o Web Host resolve o modo claro ou escuro por `theme_mode` (o padrão da facade) e mantém a escolha em memória; uma escolha explícita do usuário é perdida ao recarregar. A persistência armazena a escolha em **cookie** ou **localStorage** e a carrega cedo para evitar um flash do tema incorreto.

A persistência fica inteiramente na facade. O Web Host não conhece o armazenamento: apenas emite um evento `themeChanged`, usado pela facade ou por outro embedder para persistir a escolha.

> **Opt-in.** O padrão de `theme_persist` é **`none`**: a persistência fica desativada, salvo se a implantação definir explicitamente `cookie` ou `localStorage`. Com o padrão, o tema vem de `theme_mode` e não é lembrado após recargas. Nada é armazenado, nenhum cookie é gravado e o script gerado não faz nada.

## Configuração

Dois parâmetros da facade controlam o comportamento; consulte [Facade frontend](../../framework/facade.md):

| Parâmetro | Padrão | Valores | Descrição |
|-----------|---------|--------|-------------|
| `theme_persist` | `none` | `none` \| `cookie` \| `localStorage` | Onde o modo escolhido é armazenado. `none` mantém o comportamento atual. |
| `theme_storage_key` | `@wippy-theme-mode` | string | Chave do cookie/localStorage. |

Ambos são retornados pelo endpoint público de configuração como `themePersist` e `themeStorageKey`, permitindo também sua leitura por páginas servidas fora do Web Host.

```yaml
# in your facade dependency parameters
- name: theme_persist
  value: cookie
- name: theme_storage_key
  value: "@wippy-theme-mode"
```

### Cookie ou localStorage

- **`cookie`** — o shell do host renderizado por Jet lê o cookie **no servidor** e grava a classe `w-theme-*` em `<html>` antes de enviar a resposta. O primeiro paint já recebe o tema; é a opção preferida quando a consistência inicial importa.
- **`localStorage`** — o servidor não consegue ler localStorage, então o shell distribuído carrega `theme-persist.js` sincronamente como o primeiro script de `<head>`. Ele aplica a classe armazenada antes do stylesheet da marca, da interface de loading ou do bundle do Web Host.

## Script gerado

Quando a persistência está ativa, a facade **gera e serve** um pequeno script em:

```
GET /api/public/facade/theme-persist.js
```

A chave e o modo configurados são incorporados; não há configuração na página. Inclua-o uma vez, o mais cedo possível em `<head>`:

```html
<script src="/api/public/facade/theme-persist.js"></script>
```

Ao carregar, ele lê o valor armazenado, aplica a classe `w-theme-*` e expõe uma API pequena:

```js
window.wippyThemePersist = {
  mode,            // 'none' | 'cookie' | 'localStorage'
  key,             // the storage key
  read(),          // -> 'auto' | 'light' | 'dark' | null
  write(mode),     // persist a mode (no-op when mode === 'none')
  apply(mode),     // toggle the w-theme-* class on <html>
}
```

O shell do host (`index.html`/Jet `index.jet`) já inclui esse script, fornece o valor armazenado à aplicação e persiste mudanças. As seções seguintes destinam-se a **outras** páginas.

## Integração no shell do host

1. **Primeiro paint** — em cookie, o servidor define `<html class="w-theme-dark">`; em localStorage, o script antecipado define a classe. A página recebe o tema antes do bundle.
2. **Bootstrap** — o shell fornece o valor persistido ao host: `themeMode: window.wippyThemePersist.read() ?? cfg.themeMode`.
3. **Mudança** — o host emite `themeChanged(mode)` e o shell o persiste: `events.on('themeChanged', window.wippyThemePersist.write)`.

### Evento `themeChanged` do host

`globalEvents`, o emitter retornado por `window.initWippyApp(...)`, dispara `themeChanged(mode)` (`'auto' | 'light' | 'dark'`) na inicialização e em toda mudança. Ele não conhece a persistência: o host nunca acessa storage; o embedder decide o que fazer.

```js
const events = window.initWippyApp(config, '#app')
events.on('themeChanged', (mode) => {
  // e.g. persist, or notify a parent window
})
```

## Páginas não hospedadas pelo Wippy

Um documento fora do contrato de módulo portável do Wippy pode respeitar e persistir o mesmo tema. Os botões nativos abaixo servem somente a esse tipo de documento estático externo. Uma página ou componente Wippy com esses controles deve usar PrimeVue segundo o [Contrato de UI portável](../portable-ui-contract.md). Inclua o script gerado e chame `write()` em seu seletor:

```html
<head>
  <!-- as early as possible: applies the stored theme + exposes window.wippyThemePersist -->
  <script src="/api/public/facade/theme-persist.js"></script>
  <!-- optional: reuse the facade brand theme too -->
  <link rel="stylesheet" href="/api/public/facade/variables.css">
</head>
<body>
  <button type="button" data-mode="auto">Auto</button>
  <button type="button" data-mode="light">Light</button>
  <button type="button" data-mode="dark">Dark</button>

  <script>
    document.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode
        window.wippyThemePersist.apply(mode)   // update <html> now
        window.wippyThemePersist.write(mode)   // persist for next load / the host
      })
    })
  </script>
</body>
```

Como chave e modo de storage são compartilhados, uma escolha feita na página de login chega ao Web Host, e vice-versa. O script recebe ambos da mesma configuração da facade.

> Como alternativa, busque `/api/public/facade/config`, leia `themePersist` e `themeStorageKey` e implemente o armazenamento diretamente. O script gerado mantém essa lógica em um único lugar.

## Renderização de cookie no servidor sem flash

Em uma página personalizada renderizada pelo servidor, como um template Jet de login, você pode aplicar o tema no servidor exatamente como o shell: leia da requisição o cookie nomeado por `theme_storage_key` e emita a classe correspondente em `<html>`:

```html
<html lang="en"{{ if hasTheme }} class="{{ themeClass }}" style="color-scheme: {{ colorScheme }};"{{ end }}>
```

O handler define `themeClass` como `w-theme-dark`/`w-theme-light` e `colorScheme` como `dark`/`light` com base no cookie. Continue incluindo `theme-persist.js` para que a página grave as mudanças.
