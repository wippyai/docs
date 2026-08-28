---
title: "Sistema de Arquivos"
description: "Configure sistemas de arquivos baseados em diretórios e sistemas embutidos somente leitura."
---

# Sistema de Arquivos

Entradas de sistema de arquivos expõem armazenamento baseado em diretórios ou armazenamento embutido somente leitura aos módulos do runtime. Esta página é uma referência de configuração; os blocos YAML são fragmentos de entradas individuais, e não projetos completos.

## Tipos de Entradas

| Tipo | Descrição |
|------|-----------|
| `fs.directory` | Sistema de arquivos baseado em diretório |
| `fs.embed` | Sistema de arquivos embutido somente leitura |

## Sistema de Arquivos de Diretório

```yaml
- name: uploads
  kind: fs.directory
  directory: "/var/data/uploads"
  auto_init: true
  mode: "0755"
```

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `directory` | string | obrigatório | Caminho raiz |
| `auto_init` | bool | false | Cria diretório se ausente |
| `mode` | string | 0755 | Modo de permissão Unix (octal) |
| `base` | string | inferido | Base de caminhos relativos: `project` (diretório de trabalho do processo) ou `module` (raiz de recursos do módulo proprietário) |

Para uma entrada pertencente a um módulo, omitir `base` resolve um diretório relativo a partir da raiz de recursos desse módulo. Entradas criadas pelo host continuam relativas ao diretório de trabalho do processo. Defina `base: project` para forçar a resolução pelo diretório de trabalho em uma entrada de módulo, ou `base: module` para solicitar explicitamente a raiz do módulo. Se a propriedade do módulo ou sua raiz de recursos não estiver disponível, o runtime mantém o caminho relativo sem alterações.

O modo configurado autoriza operações por seus bits de proprietário, e as permissões solicitadas para novos arquivos e diretórios são mascaradas por esse modo. Quando todos os bits de leitura estão presentes e nenhum bit de execução está definido, o runtime adiciona os bits de execução — por exemplo, `0444` se torna `0555`. As permissões do sistema operacional ainda se aplicam ao diretório subjacente.

<note>
Caminhos são normalizados e validados. Não é possível acessar arquivos fora do diretório raiz configurado.
</note>

## Sistema de Arquivos Embutido

```yaml
- name: static
  kind: fs.embed
```

Sistemas de arquivos embutidos carregam de recursos de pack usando o ID da entrada. Eles são somente leitura.

<warning>
Sistemas de arquivos embutidos são um mecanismo interno. Configuração manual tipicamente não é necessária.
</warning>

## Operações

Ambos os tipos de sistema de arquivos implementam:

| Operação | Directory | Embed |
|----------|-----------|-------|
| Open/Read | Sim | Sim |
| Stat | Sim | Sim |
| Lstat | Sim | Sim |
| ReadDir | Sim | Sim |
| OpenFile (escrita) | Sim | Não |
| Remove | Sim | Não |
| Mkdir | Sim | Não |
| Rename | Sim | Não |
| Truncate | Sim | Não |
| Chtimes | Sim | Não |

Operações de escrita em sistemas de arquivos embutidos retornam um erro.

## API Lua

Consulte o [módulo Filesystem](lua/storage/filesystem.md) para as operações de arquivo.

## Consulte também

- [Módulo Filesystem](lua/storage/filesystem.md) — Referência da API Lua
- [Cloud Storage](system/cloudstorage.md) — Armazenamento de objetos compatível com S3
- [Template](system/template.md) — Templates carregados de sistemas de arquivos
