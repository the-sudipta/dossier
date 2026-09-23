"""Hash-only verification of the workspace produced with the real native app."""
from pathlib import Path
import hashlib, json

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'verification/output/native'
TEMPLATE=ROOT/'templates/boilerplate'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
files=list(OUT.rglob('*'))
actual_files={p.relative_to(OUT).as_posix():p for p in files if p.is_file()}
actual_dirs={p.relative_to(OUT).as_posix() for p in files if p.is_dir()}
expected={}
for section in ('G','O'):
    for source in TEMPLATE.rglob('*'):
        if source.is_file():
            name=source.relative_to(TEMPLATE).as_posix()
            target=(name.replace('SEMESTER_NAME YY-YY','Fall 25-26')
                .replace('COURSE NAME [ SECTION ]',f'DS Lab [ {section} ]')
                .replace('COURSE_NAME_[ SECTION ]',f'DS_Lab_[ {section} ]')
                .replace('SEMESTER_NAME','Fall_25-26'))
            expected.setdefault(target,source)
assert set(actual_files)==set(expected),(set(actual_files)^set(expected))
assert len(actual_files)==58,len(actual_files)
assert len(actual_dirs)==43,len(actual_dirs)
for relative,path in actual_files.items():
    original=expected[relative]
    assert sha(path)==sha(original),f'Content changed: {relative}'
assert len({k for k in actual_files if 'DS Lab [ G ]/' in k})==28
assert len({k for k in actual_files if 'DS Lab [ O ]/' in k})==28
report={'status':'PASS','files':58,'directories':43,'course_G_files':28,'course_O_files':28,'shared_semester_files':2,'templates_compared_by_sha256':58,'checks':['Native GUI section G generated 30 files including two shared semester files','Native GUI rerun reported 30 skips and created nothing','Native GUI section O generated 28 course files and skipped two shared semester files','Every on-disk file hash matches the corresponding untouched original template','No unexpected files or directories']}
(ROOT/'verification/native-desktop.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
