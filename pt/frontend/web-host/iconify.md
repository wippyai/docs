---
title: "Provedores do Iconify"
description: "Configure fontes on-line do Iconify ou uma coleção local para o Web Host."
---

# Provedores do Iconify

O Web Host usa fontes on-line do Iconify por padrão. Configure `AppConfig.iconify.providers` somente quando a implantação precisar de outra fonte. A coleção local do Tabler nesta página é uma opção explícita para implantações sem conexão. Ela não altera a fonte padrão.
A versão base verificada do Web Host para usar `AppConfig.iconify` diretamente é 1.0.64. Para implantações com Facade, consulte a base verificada em [Módulo Facade](../../framework/facade.md).

## Configurar um provedor

`providers` usa o ID do provedor do Iconify como chave. Use a chave vazia (`""`) para o provedor integrado ou um ID em minúsculas com hífens para um provedor nomeado. Cada valor contém uma lista não vazia `resources` de origens HTTP(S). O Iconify padrão usa esses recursos como origens alternativas. Ele pode lembrar uma origem que funcionou e começar por ela em solicitações posteriores. O Host não adiciona uma fonte pública à lista configurada.

```ts
interface IconifyConfig {
  providers?: Record<string, {
    resources: string[]
    path?: string
    timeout?: number
  } | null> | null
}
```

`path` usa `/` por padrão e é normalizado com barras inicial e final. `timeout` usa 5000 milissegundos por padrão e aceita inteiros positivos até 60000. Os valores de recursos são origens. Não inclua credenciais, consulta, fragmento ou caminho base.

## Como usar o Wippy sem conexão

Uma implantação sem conexão precisa servir sua própria cópia da coleção em um servidor acessível pelo navegador. O CDN público do Web Host funciona on-line e não fornece a aplicação nem outros serviços sem conexão. A versão do Host inclui `iconify/tabler.json`.

```ts
const config = {
  iconify: {
    providers: {
      "": {
        resources: ["http://localhost:5173"],
        path: "/iconify/",
      },
    },
  },
}
```

Para testes locais, sirva a saída do Host para disponibilizar `dist/iconify/tabler.json` em `/iconify/tabler.json`. Na implantação, use uma origem própria e um caminho versionado:

```ts
const deploymentConfig = { iconify: { providers: { "": { resources: ["https://wippy-host.internal"], path: "/webcomponents-<host-release>/iconify/" } } } }
```

Troque `<host-release>` pela versão fixa do Host. O servidor deve retornar JSON com `application/json` e permitir solicitações do navegador vindas da origem da aplicação. Iconify envia `?icons=...`; o espelho ignora essa consulta e retorna a coleção completa. A busca não é compatível.

A coleção usa Tabler 3.41.1, licença MIT, de Paweł Kuna. Os metadados declaram 6092 ícones; a fonte fixa contém 6140 definições e 184 aliases. SHA-256: `cf18f905479c5ca5d0be13217e17d240deea3c457b70b2ae84bcaa0d5a98a51c`.

### Servir o espelho corretamente

O servidor estático faz parte da configuração sem conexão. Ele deve retornar o arquivo como `application/json`, permitir por CORS solicitações do navegador vindas da origem da aplicação, comprimir JSON quando o navegador aceitar e retornar um 404 real se a coleção não existir. Não armazene um arquivo ausente em cache como se a resposta tivesse sucesso. Caminhos versionados podem usar cache imutável. Para um caminho sem versão, exija revalidação com `ETag` ou `Last-Modified`.

Este exemplo de Nginx pressupõe que os arquivos estejam em `/srv/wippy/host/webcomponents-<host-release>/iconify/tabler.json`, que a aplicação use exatamente a origem mostrada e que os certificados TLS sejam configurados fora deste trecho. Substitua a origem e a raiz pelos valores do seu ambiente. O trecho não instala módulos do Nginx nem configura TLS:

```nginx
server {
    location ~ ^/webcomponents-[^/]+/iconify/ {
        root /srv/wippy/host;
        default_type application/json;
        add_header Access-Control-Allow-Origin "https://app.example.com" always;
        add_header Vary Origin always;
        add_header Cache-Control "public, max-age=31536000, immutable";
        gzip on;
        gzip_types application/json;
        gzip_vary on;
        try_files $uri =404;
    }
}
```

Para um caminho sem versão, substitua a política imutável por uma política de revalidação, como `Cache-Control: no-cache`, e habilite `ETag` ou `Last-Modified`. Antes de usar o espelho, confirme que o servidor realmente comprime JSON e retorna as políticas esperadas de cache, CORS e MIME, além de 404 real para arquivo ausente.

## Provedores nomeados e nomes de ícones

Use `@provedor:prefixo:nome`, por exemplo `@tenant:tabler:home`. Vue e o elemento personalizado usam o mesmo nome.

```ts
const namedConfig = { iconify: { providers: { tenant: { resources: ["https://icons.example.internal"], path: "/tenant/" } } } }
```

```vue
<script setup lang="ts">
import { Icon } from '@iconify/vue'
</script>

<Icon icon="@tenant:tabler:home" />
<iconify-icon icon="@tenant:tabler:settings"></iconify-icon>
```

A fonte cobre somente solicitações de coleções de ícones. APIs, fontes tipográficas e outros recursos do Kickside precisam de suporte off-line próprio.

## Redefinir e atualizar

Se `iconify` for omitido na configuração inicial, os padrões on-line serão usados. Se for omitido em uma atualização posterior, a configuração Iconify atual será mantida. `iconify: null` ou `providers: null` redefinem toda a seção para os padrões on-line e removem provedores nomeados. O provedor vazio com `null` redefine somente o provedor integrado. Um provedor nomeado com `null` desativa esse namespace. Chaves omitidas mantêm as rotas. Um objeto `providers` vazio não redefine a configuração.

O esquema gerado verifica a forma do JSON e os limites dos campos. A validação em tempo de execução também verifica se `resources` são origens HTTP(S) e se `path` segue as regras do Host. Portanto, um valor pode passar pelo esquema e ainda ser rejeitado em tempo de execução. O validador aceita somente `providers` e, em cada provedor, `resources`, `path` e `timeout`. Uma seção inicial inválida é ignorada e mantém os padrões online. Uma atualização inválida mantém a última seção Iconify válida, enquanto outros campos válidos de AppConfig podem ser atualizados. O Host passa `timeout` para a API de provedor do Iconify padrão. O Host configura cada armazenamento do Iconify pela API pública `addAPIProvider`. O Iconify padrão controla o carregamento dos ícones, a seleção e repetição de origens e o cache. Ele pode lembrar uma origem que funcionou e começar por ela em solicitações posteriores. O Host não redefine nem configura novamente um armazenamento após uma atualização de AppConfig. Recarregue o documento para aplicar mudanças de provedor. `iconifyIcons` controla o carregamento e o registro do elemento `<iconify-icon>`, não a fonte. AppConfig envia configurações explícitas às aplicações filhas. Os schemas 2.0 e 2.1 são migrados para 2.2. Consulte [Sequência de bootstrap](./bootstrap.md), [Injeção de CSS](./css-injection.md), [API de proxy](../micro-frontends/proxy-api.md) e [Facade](../../framework/facade.md).

## Provider trust and updates

Use somente origens de provedores confiáveis. A página renderiza o conteúdo dos ícones como marcação SVG. Use `wippy-context-2.2` nas novas cargas `SetConfig`. Cargas versionadas `wippy-context-2.0` e `wippy-context-2.1` são aceitas e migradas; cargas 1.0 sem esquema não podem conter os novos campos `iconify` e `importMap`.

## Versões do schema

Use `wippy-context-2.2` nas novas configurações. Entradas versionadas `wippy-context-2.0` e `wippy-context-2.1` são migradas. Entradas sem `$schema` usam o conversor legado obsoleto. Ele mapeia os campos legados conhecidos, mas não encaminha os novos campos `iconify` e `importMap`. O schema gerado valida a forma do JSON e os limites dos campos. O runtime também valida origens HTTP(S) e as regras de caminho do Host. Um valor pode passar na validação do schema e ainda ser rejeitado no runtime.

## Overlay de desenvolvimento

Execute o aplicativo consumidor com Vite e `@wippy-fe/vite-plugin` habilitado; o plugin fornece ao overlay de desenvolvimento as configurações Wippy de `package.json`. Clique no botão flutuante **Wippy Dev**, abra **Configuration**, adicione `iconify.providers` em **App Config (JSON)** e clique em **Accept**. Na primeira inicialização, **Accept** permite que o aplicativo termine de carregar. O navegador salva as configurações aceitas. Depois de alterar as configurações de um aplicativo em execução, recarregue-o antes de verificar a alteração: **Accept** salva as configurações, mas não atualiza a configuração que o aplicativo já está usando. Com Auto-accept ativado, o console também mostra `Config updated (reload to apply)`.
