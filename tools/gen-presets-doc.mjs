// Generates docs/PRESETS.md from site/presets.js.  Run: node tools/gen-presets-doc.mjs
import { writeFileSync } from 'node:fs';
import { PRESETS, GROUPS, CHECKED } from '../site/presets.js';
import { targetDims } from '../site/js/validate.js';

const kb = (p) => {
  const k = p.kb || {};
  const bits = [];
  if (k.min != null && k.max != null) bits.push(`${k.min}-${k.max} KB`);
  else if (k.max != null) bits.push(`max ${k.max} KB`);
  else if (k.min != null) bits.push(`min ${k.min} KB`);
  if (p.maxCompressionRatio) bits.push(`ratio under ${p.maxCompressionRatio}:1`);
  return bits.join(', ') || '-';
};
const size = (p) => {
  if (p.dimsRule === 'free') return 'any (max side ' + p.maxSide + ' px)';
  const d = targetDims(p);
  const base = `${d.w}x${d.h} px`;
  if (p.dimsRule === 'range') return `${base} (allowed ${p.minPx.w}x${p.minPx.h} to ${p.maxPx.w}x${p.maxPx.h})`;
  if (p.dimsRule === 'suggested') return `${base} (default, not required by the form)`;
  return `${base} (exact)`;
};
const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

let md = `# formfit presets\n\nGenerated from \`site/presets.js\` by \`node tools/gen-presets-doc.mjs\`. Numbers were researched on ${CHECKED}.\n\n`;
md += `**Verified** = read from an official source on that date. **Not verified** = taken from a third-party summary or only partly confirmed; the app shows "Check the official notice - requirements change every year." for these.\n\n`;
const nv = PRESETS.filter((p) => !p.verified).length;
md += `${PRESETS.length} presets: ${PRESETS.length - nv} verified, ${nv} not verified.\n`;
for (const g of GROUPS) {
  md += `\n## ${g.en}\n\n| Preset | Kind | Size | File | Verified | Source (checked) | Also check |\n|---|---|---|---|---|---|---|\n`;
  for (const p of PRESETS.filter((x) => x.group === g.id)) {
    const src = p.source ? `[${esc(p.source.label)}](${p.source.url})` : 'n/a (generic)';
    md += `| ${esc(p.name)} | ${p.kind} | ${size(p)} | ${kb(p)} | ${p.verified ? 'yes' : '**no**'} | ${src} ${p.checked} | ${esc(p.alsoCheck)} |\n`;
  }
}
md += `\n## Not included\n\n- JEE Advanced: the 2026 brochure does not state upload sizes (they appear only on the registration portal), so no numbers could be verified. Use Custom.\n- SSC CGL photograph: taken live inside the application, no file to prepare.\n- Canada / Australia visa photos and UK visa: no official digital rule was reachable; only the passport pages are listed.\n`;
writeFileSync(new URL('../docs/PRESETS.md', import.meta.url), md);
console.log('wrote docs/PRESETS.md');
