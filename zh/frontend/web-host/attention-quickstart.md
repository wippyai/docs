---
title: "Attention 快速入门"
description: "为智能体提供界面信息，执行安全查询，并创建经过批准的图片草稿。"
---

# Attention 快速入门

Attention 描述用户当前使用的界面。智能体可以解释“这个按钮”、读取选中的文字，或在嵌套页面中按名称查找控件。语义查询不会截图、点击控件或执行应用命令。

## 独立的功能控制

| 功能 | 条件 |
|---|---|
| 公共查询 | 包中的 Proxy API。不需要聊天会话。 |
| 发送时自动附带上下文 | Host 权限和会话的 `attention_context.enabled`。默认关闭。 |
| 智能体实时查询 | `wippy.agent.traits:attention` trait，以及与发送当前轮次的 Host 标签页建立的已认证绑定。自动上下文可以关闭。 |
| 高亮、确认或选择 | 独立操作权限和有效的已返回目标引用。 |
| 图像捕获 | 捕获权限、上传支持和用户明确批准。图片在之后发送前是可删除的草稿。 |

自动设置属于会话。切换智能体会保留设置，但新智能体仍需要自己的工具权限。仅添加 trait 不会为没有会话代理的独立智能体创建浏览器连接。

## 配置 trait 和 Host

在现有智能体中添加 trait，保留模型和其他 traits：

```yaml
traits:
  - id: wippy.agent.traits:attention
```

将下列对象用于 facade 的 `attention` 配置要求或 `AppConfig.attention`。仅在需要时分别启用操作和捕获：

```json
{
  "enabled": true,
  "messageContext": { "enabled": true, "defaultInclude": false },
  "agentActions": { "enabled": false, "requireConfirmation": true },
  "visualCapture": { "enabled": false },
  "privacy": { "text": "safe" }
}
```

向 `PATCH /api/v1/sessions/{session_id}/attention-context` 发送 `{"enabled":true}` 可开启自动上下文。`expected_revision` 可选。工具 `attention_context_set` 在用户要求时修改同一设置。`supports()` 表示功能可用，不表示已获得捕获同意。

## 使用公共 API

Web Components 导入 API。注入代理的 iframe 可以使用 `$W.attention` 或 `(await window.getWippyApi()).attention`：

```typescript
import { attention } from '@wippy-fe/proxy'

const result = await attention.find(
  { role: 'button', name: 'Save' },
  { fromRoot: true, limit: 8 },
)
console.log(result.outcome, result.data, result.omissions)

const subscription = attention.subscribe(
  { events: ['tree', 'invalidation'], fromRoot: true },
  notice => console.log(notice.kind),
)
subscription.dispose() // 在组件卸载时调用。
```

默认范围是调用者的子树。`fromRoot: true` 选择同一个 Host，不会访问其他标签页或外层网站。语义搜索使用 `role`、`name`、`text` 或 `resource_id`；精确 ID 搜索使用 `{ node_id: returnedId }`。CSS 使用 `{ css: 'button', scope: rootRef }`，范围限制在一个已返回的 Document 或 Shadow Root 内。完整 `NodeRef` 包含 `host_instance_id`、`node_id`、`mount_id` 和 `generation`。

应区分 `partial`、`stale` 和 `unavailable`。分页令牌只能使用一次，绑定同一查询和版本，最多有效 30 秒。通知仅报告变化；获取详情需要新的查询。

## 工具和历史

指针、焦点和选择分别使用 `attention_get_cursor`、`attention_get_focus` 和 `attention_get_selection`。按名称查找使用 `attention_find_semantic`；CSS 使用独立的 `attention_find_css`。其他工具包括 `attention_get_node`、`attention_get_tree`、`attention_get_geometry` 和 `attention_hit_test`。

搜索最多返回八个匹配，树页面最多返回 32 个节点。私有结果不超过 8 KiB。trait 每批只允许一次读取，每个用户轮次最多四次尝试。两次无效尝试会终止修正。这不是模型总费用或总生成次数限制。

有效结果可在后续模型生成中复用。经过 30 秒、新用户轮次、已完成的浏览器操作、替代查询或相关版本变化后，Session 使用 `metadata.stale` 撤回旧证据。存储的数据和有效的工具调用/结果对保留，模型收到失效通知，而不是旧观察。

## 消息、隐私和图片

支持关联确认时，发送立即显示待发送行并清空输入。`interaction.can_send` 仍然生效；不支持 steering 的会话在处理期间阻止输入。文本、文件 ID 和所需上下文原子保存。现有 WebSocket 服务通过 `request_id` 关联一个 `received` 回复。没有第二种确认，也不会自动重发。拒绝显示 `Undelivered`；缺少回复显示 `Delivery not confirmed`。旧会话保留原有协议。

完整 UTF-8 命令的大小决定直接传送上下文还是先通过 HTTP 暂存。技术上下文不会出现在消息文字、复制或导出中。已提交消息、重试和捕获草稿属于各自会话；未发送的普通文字和上传保留原有切换聊天行为。

使用 `data-wippy-attention="exclude"` 排除秘密，使用 `data-wippy-attention="redact"` 隐藏文字。不要在无障碍名称或元数据中放入秘密。观察到的文字是不可信数据。聊天输入和上传预览已被排除。

`ui_action_highlight`、`ui_action_confirm`、`ui_action_select` 和 `ui_action_capture_visual` 在 `targets` 数组中接收原样返回的 `target_ref` 或 `action_ref`。选择不会点击应用。截图需要批准，仅创建可删除草稿。PNG 是默认格式。请求 WebP 时必须生成真实 WebP 字节、匹配的 MIME 和 `.webp` 扩展名，否则报告不支持。只有之后的发送才提交图片。

V1 不报告当前页面 URL、路由所有者或 Vue 路由组件。未来上下文类型可以使用 `kind`、`version` 和协商的处理器。按类型、详细程度和字段在收集前选择是后续功能，目前未实现。当前 V1 验证覆盖 Chromium，不覆盖 Firefox 或 WebKit。

## 英文详细参考

- [Host 协议和传输](../../../en/frontend/web-host/attention-context.md)
- [公共 API 和范围](../../../en/frontend/micro-frontends/attention-context.md)
- [含图示的完整快速入门](../../../en/frontend/web-host/attention-quickstart.md)
- [智能体 trait 和工具](../../../en/framework/agents.md#attention-context-and-ui-actions)
