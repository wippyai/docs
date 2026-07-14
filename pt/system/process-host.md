---
title: "Host de Processos"
description: "Hosts de processos gerenciam a execução de processos Lua usando um agendador de roubo de trabalho."
---

# Host de Processos

Hosts de processos gerenciam a execução de processos Lua usando um agendador de roubo de trabalho.

<note>
Cada host agenda processos independentemente. A carga não é distribuída entre hosts automaticamente.
</note>

## Tipo de Entrada

| Tipo | Descrição |
|------|-----------|
| `process.host` | Host de execução de processos com agendador |

## Configuração

```yaml
- name: main_host
  kind: process.host
  host:
    workers: 8
    queue_size: 1024
    local_queue_size: 256
  lifecycle:
    auto_start: true
```

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `workers` | int | NumCPU | Goroutines workers |
| `queue_size` | int | 1024 | Capacidade da fila global |
| `local_queue_size` | int | 256 | Tamanho do deque local por worker |

## Agendador

O agendador usa roubo de trabalho: cada worker tem um deque local, e workers ociosos roubam da fila global ou de outros workers. Isso balanceia a carga automaticamente.

- **Workers** executam processos concorrentemente
- **Fila global** armazena processos pendentes quando todos os workers estão ocupados
- **Filas locais** reduzem contenção mantendo trabalho próximo aos workers

## Tipos de Processos

Hosts de processos executam entradas destes tipos:

| Tipo | Descrição |
|------|-----------|
| `process.lua` | Processo Lua baseado em código fonte |
| `process.lua.bc` | Bytecode Lua pré-compilado |
| `process.wasm` | Processo WebAssembly (experimental) |

Processos executam independentemente com seu próprio contexto, comunicam via mensagens, e são supervisionados para tolerância a falhas.

## Veja Também

- [Módulo Process](lua/core/process.md) - Iniciar e gerenciar processos a partir de Lua
- [Processos WASM](wasm/processes.md) - Configuração de entradas `process.wasm`
- [Modelo de Processos](concepts/process-model.md) - Conceitos de ciclo de vida e supervisão
- [Supervisão](guides/supervision.md) - Construção de árvores de supervisão
