# 注册表

注册表是 Wippy 的中央配置存储。所有定义——入口点、服务、资源——都存储在这里，变更通过系统响应式传播。

## 记录

注册表包含**记录**——具有唯一 ID 的类型化定义：

```
app.api:get_user          → HTTP 处理器
app.workers:email_sender  → 后台进程
app:database              → 数据库连接
app:templates             → 模板集
```

每个记录有一个 `ID`（命名空间:名称格式）、一个决定其处理器的 `kind`、任意 `meta` 字段和特定于 kind 的 `data`。

## Kind 处理器

当提交记录时，其 `kind` 决定哪个处理器处理它。处理器验证配置并创建运行时资源——`http.service` 记录启动 HTTP 服务器，`function.lua` 记录创建函数池，`sql.database` 记录建立连接池。参见 [记录类型指南](guides/entry-kinds.md) 了解可用类型，[自定义记录类型](internals/kinds.md) 了解如何实现处理器。

## 实时更新

注册表支持运行时变更——在系统运行时添加、更新或删除记录。变更通过事件总线流动，监听器可以验证或拒绝它们，事务确保原子性。版本历史支持回滚。

YAML 定义文件是在启动时加载的序列化注册表快照。参见 [Registry 模块](lua/core/registry.md) 了解编程访问。

## 另请参阅

- [项目结构](start/structure.md) — 定义文件
- [自定义记录类型](internals/kinds.md) — 实现 kind 处理器
- [进程模型](concepts/process-model.md) — 进程如何工作
