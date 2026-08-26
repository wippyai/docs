---
title: "Installation"
description: "Install the Wippy runtime and verify that the command is available."
---

# Installation

## Install

```bash
curl -fsSL https://hub.wippy.ai/install.sh | bash
```

Or download directly from [hub.wippy.ai/releases](https://hub.wippy.ai/releases).

## Verify

```bash
wippy version
```

## Initialize a Project

```bash
# Create a new project
mkdir myapp && cd myapp
wippy init

# Run
wippy run
```

The runtime includes HTTP, SQL, storage, and process-hosting capabilities. Add framework modules from the Hub when the application needs them:

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

If the shell cannot find `wippy` after installation, reopen the shell and verify that the installation directory is on `PATH`.

## Next Steps

- [Hello World](tutorials/hello-world.md) — Create your first application
- [Project Structure](start/structure.md) — Understand the project layout
- [CLI Reference](guides/cli.md) — Review all commands and options
