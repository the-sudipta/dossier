Dossier standalone command-line generator

This package contains dossier-cli, the offline course-workspace generator.
It embeds the original templates and does not require the desktop app or a
browser runtime. It reads and writes files only in the output directory you
choose. Existing files are preserved and skipped.

Usage:
  dossier-cli --semester "Fall 25-26" --course "DS Lab" --section "G" --output "/path/to/Course Files"

The output directory must already exist. Run dossier-cli --help for all
options. Exit codes: 0 success, 1 generation error, 2 argument error.

On Linux and macOS, the executable is named dossier-cli. On Windows, use
dossier-cli.exe. The GUI desktop packages are published separately.
