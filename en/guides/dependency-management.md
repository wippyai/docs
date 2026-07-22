---
title: "Dependency Management"
description: "Wippy uses a lock file-based dependency system. Modules are published to the hub, declared as dependencies in your source, and resolved into a…"
---

# Dependency Management

Wippy uses a lock file-based dependency system. Modules are published to the hub, declared as dependencies in your source, and resolved into a `wippy.lock` file that tracks exact versions.

## Project Files

### wippy.lock

The lock file tracks your project's directory layout and pinned dependencies:

```yaml
directories:
  modules: .wippy
  src: ./src
modules:
  - name: acme/http
    version: v1.2.0
    hash: 4ea816fe84ca58a1f0869e5ca6afa93d6ddd72fa09e1162d9e600a7fbf39f0a2
  - name: acme/sql
    version: v2.0.1
    hash: b3f9c8e12a456d7890abcdef1234567890abcdef1234567890abcdef12345678
```

| Field | Description |
|-------|-------------|
| `directories.modules` | Where downloaded modules are stored (default: `.wippy`) |
| `directories.src` | Where your source code lives (default: `./src`) |
| `modules[].name` | Module identifier in `org/module` format |
| `modules[].version` | Pinned semantic version |
| `modules[].hash` | Content hash for integrity verification |

### wippy.yaml

Module metadata for publishing. Required only when you publish your own module:

```yaml
organization: acme
module: http
version: 1.2.0
description: HTTP utilities for Wippy
license: MIT
repository: https://github.com/acme/wippy-http
keywords:
  - http
  - web
```

| Field | Required | Description |
|-------|----------|-------------|
| `organization` | Yes | Lowercase, alphanumeric with hyphens |
| `module` | Yes | Lowercase, alphanumeric with hyphens |
| `version` | No | Semantic version (set at publish time) |
| `description` | No | Module description |
| `license` | No | SPDX license identifier |
| `repository` | No | Source repository URL |
| `homepage` | No | Project homepage |
| `keywords` | No | Discovery keywords |
| `authors` | No | Author list |

## Declaring Dependencies

Add `ns.dependency` entries in your `_index.yaml`:

```yaml
version: "1.0"
namespace: app
entries:
  - name: dependency.http
    kind: ns.dependency
    component: acme/http
    version: "^1.0.0"

  - name: dependency.sql
    kind: ns.dependency
    component: acme/sql
    version: ">=2.0.0"
```

### Version Constraints

| Constraint | Example | Matches |
|------------|---------|---------|
| Exact | `1.2.3` | Only 1.2.3 |
| Caret | `^1.2.0` | >=1.2.0, <2.0.0 |
| Tilde | `~1.2.0` | >=1.2.0, <1.3.0 |
| Range | `>=1.0.0` | 1.0.0 and above |
| Wildcard | `*` | Any version (picks highest) |
| Combined | `>=1.0.0 <2.0.0` | Between 1.0.0 and 2.0.0 |

## Workflow

### Starting a New Project

```bash
wippy init
```

Creates a `wippy.lock` with default directories.

### Adding Dependencies

```bash
wippy add acme/http               # Latest version
wippy add acme/http@1.2.3         # Exact version
wippy add acme/http@latest         # Latest label
```

This updates the lock file. Then install:

```bash
wippy install
```

### Resolving from Source

If your source already declares `ns.dependency` entries:

```bash
wippy update
```

This scans your source directory, resolves all dependency constraints, updates the lock file, and installs modules.

### Updating Dependencies

```bash
wippy update                       # Re-resolve all dependencies
wippy update acme/http             # Update only acme/http
wippy update acme/http acme/sql    # Update specific modules
```

When updating specific modules, other modules stay pinned to their current versions. If the update would require changing non-target modules, you are prompted for confirmation.

### Installing from Lock File

```bash
wippy install                      # Install all from lock
wippy install --refresh            # Re-fetch every module (--force and --repair are aliases)
```

## Module Storage

Downloaded modules are stored under the `.wippy/vendor/` directory:

```
project/
  wippy.lock
  src/
    _index.yaml
  .wippy/
    vendor/
      acme/
        http-v1.2.0.wapp
        sql-v2.0.1.wapp
```

By default, modules are kept as `.wapp` files. To extract them into directories:

```yaml
# wippy.lock
options:
  unpack_modules: true
```

With unpacking enabled:

```
.wippy/
  vendor/
    acme/
      http/
        wippy.yaml
        src/
          _index.yaml
          ...
```

## Local Development with Replacements

Point a hub module at a local checkout so the runtime loads your working copy instead of the vendored download. Replacements live in a **runtime configuration file** under the `workspace.replacements` map (`org/module: path`) and are activated with `--profile`:

```yaml
# .wippy.workspace.yaml
version: "1.0"

profiles:
  workspace:
    workspace:
      replacements:
        acme/http: ../local-http
```

```bash
wippy run --config .wippy.yaml --config .wippy.workspace.yaml --profile workspace
```

The replacement path is relative to the first runtime config file. The same `--config`/`--profile` composition applies to `wippy install` and `wippy update`, which validate and skip replaced modules — the runtime loads them directly from local source. See [Configuration Composition](guides/configuration.md#configuration-composition) for the merge and precedence rules. Keep the workspace file out of version control; the `workspace` section is never exported in published module metadata.

<note>
**Deprecated: lock-file replacements.** A top-level `replacements:` list in `wippy.lock` still loads for compatibility but emits a deprecation warning and will be removed. Move them to `workspace.replacements` in a runtime config file; do not add new workspace replacements to the portable lock.
</note>

## Load Order

At boot, Wippy loads entries from directories in this order:

1. Source directory (`src`)
2. Workspace replacement directories
3. Vendored module directories

Modules with an active replacement skip their vendor path.

## Integrity Verification

Each module in the lock file has a content hash. During installation, downloaded modules are verified against their expected hashes; mismatched modules are rejected and re-downloaded from the registry.

Workspace-replaced modules are exempt from this download check — `wippy install` validates and skips them because the runtime loads them directly from local source. Their replacement tree is re-hashed at boot before any cached build state is reused, so **rebuilding a replaced module is picked up on the next `wippy run` with no reinstall or registry wipe**. (Earlier runtimes re-verified a frozen digest and aborted a rebuilt replacement with `replacement content digest mismatch`; that no longer happens.)

## See Also

- [CLI](guides/cli.md) - Command reference
- [Configuration](guides/configuration.md) - Runtime config composition, profiles, and workspace replacements
- [Publishing](guides/publishing.md) - Publishing modules to the hub
- [Project Structure](start/structure.md) - Project layout
