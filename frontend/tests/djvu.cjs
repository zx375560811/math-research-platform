'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright');
const {fixtureDjvu} = require('./fixture-djvu.cjs');
async function main() {
  let browser, scan;
  const root = path.resolve(__dirname, '..');
  const server = http.createServer((req,res) => {
    const url = new URL(req.url,'http://localhost');
    if(url.pathname==='/document.djvu') {res.writeHead(200,{'Content-Type':'image/vnd.djvu'});return res.end(fixtureDjvu(Number(url.searchParams.get('rotation')||0)));}
    if(url.pathname==='/scan.djvu') {res.writeHead(200,{'Content-Type':'image/vnd.djvu'});return res.end(scan);}
    if(url.pathname==='/sample.djvu' && process.env.MATH_DJVU_SAMPLE) {res.writeHead(200,{'Content-Type':'image/vnd.djvu'});return fs.createReadStream(process.env.MATH_DJVU_SAMPLE).pipe(res);}
    if(url.pathname==='/') {res.writeHead(200,{'Content-Type':'text/html','Content-Security-Policy':"default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; connect-src 'self'; object-src 'none'"});return res.end('<!doctype html><title>Native DjVu decoder checks</title><link rel="stylesheet" href="/style.css">');}
    if(['/reader-djvu.js','/vendor/djvu/djvu.js','/style.css'].includes(url.pathname)) {res.writeHead(200,{'Content-Type':url.pathname.endsWith('.css')?'text/css':'text/javascript'});return res.end(fs.readFileSync(path.join(root,url.pathname.slice(1))));}
    res.writeHead(404);res.end();
  });
  try {
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    browser = await chromium.launch({headless:true,...(process.env.MATH_BROWSER_EXECUTABLE?{executablePath:process.env.MATH_BROWSER_EXECUTABLE}:{})});
    const page = await browser.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    for(const rotation of [0,90,180,270]) {
      const result=await page.evaluate(async rotation=>{
        const {getDjvuDocument}=await import('/reader-djvu.js');const task=getDjvuDocument('/document.djvu?rotation='+rotation);
        try {const doc=await task.promise,proxy=await doc.getPage(1),viewport=proxy.getViewport({scale:1}),canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;
          await proxy.render({canvasContext:canvas.getContext('2d'),viewport,transform:[1,0,0,1,0,0]}).promise;
          const text=await proxy.getTextContent(),container=document.createElement('div');container.style.position='relative';container.style.width=viewport.width+'px';container.style.height=viewport.height+'px';document.body.replaceChildren(container);
          await doc.createTextLayer({textContentSource:text,container,viewport}).render();const box=container.firstChild.getBoundingClientRect(),frame=container.getBoundingClientRect();
          return {width:viewport.width,height:viewport.height,text:container.textContent,x:box.left-frame.left,y:box.top-frame.top,zoneWidth:box.width,zoneHeight:box.height,pixel:canvas.getContext('2d').getImageData(0,0,1,1).data[3]};
        } finally {await task.destroy();}
      },rotation);
      const expected={0:[600,800,60,76,350,24],90:[800,600,700,60,24,350],180:[600,800,190,700,350,24],270:[800,600,76,190,24,350]}[rotation];
      assert.deepEqual([result.width,result.height],expected.slice(0,2));assert.equal(result.text,'Native DjVu mathematics');assert.equal(result.pixel,255);
      [result.x,result.y,result.zoneWidth,result.zoneHeight].forEach((n,i)=>assert.ok(Math.abs(n-expected[i+2])<1,JSON.stringify(result)));
    }
    // Encode original colored scans, then test the actual IW44 image decoder in our adapter.
    scan=Buffer.from(await page.evaluate(async()=>{
      const worker=new DjVu.Worker('/vendor/djvu/djvu.js');
      try {const images=Array.from({length:2},()=>{const image=new ImageData(64,96);for(let i=0;i<image.data.length;i+=4){image.data[i]=220;image.data[i+1]=40;image.data[i+2]=40;image.data[i+3]=255;}return image;});await worker.startMultiPageDocument(100,0,false);for(const image of images)await worker.addPageToDocument(image);return [...new Uint8Array(await worker.endMultiPageDocument())];}
      catch(error){throw new Error(JSON.stringify(error));} finally {worker.terminate();}
    }));
    const decoded=await page.evaluate(async()=>{const {getDjvuDocument}=await import('/reader-djvu.js');const task=getDjvuDocument('/scan.djvu');try{const doc=await task.promise,p=await doc.getPage(2),v=p.getViewport({scale:1}),canvas=document.createElement('canvas');canvas.width=v.width;canvas.height=v.height;await p.render({canvasContext:canvas.getContext('2d'),viewport:v,transform:[1,0,0,1,0,0]}).promise;return {pages:doc.numPages,pixel:[...canvas.getContext('2d').getImageData(20,20,1,1).data],text:(await p.getTextContent()).items};}finally{await task.destroy();}});
    assert.equal(decoded.pages,2);assert.ok(decoded.pixel[0]>130 && decoded.pixel[0]>decoded.pixel[1]+30 && decoded.pixel[3]===255,JSON.stringify(decoded));assert.deepEqual(decoded.text,[]);
    if(process.env.MATH_DJVU_SAMPLE) {
      const real=await page.evaluate(async()=>{const {getDjvuDocument}=await import('/reader-djvu.js');const task=getDjvuDocument('/sample.djvu');try{const doc=await task.promise,p=await doc.getPage(1),v=p.getViewport({scale:.15}),canvas=document.createElement('canvas');canvas.width=v.width;canvas.height=v.height;await p.render({canvasContext:canvas.getContext('2d'),viewport:v,transform:[1,0,0,1,0,0]}).promise;return {pages:doc.numPages,width:v.width,textZones:(await p.getTextContent()).items.length};}finally{await task.destroy();}});
      assert.ok(real.pages>0 && real.width>0);console.log('Local original DjVu decoded:',real);
    }
    assert.deepEqual(errors,[]);console.log('Native DjVu OCR alignment in four rotations, bundled scans and actual IW44 decoding passed.');
  } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
