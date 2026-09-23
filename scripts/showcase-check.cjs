const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true});const p=await b.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});const errors=[];p.on('pageerror',e=>errors.push(String(e)));
 await p.goto('http://127.0.0.1:8765/',{waitUntil:'networkidle'});
 assert.equal(await p.locator('.category').count(),12);assert.equal(await p.locator('.platform').count(),4);
 assert.equal(await p.locator('.visual canvas').count(),1,'Three.js hero should initialize when online');
 await p.locator('#inside').scrollIntoViewIfNeeded();await p.screenshot({path:'verification/browser/showcase-categories.png',fullPage:true});
 for(const width of [1280,760,390]){await p.setViewportSize({width,height:900});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}`);}
 await p.route('https://cdn.jsdelivr.net/**',r=>r.abort());await p.reload();assert.equal(await p.locator('.visual img').isVisible(),true);assert.equal(await p.locator('.category').count(),12);
 assert.deepEqual(errors,[]);fs.writeFileSync('verification/showcase.json',JSON.stringify({status:'PASS',checks:['12 categories','4 prepared platform links','Three.js initialized online','Responsive:1280,760,390','Logo and content remain usable when CDN unavailable'],console_errors:errors},null,2));await b.close();console.log('Showcase checks passed.');
})().catch(e=>{console.error(e);process.exit(1)});
