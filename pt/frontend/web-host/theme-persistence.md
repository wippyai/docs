---
title: "Persistência de Tema"
description: "Por padrão, o Web Host resolve claro/escuro a partir de thememode (o padrão da facade) e o mantém em memória — então a escolha explícita de um usuário se perde no…"
---

# Persistência de Tema

Por padrão, o Web Host resolve claro/escuro a partir de `theme_mode` (o padrão da facade) e o mantém
em memória — então a escolha explícita de um usuário se perde no próximo recarregamento. A persistência de tema faz essa
escolha sobreviver a recarregamentos armazenando-a em um **cookie** ou no **localStorage**, e a carrega o mais cedo
possível para que não haja um flash do tema errado.

A persistência vive inteiramente na facade. O Web Host permanece agnóstico quanto ao armazenamento: ele apenas emite um
evento `themeChanged` que a facade (ou qualquer embedder) usa para persistir a escolha.

> **Adesão opcional.** `theme_persist` tem como padrão **`none`** — a persistência fica **desligada**, a menos que um deployment
> a defina explicitamente como `cookie` ou `localStorage`. Com o padrão, o comportamento é exatamente o mesmo de antes
> (o tema sempre vem de `theme_mode` e não é lembrado entre recarregamentos). Nada é armazenado,
> nenhum cookie é escrito, e o script gerado é um no-op até você aderir.

## Configuração

Dois parâmetros da facade o controlam (veja [Facade de Frontend](../../framework/facade.md)):

| Parâmetro | Padrão | Valores | Descrição |
|-----------|---------|--------|-------------|
| `theme_persist` | `none` | `none` \| `cookie` \| `localStorage` | Onde o modo escolhido é armazenado. `none` = comportamento atual. |
| `theme_storage_key` | `@wippy-theme-mode` | string | Chave de cookie / localStorage. |

Ambos são retornados pelo endpoint público de configuração como `themePersist` e `themeStorageKey`, de modo que páginas
servidas fora do Web Host também possam lê-los.

```yaml
# nos parâmetros da sua dependência de facade
- name: theme_persist
  value: cookie
- name: theme_storage_key
  value: "@wippy-theme-mode"
```

### cookie vs localStorage

- **`cookie`** — o shell do host renderizado por Jet lê o cookie **no servidor** e escreve a
  classe `w-theme-*` no `<html>` antes de a resposta ser enviada, de modo que a primeira pintura já vem
  tematizada. **Sem flash.** Melhor padrão.
- **`localStorage`** — o servidor não consegue ler o localStorage, então o valor armazenado é aplicado por um
  script inline síncrono o mais cedo possível. Um breve flash é tecnicamente possível, mas minimizado.

## O script gerado

Quando a persistência está habilitada, a facade **gera e serve** um pequeno script em:

```
GET /api/public/facade/theme-persist.js
```

A chave e o modo configurados já vêm embutidos — não há nada a configurar na página. Inclua-o
uma vez, o mais cedo possível no `<head>`:

```html
<script src="/api/public/facade/theme-persist.js"></script>
```

Ao carregar, ele lê o valor armazenado e aplica a classe `w-theme-*`, depois expõe uma pequena API:

```js
window.wippyThemePersist = {
  mode,            // 'none' | 'cookie' | 'localStorage'
  key,             // a chave de armazenamento
  read(),          // -> 'auto' | 'light' | 'dark' | null
  write(mode),     // persiste um modo (no-op quando mode === 'none')
  apply(mode),     // alterna a classe w-theme-* no <html>
}
```

O shell do host (`index.html` / o `index.jet` do Jet) já inclui esse script, injeta o valor
armazenado no app e persiste as mudanças — você não precisa mexer nele. As seções abaixo são para
**outras** páginas.

## Como tudo se encaixa (shell do host)

1. **Primeira pintura** — modo cookie: o servidor definiu `<html class="w-theme-dark">`. Modo localStorage:
   o script de aplicação antecipada a definiu. De qualquer forma, a página está tematizada antes de o bundle carregar.
2. **Bootstrap** — o shell injeta o valor persistido no host:
   `themeMode: window.wippyThemePersist.read() ?? cfg.themeMode`, de modo que o host aplique o mesmo modo.
3. **Na mudança** — o host emite `themeChanged(mode)`; o shell o persiste:
   `events.on('themeChanged', window.wippyThemePersist.write)`.

### O evento de host `themeChanged`

`globalEvents` — o emissor retornado por `window.initWippyApp(...)` — dispara `themeChanged(mode)`
(`'auto' | 'light' | 'dark'`) na inicialização e a cada mudança de tema. Ele é agnóstico quanto à persistência: o host
nunca toca no armazenamento; os embedders decidem o que fazer com isso.

```js
const events = window.initWippyApp(config, '#app')
events.on('themeChanged', (mode) => {
  // por exemplo, persistir, ou notificar uma janela pai
})
```

## Páginas não hospedadas pelo Wippy

Um documento fora do contrato de módulos portáveis do Wippy pode respeitar e persistir
o mesmo tema. Os botões nativos abaixo são apropriados apenas para esse tipo de
documento estático externo. Uma página ou componente do Wippy com esses controles deve
usar PrimeVue sob o [Contrato de UI Portável](../portable-ui-contract.md).
Inclua o script gerado e chame `write()` a partir do seu próprio seletor:

```html
<head>
  <!-- o mais cedo possível: aplica o tema armazenado + expõe window.wippyThemePersist -->
  <script src="/api/public/facade/theme-persist.js"></script>
  <!-- opcional: reutilize também o tema de marca da facade -->
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
        window.wippyThemePersist.apply(mode)   // atualiza o <html> agora
        window.wippyThemePersist.write(mode)   // persiste para o próximo carregamento / o host
      })
    })
  </script>
</body>
```

Como a chave e o modo de armazenamento são compartilhados (o script é gerado a partir da mesma configuração da facade),
uma escolha feita na página de login é levada diretamente para o Web Host, e vice-versa.

> Se você preferir não carregar o script, pode buscar `/api/public/facade/config`, ler
> `themePersist` / `themeStorageKey` e implementar leitura/escrita por conta própria — mas o script gerado
> mantém a lógica de armazenamento em um só lugar.

## Renderização de cookie no servidor (zero flash)

Para uma página customizada renderizada no servidor (por exemplo, um template Jet de login), você pode aplicar o tema no servidor,
exatamente como o shell do host faz: leia da requisição o cookie nomeado por `theme_storage_key` e
emita a classe correspondente no `<html>`:

```html
<html lang="en"{{ if hasTheme }} class="{{ themeClass }}" style="color-scheme: {{ colorScheme }};"{{ end }}>
```

onde o handler definiu `themeClass` como `w-theme-dark` / `w-theme-light` (e `colorScheme` como
`dark` / `light`) com base no cookie. Ainda assim, inclua `theme-persist.js` para que a página possa escrever
as mudanças de volta.
