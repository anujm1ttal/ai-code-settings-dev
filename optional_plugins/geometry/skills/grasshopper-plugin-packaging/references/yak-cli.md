# Reference: Yak CLI & Manifest (Exhaustive)

Load this file only when authoring/debugging `manifest.yml` directly or scripting the `yak` CLI outside `rhinocode project build`. `SKILL.md` covers the day-to-day pipeline — this file is the exhaustive detail.

## CLI Commands

| Command | Purpose |
|:---|:---|
| `yak spec` | Generate a skeleton `manifest.yml` by inspecting an existing `.gha`/`.rhp`. |
| `yak build [--platform win\|mac\|any]` | Compile the current directory into a `.yak` package. Platform defaults to the OS you build on if omitted. |
| `yak login` | Interactive browser-based auth against the Rhino package server. |
| `yak login --ci` | Non-interactive; expects `YAK_TOKEN` env var with a non-expiring API key — the CI path. |
| `yak push <file>.yak` | Publish to the production package server. Irreversible for that version (see Versioning Immutability in `SKILL.md`). |
| `yak push --source https://test.yak.rhino3d.com <file>.yak` | Publish to the test server (resets daily) — use for dry runs before prod. |
| `yak yank <name> <version>` | Unlist a version. Does NOT delete the underlying file; existing installs unaffected. |
| `yak install <file>.yak` | Local install for dry-run testing without touching the server. |
| `yak list` / `yak search <term>` | Query the package server. |

Source: [Yak CLI Reference](https://developer.rhino3d.com/guides/yak/yak-cli-reference/).

## manifest.yml — Full Field Reference

| Field | Required | Notes |
|:---|:---|:---|
| `name` | Yes | Letters, numbers, dashes, underscores. Case-insensitive after first upload — a rename requires deleting and re-registering the name via McNeel support. |
| `version` | Yes | SemVer 2.0.0 (`1.2.3`) or 4-digit (`1.2.3.4`). `$version` placeholder infers from the built assembly's version attribute — preferred for CI so the assembly stays the single source of truth. |
| `authors` | Yes | List of strings. **Build fails without at least one author.** |
| `description` | No (strongly recommended) | Free text, surfaced in the package browser. |
| `url` | No | Project homepage / repo. |
| `keywords` | No | List of strings, aids search. |
| `icon` | No (strongly recommended) | 64x64 PNG or JPEG, relative path from `manifest.yml`. |

Source: [The Package Manifest](https://developer.rhino3d.com/guides/yak/the-package-manifest/).

## Distribution Tag Anatomy

Filename pattern: `<name>-<version>-<rhino-tag>-<platform>.yak`, e.g. `myplugin-1.0.0-rh8_0-win.yak`.

| Segment | Source | Values |
|:---|:---|:---|
| `<rhino-tag>` | Auto-derived from the referenced RhinoCommon assembly at build time | `rh8_0`, `rh8_11`, `any` |
| `<platform>` | `--platform` flag at `yak build` | `win`, `mac`, `any` |

**Unresolved from docs (flag, do not assume)**: there is no manifest field to force a specific `<rhino-tag>` independent of the referenced RhinoCommon assembly version. If a build needs to target an older Rhino 8 minor version than the dev machine's installed RhinoCommon, the mechanism (older RhinoCommon reference vs. a CLI override) is unconfirmed — verify against a live `yak build` before depending on a specific tag. Source: [Pushing a Package to the Server](https://developer.rhino3d.com/guides/yak/pushing-a-package-to-the-server/).

## Package Restore in Grasshopper

End users who open a `.gh`/`.ghx` referencing an unpublished/uninstalled component trigger Grasshopper's built-in **Package Restore** prompt, which queries the Yak server for a matching `name`+`version` and offers to install it. This is why immutable versioning matters — restore resolves by exact version, so yanking without publishing a replacement breaks restore for anyone still on that version. Source: [Package Restore in Grasshopper](https://developer.rhino3d.com/guides/yak/package-restore-in-grasshopper/).
