# CODEX BUILD RUNBOOK — "Dossier"
### AIUB Course-Section Folder & File Generator (Rust + Tauri v2)

This document is written so Codex can build this entire tool, end to end, with
**zero clarifying questions back to Master**. Every rule below is derived from
real inspection of Master's actual template files, not assumption. If
something genuinely cannot be resolved from this document, it is listed
explicitly in Section 12 ("What Codex cannot do alone") — everything else is
fully specified.

---

## 0. Mission

Build a small cross-platform desktop app (Windows, Linux, macOS) called
**Dossier**. Master opens it, types three short values into a form
(Semester, Course Name, Section), picks an output location with a native
folder picker, clicks Generate — and the app instantly recreates a complete,
correctly-named course-section folder structure at that location, pre-filled
with Master's real institutional template files (already-designed Word/Excel
documents with the AIUB layout, formulas, and formatting already correct).

This directly mirrors the existing sibling project
[Thesis-Architect](https://github.com/the-sudipta/Thesis-Architect) (same
author, same philosophy: single offline Rust binary, no install, never
deletes, never overwrites) — but the folder tree is seeded with *real, filled*
document templates instead of empty starter files, and the run is triggered
from a small native GUI form instead of a bare terminal prompt.

## 1. Definition of Done

Codex's work is complete when ALL of the following are true and demonstrably
verified (see Section 9 for exact test procedure):

- [ ] Running the built app on a clean machine, entering
      `Semester="Fall 25-26"`, `Course Name="DS Lab"`, `Section="G"`, and an
      output folder, produces a folder tree **byte-for-byte identical in
      structure and file content** to Appendix B of this document.
- [ ] No internet connection is required at runtime — all template assets are
      embedded in the compiled binary.
- [ ] Running the tool a second time with the same three inputs into the same
      output location does not overwrite or duplicate anything — it reports
      what already existed and skips it.
- [ ] Running the tool a second time with a *different* Section but the
      *same* Semester adds the new course-section folder alongside the
      existing one, and does **not** recreate or duplicate the
      semester-level files (`NAMING CONVENTIONS.txt`,
      `{Semester}.TODO_LIST.html`) that already exist from the first run.
- [ ] The app builds and produces working release binaries for Windows,
      Linux, macOS Intel, and macOS Apple Silicon.
- [ ] A GitHub Actions workflow builds all four targets and publishes them to
      a GitHub Release automatically when a version tag is pushed.
- [ ] The repo contains `README.md`, `LICENSE`, `CITATION.cff`, `.gitignore`,
      and a single self-contained `index.html` showcase page, all committed
      with the commit-message convention in Section 11.
- [ ] The app has an embedded icon/logo, used consistently as: the compiled
      binary's OS-level icon, an "About" panel image inside the app, the
      README header image, and the website hero image.

## 2. What Codex is building — architecture

- **Framework:** Tauri v2 (matches this Hub's established convention for
  desktop tools). Rust backend, minimal HTML/CSS/JS frontend (no framework
  needed — three text inputs, one folder-picker button, one Generate button,
  one output/result panel is the entire UI surface).
- **Folder-picker:** use the `tauri-plugin-dialog` plugin's folder-open
  dialog. This is the "similar like choosing the download location" behavior
  Master described.
- **Template embedding:** use the `rust-embed` crate to compile the entire
  boilerplate directory into the binary at build time. This is what makes the
  app a single offline executable with no external file dependency — same
  guarantee Thesis-Architect gives ("No installation and no internet
  connection required").
- **Packaging targets:** `x86_64-pc-windows-msvc`, `x86_64-unknown-linux-gnu`,
  `x86_64-apple-darwin`, `aarch64-apple-darwin` — the same four Thesis-Architect
  ships.

## 3. The three user inputs

| Field | Example | Notes |
|---|---|---|
| Semester | `Fall 25-26` | Free text. Master types it exactly as he wants it to appear in folder names. Valid patterns per Master's own convention: `Fall 25-26`, `Spring 25-26`, `Summer 25-26`, etc. — do not hardcode a fixed list, accept any string, but trim leading/trailing whitespace. |
| Course Name | `DS Lab` | Free text, e.g. `DS Lab`, `IP Lab`, `Introduction to Computer Studies`. |
| Section | `G` | Free text, typically 1-3 characters, e.g. `G`, `B1`, `B10`. |

**Validation rule:** reject (with an inline error message, do not crash)
any input containing characters illegal in filenames on any target OS:
`\ / : * ? " < > |`. Leading/trailing whitespace is trimmed automatically,
not rejected.

## 4. THE NAMING ALGORITHM — exact, verified, non-negotiable

This was reverse-engineered from Master's actual `NAMING CONVENTIONS.txt` and
verified by literally running it against his real template zip. It is not a
guess. Implement it exactly as written.

Given the three raw inputs `semester`, `course`, `section` (already
whitespace-trimmed), derive two additional strings:

```
semester_underscored = semester.replace(" ", "_")   // "Fall 25-26" -> "Fall_25-26"
course_underscored   = course.replace(" ", "_")      // "DS Lab"     -> "DS_Lab"
```

Then, walking every path in the embedded template tree, apply these four
literal string replacements to **every path component** (both folder names
and file names — applying all four everywhere is safe, because the two
"folder form" tokens and two "file form" tokens never appear in the same
component in the real template, so there is no collision risk):

```
1. "SEMESTER_NAME YY-YY"        ->  semester                          (folder form, semester+year as one wrapper)
2. "COURSE NAME [ SECTION ]"    ->  f"{course} [ {section} ]"         (folder form, verbatim spacing)
3. "COURSE_NAME_[ SECTION ]"    ->  f"{course_underscored}_[ {section} ]"   (file form)
4. "SEMESTER_NAME"              ->  semester_underscored              (file form — apply AFTER rule 1, so the two-word
                                                                        folder-form phrase is matched first and doesn't
                                                                        get partially consumed by this shorter rule)
```

Order matters: apply rule 1 before rule 4, since rule 4's pattern
(`SEMESTER_NAME` alone) is a substring of rule 1's pattern
(`SEMESTER_NAME YY-YY`). Applying 1 first consumes the full phrase in folder
names; rule 4 then only fires on the standalone occurrences inside file
names, where `YY-YY` never follows.

**Everything else in every filename is literal, fixed text that never
changes** — e.g. `MID_TERM`, `FINAL_TERM`, `OVERALL`, `Course_File_Checklist`,
`MARKSHEET`, `CQI_Report` are permanent parts of that specific template
file's name, not placeholders. Do not attempt to detect or substitute
anything beyond the four rules above.

## 5. File content handling — critical prohibition

**Never open, parse, or modify the contents of any template file.** Every
`.docx`, `.xlsx`, `.pdf`, `.html`, and `.txt` file in the boilerplate is
copied **byte-for-byte, unchanged**, from the embedded template to the
destination — only the *filename* changes, per Section 4.

This was explicitly verified: the `.docx` files contain zero placeholder text
in their document bodies (checked via unzipping and grepping
`word/document.xml`, headers, and footers of three representative templates —
none matched). The `MARKSHEET.xlsx` contains live formulas that must not be
touched. Do not use any docx/xlsx manipulation library. This tool's Rust
implementation should use nothing more than `std::fs::copy`-equivalent byte
copying for every embedded asset.

## 6. The boilerplate asset bundle

Master will place the exact contents of his template zip into the repo at:

```
templates/boilerplate/
├── SEMESTER_NAME YY-YY/
│   ├── NAMING CONVENTIONS.txt
│   ├── SEMESTER_NAME.TODO_LIST.html
│   └── COURSE NAME [ SECTION ]/
│       ├── (12 numbered subfolders, each with DESCRIPTION.txt and/or real template files)
│       └── SEMESTER_NAME.COURSE_NAME_[ SECTION ].OVERALL.Course_File_Checklist.docx
│       └── SEMESTER_NAME.COURSE_NAME_[ SECTION ].OVERALL.MARKSHEET.xlsx
```

The full, exact manifest (every folder and file, verified by directly
inspecting Master's zip) is in **Appendix A**. Codex should embed this entire
`templates/boilerplate/` directory using `rust-embed`:

```rust
#[derive(rust_embed::RustEmbed)]
#[folder = "templates/boilerplate/"]
struct Boilerplate;
```

Then iterate `Boilerplate::iter()` to get every embedded relative path,
apply the Section 4 substitution to each path component, and write it out
under the user's chosen output root.

**If `templates/boilerplate/` is empty or missing when Codex starts work**,
stop and report this to Master rather than inventing placeholder content —
this directory must be populated with Master's real files before the app can
be meaningfully tested. See Section 12.

## 7. Runtime behavior spec

**On launch:** a single-window form:
- Text field: Semester
- Text field: Course Name
- Text field: Section
- Button: "Choose Output Location" → opens native folder picker, shows the
  chosen path next to the button
- Button: "Generate" (disabled until all three text fields are non-empty and
  a folder is chosen)
- A results panel below, initially empty

**On Generate click:**
1. Validate inputs (Section 3's illegal-character rule).
2. Compute the full output path for every embedded template path using
   Section 4's algorithm.
3. For each computed path:
   - If it's a directory and doesn't exist at the destination: create it.
   - If it's a directory and already exists: do nothing, continue into it.
   - If it's a file and the destination doesn't exist: copy it byte-for-byte.
   - If it's a file and the destination **already exists**: **skip it, do
     not overwrite**. Record this in the run summary as "already existed,
     skipped."
4. Show a run summary in the results panel: count of folders created, files
   created, files skipped (already existed), and the final output path. This
   naturally handles the "same semester, second course" case correctly with
   zero special-casing — see Definition of Done, bullet 4.
5. Never delete anything, under any circumstance, in any code path.

**Error handling:**
- Output location not writable (permissions): show a clear inline error, do
  not crash.
- Disk full mid-copy: show a clear inline error listing exactly which files
  succeeded before the failure, do not leave the app in a silent partial
  state.

## 8. Icon / logo requirements

**Do not reuse the AIUB institutional crest** (found embedded in
`CLASS_ATTENDANCE.docx` — that is appropriate *inside* the official
documents themselves, but is a university's official mark, not something to
repurpose as this personal tool's app-branding icon without Master
explicitly deciding that). Default to an original, simple, unrelated icon —
e.g. a stylized stacked-folder-with-checkmark glyph — as a placeholder Master
can swap later. Flag this decision back to Master once (in the PR/commit
description), do not block the build on it.

Required formats, generated from one master SVG/PNG:
- `.ico` (Windows, multi-resolution: 16/32/48/256px)
- `.icns` (macOS)
- `.png` (Linux, 512x512, plus a 256x256 for in-app use)
- The same master image is used unmodified as: the README.md header image,
  the website hero logo, and an "About Dossier" panel inside the app itself
  ("burned into the tool" — Master's phrase — meaning `include_bytes!`
  embedded into the binary, not loaded from an external file at runtime).

## 9. Testing / acceptance criteria

Run: `dossier --semester "Fall 25-26" --course "DS Lab" --section "G" --output /tmp/test`
(expose this as CLI flags in addition to the GUI, purely for this automated
test — the GUI remains the primary interface per Section 7).

The resulting tree under `/tmp/test/` must exactly match **Appendix B**
below, both in structure (every folder and file name) and in content (every
copied file's bytes identical to its source in `templates/boilerplate/`).

Second test: run the exact same command again. Expected: zero new files
created, zero errors, summary reports all items as "already existed,
skipped."

Third test: run again with `--section "O"` (same semester, same course name).
Expected: a new `DS Lab [ O ]` folder appears alongside `DS Lab [ G ]`, and
`NAMING CONVENTIONS.txt` / `Fall_25-26.TODO_LIST.html` at the semester level
are reported as "already existed, skipped," not duplicated or overwritten.

## 10. Repository scaffolding

- **`README.md`** — header image (the logo), one-paragraph pitch (same tone
  as Thesis-Architect's own README: "Build a complete course-section
  documentation workspace in seconds"), Project Snapshot table, Why This
  Exists, What It Creates (list the 12 numbered folders from Appendix A),
  Requirements, How To Use (per-OS run commands, mirroring Thesis-Architect's
  own README structure exactly), Example, Safety Notes (no delete, no
  overwrite, skip existing), License.
- **`LICENSE`** — MIT (matches the sibling Thesis-Architect project; flag as
  a default choice Master can override).
- **`CITATION.cff`** — standard Citation File Format, author Master, title
  "Dossier", a placeholder DOI field left blank until/unless Master archives
  a release on Zenodo.
- **`.gitignore`** — standard Rust (`/target`) plus Tauri build artifacts
  (`/src-tauri/target`, `/dist`).

## 11. Git commit convention

Every commit message follows exactly this shape:

```
<ICON> <SHORT_TITLE_IN_CAPS_OR_TITLE_CASE>: <one-line summary>

<Detailed multi-line description of what changed and why, written for
someone with zero context on this specific commit.>
```

Pick an icon that matches the commit's nature (feature, fix, docs, CI,
chore). Examples:

```
✨ FEATURE: Add three-field input form and folder picker

Implements the Semester / Course Name / Section text inputs and wires up
the tauri-plugin-dialog folder picker for output location selection. No
generation logic yet — this commit only builds the form UI and captures
input state.
```

```
🧩 CORE: Implement the naming-substitution engine

Adds the four-rule token substitution described in the build runbook
Section 4, with unit tests covering folder-form and file-form tokens
independently, plus the ordering edge case between rules 1 and 4.
```

```
🛡️ SAFETY: Add skip-if-exists guard to the file-copy step

Ensures re-running Dossier against a folder that already contains a
partially-generated section never overwrites existing files. Adds a
run-summary counter for "skipped, already existed" so Master can see
exactly what happened after a run.
```

```
🚀 RELEASE: Add GitHub Actions workflow for cross-platform builds

Builds Windows, Linux, macOS-Intel, and macOS-Apple-Silicon binaries on
every version tag push and publishes them to a GitHub Release with
auto-generated release notes, matching the Thesis-Architect pipeline.
```

```
📄 DOCS: Add README, LICENSE, and CITATION.cff
```

```
🎨 WEBSITE: Add animated Three.js showcase page (index.html)
```

## 12. GitHub Actions release pipeline

On every pushed tag matching `v*.*.*`:
1. Matrix build across the four targets in Section 2.
2. Package each: `.exe` for Windows, `.tar.gz` for Linux, `.app.zip` for each
   macOS arch (matching Thesis-Architect's exact packaging shape).
3. Embed the OS-appropriate icon into each binary at build time (a `build.rs`
   step, same approach as the sibling project).
4. Create a GitHub Release for that tag with auto-generated release notes,
   attach all four packaged artifacts.

## 13. The showcase website — `index.html`

Single self-contained file (HTML+CSS+JS inline, no build step), living at the
repo root so it can be served directly via GitHub Pages. Requirements:

- Uses **Three.js** (via a CDN `<script>` tag — this is a public GitHub Pages
  site, not a Claude-published artifact, so it is not subject to any
  restricted-CDN rule; any CDN is fine here) for an animated 3D visual in the
  hero section — e.g. an abstract rotating stack of folder/document shapes,
  reacting subtly to mouse movement.
- Sections: animated hero with logo + tagline; "Why This Exists" (mirroring
  the README); "What It Creates" (the 12-folder structure, visually laid out,
  not just a bullet list); "How To Use" (per-OS instructions); Download
  buttons that link to the latest GitHub Release asset for each OS; footer
  with license + citation link.
- Fully responsive; smooth scroll-triggered animations (CSS transitions or a
  small lightweight JS scroll-observer — no heavy framework needed for this).
- The embedded logo (Section 8) is used as the favicon and the hero image.

## 14. What Codex cannot do alone — needs Master directly

- **Populating `templates/boilerplate/`** with the real files from his zip —
  Codex cannot fabricate the actual filled `.docx`/`.xlsx` templates; Master
  must add them to the repo himself (or hand them to Codex as an attached
  archive at the start of the actual build session).
- **The AIUB-crest-vs-original-icon decision** (Section 8) — Codex proceeds
  with an original placeholder icon by default but should not silently
  decide this is final; surface it once.
- **Creating the GitHub repository itself, and the first push** — this
  requires Master's own GitHub account and credentials.
- **Pushing the version tag that triggers the first release** — Master does
  this once he's happy with a build.
- **Enabling GitHub Pages** for the `index.html` site (a one-time repo
  settings toggle only Master can do).

---

## Appendix A — Full real template manifest

*(Every folder and file, exactly as it exists in Master's supplied zip.
Paths shown relative to `templates/boilerplate/`.)*

```
SEMESTER_NAME YY-YY/
├── NAMING CONVENTIONS.txt
├── SEMESTER_NAME.TODO_LIST.html
└── COURSE NAME [ SECTION ]/
    ├── SEMESTER_NAME.COURSE_NAME_[ SECTION ].OVERALL.Course_File_Checklist.docx
    ├── SEMESTER_NAME.COURSE_NAME_[ SECTION ].OVERALL.MARKSHEET.xlsx
    ├── 1. Course Outline/
    │   └── DESCRIPTION.txt
    ├── 2. Attendance Record of the Students/
    │   ├── SEMESTER_NAME.COURSE_NAME_[ SECTION ].MID_TERM.CLASS_ATTENDANCE.docx
    │   └── SEMESTER_NAME.COURSE_NAME_[ SECTION ].FINAL_TERM.CLASS_ATTENDANCE.docx
    ├── 3. Assignment Question/
    │   └── DESCRIPTION.txt
    ├── 4. Lab Test Questions/
    │   ├── Final Term Exam/
    │   │   └── DESCRIPTION.txt
    │   ├── Lab Tasks/
    │   │   └── DESCRIPTION.txt
    │   ├── Mid Exam/
    │   │   └── DESCRIPTION.txt
    │   ├── OBE/
    │   │   └── DESCRIPTION.txt
    │   └── Quiz/
    │       └── DESCRIPTION.txt
    ├── 5. Project Report/
    │   └── DESCRIPTION.txt
    ├── 6. Answer Scripts (Highest, Medium, Lowest) of Lab Tests/
    │   ├── DESCRIPTION.txt
    │   └── OBE_BEST-AVG-WORST_COPIES/
    │       └── DESCRIPTION.txt
    ├── 7. Submitted Copy (Highest, Medium, Lowest) of Assignments/
    │   └── DESCRIPTION.txt
    ├── 8. Examination Result/
    │   └── DESCRIPTION.txt
    ├── 9. Lab sheet/
    │   └── DESCRIPTION.txt
    ├── 10. Assessment criteria or rubrics for assignments or projects or lab-activities/
    │   └── DESCRIPTION.txt
    ├── 11. CO-PO Files/
    │   ├── DESCRIPTION.txt
    │   ├── SEMESTER_NAME.COURSE_NAME_[ SECTION ].OVERALL.CQI_Report.docx
    │   ├── SEMESTER_NAME.COURSE_NAME_[ SECTION ].OVERALL.Mid_Final_Labtask_Marks.docx
    │   ├── SEMESTER_NAME.COURSE_NAME_[ SECTION ].OVERALL.Self_Evaluation_Report.docx
    │   ├── SEMESTER_NAME.COURSE_NAME_[ SECTION ].OVERALL.Student_CO_Marks_Breakdown.xlsx
    │   ├── SEMESTER_NAME.COURSE_NAME_[ SECTION ].OVERALL.Student_Wise_CO_Evaluation_Mark.docx
    │   ├── SEMESTER_NAME.COURSE_NAME_[ SECTION ].OVERALL.Student_wise_CO1_Labtask.docx
    │   └── SEMESTER_NAME.COURSE_NAME_[ SECTION ].OVERALL.Student_wise_CO3_Labtask.docx
    └── 12. PRINT/
        ├── All/
        │   └── DESCRIPTION.txt
        └── Merged/
            └── DESCRIPTION.txt
```

## Appendix B — Golden reference output

*(This is the exact, verified result of applying Section 4's algorithm to
Appendix A with `Semester="Fall 25-26"`, `Course Name="DS Lab"`,
`Section="G"`. Generated and confirmed by actually running the substitution
against Master's real files. Codex's test in Section 9 must match this
exactly.)*

```
Fall 25-26/
├── NAMING CONVENTIONS.txt
├── Fall_25-26.TODO_LIST.html
└── DS Lab [ G ]/
    ├── Fall_25-26.DS_Lab_[ G ].OVERALL.Course_File_Checklist.docx
    ├── Fall_25-26.DS_Lab_[ G ].OVERALL.MARKSHEET.xlsx
    ├── 1. Course Outline/
    │   └── DESCRIPTION.txt
    ├── 2. Attendance Record of the Students/
    │   ├── Fall_25-26.DS_Lab_[ G ].MID_TERM.CLASS_ATTENDANCE.docx
    │   └── Fall_25-26.DS_Lab_[ G ].FINAL_TERM.CLASS_ATTENDANCE.docx
    ├── 3. Assignment Question/
    │   └── DESCRIPTION.txt
    ├── 4. Lab Test Questions/
    │   ├── Final Term Exam/DESCRIPTION.txt
    │   ├── Lab Tasks/DESCRIPTION.txt
    │   ├── Mid Exam/DESCRIPTION.txt
    │   ├── OBE/DESCRIPTION.txt
    │   └── Quiz/DESCRIPTION.txt
    ├── 5. Project Report/
    │   └── DESCRIPTION.txt
    ├── 6. Answer Scripts (Highest, Medium, Lowest) of Lab Tests/
    │   ├── DESCRIPTION.txt
    │   └── OBE_BEST-AVG-WORST_COPIES/DESCRIPTION.txt
    ├── 7. Submitted Copy (Highest, Medium, Lowest) of Assignments/
    │   └── DESCRIPTION.txt
    ├── 8. Examination Result/
    │   └── DESCRIPTION.txt
    ├── 9. Lab sheet/
    │   └── DESCRIPTION.txt
    ├── 10. Assessment criteria or rubrics for assignments or projects or lab-activities/
    │   └── DESCRIPTION.txt
    ├── 11. CO-PO Files/
    │   ├── DESCRIPTION.txt
    │   ├── Fall_25-26.DS_Lab_[ G ].OVERALL.CQI_Report.docx
    │   ├── Fall_25-26.DS_Lab_[ G ].OVERALL.Mid_Final_Labtask_Marks.docx
    │   ├── Fall_25-26.DS_Lab_[ G ].OVERALL.Self_Evaluation_Report.docx
    │   ├── Fall_25-26.DS_Lab_[ G ].OVERALL.Student_CO_Marks_Breakdown.xlsx
    │   ├── Fall_25-26.DS_Lab_[ G ].OVERALL.Student_Wise_CO_Evaluation_Mark.docx
    │   ├── Fall_25-26.DS_Lab_[ G ].OVERALL.Student_wise_CO1_Labtask.docx
    │   └── Fall_25-26.DS_Lab_[ G ].OVERALL.Student_wise_CO3_Labtask.docx
    └── 12. PRINT/
        ├── All/DESCRIPTION.txt
        └── Merged/DESCRIPTION.txt
```
