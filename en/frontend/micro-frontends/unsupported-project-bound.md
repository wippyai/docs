---
title: "Unsupported Project-Bound Modules"
description: "Advanced warning for modules that intentionally abandon Wippy frontend portability."
---

# Unsupported Project-Bound Modules

**Classification: normative policy reference.** It defines the marker and
required result for a project-selected compliance workflow; the public package
family does not provide that workflow as a runnable CLI.

Wippy’s supported frontend contract is portable. A module that intentionally requires project-private facade CSS, private classes, or another deployment-specific frontend assumption is `UNSUPPORTED`.

This is not a normal exception. The project compliance workflow must enforce
these results:

- Standard compliance returns exactly `UNSUPPORTED`.
- Standard CI fails.
- Reuse, theme portability, upgrades, and support are not guaranteed.
- The module owner is responsible for every consuming facade and migration.

Do not label this mode “discouraged,” “partially compliant,” or “non-compliant but accepted.” The canonical status is `UNSUPPORTED`.

Project-bound mode is advanced-only and is not presented in Quickstart or standard recipes. It cannot waive accessibility, HTML validity, security, or backend schema requirements.

An entire project being intended for one deployment does not silently relax the contract. The unsupported status must be explicit in project policy and module metadata, with the standard CI failure deliberately handled outside Wippy’s supported compliance workflow.

Declare the status in the module-root `wippy-fe.contract.json` with the exact
field and value below:

```json
{
  "portability": "project-bound"
}
```

`mode` and other aliases are not accepted. The compliance workflow must make
this marker return `UNSUPPORTED` and exit unsuccessfully; it does not grant an
exemption. The public `@wippy-fe/*` 0.0.56 package family does not ship an
application-compliance CLI, so the project must implement this gate in its
selected compliance workflow.
