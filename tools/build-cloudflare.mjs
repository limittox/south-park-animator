// Builds the copy of the site that Cloudflare serves at yathuarul.xyz/paper-town-animator.
// Cloudflare finds files by their full path, so the built site goes in a folder named after that path.
// GitHub Pages keeps using dist/ as it is. Wrangler runs this before each deploy (see wrangler.jsonc).
import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs';

/** Must match the route in wrangler.jsonc. */
const PATH = 'paper-town-animator';
const OUT = 'dist-cloudflare';

if (!existsSync('dist/index.html')) {
  console.error('No built site in dist/. Run `npm run build` first.');
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
cpSync('dist', `${OUT}/${PATH}`, { recursive: true });
// The workers.dev address has nothing at its root, so it sends visitors on to the app.
writeFileSync(`${OUT}/_redirects`, `/ /${PATH}/ 302\n`);
console.log(`Copied dist/ to ${OUT}/${PATH}/`);
