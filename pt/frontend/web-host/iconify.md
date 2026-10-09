---
title: "Provedores do Iconify"
description: "Configure fontes on-line do Iconify ou uma coleção local para o Web Host."
---

# Provedores do Iconify

O Web Host usa fontes on-line do Iconify por padrão. Configure `AppConfig.iconify.providers` somente quando a implantação precisar de outra fonte. A coleção local do Tabler nesta página é uma opção explícita para implantações sem conexão. Ela não altera a fonte padrão.

## Configurar um provedor

`providers` usa o ID do provedor do Iconify como chave. Use a chave vazia (`""`) para o provedor integrado ou um ID em minúsculas com hífens para um provedor nomeado. Cada valor contém uma lista ordenada e não vazia `resources` de origens HTTP(S). O Host tenta essas origens em ordem e não adiciona uma fonte pública à lista configurada.

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

O validador aceita somente `providers` e os campos `resources`, `path` e `timeout`. Uma seção inicial inválida é ignorada; uma atualização inválida mantém a última válida. `timeout` define um único prazo para a solicitação lógica e todas as origens configuradas. Cada tentativa de failover usa o tempo restante desse mesmo prazo. Somente uma correspondência byte a byte da coleção Tabler fixada é reconhecida como coleção completa, e apenas quando Web Crypto SHA-256 está disponível. Essa resposta é armazenada pela URL do endpoint sem a consulta. As demais respostas são armazenadas pela URL completa com consulta. Sem `crypto.subtle`, como pode ocorrer em HTTP não seguro, o adaptador usa cache por consulta e o armazenamento do Iconify ainda pode usar seu cache nativo por ícone. Os caches do adaptador têm limite combinado de 32 URLs. Trocar a coleção na mesma URL não remove respostas, ícones resolvidos nem resultados negativos já armazenados. Inicie um novo contexto do navegador para carregar a coleção substituta. Falhas de transporte ou respostas inválidas tentam a próxima origem; uma resposta válida sem o ícone é informada como não encontrada. `iconifyIcons` controla o carregamento e o registro do elemento `<iconify-icon>`, não a fonte. AppConfig envia configurações explícitas às aplicações filhas. Os schemas 2.0 e 2.1 são migrados para 2.2. Consulte [Sequência de bootstrap](./bootstrap.md), [Injeção de CSS](./css-injection.md), [API de proxy](../micro-frontends/proxy-api.md) e [Facade](../../framework/facade.md).

## Provider trust and updates

Use somente origens de provedores confiáveis. A página renderiza o conteúdo dos ícones como marcação SVG. As atualizações `SetConfig` do pai devem incluir o valor atual de `$schema`, `wippy-context-2.2`, para usar a validação atual. A troca de provedor afeta ícones que ainda não foram carregados; respostas em cache e ícones já renderizados não são apagados. Abra um novo documento para verificar a troca.
