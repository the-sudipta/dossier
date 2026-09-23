use rust_embed::RustEmbed;
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeSet,
    fs::{self, OpenOptions},
    io::Write,
    path::{Component, Path, PathBuf},
};

#[derive(RustEmbed)]
#[folder = "templates/boilerplate/"]
struct Boilerplate;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Inputs {
    pub semester: String,
    pub course: String,
    pub section: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entry {
    pub path: String,
    pub status: String,
}
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct Summary {
    pub folders_created: usize,
    pub files_created: usize,
    pub files_skipped: usize,
    pub output_path: String,
    pub entries: Vec<Entry>,
    pub error: Option<String>,
}
#[derive(Debug, Serialize)]
pub struct Plan {
    pub directories: Vec<String>,
    pub files: Vec<String>,
    pub bytes: usize,
}

fn valid_component(s: &str) -> Result<(), String> {
    if s.is_empty() || s == "." || s == ".." || s.ends_with('.') || s.ends_with(' ') {
        return Err("Use a nonempty name without a trailing dot or space.".into());
    }
    if s.chars()
        .any(|c| c.is_control() || "\\/:*?\"<>|".contains(c))
    {
        return Err("Names cannot contain control characters or \\ / : * ? \" < > |.".into());
    }
    let stem = s.split('.').next().unwrap_or("").to_uppercase();
    if [
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
        "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9", "COM¹",
        "COM²", "COM³", "LPT¹", "LPT²", "LPT³",
    ]
    .contains(&stem.as_str())
    {
        return Err("This name is reserved by Windows; choose another name.".into());
    }
    if s.len() > 255 || s.encode_utf16().count() > 255 {
        return Err("A generated name is too long (maximum 255 bytes per component).".into());
    }
    Ok(())
}
impl Inputs {
    pub fn normalized(&self) -> Result<Self, String> {
        let n = Self {
            semester: self.semester.trim().into(),
            course: self.course.trim().into(),
            section: self.section.trim().into(),
        };
        for (label, value) in [
            ("Semester", &n.semester),
            ("Course", &n.course),
            ("Section", &n.section),
        ] {
            valid_component(value).map_err(|e| format!("{label}: {e}"))?;
        }
        Ok(n)
    }
    pub fn rename(&self, path: &str) -> String {
        path.split('/')
            .map(|part| {
                part.replace("SEMESTER_NAME YY-YY", &self.semester)
                    .replace(
                        "COURSE NAME [ SECTION ]",
                        &format!("{} [ {} ]", self.course, self.section),
                    )
                    .replace(
                        "COURSE_NAME_[ SECTION ]",
                        &format!("{}_[ {} ]", self.course.replace(' ', "_"), self.section),
                    )
                    .replace("SEMESTER_NAME", &self.semester.replace(' ', "_"))
            })
            .collect::<Vec<_>>()
            .join("/")
    }
}

pub fn plan(inputs: &Inputs) -> Result<Plan, String> {
    let n = inputs.normalized()?;
    let mut directories = BTreeSet::new();
    let mut files = BTreeSet::new();
    let mut bytes = 0;
    for source in Boilerplate::iter() {
        let renamed = n.rename(&source);
        for component in renamed.split('/') {
            valid_component(component)?;
        }
        if !files.insert(renamed.clone()) {
            return Err("The chosen names produce duplicate output paths.".into());
        }
        let mut parent = Path::new(&renamed).parent();
        while let Some(p) = parent {
            if p.as_os_str().is_empty() {
                break;
            }
            directories.insert(p.to_string_lossy().replace('\\', "/"));
            parent = p.parent();
        }
        bytes += Boilerplate::get(&source)
            .ok_or("An embedded template is missing.")?
            .data
            .len();
    }
    if files.is_empty() {
        return Err("No real templates were embedded; generation is unavailable.".into());
    }
    Ok(Plan {
        directories: directories.into_iter().collect(),
        files: files.into_iter().collect(),
        bytes,
    })
}

// Reject links/junctions in the destination chain, including dangling links.
fn check_chain(path: &Path) -> Result<(), String> {
    let mut current = PathBuf::new();
    for part in path.components() {
        if matches!(part, Component::ParentDir) {
            return Err("The output path must not contain '..'.".into());
        }
        current.push(part);
        match fs::symlink_metadata(&current) {
            Ok(m) => {
                #[cfg(windows)]
                let link = {
                    use std::os::windows::fs::MetadataExt;
                    m.file_attributes() & 0x400 != 0
                };
                #[cfg(not(windows))]
                let link = m.file_type().is_symlink();
                if link {
                    return Err(format!(
                        "Refusing symbolic link or junction: {}",
                        current.display()
                    ));
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
            Err(e) => return Err(format!("Cannot inspect {}: {e}", current.display())),
        }
    }
    Ok(())
}

pub fn generate(inputs: &Inputs, output: &Path) -> Summary {
    generate_with_writer(inputs, output, |file, data| {
        file.write_all(data).and_then(|_| file.sync_all())
    })
}

fn generate_with_writer(
    inputs: &Inputs,
    output: &Path,
    mut write: impl FnMut(&mut fs::File, &[u8]) -> std::io::Result<()>,
) -> Summary {
    let mut result = Summary::default();
    let work = (|| -> Result<(), String> {
        let n = inputs.normalized()?;
        let p = plan(&n)?;
        if !output.is_absolute() {
            return Err("Choose an absolute output folder path.".into());
        }
        check_chain(output)?;
        if !output.is_dir() {
            return Err("The selected output folder does not exist or is not a directory.".into());
        }
        result.output_path = output.join(&n.semester).display().to_string();
        for directory in p.directories {
            let target = output.join(&directory);
            check_chain(&target)?;
            match fs::create_dir(&target) {
                Ok(()) => {
                    result.folders_created += 1;
                    result.entries.push(Entry {
                        path: directory,
                        status: "folder created".into(),
                    });
                }
                Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists && target.is_dir() => (),
                Err(e) => return Err(format!("Cannot create folder {}: {e}", target.display())),
            }
        }
        let mut sources: Vec<_> = Boilerplate::iter().collect();
        sources.sort();
        for source in sources {
            let relative = n.rename(&source);
            let target = output.join(&relative);
            check_chain(&target)?;
            let asset = Boilerplate::get(&source).ok_or("Missing embedded file")?;
            match OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&target)
            {
                Ok(mut file) => {
                    if let Err(e) = write(&mut file, &asset.data) {
                        result.entries.push(Entry {
                            path: relative,
                            status: "incomplete file retained; inspect before retry".into(),
                        });
                        return Err(format!("Could not finish {}: {e}. The incomplete file is retained and will be skipped on retry; move it aside manually after inspection.", target.display()));
                    }
                    result.files_created += 1;
                    result.entries.push(Entry {
                        path: relative,
                        status: "file created".into(),
                    });
                }
                Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists && target.is_file() => {
                    result.files_skipped += 1;
                    result.entries.push(Entry {
                        path: relative,
                        status: "already existed, skipped".into(),
                    });
                }
                Err(e) => return Err(format!("Cannot create file {}: {e}", target.display())),
            }
        }
        Ok(())
    })();
    if let Err(error) = work {
        result.error = Some(error);
    }
    result
}

pub fn cli(args: Vec<String>) -> i32 {
    if args.iter().any(|a| a == "--help" || a == "-h") {
        println!("Dossier 0.1.0\nUsage: dossier --semester \"Fall 25-26\" --course \"DS Lab\" --section G --output <existing-absolute-folder>\nOutputs a JSON summary. Never overwrites or deletes. Exit codes: 0 success, 1 generation error, 2 argument error.");
        return 0;
    }
    if args == ["--version"] {
        println!("Dossier 0.1.0");
        return 0;
    }
    let mut flags = std::collections::BTreeMap::new();
    for pair in args.chunks(2) {
        if pair.len() != 2
            || !["--semester", "--course", "--section", "--output"].contains(&pair[0].as_str())
            || flags.insert(pair[0].clone(), pair[1].clone()).is_some()
        {
            eprintln!("Invalid or repeated argument. Use --help.");
            return 2;
        }
    }
    if flags.len() != 4 {
        eprintln!("All four flags are required. Use --help.");
        return 2;
    }
    let summary = generate(
        &Inputs {
            semester: flags["--semester"].clone(),
            course: flags["--course"].clone(),
            section: flags["--section"].clone(),
        },
        Path::new(&flags["--output"]),
    );
    println!("{}", serde_json::to_string_pretty(&summary).unwrap());
    i32::from(summary.error.is_some())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn inputs() -> Inputs {
        Inputs {
            semester: "Fall 25-26".into(),
            course: "DS Lab".into(),
            section: "G".into(),
        }
    }
    #[test]
    fn naming_is_exact() {
        assert_eq!(inputs().rename("SEMESTER_NAME YY-YY/COURSE NAME [ SECTION ]/SEMESTER_NAME.COURSE_NAME_[ SECTION ].OVERALL.MARKSHEET.xlsx"), "Fall 25-26/DS Lab [ G ]/Fall_25-26.DS_Lab_[ G ].OVERALL.MARKSHEET.xlsx");
    }
    #[test]
    fn validates_portable_names() {
        for name in [
            "", "..", "CON", "aux.txt", "LPT1", "x/y", "x\\y", "x:", "x*", "x?", "x\"", "x<", "x>",
            "x|", "x\n", "x.",
        ] {
            assert!(valid_component(name).is_err(), "{name}");
        }
        let mut i = inputs();
        i.semester = "  Summer 27-28  ".into();
        assert_eq!(i.normalized().unwrap().semester, "Summer 27-28");
    }
    #[test]
    fn real_assets_repeat_and_second_section() {
        let root = tempfile::tempdir().unwrap();
        let first = generate(&inputs(), root.path());
        assert!(first.error.is_none(), "{:?}", first.error);
        assert_eq!(first.files_created, 30);
        for source in Boilerplate::iter() {
            assert_eq!(
                fs::read(root.path().join(inputs().rename(&source))).unwrap(),
                Boilerplate::get(&source).unwrap().data.as_ref()
            );
        }
        let second = generate(&inputs(), root.path());
        assert_eq!(
            (
                second.files_created,
                second.folders_created,
                second.files_skipped
            ),
            (0, 0, 30)
        );
        let mut next = inputs();
        next.section = "O".into();
        let third = generate(&next, root.path());
        assert_eq!((third.files_created, third.files_skipped), (28, 2));
        assert!(third.error.is_none());
    }
    #[test]
    fn preserves_edited_files() {
        let root = tempfile::tempdir().unwrap();
        generate(&inputs(), root.path());
        let file = root.path().join("Fall 25-26/NAMING CONVENTIONS.txt");
        fs::write(&file, b"user changes").unwrap();
        assert!(generate(&inputs(), root.path()).error.is_none());
        assert_eq!(fs::read(file).unwrap(), b"user changes");
    }
    #[test]
    fn invalid_input_writes_nothing() {
        let root = tempfile::tempdir().unwrap();
        let mut i = inputs();
        i.course = "../escape".into();
        assert!(generate(&i, root.path()).error.is_some());
        assert_eq!(fs::read_dir(root.path()).unwrap().count(), 0);
    }
    #[test]
    fn reports_partial_work_and_conflicts() {
        let root = tempfile::tempdir().unwrap();
        let semester = root.path().join("Fall 25-26");
        fs::create_dir(&semester).unwrap();
        fs::write(semester.join("NAMING CONVENTIONS.txt"), b"keep").unwrap();
        fs::create_dir(semester.join("Fall_25-26.TODO_LIST.html")).unwrap();
        let r = generate(&inputs(), root.path());
        assert!(r.error.is_some());
        assert!(r.files_created > 0);
        assert!(!r.entries.is_empty());
        assert_eq!(
            fs::read(semester.join("NAMING CONVENTIONS.txt")).unwrap(),
            b"keep"
        );
    }
    #[test]
    fn concurrent_runs_do_not_overwrite() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().to_owned();
        let p2 = path.clone();
        let a = std::thread::spawn(move || generate(&inputs(), &path));
        let b = std::thread::spawn(move || generate(&inputs(), &p2));
        let a = a.join().unwrap();
        let b = b.join().unwrap();
        assert!(a.error.is_none());
        assert!(b.error.is_none());
        assert_eq!(a.files_created + b.files_created, 30);
    }
    #[test]
    fn write_failure_retains_partial_file_and_reports_previous_success() {
        let root = tempfile::tempdir().unwrap();
        let mut attempts = 0;
        let result = generate_with_writer(&inputs(), root.path(), |file, bytes| {
            attempts += 1;
            if attempts == 2 {
                file.write_all(&bytes[..4.min(bytes.len())])?;
                return Err(std::io::Error::other("simulated disk full"));
            }
            file.write_all(bytes)
        });
        assert_eq!(result.files_created, 1);
        assert!(result
            .error
            .as_ref()
            .unwrap()
            .contains("simulated disk full"));
        let incomplete = result
            .entries
            .iter()
            .find(|e| e.status.starts_with("incomplete"))
            .unwrap();
        assert_eq!(
            fs::read(root.path().join(&incomplete.path)).unwrap().len(),
            4
        );
        assert_eq!(
            result
                .entries
                .iter()
                .filter(|e| e.status == "file created")
                .count(),
            1
        );
        let retry = generate(&inputs(), root.path());
        assert_eq!(retry.files_skipped, 2);
        assert_eq!(retry.files_created, 28);
        assert_eq!(
            fs::read(root.path().join(&incomplete.path)).unwrap().len(),
            4
        );
    }
    #[cfg(unix)]
    #[test]
    fn rejects_symlink_escape() {
        let root = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        std::os::unix::fs::symlink(outside.path(), root.path().join("Fall 25-26")).unwrap();
        assert!(generate(&inputs(), root.path()).error.is_some());
        assert_eq!(fs::read_dir(outside.path()).unwrap().count(), 0);
    }
}
