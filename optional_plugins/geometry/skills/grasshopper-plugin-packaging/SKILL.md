---
name: grasshopper-plugin-packaging
description: Use this skill whenever you are developing or packaging a Python Grasshopper plugin for Rhino 8 — from `#! python 3` Script components through a `.rhproj` Script Project to a published `.yak` package on the Rhino package server. Trigger when the user mentions "Grasshopper plugin", "Yak package", "yak push", ".rhproj", "GH component packaging", or "publish to package server". Covers the CPython-vs-IronPython component tradeoff, manifest.yml authoring, distribution-tag versioning, dependency bundling, and CI publishing. Do NOT use for writing/testing RhinoCommon geometry logic itself — use python-rhino-grasshopper for authoring and rhino-unit-testing/rhino-e2e-testing for verification.
argument-hint: "[new-plugin|package-release|ci-setup] <plugin name>"
metadata:
  version: "1.0.0"
  tags: ["rhino", "grasshopper", "yak", "packaging", "rhproj", "plugin", "distribution", "ci"]
---

# Skill: Grasshopper Plugin Packaging

## 🚀 Recommended Pipeline (Lead With This)

For a solo Python dev, Rhino 8 ships a real plugin without C#/Visual Studio:

```
#! python 3 Script components
    → collect into a .rhproj Script Project
    → rhinocode project build <path>.rhproj
    → emits <name>.Components.gha + <name>.rhp + <name>-<ver>-rh8-any.yak
    → yak push <file>.yak
```

C#-free end to end; this pipeline did not exist before Rhino 8. Sources: [Create a Script Project](https://developer.rhino3d.com/guides/scripting/projects-create/), [Publish a Script Project](https://developer.rhino3d.com/guides/scripting/projects-publish/).

## 🗺 Landscape: 4 Ways to Ship GH Logic

| Approach | Runtime | Status | Use When |
|:---|:---|:---|:---|
| Script component `#! python 3` | CPython 3.9.10 | ✅ Recommended | Default for new plugins |
| Legacy GHPython | IronPython 2.7 | ⚠️ Legacy | Maintaining existing IronPython components |
| `.ghpy` compiled component | — | ❌ Deprecated | Never for new work — McNeel no longer supports |
| C# `.gha` | .NET | ✅ Perf-critical | Deep GH SDK access, tight RhinoCommon loops |

Escape hatch: `rhinocode project build` generates a VS/dotnet solution under `src/` inside the `.rhproj` — drop a Python hotspot to C# without leaving the project. Source: [Create a Script Project](https://developer.rhino3d.com/guides/scripting/projects-create/).

## ⚖ CPython vs IronPython (Choose Per Component)

| | CPython (`#! python 3`) | IronPython 2.7 (legacy GHPython) |
|:---|:---|:---|
| PyPI (numpy, scipy) | ✅ Yes | ❌ No easy path |
| Tight RhinoCommon geometry loops | ~10x slower (Python.NET marshalling) | Faster |

A plugin can mix both. See `python-rhino-grasshopper` for RhinoCommon authoring patterns — not restated here.

## 📦 Packaging via Yak

`Yak.exe`: `C:\Program Files\Rhino 8\System\Yak.exe` (Windows) / `/Applications/Rhino 8.app/Contents/Resources/bin/yak` (mac).

Manual path (when not using `rhinocode project build`):
```
yak spec                          # generate skeleton manifest.yml by inspecting the .gha
# edit manifest.yml
yak build --platform win|mac|any
yak login
yak push <file>.yak
```

Mandatory `manifest.yml` fields: `name` (letters/numbers/dashes/underscores, case-insensitive after first upload), `version` (SemVer 2.0.0 or 4-digit — `$version` infers from the assembly, use it in CI for single-source-of-truth), `authors` (**build fails without it**). Also `description`, `url`, `keywords`, `icon` (64x64 PNG/JPEG). Exhaustive field list + full CLI reference: `references/yak-cli.md`.

Sources: [What is Yak](https://developer.rhino3d.com/guides/yak/what-is-yak/), [The Package Manifest](https://developer.rhino3d.com/guides/yak/the-package-manifest/), [Yak CLI Reference](https://developer.rhino3d.com/guides/yak/yak-cli-reference/), [Creating a Grasshopper Plugin Package](https://developer.rhino3d.com/guides/yak/creating-a-grasshopper-plugin-package/).

## ⚠️ Distribution Tags (Docs Are Misleading — Read This)

`manifest.yml` has **no** Rhino-version or platform field. Targeting lives in the **distribution tag baked into the filename**: `yourplugin-1.0.0-rh8_0-win.yak`.
- `rh8_0` = minimum Rhino version, auto-derived by inspecting the assembly's referenced RhinoCommon.
- `any` = version-agnostic.
- Platform segment set by `--platform` at build time.

**FLAG — verify against a live Rhino 8 build**: targeting a specific Rhino version is controlled via the build target / referenced RhinoCommon assembly, not a YAML field. Not settled from docs alone — confirm the derived tag on an actual `yak build` output before shipping. Source: [Pushing a Package to the Server](https://developer.rhino3d.com/guides/yak/pushing-a-package-to-the-server/).

## 🔒 Versioning Immutability

Published versions **cannot be deleted or overwritten** — bump every release. `yak yank` only unlists (file stays hidden, not removed). Dry-run against the test server (resets daily) before prod:
```
yak push --source https://test.yak.rhino3d.com <file>.yak
```

## 🧩 Dependency Bundling — The Sharp Edge (Flag, Don't Assume)

Declare PyPI deps inline in a script header:
```python
#! python 3
# venv: <name>
# r: numpy, scipy
```
Non-PyPI local libs: `# env: C:/path/to/lib/`. Full `# venv:`/`# r:`/`# env:` semantics (version trap, async gotcha) are owned by `rhino-e2e-testing` §*Bringing packages into the in-process script* — not restated here. Envs install into `~/.rhinocode/py39-rh8/.../site-envs/`.

**FLAG — verify against a live Rhino 8 build**: McNeel docs do NOT settle whether `# r:` deps bundle into the `.yak` at build time or pip-install on the **end user's** machine at first run. Evidence favors runtime install — first run "takes time and disables the editor," implying a live install step — meaning end users would need internet access. Do not treat this as settled; confirm on a real install before relying on it for offline distribution.

**Safer default for hard/offline deps**: vendor pure-Python libraries into the project's `Libraries/` folder — embedded in the `.yak`, deployed with the assemblies, queryable at runtime via `PlugIn.PathFromId`. Sources: [Python Packages](https://developer.rhino3d.com/guides/rhinopython/python-packages/), [Advanced: Python Virtual Environments](https://developer.rhino3d.com/guides/scripting/advanced-pyvenvs/), [Package Restore in Grasshopper](https://developer.rhino3d.com/guides/yak/package-restore-in-grasshopper/).

## 📁 `.rhproj` Folder Structure

```
MyPlugin.rhproj
├── Libraries/       # importable .py modules, embedded in the package
├── Shared/          # data files
├── icon.svg         # plugin icon (light + dark)
└── <Component>/
    ├── code.py
    ├── icon-light.svg / icon-dark.svg
    └── metadata: Name, NickName, Description, sub-category, Exposure, Exclude
```
- **Exposure**: primary / secondary / tertiary / quaternary — controls ribbon prominence.
- **Exclude**: keep a component in the project without publishing it.

Source: [Create a Script Project](https://developer.rhino3d.com/guides/scripting/projects-create/).

## 🛠 Dev Workflow

- **Thin components, deep modules**: components call into `Libraries/*.py` modules. Pure logic in those modules is Lane-B testable outside Rhino entirely (`rhino-unit-testing`); geometry-dependent logic is Lane A (`rhino-e2e-testing`) — test lanes not restated here.
- **Version control `.ghx` (XML, diffable), not `.gh` (binary)**.
- **Local iteration**: `yak install <local.yak>` to dry-run install; the Script Editor runs components in-place for day-to-day work — package only at release checkpoints.

## 🤖 CI

```
yak login --ci                    # non-expiring API key via YAK_TOKEN env var
```
GitHub Actions: `mcneel/setup-yak`, `Paramdigma/setup-yak`, `crashcloud/yak-publish`. Gate `yak push` on a git tag (`v1.2.3`) — versions are immutable, so an untagged push risks burning a version number.

## ✅ Packaging Checklist

1. Every component starts with `#! python 3` unless deliberately using legacy IronPython for a hot loop.
2. Thin component / deep `Libraries/` module split — logic is Lane-B testable.
3. `.rhproj` has Name, Version, Author set.
4. SVG icons present (plugin + per-component, light + dark).
5. Dependency decision made explicitly — `# r:`+`# venv:` vs vendored `Libraries/` — and verified which one actually ships offline.
6. `manifest.yml` valid: `name`, `version` (or `$version`), `authors` present.
7. Built with correct `--platform`, and the derived distribution tag checked against the target Rhino version.
8. Dry-run pushed to the test server before prod.
9. Version bumped — never overwrite (immutable).
10. `.ghx` committed, not `.gh`.
11. CI `YAK_TOKEN` configured, `yak push` gated on a git tag.

## 🔗 Relationships
- **Authoring RhinoCommon logic**: `python-rhino-grasshopper`
- **Lane B testing of `Libraries/` modules**: `rhino-unit-testing`
- **Lane A E2E testing of geometry-dependent components**: `rhino-e2e-testing`
