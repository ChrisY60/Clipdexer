import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const out = 'design-options';
await mkdir(out, { recursive: true });
const themes = [
  {name:'01 Archive', note:'Warm paper / vermilion', display:'Instrument Serif', body:'DM Sans', bg:'#f3efdf', ink:'#262721', accent:'#ce3925', muted:'#68685e', line:'#c8c3b3', panel:'#faf7ed', on:'#fff5df', size:99},
  {name:'02 Blue Hour', note:'Midnight / ice blue', display:'Space Grotesk', body:'Inter', bg:'#101d2e', ink:'#e7eef5', accent:'#9bc5ff', muted:'#a5b6c9', line:'#3a4c60', panel:'#18283b', on:'#101d2e', size:80},
  {name:'03 Botanical', note:'Pistachio / forest green', display:'Fraunces', body:'Manrope', bg:'#e8edda', ink:'#203d32', accent:'#466d3c', muted:'#526653', line:'#aebfa4', panel:'#f1f5e8', on:'#ffffff', size:84},
  {name:'04 Plum Edition', note:'Blush / deep plum', display:'Bodoni Moda', body:'DM Sans', bg:'#f2e3e8', ink:'#3a243b', accent:'#853a66', muted:'#725c70', line:'#c9aebf', panel:'#f9edf2', on:'#ffffff', size:88},
  {name:'05 Acid Press', note:'Charcoal / electric citron', display:'Syne', body:'Manrope', bg:'#20211d', ink:'#f1f0e8', accent:'#d7ef62', muted:'#b4b6a8', line:'#55584b', panel:'#292c24', on:'#20211d', size:80},
  {name:'06 Cobalt Studio', note:'Chalk / ultramarine', display:'Cormorant Garamond', body:'Space Grotesk', bg:'#f5f3ed', ink:'#202b43', accent:'#244ee8', muted:'#656b79', line:'#c5c9d1', panel:'#ffffff', on:'#ffffff', size:100},
];
const svg = await readFile('public/identity/memory-loop.svg', 'utf8');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  await page.route('**/api/config', r=>r.fulfill({json:{ai:false,twitch:false,user:null}}));
  await page.route('**/api/clips?*', r=>r.fulfill({json:{clips:[],page:1,pages:1,total:0,counts:{total:0,ready:0,pending:0}}}));
  await page.goto('http://127.0.0.1:3000', {waitUntil:'networkidle'});
  const families = [...new Set(themes.flatMap(t=>[t.display,t.body]))];
  const fontUrl = 'https://fonts.googleapis.com/css2?' + families.map(f=>'family='+f.replaceAll(' ','+')+':ital,wght@0,400;0,500;1,400').join('&') + '&display=swap';
  await page.evaluate(url=>{const l=document.createElement('link');l.rel='stylesheet';l.href=url;document.head.append(l);},fontUrl);
  await page.waitForTimeout(3000);
  for (const t of themes) {
    const css = `:root {--paper:${t.bg};--bg:${t.bg};--ink:${t.ink};--text:${t.ink};--red:${t.accent};--orange:${t.accent};--muted:${t.muted};--border:${t.line};--panel:${t.panel};--green:${t.accent};--serif:'${t.display}',serif;}
      body {font-family:'${t.body}',sans-serif;}
      .hero h1 {font-size:${t.size}px;}
      .hero > p,.demo-banner p,.section-heading p,.index-count,.mode-pill {color:${t.muted};}
      .search-form {background:${t.panel};box-shadow:5px 5px 0 ${t.line};}
      .search-form input::placeholder {color:${t.muted};}
      .search-form kbd {color:${t.muted};border-color:${t.line};}
      .search-submit,.search-submit:disabled {background:${t.accent};color:${t.on};}
      .button.small {background:${t.ink};color:${t.bg};}
      .topbar,.demo-banner {border-color:${t.line};}
      .sidebar nav .nav-item,.channel {color:${t.ink};}
      .sidebar nav .nav-item.active {color:${t.accent};}
      .hero {min-height:440px;} .library,.page-footer {display:none;}
      .brand {font-size:40px;} .demo-banner strong {font-size:24px;}
    `;
    await page.evaluate(({css,svg,t})=>{
      document.getElementById('theme-preview')?.remove();
      const style=document.createElement('style');style.id='theme-preview';style.textContent=css;document.head.append(style);
      const art=svg.replaceAll('#e74027',t.accent).replaceAll('#24251f',t.ink).replaceAll('#f3eddc',t.bg).replaceAll('#bfb8a7',t.line);
      document.querySelector('.archive-art img').src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(art);
    },{css,svg,t});
    await page.evaluate(async t=>{await document.fonts.load(`400 90px "${t.display}"`);await document.fonts.load(`italic 400 90px "${t.display}"`);await document.fonts.load(`400 14px "${t.body}"`);await document.fonts.ready;},t);
    const loaded=await page.evaluate(t=>document.fonts.check(`400 90px "${t.display}"`),t);
    if(!loaded) throw new Error('Font not loaded: '+t.display);
    await page.waitForTimeout(500);
    t.file=t.name.toLowerCase().replaceAll(' ','-')+'.png';
    await page.screenshot({path:out+'/'+t.file});
    await writeFile(out+'/'+t.file.replace('.png','.css'),css);
    console.log('Saved '+t.name+' / '+t.display+' + '+t.body);
  }
  const cards=await Promise.all(themes.map(async t=>`<article><img src="data:image/png;base64,${(await readFile(out+'/'+t.file)).toString('base64')}"/><div class="caption"><strong>${t.name}</strong><span>${t.note}<br>${t.display} + ${t.body}</span><div class="swatches">${[t.bg,t.ink,t.accent].map(c=>`<i style="background:${c}"></i>`).join('')}</div></div></article>`));
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>Clipdexer colour and type studies</title><style>*{box-sizing:border-box}body{margin:0;padding:40px;background:#deddd7;color:#292a26;font-family:Arial,sans-serif}header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:28px}h1{font-size:32px;font-weight:500;margin:0}header p{font-size:15px;color:#62635c}.grid{display:grid;grid-template-columns:1fr 1fr;gap:28px}article{background:#f9f8f3;border:1px solid #c6c5be}img{width:100%;display:block}.caption{display:flex;align-items:center;gap:22px;padding:20px}.caption strong{font-size:21px;min-width:185px}.caption span{font-size:13px;line-height:1.6;color:#64645f}.swatches{margin-left:auto;display:flex;gap:5px}.swatches i{width:22px;height:22px;border-radius:50%;border:1px solid #0002}</style></head><body><header><h1>Clipdexer / colour & type studies</h1><p>Six directions. Same layout.</p></header><div class="grid">${cards.join('')}</div></body></html>`;
  await writeFile(out+'/comparison.html',html);
  const sheet=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});
  await sheet.setContent(html,{waitUntil:'load'});
  await sheet.screenshot({path:out+'/comparison.png',fullPage:true});
  await writeFile(out+'/themes.json',JSON.stringify(themes,null,2));
} finally {await browser.close();}
