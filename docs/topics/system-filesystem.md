# Filesystem

Directory and embedded filesystem access.

## Entry Kinds

| Kind | Description |
|------|-------------|
| `fs.directory` | Directory-based filesystem |
| `fs.embed` | Read-only embedded filesystem |

## Directory Filesystem

```yaml
- name: uploads
  kind: fs.directory
  directory: "/var/data/uploads"
  auto_init: true
  mode: "0755"
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `directory` | string | required | Root path |
| `auto_init` | bool | false | Create directory if missing |
| `mode` | string | 0755 | Unix permission mode (octal) |

The mode restricts all file operations. Execute bits are added automatically when read bits are present.

<note>
Paths are normalized and validated. It is not possible to access files outside the configured root directory.
</note>

## Embedded Filesystem

```yaml
- name: static
  kind: fs.embed
```

Embedded filesystems load from pack resources using the entry ID. They are read-only.

<warning>
Embedded filesystems are an internal mechanism. Manual configuration is typically not required.
</warning>

## Operations

Both filesystem types implement:

| Operation | Directory | Embed |
|-----------|-----------|-------|
| Open/Read | Yes | Yes |
| Stat | Yes | Yes |
| ReadDir | Yes | Yes |
| OpenFile (write) | Yes | No |
| Remove | Yes | No |
| Mkdir | Yes | No |

Write operations on embedded filesystems return an error.

## Lua API

See [Filesystem Module](lua-fs.md) for file operations.
