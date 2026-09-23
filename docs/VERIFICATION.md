# Dossier verification — 2026-09-24

## What is actually ready

The Windows desktop executable and console generator are built locally. The
compiled app was opened in a native Windows window; its OS folder picker was
used; generation, rerun, and second-section behavior were checked in the GUI.
The independent golden-tree verifier, Rust tests, UI integration, responsive
browser preview, and showcase checks pass. GitHub Actions built and verified
the Windows, Linux, macOS Intel, and macOS Apple Silicon packages. The public
[v0.1.0 release](https://github.com/the-sudipta/dossier/releases/tag/v0.1.0)
contains all eight desktop and standalone CLI assets plus SHA-256 checksums.
The tagged [release workflow run](https://github.com/the-sudipta/dossier/actions/runs/35907782917)
completed successfully. No Pages deployment has been performed.

## Native build blocker

The first Windows build attempt refused to execute the generated Tauri plugin
build script:

```text
tauri-plugin-dialog-0a35389e3502a5fc/build-script-build.exe
An Application Control policy has blocked this file. (os error 4551)
```

That error no longer blocks the build. Retrying later succeeded; the complete
Tauri Windows workspace compiled, and the packaging script completed. The final
outputs are in `dist/Dossier.exe` and `dist/dossier-cli.exe`. The first attempt's
log is retained as troubleshooting history in `verification/build.log`; the
successful build is recorded in `verification/build-retry.log` and
`verification/windows-package.log`. A read-only
check found `VerifiedAndReputablePolicyState = 1` (Smart App Control enabled).
The particular policy event was not available in the filtered log query; the
build output is the direct evidence of the block. No security policy was changed.

Microsoft states that Smart App Control has no per-app exception. Despite the
initial block, a later build succeeded without changing Windows security
settings. `scripts/build-windows.ps1` verifies formatting, runs core tests,
builds the full workspace, and packages both Windows executables.

## Verified evidence

| Check | Result | Evidence |
|---|---|---|
| Original ZIP extracted without content changes | 30 original file hashes match | `verification/acceptance.json` |
| Exact Appendix B tree | 30 files, 22 directories | `verification/acceptance.json` |
| Every generated file equals its original bytes | PASS | `verification/acceptance.json` |
| Same inputs, second run | 0 new, 30 skipped | `verification/acceptance.json` |
| Section O | 28 new, 2 shared files skipped | `verification/acceptance.json` |
| Preserves manually edited existing files | PASS | Core tests and acceptance report |
| Input validation / path traversal / missing root | PASS | Core tests and acceptance report |
| Simultaneous generators | Exactly 30 files created in total | Core tests |
| Mid-write failure | Earlier successes listed; 4-byte incomplete file retained and reported; retry skips it | Core fault-injection test |
| Rust unit tests | 8 passed | `verification/core-tests.log` |
| Core Clippy | PASS with warnings denied | `verification/clippy.log` |
| Browser interface | PASS at 1280, 980, 760, 390px widths | `verification/browser.json` |
| Frontend network use | Zero external requests | `verification/browser.json` |
| Hints | Every interactive element covered; hover/focus, Escape, hint toggle tested | `verification/browser.json` |
| Real Rust engine plus UI | First run, rerun, section O, log, backend rejection passed | `verification/ui-integration.json` |
| Clean exported source, cached offline build | 8 tests pass from Git archive in a separate target directory | `verification/clean-source.log` |
| Git archive preserves original templates | All 30 ZIP hashes and golden output checks pass against exported source | `scripts/verify.py` run from `artifacts/clean-source` |
| Transparent branding | Master and PNG derivatives are RGBA; alpha range 0–255, corner alpha 0 | `verification/icon.json` |
| Showcase | Three.js online, offline fallback, 12 categories, four prepared release links | `verification/showcase.json` |
| Native Dossier window | Launches independently; no browser tab or localhost server | Observed in native Windows desktop window |
| Native Windows folder picker | Opened and selected the isolated acceptance-test output folder | Observed in native Windows folder dialog |
| Native GUI first run | Fall 25-26 / DS Lab / G: 22 folders, 30 files, 0 skips | Native app result panel |
| Native GUI rerun | 0 folders, 0 files, 30 skipped | Native app result panel |
| Native GUI section O | 21 folders, 28 files, 2 shared semester files skipped | Native app result panel; exact output tree checked below |
| Native output contents | 58 files and 43 directories across both sections; file hashes match original assets in each section | `verification/native-desktop.json` |
| Final Windows package | Dossier desktop 9,800,704 bytes; CLI generator 1,138,688 bytes | `verification/windows-package.log` |
| Cross-platform release build | Windows, Linux x64, macOS Intel, and macOS Apple Silicon tests and package jobs succeeded | [GitHub Actions run](https://github.com/the-sudipta/dossier/actions/runs/35907782917) |
| Published release assets | Four desktop packages, four standalone CLI packages, and `SHA256SUMS.txt` | [v0.1.0 release](https://github.com/the-sudipta/dossier/releases/tag/v0.1.0) |
| GUI command-line flags | `Dossier.exe --help` attaches to the invoking terminal and returns help | `verification/dossier-gui-help.txt` |

The UI integration test uses an explicit test adapter between the production
frontend and the actual Rust CLI. The folder selection is simulated there;
**it does not verify native Tauri IPC or the OS picker**. Browser screenshots
in `verification/browser/` are real captures of that frontend, not captures of
a running compiled desktop application.

## Environment

Rust and Cargo 1.98.1 are installed under `E:\DOWNLOADED_SOFTWARES\rust`.
Persistent user variables:

```text
CARGO_HOME=E:\DOWNLOADED_SOFTWARES\rust\cargo
RUSTUP_HOME=E:\DOWNLOADED_SOFTWARES\rust\rustup
PATH includes E:\DOWNLOADED_SOFTWARES\rust\cargo\bin
```

Microsoft Visual Studio 2022 C++ Build Tools and Windows SDK prerequisites were
installed. WebView2 Runtime was already present. Existing terminals may need
reopening to inherit the new environment; the provided PowerShell scripts load
the saved variables directly.

## Scope and limitations

- Desktop runtime is designed to be offline, without localhost or a browser tab.
- Tauri's OS webview is still a runtime prerequisite; a bare Windows machine
  without WebView2 must have that prerequisite provisioned separately.
- Linux and both Mac binaries were built and packaged in CI, but their native
  GUI dialogs and clean-machine runtime behavior have not been exercised on
  those operating systems.
- The Windows GUI was exercised natively; Linux/macOS GUI runtime behavior is
  not inferred from successful cross-platform compilation.
- Destination links/junctions are rejected, but this personal desktop tool is not
  a security boundary against a malicious process concurrently swapping folders.
- The template ZIP remains the source of truth. File bodies were not parsed or
  modified. The MIT code license does not relicense institutional templates.

## Implementation references

- [Rustup custom installation locations](https://rust-lang.github.io/rustup/installation/)
- [Tauri native prerequisites](https://v2.tauri.app/start/prerequisites/)
- [Tauri Rust commands](https://v2.tauri.app/develop/calling-rust/)
- [GitHub runner architectures](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
- [Microsoft Smart App Control FAQ](https://support.microsoft.com/en-us/windows/security/threat-malware-protection/smart-app-control-frequently-asked-questions)
