/**
 * Renders logo.svg → assets/icon.png (512×512) using Electron's offscreen renderer.
 * Run with: npx electron create-icon.js
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const SIZE = 512;
  const PAD = 28; // padding around rhino inside the square

  const svgRaw = fs.readFileSync(path.join(__dirname, 'assets/logo.svg'), 'utf8');

  // Replace all fill colours in the SVG with the app's green accent
  const svgColoured = svgRaw.replace(/fill="#[0-9a-fA-F]{3,6}"/g, 'fill="#4CAF7C"');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: ${SIZE}px; height: ${SIZE}px;
    background: #111111;
    overflow: hidden;
    display: flex; align-items: center; justify-content: center;
  }
  .wrap {
    width: ${SIZE - PAD * 2}px; height: ${SIZE - PAD * 2}px;
    display: flex; align-items: center; justify-content: center;
  }
  svg { width: 100%; height: 100%; }
</style>
</head>
<body>
  <div class="wrap">${svgColoured}</div>
</body>
</html>`;

  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: '#111111',
    webPreferences: { nodeIntegration: false, contextIsolation: true, offscreen: false },
  });

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  // Give the SVG time to paint
  await new Promise(r => setTimeout(r, 800));

  const image = await win.capturePage({ x: 0, y: 0, width: SIZE, height: SIZE });
  const pngBuf = image.toPNG();

  const outPath = path.join(__dirname, 'assets/icon.png');
  fs.writeFileSync(outPath, pngBuf);
  console.log(`✓ Icon saved → ${outPath} (${pngBuf.length} bytes)`);

  app.quit();
});
