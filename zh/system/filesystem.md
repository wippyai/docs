# Filesystem

目录和嵌入式文件系统访问。

## Entry 类型

| Kind | 描述 |
|------|------|
| `fs.directory` | 基于目录的文件系统 |
| `fs.embed` | 只读嵌入式文件系统 |

## 目录文件系统

```yaml
- name: uploads
  kind: fs.directory
  directory: "/var/data/uploads"
  auto_init: true
  mode: "0755"
```

| 字段 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `directory` | string | required | 根路径 |
| `auto_init` | bool | false | 目录不存在时自动创建 |
| `mode` | string | 0755 | Unix 权限模式（八进制） |

mode 限制所有文件操作。当存在读取位时，执行位会自动添加。

<note>
路径会被规范化和验证。无法访问配置的根目录之外的文件。
</note>

## 嵌入式文件系统

```yaml
- name: static
  kind: fs.embed
```

嵌入式文件系统使用 entry ID 从 pack 资源加载。它们是只读的。

<warning>
嵌入式文件系统是内部机制。通常不需要手动配置。
</warning>

## 操作

两种文件系统类型都实现：

| 操作 | 目录 | 嵌入式 |
|------|------|--------|
| Open/Read | 是 | 是 |
| Stat | 是 | 是 |
| ReadDir | 是 | 是 |
| OpenFile (write) | 是 | 否 |
| Remove | 是 | 否 |
| Mkdir | 是 | 否 |

对嵌入式文件系统的写操作会返回错误。

## Lua API

参见 [Filesystem 模块](lua/storage/filesystem.md) 了解文件操作。
