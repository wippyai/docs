# Lua-модули

Runtime-модули расширяют Lua-окружение новой функциональностью. Модули могут предоставлять детерминированные утилиты, I/O-операции или асинхронные команды, которые yield'ят во внешние системы.

> Реализация Lua-рантайма может измениться в будущих версиях.

## Определение модуля

Каждый модуль использует `luaapi.ModuleDef`:

```go
var Module = &luaapi.ModuleDef{
    Name:        "mymodule",
    Description: "My custom module",
    Class:       []string{luaapi.ClassDeterministic},
    Types:       ModuleTypes,  // Определения типов для тулинга
    Build: func() (*lua.LTable, []luaapi.YieldType) {
        mod := lua.CreateTable(0, 2)
        mod.RawSetString("hello", lua.LGoFunc(helloFunc))
        mod.RawSetString("greet", lua.LGoFunc(greetFunc))
        mod.Immutable = true
        return mod, nil
    },
}
```

Функция `Build` возвращает:
- Таблицу модуля с экспортируемыми функциями
- Список типов yield для асинхронных операций (или nil)

Таблицы модулей строятся один раз и кешируются для переиспользования во всех Lua-состояниях.

## Классификация модулей

Поле `Class` определяет, где модуль может использоваться:

| Класс | Описание |
|-------|----------|
| `ClassDeterministic` | Один вход всегда даёт один выход |
| `ClassNondeterministic` | Выход варьируется (время, random) |
| `ClassIO` | Внешние I/O-операции |
| `ClassNetwork` | Сетевые операции |
| `ClassStorage` | Персистентность данных |
| `ClassWorkflow` | Workflow-безопасные операции |

Модули только с тегом `ClassDeterministic` безопасны для workflow. Добавление классов I/O или network ограничивает модуль функциями и процессами.

## Экспорт функций

Функции имеют сигнатуру `func(l *lua.LState) int`, где возвращаемое значение — количество значений, положенных на стек:

```go
func greetFunc(l *lua.LState) int {
    name := l.CheckString(1)           // Обязательный аргумент
    greeting := l.OptString(2, "Hello") // Необязательный с default

    l.Push(lua.LString(greeting + ", " + name + "!"))
    return 1
}
```

| Метод | Описание |
|-------|----------|
| `l.CheckString(n)` | Обязательная строка на позиции n |
| `l.CheckInt(n)` | Обязательный integer |
| `l.CheckNumber(n)` | Обязательное число |
| `l.CheckTable(n)` | Обязательная таблица |
| `l.OptString(n, def)` | Необязательная строка с default |
| `l.OptInt(n, def)` | Необязательный int с default |

## Таблицы

Таблицы, передаваемые между Go и Lua, по умолчанию мутабельны. Экспортные таблицы модулей должны быть помечены как immutable:

```go
mod := lua.CreateTable(0, 5)
mod.RawSetString("func1", lua.LGoFunc(func1))
mod.Immutable = true  // Запретить Lua модифицировать экспорты
```

Таблицы данных остаются мутабельными для обычного использования:

```go
result := l.CreateTable(0, 3)
result.RawSetString("name", lua.LString("value"))
result.RawSetString("count", lua.LNumber(42))
l.Push(result)
```

## Система типов

Модули используют два отдельных, но дополняющих друг друга механизма типизации.

### Определения типов (тулинг)

Поле `Types` предоставляет сигнатуры типов для поддержки IDE и документации:

```go
func ModuleTypes() *types.TypeManifest {
    m := types.NewManifest("mymodule")

    objectType := &types.InterfaceType{
        Name: "mymodule.Object",
        Methods: map[string]*types.FunctionType{
            "get_value": types.NewFunction(nil, []types.Type{types.String}),
            "set_value": types.NewFunction([]types.Type{types.String}, nil),
        },
    }

    m.DefineType("Object", objectType)
    m.SetExport(moduleType)
    return m
}
```

**Доступные конструкции типов:**

| Тип | Описание |
|-----|----------|
| `types.String` | Строковый примитив |
| `types.Number` | Числовое значение |
| `types.Boolean` | Булево значение |
| `types.Any` | Любое Lua-значение |
| `types.LuaError` | Тип ошибки |
| `types.Optional(t)` | Необязательное значение типа t |
| `types.InterfaceType` | Объект с методами |
| `types.FunctionType` | Сигнатура функции с params/returns |
| `types.RecordType` | Struct-подобный тип с полями |
| `types.TableType` | Таблица с типами ключ/значение |

Сигнатуры функций поддерживают variadic-параметры:

```go
// (string, ...any) -> (string, error?)
types.FunctionType{
    Params:   []types.Type{types.String},
    Variadic: types.Any,
    Returns:  []types.Type{types.String, types.Optional(types.LuaError)},
}
```

См. пакет `types` в go-lua для полной системы типов.

### UserData-привязки (runtime)

`RegisterTypeMethods` создаёт реальные Go-to-Lua привязки:

```go
func init() {
    value.RegisterTypeMethods(nil, "mymodule.Object",
        map[string]lua.LGoFunc{
            "__tostring": objectToString,  // Метаметоды
        },
        map[string]lua.LGoFunc{
            "get_value": objectGetValue,   // Обычные методы
            "set_value": objectSetValue,
        },
    )
}
```

Метатаблицы immutable и кешируются глобально для потокобезопасного переиспользования.

| Система | Назначение | Определяет |
|---------|------------|------------|
| Определения типов | IDE, docs, проверка типов | Сигнатуры |
| UserData-привязки | Runtime-вызовы методов | Исполняемые функции |

## Асинхронные операции

Для операций, ожидающих внешние системы, возвращайте yield вместо результата. Yield диспатчится Go-обработчику, и процесс возобновляется, когда обработчик завершит работу.

### Определение yield'ов

Объявите типы yield в функции `Build` модуля:

```go
Build: func() (*lua.LTable, []luaapi.YieldType) {
    mod := lua.CreateTable(0, 1)
    mod.RawSetString("fetch", lua.LGoFunc(fetchFunc))
    mod.Immutable = true

    yields := []luaapi.YieldType{
        {Sample: &FetchYield{}, CmdID: myapi.FetchCommand},
    }

    return mod, yields
}
```

### Создание yield

Возвращайте -1 для сигнала yield вместо обычных возвращаемых значений:

```go
func fetchFunc(l *lua.LState) int {
    url := l.CheckString(1)

    yield := AcquireFetchYield()
    yield.URL = url

    l.Push(yield)
    return -1  // Сигнал yield, не количество на стеке
}
```

### Реализация yield

Yield'ы связывают Lua-значения и команды диспатчера:

```go
type FetchYield struct {
    *myapi.FetchCmd
}

func (y *FetchYield) String() string              { return "<fetch_yield>" }
func (y *FetchYield) Type() lua.LValueType        { return lua.LTUserData }
func (y *FetchYield) CmdID() dispatcher.CommandID { return myapi.FetchCommand }
func (y *FetchYield) ToCommand() dispatcher.Command { return y.FetchCmd }
func (y *FetchYield) Release() { releaseFetchYield(y) }

func (y *FetchYield) HandleResult(l *lua.LState, data any, err error) []lua.LValue {
    if err != nil {
        return []lua.LValue{lua.LNil, lua.NewLuaError(l, err.Error())}
    }
    resp := data.(*myapi.FetchResponse)
    return []lua.LValue{lua.LString(resp.Body), lua.LNil}
}
```

Диспатчер маршрутизирует команду обработчику. См. [Диспатчинг команд](internal-dispatch.md) для реализации обработчиков.

## Обработка ошибок

Возвращайте ошибки как второе значение с использованием структурированных ошибок:

```go
func myFunc(l *lua.LState) int {
    result, err := doSomething()
    if err != nil {
        lerr := lua.NewLuaError(l, err.Error()).
            WithKind(lua.Internal).
            WithRetryable(true)
        l.Push(lua.LNil)
        l.Push(lerr)
        return 2
    }

    l.Push(lua.LString(result))
    l.Push(lua.LNil)
    return 2
}
```

## Безопасность

Проверяйте разрешения перед выполнением чувствительных операций:

```go
func myFunc(l *lua.LState) int {
    ctx := l.Context()

    if !security.IsAllowed(ctx, "mymodule.action", resource, nil) {
        l.Push(lua.LNil)
        l.Push(lua.NewLuaError(l, "permission denied").WithKind(lua.PermissionDenied))
        return 2
    }

    // Продолжить операцию
}
```

## Тестирование

Базовые тесты модуля проверяют структуру и синхронные функции:

```go
func TestModule(t *testing.T) {
    l := lua.NewState()
    defer l.Close()

    mod, _ := Module.Build()
    l.SetGlobal("mymodule", mod)

    err := l.DoString(`
        local m = mymodule
        assert(m.hello() == "Hello, World!")
    `)
    if err != nil {
        t.Fatal(err)
    }
}
```

### Тестирование модулей с yield'ами

Для тестирования Lua-кода с yield'ящими функциями создайте минимальный планировщик с нужными диспатчерами:

```go
type testScheduler struct {
    *actor.Scheduler
    clock   *clock.Dispatcher
    mu      sync.Mutex
    pending map[string]chan *runtime.Result
}

func newTestScheduler() *testScheduler {
    ts := &testScheduler{pending: make(map[string]chan *runtime.Result)}
    reg := scheduler.NewRegistry()

    // Регистрация диспатчеров для yield'ов вашего модуля
    clockSvc := clock.NewDispatcher()
    clockSvc.RegisterAll(func(id dispatcher.CommandID, h dispatcher.Handler) {
        reg.Register(id, h)
    })
    ts.clock = clockSvc

    ts.Scheduler = actor.NewScheduler(reg, actor.WithWorkers(4), actor.WithLifecycle(ts))
    return ts
}

func (ts *testScheduler) OnComplete(_ context.Context, p pid.PID, result *runtime.Result) {
    ts.mu.Lock()
    ch, ok := ts.pending[p.UniqID]
    delete(ts.pending, p.UniqID)
    ts.mu.Unlock()
    if ok {
        ch <- result
    }
}

func (ts *testScheduler) Execute(ctx context.Context, p pid.PID, proc process.Process,
    method string, input payload.Payloads) (*runtime.Result, error) {
    resultCh := make(chan *runtime.Result, 1)
    ts.mu.Lock()
    ts.pending[p.UniqID] = resultCh
    ts.mu.Unlock()

    _, err := ts.Scheduler.Submit(ctx, p, proc, method, input)
    if err != nil {
        return nil, err
    }

    select {
    case result := <-resultCh:
        return result, nil
    case <-ctx.Done():
        return nil, ctx.Err()
    }
}
```

Создание процессов из Lua-скриптов с тестируемыми модулями:

```go
func bindMyModule(l *lua.LState) {
    tbl, _ := mymodule.Module.Build()
    l.SetGlobal(mymodule.Module.Name, tbl)
}

func newLuaProcess(script string) *engine.Process {
    proto, _ := lua.CompileString(script, "test.lua")
    return engine.NewProcess(
        engine.WithProto(proto),
        engine.WithModuleBinder(bindMyModule),
    )
}

func TestMyModuleYields(t *testing.T) {
    sched := newTestScheduler()
    sched.Start()
    defer sched.Stop()

    script := `
        local result = mymodule.fetch("http://example.com")
        return result.status
    `

    ctx, _ := ctxapi.OpenFrameContext(context.Background())
    proc := newLuaProcess(script)

    result, err := sched.Execute(ctx, pid.PID{UniqID: "test"}, proc, "", nil)
    if err != nil {
        t.Fatal(err)
    }
    // Assert на result
}
```

См. `runtime/lua/modules/time/integration_test.go` для полного примера.

## См. также

- [Диспатчинг команд](internal-dispatch.md) — обработка yield-команд
- [Планировщик](internal-scheduler.md) — выполнение процессов
