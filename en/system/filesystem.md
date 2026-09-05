---
title: "Filesystem"
description: "Directory and embedded filesystem access."
---

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
| `base` | string | - | Relative-path base: `project` (process working directory) or `module` (owning module load root) |

Absolute paths are used as given, whatever `base` says.

For a relative path, `base: project` keeps it relative to the process working directory. Both `base: module` and an unset `base` resolve it against the load root of the module that owns the entry, looked up through the entry's registry owner. When the entry has no owning module, or that module has no resolvable resource root, the path stays relative to the process working directory.

Any other value is rejected with `invalid directory base`.

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

See [Filesystem Module](lua/storage/filesystem.md) for file operations.

## See Also

- [Filesystem Module](lua/storage/filesystem.md) - Lua API reference
- [Cloud Storage](system/cloudstorage.md) - S3-compatible object storage
- [Template](system/template.md) - Templates loaded from filesystems
