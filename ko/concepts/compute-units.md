---
title: "컴퓨트 유닛"
description: "lifetime, state, communication 및 failure handling 기준으로 Wippy function, process, workflow를 비교합니다."
---

# 컴퓨트 유닛

Wippy는 함수, 프로세스, 워크플로우의 세 가지 코드 실행 방식을 제공합니다. 동일한 기본 메커니즘을 공유하지만 수명, 상태 저장 위치, 실패 시 동작이 다릅니다.

## 함수

함수는 호출될 때 실행되고 결과를 반환합니다. 각 호출을 stateless로 취급하십시오. durable 또는 shared state는 database나 store에 있어야 합니다. function pool은 Lua state를 재사용할 수 있으므로 module global 및 closure upvalue는 worker-local이며 신뢰할 수 있는 cross-call store가 아닙니다.

```lua
local funcs = require("funcs")

local result, err = funcs.call("app.math:add", 2, 3)
if err then
    return nil, err
end
```

함수는 호출자의 context에서 실행됩니다. 호출자가 cancel되거나 exit하면 실행 중인 function call도 함께 cancel됩니다.

<tip>
HTTP 핸들러, 데이터 변환 등 빠르게 완료되고 결과를 반환해야 하는 작업에 함수를 사용하세요.
</tip>

## 프로세스

프로세스는 액터입니다. 여러 메시지에 걸쳐 상태를 유지하고, 시작한 사람과 독립적으로 실행되며, 메시지 전달을 통해 통신합니다.

```lua
local pid, err = process.spawn("app.workers:handler", "app:processes")
if err then return nil, err end

local ok, send_err = process.send(pid, "job", {task = "process_data"})
if send_err then return nil, send_err end
return ok
```

프로세스를 생성하면 생성자의 코드가 완료된 후에도 계속 실행됩니다. 프로세스는 서로 모니터링하고 링크하여 실패한 자식을 자동으로 재시작하는 슈퍼비전 트리를 형성할 수 있습니다.

스케줄러는 워커 풀에서 수천 개의 프로세스를 멀티플렉싱합니다. 각 프로세스는 I/O를 기다릴 때 양보하여 다른 프로세스가 실행될 수 있게 합니다.

<tip>
백그라운드 작업, 서비스 데몬, 생성자보다 오래 지속되거나 메시지 간에 상태를 유지해야 하는 작업에 프로세스를 사용하세요.
</tip>

## 워크플로우

workflow는 중단에서 복구해야 하는 durable operation을 위한 것입니다. Temporal 같은 workflow provider가 execution history를 기록하고 replay하여 crash, restart 또는 infrastructure change 후 state를 rebuild합니다.

```lua
-- The provider records this workflow so a worker restart can replay it.
local pid, err = process.spawn("app.orders:process", "app:temporal_worker", order_id)
if err then return nil, err end
return pid
```

workflow operation이 기록되므로 durability는 latency를 추가합니다. multi-step business process 및 long-running orchestration처럼 recovery가 function 또는 process의 낮은 latency보다 중요한 경우 workflow를 사용하십시오.

<note>
Wippy는 지원되는 workflow operation이 replay 중 같은 결과를 생성하도록 기록합니다. workflow code는 다른 compute unit과 같은 Lua syntax를 사용합니다.
</note>

## 비교

| | 함수 | 프로세스 | 워크플로우 |
|---|---|---|---|
| **상태** | call-local; worker reuse에 의존하지 않음 | memory 내 | persisted history에서 rebuild |
| **수명** | 단일 호출 | exit 또는 crash까지 | restart 이후에도 지속 |
| **통신** | 반환값 + 메시지 | 메시지 전달 | 액티비티 호출 + 메시지 |
| **실패 처리** | 호출자가 처리 | supervision tree | provider recovery; retry는 policy를 따름 |
| **지연 시간** | 최저 | 낮음 | 높음 |

## 같은 코드, 다른 동작

많은 모듈이 context에 따라 자동으로 적응합니다. 예를 들어 `time.sleep()`은 function과 process 모두에서 다른 작업이 실행될 수 있도록 yield합니다. workflow에서는 provider가 timer도 기록하여 replay가 두 번째 timer를 시작하지 않게 합니다.
