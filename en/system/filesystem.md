---
title: "Filesystem"
description: "Configure directory-backed and read-only embedded filesystems."
---

# Filesystem

Filesystem entries expose directory-backed or read-only embedded storage to runtime modules. This page is a configuration reference; its YAML blocks are individual entry fragments rather than complete projects.

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
| `base` | string | inferred | Relative-path base: `project` (process working directory) or `module` (owning module resource root) |

For a module-owned entry, an omitted `base` resolves a relative directory from
the owning module's resource root. Host-authored entries remain relative to the
process working directory. Set `base: project` to force working-directory
resolution for a module entry, or `base: module` to request module-root
resolution explicitly. If module ownership or its resource root is unavailable,
the runtime leaves the relative path unchanged.

The configured mode gates operations by its owner bits, and permissions
requested for newly created files and directories are masked by that mode. When
all read bits are present and no execute bits are set, the runtime adds execute
bits (for example, `0444` becomes `0555`). Operating-system permissions still
apply to the backing directory.

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
Embedded filesystems are used internally and normally do not require manual configuration.
</warning>

## Operations

Both filesystem types implement:

| Operation | Directory | Embed |
|-----------|-----------|-------|
| Open/Read | Yes | Yes |
| Stat | Yes | Yes |
| Lstat | Yes | Yes |
| ReadDir | Yes | Yes |
| OpenFile (write) | Yes | No |
| Remove | Yes | No |
| Mkdir | Yes | No |
| Rename | Yes | No |
| Truncate | Yes | No |
| Chtimes | Yes | No |

Write operations on embedded filesystems return an error.

## Lua API

See [Filesystem Module](../lua/storage/filesystem.md) for file operations.

## See Also

- [Filesystem Module](../lua/storage/filesystem.md) - Lua API reference
- [Cloud Storage](./cloudstorage.md) - S3-compatible object storage
- [Template](./template.md) - Templates loaded from filesystems
