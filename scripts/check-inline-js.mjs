import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script\\b([^>]*)>([\\s\\S]*?)<\\/script>/gi)];
let checked = 0;
let failed = false;

for (let i = 0; i < scripts.length; i++) {
  const attrs = scripts[i][1] || '';
  const source = scripts[i][2] || '';
  if (/\\bsrc\\s*=/.test(attrs) || !source.trim()) continue;
  try {
    new vm.Script(source, { filename: 'inline-script-' + (i + 1) + '.js' });
    checked++;
  } catch (error) {
    failed = true;
    console.error('Inline script #' + (i + 1) + ' syntax error:');
    console.error(error.stack || error.message);
  }
}

if (failed) process.exitCode = 1;
else console.log('Validated ' + checked + ' inline JavaScript blocks.');
