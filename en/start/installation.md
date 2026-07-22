---
title: "Installation"
description: "Install the Wippy runtime"
---

# Installation

## Quick Install

```bash
curl -fsSL https://hub.wippy.ai/install.sh | bash
```

Or download directly from [hub.wippy.ai/releases](https://hub.wippy.ai/releases).

## Verify

```bash
wippy version
```

## Quick Start

```bash
# Create a new project
mkdir myapp && cd myapp
wippy init

# Run
wippy run
```

HTTP, SQL, storage, and process hosting are built into the runtime — a fresh project runs without any dependencies. Framework modules are added from the hub as needed:

```bash
wippy add wippy/test
wippy install
```

## Commands Overview

| Command | Description |
| --------- | ------------- |
| `wippy init` | Initialize a new project |
| `wippy run` | Start the runtime |
| `wippy test` | Run the test entrypoint |
| `wippy lint` | Check code for errors |
| `wippy add` | Add a dependency |
| `wippy install` | Install dependencies |
| `wippy update` | Update dependencies |
| `wippy pack` | Create a snapshot |
| `wippy publish` | Publish to hub |
| `wippy search` | Search for modules |
| `wippy readme` | Fetch a module README from the hub |
| `wippy registry` | Inspect loaded registry entries |
| `wippy auth` | Manage authentication |
| `wippy version` | Print version info |

See [CLI Reference](guides/cli.md) for full documentation.

## Troubleshooting

If `wippy version` is not found after install, reopen your shell or verify that the install directory is on your `PATH`.

## Next Steps

- [Hello World](tutorials/hello-world.md) - Create your first project
- [Project Structure](start/structure.md) - Understand the layout
- [CLI Reference](guides/cli.md) - All commands and options
