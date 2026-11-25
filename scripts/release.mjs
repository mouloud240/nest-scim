import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const manifest = JSON.parse(readFileSync('packages/scim/package.json', 'utf8'));

if (manifest.license === 'UNLICENSED' || !manifest.license) {
  console.error('Refusing to publish @nest-scim/core without a package license.');
  process.exitCode = 1;
} else if (['0.0.0-alpha.0', '0.0.0'].includes(manifest.version)) {
  console.error(
    `Refusing to publish placeholder version ${manifest.version}; set the intended first release version.`,
  );
  process.exitCode = 1;
} else {
  const result = spawnSync('pnpm', ['changeset', 'publish'], { stdio: 'inherit' });

  if (result.error) {
    console.error(result.error.message);
    process.exitCode = 1;
  } else {
    process.exitCode = result.status ?? 1;
  }
}
