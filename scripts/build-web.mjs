import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'vendor', 'firebase'), { recursive: true });
fs.mkdirSync(path.join(out, 'vendor', 'leaflet'), { recursive: true });
fs.mkdirSync(path.join(out, 'vendor', 'fontawesome'), { recursive: true });
fs.mkdirSync(path.join(out, 'vendor', 'fontawesome', 'webfonts'), { recursive: true });

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const replacements = [
  ['https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js', './vendor/firebase/firebase-app-compat.js'],
  ['https://www.gstatic.com/firebasejs/9.6.1/firebase-database-compat.js', './vendor/firebase/firebase-database-compat.js'],
  ['https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css', './vendor/fontawesome/all.min.css'],
  ['https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', './vendor/leaflet/leaflet.css'],
  ['https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', './vendor/leaflet/leaflet.js']
];
for (const [remote, local] of replacements) html = html.split(remote).join(local);

// Enable Firebase Realtime Database's local persistence where supported.
// This keeps previously-read data and queued writes available across restarts.
html = html.replace(
  'firebase.initializeApp(firebaseConfig);\nconst db=firebase.database();',
  'firebase.initializeApp(firebaseConfig);\ntry { firebase.database().setPersistenceEnabled(true); } catch (e) { console.warn("Firebase local persistence unavailable", e); }\nconst db=firebase.database();'
);

fs.writeFileSync(path.join(out, 'index.html'), html);
const copy = (from, to) => fs.copyFileSync(path.join(root, from), path.join(out, to));
copy('node_modules/firebase/compat/firebase-app.js', 'vendor/firebase/firebase-app-compat.js');
copy('node_modules/firebase/compat/firebase-database.js', 'vendor/firebase/firebase-database-compat.js');
copy('node_modules/leaflet/dist/leaflet.js', 'vendor/leaflet/leaflet.js');
copy('node_modules/leaflet/dist/leaflet.css', 'vendor/leaflet/leaflet.css');
fs.cpSync(path.join(root, 'node_modules/leaflet/dist/images'), path.join(out, 'vendor/leaflet/images'), { recursive: true });
copy('node_modules/@fortawesome/fontawesome-free/css/all.min.css', 'vendor/fontawesome/all.min.css');
fs.cpSync(path.join(root, 'node_modules/@fortawesome/fontawesome-free/webfonts'), path.join(out, 'vendor/fontawesome/webfonts'), { recursive: true });
console.log('Prepared offline-capable DonorGram web assets in www/');
