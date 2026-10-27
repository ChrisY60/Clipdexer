import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";
import path from "node:path";
const out = path.resolve("public/samples");
await mkdir(out, { recursive: true });
const defs = `<defs><linearGradient id="room" x2="1" y2="1"><stop stop-color="#38304f"/><stop offset="1" stop-color="#141522"/></linearGradient><linearGradient id="shirt" x2="1" y2="1"><stop stop-color="#a377f1"/><stop offset="1" stop-color="#5f3ba1"/></linearGradient><linearGradient id="desk" x2="0" y2="1"><stop stop-color="#504253"/><stop offset="1" stop-color="#26202e"/></linearGradient><radialGradient id="light"><stop stop-color="#cb77ff" stop-opacity=".35"/><stop offset="1" stop-color="#cb77ff" stop-opacity="0"/></radialGradient><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#899f9b"/><stop offset="1" stop-color="#cfbba1"/></linearGradient><linearGradient id="fur" x2="1" y2="1"><stop stop-color="#e5b579"/><stop offset="1" stop-color="#ba7b48"/></linearGradient><pattern id="keys" width="23" height="17" patternUnits="userSpaceOnUse"><rect x="2" y="2" width="19" height="12" rx="2" fill="#c1b4a2"/></pattern></defs>`;
const scene = {
  purple: `<rect width="960" height="540" fill="url(#room)"/><circle cx="710" cy="160" r="300" fill="url(#light)"/><rect x="66" y="57" width="230" height="270" rx="3" fill="#181721" stroke="#554562" stroke-width="8"/><path d="M100 250L159 110 223 230 262 159" fill="none" stroke="#876ba3" stroke-width="3"/><rect x="733" y="46" width="12" height="326" rx="6" fill="#b574e2"/><rect x="738" y="50" width="3" height="318" fill="#f7caff"/><path d="M35 375H937" stroke="#6d546f" stroke-width="8"/><rect x="315" y="177" width="264" height="350" rx="72" fill="#171820" stroke="#555064" stroke-width="9"/><path d="M338 540L329 372Q343 294 424 290H494Q572 301 590 372L629 540" fill="url(#shirt)"/><path d="M422 280V325Q453 346 484 320V270" fill="#bc8a70"/><ellipse cx="453" cy="214" rx="65" ry="80" fill="#ce9b7e"/><path d="M389 203Q366 121 448 116Q531 108 521 193L494 180 474 151 423 180Z" fill="#272127"/><path d="M409 203h20m49 0h19" stroke="#563c38" stroke-width="5" stroke-linecap="round"/><path d="M436 248q20 12 38-3" fill="none" stroke="#75463f" stroke-width="4" stroke-linecap="round"/><path d="M384 203Q372 115 449 103Q534 106 530 206" fill="none" stroke="#25252f" stroke-width="18"/><rect x="375" y="186" width="29" height="61" rx="13" fill="#3d354c"/><rect x="511" y="185" width="28" height="62" rx="12" fill="#3d354c"/><path d="M354 381L299 463 380 490M570 387L619 466 541 489" fill="none" stroke="#9568d0" stroke-width="46" stroke-linecap="round"/><rect y="476" width="960" height="64" fill="url(#desk)"/><path d="M698 540L667 294 584 270" fill="none" stroke="#181923" stroke-width="16"/><rect x="555" y="246" width="64" height="37" rx="16" fill="#33333f" transform="rotate(16 555 246)"/><rect x="74" y="360" width="216" height="141" rx="9" fill="#171d2a" stroke="#414550" stroke-width="7"/><path d="M95 394H227M95 413H201M95 432H249" stroke="#777caa" stroke-width="5" opacity=".5"/><rect x="780" y="420" width="53" height="62" rx="9" fill="#d2b1a8"/><path d="M834 430q37-4 26 28h-27" fill="none" stroke="#d2b1a8" stroke-width="10"/><text x="808" y="80" fill="#e0baff" font-family="monospace" font-size="14">ON AIR</text><circle cx="792" cy="75" r="5" fill="#e79bba"/>`,
  game: `<rect width="960" height="540" fill="url(#sky)"/><path d="M0 0H310V320H0Z" fill="#635e56"/><path d="M12 0H282V305H12Z" fill="#807a6a"/><path d="M45 50H239V230H45Z" fill="#4e5350"/><path d="M320 84L586 25 701 100V341H320Z" fill="#a19881"/><path d="M341 121L568 75V298H341Z" fill="#8c8c77"/><path d="M594 25L701 100V341L594 280Z" fill="#6e7464"/><path d="M742 0H960V540H742Z" fill="#787b69"/><path d="M748 105H936V303H748Z" fill="#8d8f79"/><path d="M0 540L324 309 698 309 960 540Z" fill="#9d9b82"/><path d="M318 307L400 540M699 307L590 540" stroke="#b7b296" stroke-width="3"/><rect x="439" y="211" width="73" height="108" rx="3" fill="#34413d"/><rect x="455" y="199" width="40" height="36" rx="11" fill="#bd735f"/><path d="M443 251l-26 56m90-56 27 48m-73 18-15 41m44-41 17 40" stroke="#34413d" stroke-width="17"/><path d="M611 540L573 433 662 386 743 451 790 540Z" fill="#343e3e"/><path d="M629 452L571 345 607 319 706 426Z" fill="#222d31"/><path d="M584 343L606 333 667 408 644 422Z" fill="#657577"/><path d="M659 540L631 463 690 438 761 540" fill="#59695f"/><path d="M470 257V272M470 287V302M448 280H463M478 280H493" stroke="#eff7d2" stroke-width="2"/><rect x="343" y="49" width="273" height="54" rx="4" fill="#243b31da"/><text x="480" y="84" text-anchor="middle" fill="#d4ecc0" font-family="Arial" font-weight="bold" font-size="25" letter-spacing="4">ROUND WON</text><rect x="20" y="387" width="200" height="132" rx="7" fill="#222d2c" stroke="#d4b986" stroke-width="3"/><rect x="28" y="395" width="184" height="116" rx="4" fill="#435148"/><path d="M75 511v-51q40-45 80 0v51" fill="#87a87a"/><ellipse cx="115" cy="445" rx="24" ry="30" fill="#d1ad90"/><path d="M90 434q10-40 45-15l5 23" fill="#35302c"/><path d="M77 469L49 419M153 467L178 415" stroke="#8cad7b" stroke-width="15" stroke-linecap="round"/><text x="306" y="491" fill="#f6d2a3" font-family="Arial" font-weight="bold" font-size="31">1</text><path d="M345 477h126" stroke="#c4c8ad" stroke-width="8"/><path d="M345 477h7" stroke="#f3a888" stroke-width="8"/><text x="810" y="492" fill="#eef0db" font-family="monospace" font-size="27">01 / 24</text>`,
  cat: `<rect width="960" height="540" fill="#74604e"/><rect x="0" y="0" width="960" height="360" fill="#90735a"/><rect x="59" y="38" width="310" height="252" rx="5" fill="#d1b89a"/><rect x="74" y="54" width="280" height="220" fill="#aeb5a0"/><path d="M215 54V275M74 165H354" stroke="#e0c6a4" stroke-width="10"/><path d="M0 390L960 330V540H0" fill="#b4936b"/><rect x="535" y="54" width="350" height="257" rx="11" fill="#302d2a"/><rect x="549" y="67" width="322" height="231" rx="3" fill="#444b45"/><rect x="570" y="87" width="130" height="10" rx="4" fill="#909f89"/><path d="M570 124h242M570 148h186M570 173h224M570 197h117M570 221h199" stroke="#8c9b84" stroke-width="6" opacity=".55"/><path d="M696 311v44m-45 5h94" stroke="#37352e" stroke-width="16"/><path d="M200 412L696 386 760 480 167 507Z" fill="#463e35"/><path d="M215 423L684 401 732 468 187 491Z" fill="url(#keys)"/><path d="M454 413Q575 463 606 376T542 327" fill="none" stroke="#bd814b" stroke-width="30" stroke-linecap="round"/><ellipse cx="407" cy="362" rx="116" ry="83" fill="url(#fur)"/><path d="M332 382L311 451Q340 470 366 444L372 400M440 396L451 454Q476 469 499 449L495 384" fill="#d9a368"/><path d="M298 303L277 225 333 257Q368 235 405 258L456 224 441 311Q428 368 368 373Q312 369 298 303Z" fill="url(#fur)"/><path d="M291 247L302 283 326 268M414 269L442 245 432 287" fill="#dba3a0"/><path d="M331 301l17 3m40 0 17-5" stroke="#5c493a" stroke-width="6" stroke-linecap="round"/><path d="M361 318l15 0-8 9Z" fill="#a97165"/><path d="M368 329q-8 12-17 4m17-4q8 12 17 4" fill="none" stroke="#775445" stroke-width="2"/><path d="M328 324L277 315M328 335L273 339M407 322L459 311M407 333L463 337" stroke="#ebcc9f" stroke-width="3"/><path d="M350 254l5 23m17-26v24m18-22-5 21M478 318l-23 23m48-6-22 23" stroke="#a46b3b" stroke-width="8" stroke-linecap="round"/><ellipse cx="110" cy="441" rx="48" ry="14" fill="#7f6449" opacity=".3"/><rect x="71" y="355" width="70" height="80" rx="12" fill="#e4d6bb"/><path d="M140 368q48-5 32 38h-31" fill="none" stroke="#e4d6bb" stroke-width="12"/><ellipse cx="106" cy="358" rx="32" ry="8" fill="#68503e"/><path d="M104 341q-15-17 3-30" fill="none" stroke="#e0d5be" stroke-width="3" opacity=".6"/>`,
};
const captions = {
  purple: [
    { start: 6, end: 12, text: "Chat, where should we travel next?" },
    { start: 18, end: 24, text: "Bulgaria! I want to visit Bulgaria." },
  ],
  game: [
    {
      start: 18,
      end: 26,
      text: "No way! One health! That was the best clutch.",
    },
  ],
  cat: [{ start: 16, end: 24, text: "My cat just deleted everything." }],
};
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 960, height: 540 },
  deviceScaleFactor: 1,
});
for (const [name, body] of Object.entries(scene)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">${defs}${body}<rect width="960" height="540" fill="#14121c" opacity=".08"/></svg>`;
  await writeFile(path.join(out, name + ".svg"), svg);
  await page.setContent(`<style>body{margin:0}</style>${svg}`);
  await page.screenshot({ path: path.join(out, name + ".png") });
  let filters = [
    "drawbox=x=0:y=0:w=iw:h=45:color=black@0.65:t=fill",
    "drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='CLIPDEXER  /  AUTHORED SAMPLE STORYBOARD':fontcolor=white:fontsize=16:x=20:y=15",
  ];
  for (const [i, c] of captions[name].entries()) {
    const textfile = path.join(out, `${name}-${i}.txt`);
    await writeFile(textfile, c.text);
    const escaped = textfile.replaceAll("\\", "/").replace(":", "\\:");
    filters.push(
      `drawbox=x=0:y=455:w=iw:h=85:color=black@0.75:t=fill:enable='between(t,${c.start},${c.end})'`,
      `drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':textfile='${escaped}':fontcolor=white:fontsize=24:x=(w-tw)/2:y=485:enable='between(t,${c.start},${c.end})'`,
    );
  }
  execFileSync(
    process.env.FFMPEG_PATH || "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-loop",
      "1",
      "-framerate",
      "15",
      "-i",
      path.join(out, name + ".png"),
      "-t",
      "30",
      "-vf",
      filters.join(","),
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "25",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      path.join(out, name + ".mp4"),
    ],
    { stdio: "inherit" },
  );
  console.log(`Created ${name} storyboard`);
}
await browser.close();
