import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Only these reviewed public documents can enter the website build.
// Never discover or publish files from docs/technical automatically.
export const publicDocuments = [
  { file: 'website/documents/pilots.md', route: 'pilots', title: 'Handbuch für Pilotinnen und Piloten', group: 0, chapters: true },
  { file: 'website/documents/schools.md', route: 'schools', title: 'Betriebshandbuch für Flugschulen', group: 1, chapters: true },
  { file: 'website/documents/technical/README.md', route: 'technical', group: 2 },
  { file: 'website/documents/technical/architecture.md', route: 'technical/architecture', group: 2 },
  { file: 'website/documents/technical/security.md', route: 'technical/security', group: 2 },
  { file: 'website/documents/technical/data-and-export.md', route: 'technical/data-and-export', group: 2 },
  { file: 'website/documents/technical/browser.md', route: 'technical/browser', group: 2 },
];

// Regression guard, supplementing editorial review (not a general classifier).
// burnair is a public third-party map the app links to (a feature), not internal information.
const excluded = /roadmap|backlog|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ACCESS_TOKEN|PUSH_INTERNAL_SECRET|\.env(?:\.|\b)|docs\/technical|drizzle\/migrations|supabase\/migrations|Quelldatei im Repository|technische Schulden|interne(?:r|n)? (?:Plan|Roadmap)/i;
export function assertPublicText(text, name) {
  if (excluded.test(text)) throw new Error(`Non-public content in ${name}; review the public edition before building.`);
}

export async function auditPublicOutput(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { await auditPublicOutput(path); continue; }
    assertPublicText(entry.name, path);
    if (/\.(html|js|css|xml|txt)$/i.test(entry.name)) assertPublicText(await readFile(path, 'utf8'), path);
    else if (!/\.png$/i.test(entry.name)) throw new Error(`Unreviewed public asset type: ${path}`);
  }
}
