"""Independent golden-tree, original-byte, rerun and failure acceptance tests.
Never opens or parses document contents; compares byte hashes only.
Usage: python scripts/verify.py [path/to/dossier-cli[.exe]]
"""
from pathlib import Path
import hashlib, json, re, subprocess, sys, tempfile, zipfile

ROOT = Path(__file__).resolve().parents[1]
EXE = Path(sys.argv[1]).resolve() if len(sys.argv)>1 else ROOT/'target'/'release'/('dossier-cli.exe' if sys.platform=='win32' else 'dossier-cli')
sha = lambda data: hashlib.sha256(data).hexdigest()
def golden_paths():
    source=(ROOT/'docs/CODEX_BUILD_DOSSIER.md').read_text(encoding='utf-8')
    block=source.split('## Appendix B',1)[1].split('```')[1]
    stack=[]; files=set(); directories=set()
    for line in block.strip().splitlines():
        match=re.match(r'((?:│   |    )*)(?:├── |└── )(.*)',line)
        if match:
            level=len(match[1])//4+1; name=match[2]; stack=stack[:level]
        else: level=0; name=line; stack=[]
        path='/'.join(stack+[name.rstrip('/')])
        if name.endswith('/'): directories.add(path); stack.append(name.rstrip('/'))
        else:
            files.add(path)
            p=Path(path).parent
            while str(p)!='.': directories.add(p.as_posix());p=p.parent
    return files,directories

def run(root, section='G', course='DS Lab', success=True):
    proc=subprocess.run([str(EXE),'--semester','Fall 25-26','--course',course,'--section',section,'--output',str(root)],capture_output=True,text=True,encoding='utf-8')
    assert proc.returncode == (0 if success else 1),(proc.returncode,proc.stdout,proc.stderr)
    return json.loads(proc.stdout)

def main():
    expected_files,expected_dirs=golden_paths()
    assert len(expected_files)==30,len(expected_files)
    archive=ROOT/'docs/SEMESTER_NAME YY-YY.zip'
    sources=ROOT/'templates/boilerplate'
    with zipfile.ZipFile(archive) as z:
        originals={n:sha(z.read(n)) for n in z.namelist() if not n.endswith('/')}
    assert originals=={p.relative_to(sources).as_posix():sha(p.read_bytes()) for p in sources.rglob('*') if p.is_file()},'Extracted templates differ from ZIP'
    hashes={}
    with tempfile.TemporaryDirectory(prefix='dossier-acceptance-') as temp:
        # macOS exposes /tmp through /var, which is a system symlink. Resolve
        # the test directory itself so the app's intentional symlink refusal
        # tests the output tree, not the host's temporary-directory alias.
        out=Path(temp).resolve();first=run(out)
        actual_files={p.relative_to(out).as_posix() for p in out.rglob('*') if p.is_file()}
        actual_dirs={p.relative_to(out).as_posix() for p in out.rglob('*') if p.is_dir()}
        assert actual_files==expected_files, (actual_files^expected_files)
        assert actual_dirs==expected_dirs, (actual_dirs^expected_dirs)
        for p in sources.rglob('*'):
            if not p.is_file():continue
            renamed=p.relative_to(sources).as_posix().replace('SEMESTER_NAME YY-YY','Fall 25-26').replace('COURSE NAME [ SECTION ]','DS Lab [ G ]').replace('COURSE_NAME_[ SECTION ]','DS_Lab_[ G ]').replace('SEMESTER_NAME','Fall_25-26')
            hashes[renamed]=sha((out/renamed).read_bytes());assert hashes[renamed]==sha(p.read_bytes())
        assert (first['files_created'],first['files_skipped'],first['folders_created'])==(30,0,len(expected_dirs))
        second=run(out);assert (second['files_created'],second['folders_created'],second['files_skipped'])==(0,0,30)
        third=run(out,'O');assert (third['files_created'],third['files_skipped'])==(28,2)
        for name,digest in hashes.items():assert sha((out/name).read_bytes())==digest
        edited=out/'Fall 25-26'/'NAMING CONVENTIONS.txt';edited.write_bytes(b'USER EDIT - MUST SURVIVE')
        run(out);assert edited.read_bytes()==b'USER EDIT - MUST SURVIVE'
        bad=run(out,course='../escape',success=False);assert bad['files_created']==0 and bad['folders_created']==0
        absent=run(out/'missing',success=False);assert absent['files_created']==0
    report={'status':'PASS','binary':str(EXE),'golden_files':len(expected_files),'golden_directories':len(expected_dirs),'zip_bytes_verified':30,'checks':['Appendix B exact file and directory names','All output bytes equal original ZIP assets','Second run: 0 created, 30 skipped','Section O: 28 created, 2 shared files skipped','User-edited existing file preserved','Traversal rejected before writes','Missing output folder rejected'],'output_sha256':hashes}
    (ROOT/'verification').mkdir(exist_ok=True)
    (ROOT/'verification/acceptance.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='output_sha256'},indent=2))
if __name__=='__main__':main()
