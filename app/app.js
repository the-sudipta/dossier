'use strict';
const $ = id => document.getElementById(id);
const fields = ['semester','course','section'];
const defaults = {semester:'Fall 25-26',course:'DS Lab',section:'G'};
const invoke = window.__TAURI__?.core?.invoke;
let output = '', busy = false, expanded = false, previewRevision = 0;
const inputs = () => Object.fromEntries(fields.map(id=>[id,$(id).value.trim()]));
function errorFor(value) {
  if(!value) return 'Please enter a value.';
  if(/[\\/:*?"<>|\u0000-\u001f\u007f]/.test(value)) return 'Avoid \\ / : * ? " < > | and control characters.';
  if(value==='.' || value==='..' || value.endsWith('.')) return 'Choose a name without a trailing dot.';
  if(/^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(value)) return 'This name is reserved by Windows.';
  if(new TextEncoder().encode(value).length>255) return 'This name is too long.';
  return '';
}
function rename(path,n) {
  return path.split('/').map(p=>p.replaceAll('SEMESTER_NAME YY-YY',n.semester).replaceAll('COURSE NAME [ SECTION ]',`${n.course} [ ${n.section} ]`).replaceAll('COURSE_NAME_[ SECTION ]',`${n.course.replaceAll(' ','_')}_[ ${n.section} ]`).replaceAll('SEMESTER_NAME',n.semester.replaceAll(' ','_'))).join('/');
}
function tip(element,text) { element.dataset.hint=text; return element; }
function el(tag,text,className) { const node=document.createElement(tag); if(text!==undefined)node.textContent=text;if(className)node.className=className;return node; }
function renderTree(paths) {
  const root=Object.create(null);
  for(const path of paths){let branch=root;for(const part of path.split('/'))branch=branch[part]??=Object.create(null);}
  function build(branch,depth=0,prefix='') {
    const fragment=document.createDocumentFragment();
    const items=Object.entries(branch).sort(([a,av],[b,bv])=>Number(Object.keys(bv).length>0)-Number(Object.keys(av).length>0)||a.localeCompare(b,undefined,{numeric:true}));
    for(const [name,children] of items){
      const path=prefix+name;
      if(Object.keys(children).length){
        const detail=el('details',undefined,depth===0?'root':depth===1&&name.includes(' [ ')?'course-node':''); detail.open=depth<2||expanded;
        const summary=tip(el('summary'),`Folder: ${path}. Click or press Enter to ${detail.open?'collapse':'expand'} its contents. Original filenames inside are shown exactly as they will be created.`);
        summary.dataset.count=String(Object.keys(children).length);summary.append(el('span','', 'folder-icon'),el('span',name));
        const sub=el('div',undefined,'branch');sub.append(build(children,depth+1,path+'/'));detail.append(summary,sub);fragment.append(detail);
      }else{
        const extension=name.split('.').pop().toUpperCase();
        const file=tip(el('div',undefined,'file'),`${path}. ${extension==='XLSX'?'Excel workbook: all existing formulas and formatting are preserved.':extension==='DOCX'?'Word template: original document contents and formatting are preserved.':'Original template copied unchanged.'} Existing files are skipped.`);
        file.tabIndex=0;file.append(el('span',extension==='DESCRIPTION'?'TXT':extension,'file-icon'),el('span',name));fragment.append(file);
      }
    }return fragment;
  }
  $('tree').replaceChildren(build(root)); hydrateHints($('tree'));
}
async function update(showErrors=false) {
  const n=inputs();let valid=true;
  for(const id of fields){const error=errorFor(n[id]);valid&&=!error;const show=showErrors||$(id).dataset.touched==='true';$(id+'-error').textContent=show?error:'';$(id).setAttribute('aria-invalid',String(show&&!!error));}
  $('generate').disabled=!valid||!output||busy;
  const sample=Object.fromEntries(fields.map(id=>[id,n[id]||defaults[id]]));
  $('preview-mode').textContent=fields.every(id=>n[id])?'YOUR WORKSPACE':'EXAMPLE WORKSPACE';
  const revision=++previewRevision;
  if(fields.some(id=>n[id]&&errorFor(n[id]))){$('tree').replaceChildren(el('p','Correct the highlighted details to see your workspace preview.','preview-invalid'));return;}
  try{
    let files;
    if(invoke){const plan=await invoke('preview',{inputs:sample});files=plan.files;}
    else {files=window.DOSSIER_MANIFEST.map(p=>rename(p,sample));for(const p of files)for(const component of p.split('/'))if(errorFor(component))throw new Error(errorFor(component));}
    if(revision!==previewRevision)return;renderTree(files);
    $('form-message').textContent='';
  }catch(error){if(revision!==previewRevision)return;$('generate').disabled=true;$('form-message').textContent=String(error.message||error);$('tree').replaceChildren(el('p','These names cannot produce a valid workspace. Please shorten or correct them.','preview-invalid'));}
}
fields.forEach(id=>{ $(id).addEventListener('input',()=>update());$(id).addEventListener('blur',()=>{$(id).dataset.touched='true';$(id).value=$(id).value.trim();update();}); });
$('choose-folder').addEventListener('click',async()=>{
  if(!invoke){$('form-message').textContent='This is a browser preview. Open the Dossier desktop app to choose a folder and generate real files.';return;}
  $('choose-folder').disabled=true;
  try {const selected=await invoke('choose_folder');if(selected){output=selected;$('destination-label').textContent=selected;$('destination-sub').textContent='Your semester folder will be created here.';$('choose-folder').dataset.hint=`Selected location: ${selected}. Click to choose a different output folder.`;update();}}
  catch(error){$('form-message').textContent=`Could not open the folder picker: ${error}`;}
  finally{$('choose-folder').disabled=false;}
});
$('generator').addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;await update(true);if(busy||$('generate').disabled)return;
  busy=true;$('generate').disabled=true;$('generate').firstElementChild.textContent='Creating your workspace…';$('choose-folder').disabled=true;fields.forEach(id=>$(id).disabled=true);
  let failure='';
  try{const result=await invoke('generate',{inputs:inputs(),output});showResults(result);}
  catch(error){failure=`Generation could not complete: ${error}`;}
  finally{busy=false;fields.forEach(id=>$(id).disabled=false);$('choose-folder').disabled=false;$('generate').firstElementChild.textContent='Create workspace';await update();if(failure)$('form-message').textContent=failure;}
});
function showResults(r){
  $('results').hidden=false;$('result-title').textContent=r.error?'Let’s finish this safely.':r.files_created?'A little order. A lot of possibility.':'Already beautifully in place.';
  $('result-badge').textContent=r.error?'Needs attention':'Complete';$('result-path').textContent=r.output_path||output;$('result-error').textContent=r.error||'';
  $('result-counts').replaceChildren();
  for(const [number,label,hint] of [[r.folders_created,'folders created','New folders made during this run. Existing folders are reused.'],[r.files_created,'files created','New template files successfully written and flushed to disk in this run.'],[r.files_skipped,'already existed','Existing files were left unchanged. A skipped file is not checked against the original template.']]){
    const card=tip(el('div'),hint);card.tabIndex=0;card.append(el('strong',String(number)),el('span',label));$('result-counts').append(card);
  }
  $('activity').replaceChildren(...r.entries.map(entry=>tip(el('li',`${entry.status} — ${entry.path}`),`Run result: ${entry.status}. Relative path: ${entry.path}`)));
  hydrateHints($('results'));$('results').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest'});
}
$('expand-all').addEventListener('click',()=>{expanded=!expanded;$('expand-all').textContent=expanded?'Collapse all ↗':'Expand all ↗';$('tree').querySelectorAll('details').forEach(d=>d.open=expanded||d.classList.contains('root')||d.classList.contains('course-node'));});
function dialog(kind){
  const c=$('dialog-content');c.replaceChildren();
  if(kind==='about'){
    const image=el('img');image.src='assets/logo.png';image.alt='Original Dossier icon';c.append(image,el('div','LOCAL BY DESIGN · VERSION 0.1.0','step-label'),el('h2','Dossier'),el('p','Your course. Beautifully in order. A small offline companion that turns your real academic templates into an organized course workspace.'));
    c.append(el('h3','Originals, preserved.'),el('p','30 original files. 12 numbered categories. Rust handles file generation; Tauri brings it to your desktop. No uploads, telemetry, sign-in, or runtime downloads.'));
    c.append(el('p','Application code: MIT license. Institutional templates retain their original ownership. The original folder icon is independent of the AIUB crest.'));
  }else{
    c.append(el('div','THREE STEPS. EVERYTHING IN PLACE.','step-label'),el('h2','A very quick guide'));
    for(const [title,body] of [['01 · Name your course','Enter a semester, course name, and section. Spaces stay in folder names and become underscores in template filenames. Leading and trailing whitespace is trimmed.'],['02 · Choose its home','Select an existing folder on your computer. Dossier creates the semester and course-section folders inside it.'],['03 · Create, and carry on','Create the workspace. The result shows every created and skipped file. Repeat for another section to add it alongside the first; shared semester files stay unchanged.'],['Safe to run again','Existing files are always skipped—even if you edited them. If a disk error leaves an incomplete file, it is listed explicitly; inspect and move it aside manually before retrying.'],['Hints for everything','Hover or focus an item for its explanation. Press F1 for hint mode, then tap an item to read its hint. Press Escape to dismiss a hint or close this panel.']]) c.append(el('h3',title),el('p',body));
  }
  c.querySelectorAll('h2,h3,p,img,.step-label').forEach(n=>tip(n,n.alt||n.textContent));hydrateHints(c);$('info-dialog').showModal();
}
$('guide-button').addEventListener('click',()=>dialog('guide'));$('about-button').addEventListener('click',()=>dialog('about'));$('close-dialog').addEventListener('click',()=>$('info-dialog').close());
$('workspace-nav').addEventListener('click',()=>{$('semester').focus();window.scrollTo({top:0,behavior:'smooth'});});
let tooltipTarget=null;
function hydrateHints(root=document){
  root.querySelectorAll('h2,h3,p,label,.step-label,.field-error,.form-message,#result-badge').forEach(node=>{if(!node.closest('[data-hint]')&&node.textContent.trim())tip(node,node.textContent.trim());});
  root.querySelectorAll('[data-hint]').forEach(node=>{if(!node.hasAttribute('tabindex')&&!node.matches('button,input,a,summary,label'))node.tabIndex=0;});
}
function hideHint(){ $('tooltip').hidden=true;if(tooltipTarget){const ids=(tooltipTarget.getAttribute('aria-describedby')||'').split(' ').filter(x=>x&&x!=='tooltip');if(ids.length)tooltipTarget.setAttribute('aria-describedby',ids.join(' '));else tooltipTarget.removeAttribute('aria-describedby');}tooltipTarget=null; }
function showHint(target){
  if(!target?.dataset.hint)return;hideHint();tooltipTarget=target;const box=$('tooltip');box.textContent=target.dataset.hint;box.hidden=false;
  const ids=(target.getAttribute('aria-describedby')||'').split(' ').filter(Boolean);target.setAttribute('aria-describedby',[...new Set([...ids,'tooltip'])].join(' '));
  const rect=target.getBoundingClientRect();const width=box.offsetWidth;const height=box.offsetHeight;
  box.style.left=Math.max(8,Math.min(rect.left,innerWidth-width-8))+'px';box.style.top=Math.max(8,rect.bottom+height+12<innerHeight?rect.bottom+8:rect.top-height-8)+'px';
}
document.addEventListener('pointerover',e=>{const target=e.target.closest('[data-hint]');if(target&&target!==tooltipTarget)showHint(target);});
document.addEventListener('pointerout',e=>{if(tooltipTarget&&!tooltipTarget.contains(e.relatedTarget))hideHint();});
document.addEventListener('focusin',e=>showHint(e.target.closest('[data-hint]')));document.addEventListener('focusout',hideHint);
document.addEventListener('click',e=>{if(document.body.classList.contains('hint-mode')){const target=e.target.closest('[data-hint]');if(target)showHint(target);}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')hideHint();if(e.key==='F1'){e.preventDefault();$('hint-button').click();}});
document.addEventListener('scroll',hideHint,true);window.addEventListener('resize',hideHint);
$('hint-button').addEventListener('click',()=>{const on=document.body.classList.toggle('hint-mode');$('hint-button').setAttribute('aria-pressed',String(on));});
hydrateHints();update();
