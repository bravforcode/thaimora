// Capture a single batched visual-review round from the exported preview.
// Run from this project root: node docs/capture-review.mjs http://127.0.0.1:4100/
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const base = new URL(process.argv[2] ?? 'http://127.0.0.1:4100/');
if (!['localhost','127.0.0.1'].includes(base.hostname)) throw new Error('Review capture requires a local preview');
const project = path.basename(process.cwd());
const directory = path.join(process.cwd(), '.impeccable', 'review');
await mkdir(directory, {recursive:true});
const report = {project, baseUrl:base.href, capturedAt:new Date().toISOString(), captures:[], errors:[]};
const browser = await chromium.launch({headless:true});
try {
  for (const [name,width,height,route] of [
    ['desktop',1440,1000,'/'],
    ['mobile',390,844,'/'],
    ['user-360',360,800,'/'],
    ['thai-mobile',390,844,'/th/'],
    ['detail-desktop',1440,1000, project==='taotide'?'/hotels/sairee-demo-stay/':null],
    ['detail-mobile',390,844,project==='taotide'?'/hotels/sairee-demo-stay/':null],
    ['admin-desktop',1440,1000,'/admin/'],
    ...(project==='taotide'?[['explore-desktop',1440,1000,'/explore/']]:[])
  ]) {
    const page = await browser.newPage({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
    page.on('pageerror',error=>report.errors.push({capture:name,message:error.message}));
    await page.goto(base.href,{waitUntil:'networkidle',timeout:60000});
    let target = route;
    if (!target) target = '/property/villa-chalong-6/';
    if (!target) throw new Error('No property detail route found in exported preview');
    if (target!=='/') await page.goto(new URL(target,base).href,{waitUntil:'networkidle',timeout:60000});
    await page.evaluate(async()=>{await document.fonts.ready;for(const img of document.images)img.loading='eager';await Promise.race([Promise.all([...document.images].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});}))),new Promise(resolve=>setTimeout(resolve,10000))]);});
    await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important;}'});
    await page.evaluate(()=>window.scrollTo(0,0));
    const filename = path.join(directory,name+'.png');
    await page.screenshot({path:filename,fullPage:true});
    report.captures.push({name,width,height,url:page.url(),filename,documentLanguage:await page.locator('html').getAttribute('lang'),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)});
    console.log('Captured '+name+' at '+page.url());
    await page.close();
  }
} finally { await browser.close(); }
await writeFile(path.join(directory,'capture-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if (report.errors.length || report.captures.some(c=>c.overflow)) process.exitCode=1;
