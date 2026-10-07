// Сборка лаунчера по профилю: node scripts/build-app.mjs dev|prod
//   dev  — админская сборка: панель kuberheim через SSH-туннель, все серверы (vite-src/.env.dev);
//   prod — сборка для игроков: только основной сервер, файлы из публичного бакета (vite-src/.env.prod).
// neu build всегда пишет в dist/VLauncher, поэтому готовые файлы Windows копируются оттуда
// в dist/VLauncher-<профиль>. .storage (путь к игре, выбранный сервер) в папке профиля сохраняется.
// Для prod рядом кладётся dist/VLauncher-prod.zip — то, что раздаётся игрокам, и dist/VLauncher-prod.json с версией:
// её вшивает сборка, а самообновление сравнивает с files/launcher/launcher.json в бакете. Публикует zip
// kuberheim: node scripts/publish-launcher.mjs (в репозитории kuberheim).
import { execFileSync, execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const profile = process.argv[2];
if (!['dev', 'prod'].includes(profile)) {
  console.error('Usage: node scripts/build-app.mjs dev|prod');
  process.exit(1);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, VLAUNCHER_PROFILE: profile };
// A shell-level override would silently replace the profile's address.
delete env.VITE_API_URL;
delete env.VITE_PROFILE;
delete env.VITE_SERVER_PICKER;
delete env.VITE_MANIFEST_KEY;
delete env.VITE_LAUNCHER_VERSION;

execSync('npm run check', { cwd: path.join(root, 'vite-src'), env, stdio: 'inherit' });
// Version: build time and commit, -dirty when the sources differ from it. Any change makes a new version.
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '.').slice(0, 15);
const dirty = git('status', '--porcelain', '--', 'vite-src', 'neutralino.config.json') ? '-dirty' : '';
const version = `${stamp}-${git('rev-parse', '--short', 'HEAD')}${dirty}`;
execFileSync(process.execPath, [path.join(root, 'vite-src/node_modules/@neutralinojs/neu/bin/neu.js'), 'build'], {
  cwd: root,
  env: { ...env, VITE_LAUNCHER_VERSION: version },
  stdio: 'inherit',
});

const built = path.join(root, 'dist/VLauncher');
const target = path.join(root, `dist/VLauncher-${profile}`);
const files = ['VLauncher-win_x64.exe', 'resources.neu', 'extensions/extension.exe'];
mkdirSync(path.join(target, 'extensions'), { recursive: true });
for (const file of files) cpSync(path.join(built, file), path.join(target, file));
// The admin launcher used to live in dist/VLauncher: carry its saved game path over once.
if (profile === 'dev' && !existsSync(path.join(target, '.storage')) && existsSync(path.join(built, '.storage')))
  cpSync(path.join(built, '.storage'), path.join(target, '.storage'), { recursive: true });

if (profile === 'prod') {
  const AdmZip = createRequire(path.join(root, 'vite-src/package.json'))('adm-zip');
  const zip = new AdmZip();
  for (const file of files) zip.addLocalFile(path.join(target, file), path.posix.join('VLauncher', path.posix.dirname(file)));
  const archive = path.join(root, 'dist/VLauncher-prod.zip');
  rmSync(archive, { force: true });
  zip.writeZip(archive);
  const info = { version, builtAt: new Date().toISOString() };
  writeFileSync(path.join(root, 'dist/VLauncher-prod.json'), JSON.stringify(info, null, 2) + '\n');
  console.log(`Готово: ${target}, архив для игроков ${archive}, версия ${version}`);
} else console.log(`Готово: ${target}`);
