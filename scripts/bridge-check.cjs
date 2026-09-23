// Integrates the production UI with the real Rust CLI through a test adapter.
// Does not claim native Tauri IPC or the native folder picker was exercised.
const {chromium}=require('playwright');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const run=promisify(execFile),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const output=fs.mkdtempSync(path.join(os.tmpdir(),'dossier-ui-'));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:960},reducedMotion:'reduce'});
 let deny=false,pickerCancel=false;const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.exposeFunction('testInvoke',async(command,args)=>{
   if(command==='choose_folder')return pickerCancel?null:output;
   if(command==='generate'){
     if(deny)throw new Error('TEST: IPC request denied');
     const {inputs:i}=args;
     try{return JSON.parse((await run(path.resolve('target/release/dossier-cli.exe'),['--semester',i.semester,'--course',i.course,'--section',i.section,'--output',args.output])).stdout);}
     catch(e){if(e.stdout)return JSON.parse(e.stdout);throw e;}
   }
   throw new Error('unexpected command');
 });
 await page.addInitScript(()=>window.__TAURI__={core:{invoke:async(command,args)=>{
   if(command==='preview'){
     const n=args.inputs;return {files:window.DOSSIER_MANIFEST.map(p=>p.split('/').map(c=>c.replaceAll('SEMESTER_NAME YY-YY',n.semester).replaceAll('COURSE NAME [ SECTION ]',`${n.course} [ ${n.section} ]`).replaceAll('COURSE_NAME_[ SECTION ]',`${n.course.replaceAll(' ','_')}_[ ${n.section} ]`).replaceAll('SEMESTER_NAME',n.semester.replaceAll(' ','_'))).join('/'))};
   }
   return window.testInvoke(command,args);
 }}});
 await page.goto('http://127.0.0.1:8765/app/');
 for(const [id,value]of [['semester','Fall 25-26'],['course','DS Lab'],['section','G']])await page.locator('#'+id).fill(value);
 pickerCancel=true;await page.locator('#choose-folder').click();assert(await page.locator('#generate').isDisabled());pickerCancel=false;
 await page.locator('#choose-folder').click();await page.locator('#generate:not([disabled])').waitFor();
 await page.locator('#generate').click();await page.getByText('30',{exact:true}).filter({hasNot:page.locator('#tree')}).first().waitFor();
 await page.waitForFunction(()=>document.querySelector('#result-counts').innerText.includes('30')&&!document.querySelector('#generate').disabled);
 assert.deepEqual(await page.locator('#result-counts strong').allTextContents(),['22','30','0']);
 await page.locator('#generate').click();await page.waitForFunction(()=>document.querySelector('#result-title').textContent.includes('Already'));
 assert.deepEqual(await page.locator('#result-counts strong').allTextContents(),['0','0','30']);
 await page.locator('#section').fill('O');await page.locator('#generate').click();await page.waitForFunction(()=>document.querySelector('#result-counts').innerText.includes('28')&&!document.querySelector('#generate').disabled);
 assert.deepEqual(await page.locator('#result-counts strong').allTextContents(),['21','28','2']);
 assert.equal(fs.existsSync(path.join(output,'Fall 25-26','DS Lab [ O ]')),true);
 await page.locator('#results summary').click();assert.equal(await page.locator('#activity li').count(),51);
 await page.locator('#results summary').click();await page.mouse.move(0,0);await page.keyboard.press('Escape');
 fs.mkdirSync('verification/browser',{recursive:true});await page.screenshot({path:'verification/browser/generated-workspace.png',fullPage:true});
 deny=true;await page.locator('#generate').click();await page.waitForFunction(()=>document.querySelector('#form-message').textContent.includes('IPC request denied'));assert(await page.locator('#generate').isEnabled());
 assert.deepEqual(errors,[]);
 fs.writeFileSync('verification/ui-integration.json',JSON.stringify({status:'PASS',method:'Production browser UI connected to actual Rust CLI through a test adapter. Native Tauri IPC/picker NOT tested.',checks:['Cancelled picker keeps Generate disabled','Native CLI generation from form: 22 directories,30 files','Repeat: 0 created,30 skipped','Section O:21 directories,28 files,2 shared skips','Activity log:51 entries','Backend rejection remains visible after controls re-enable'],console_errors:errors},null,2));
 await browser.close();fs.rmSync(output,{recursive:true,force:true});console.log('Real Rust CLI + UI adapter integration checks passed.');
})().catch(e=>{console.error(e);process.exit(1)});
