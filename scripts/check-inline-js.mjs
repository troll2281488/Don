import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script\\b([^>]*)>([\\s\\S]*?)<\\/script>/gi)];
let checked = 0;
for (let i = 0; i < scripts.length; i++) {
  const attrs = scripts[i][1] || '';
  const source = scripts[i][2] || '';
  if (/\\bsrc\\s*=/.test(attrs) || !source.trim()) continue;
  try {
    new Function(source);
    checked++;
  } catch (error) {
    console.error('Inline script #' + (i + 1) + ' syntax error: ' + error.message);
    process.exitCode = 1;
  }
}
if (!process.exitCode) console.log('Validated ' + checked + ' inline JavaScript blocks.');
