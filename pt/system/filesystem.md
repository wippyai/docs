---
title: "Sistema de Arquivos"
description: "Acesso a diretórios e sistemas de arquivos embutidos."
---

# Sistema de Arquivos

Acesso a diretórios e sistemas de arquivos embutidos.

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
| `base` | string | - | Base para caminhos relativos: `project` (diretório de trabalho do processo) ou `module` (raiz de carregamento do módulo proprietário) |

Caminhos absolutos são usados como fornecidos, independentemente do que `base` indicar.

Para um caminho relativo, `base: project` o mantém relativo ao diretório de trabalho do processo. Tanto `base: module` quanto um `base` não definido o resolvem contra a raiz de carregamento do módulo que é dono da entrada, obtida através do proprietário da entrada no registry. Quando a entrada não tem módulo proprietário, ou esse módulo não tem uma raiz de recursos resolvível, o caminho permanece relativo ao diretório de trabalho do processo.

Qualquer outro valor é rejeitado com `invalid directory base`.

O modo restringe todas as operações de arquivo. Bits de execução são adicionados automaticamente quando bits de leitura estão presentes.

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
| ReadDir | Sim | Sim |
| OpenFile (escrita) | Sim | Não |
| Remove | Sim | Não |
| Mkdir | Sim | Não |

Operações de escrita em sistemas de arquivos embutidos retornam um erro.

## API Lua

Veja [Módulo Filesystem](lua/storage/filesystem.md) para operações de arquivo.

## Veja Também

- [Módulo Filesystem](lua/storage/filesystem.md) - Referência da API Lua
- [Cloud Storage](system/cloudstorage.md) - Armazenamento de objetos compatível com S3
- [Template](system/template.md) - Templates carregados de filesystems
