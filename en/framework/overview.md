# Framework

Wippy provides official framework modules through the hub. These modules are maintained under the `wippy` organization and can be added to any project.

## Adding Framework Modules

```bash
wippy add wippy/test
wippy install
```

This adds the module to your lock file and downloads it to `.wippy/vendor/`.

## Declaring Dependencies in Source

Framework modules can also be declared as dependencies in your `_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dependency.test
    kind: ns.dependency
    component: wippy/test
    version: "^0.3.0"
```

Then resolve and install:

```bash
wippy update
```

## Importing Framework Libraries

Once installed, import framework libraries into your entries:

```yaml
entries:
  - name: my_test
    kind: function.lua
    meta:
      type: test
      suite: my-suite
    source: file://my_test.lua
    method: run
    imports:
      test: wippy.test:test
```

The import maps `wippy.test:test` (the `test` entry from the `wippy.test` namespace) to the local name `test`, which you then `require("test")` in Lua.

## Available Modules

| Module | Description |
|--------|-------------|
| `wippy/test` | BDD-style testing framework with assertions and mocking |
| `wippy/terminal` | Terminal UI components |

More modules are available and being published regularly. Search the hub:

```bash
wippy search wippy
```

## See Also

- [Dependency Management](guides/dependency-management.md) - Lock file and version constraints
- [Publishing](guides/publishing.md) - Publishing your own modules
- [CLI Reference](guides/cli.md) - CLI commands
