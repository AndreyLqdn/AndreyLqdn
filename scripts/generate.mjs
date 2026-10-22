// Draws the "Tech Stack & Languages" card for the profile README, in light and
// dark (stack-light.svg, stack-dark.svg). Languages are GitHub's own byte
// counts (linguist) summed over every repo Andrey owns or works in, team repos
// included. Run: node scripts/generate.mjs (needs `gh` logged in).
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const OWNERS = ["AndreyLqdn", "weAltura", "weAltura-old", "ValloraDK"];

// Design-engineer stack first, then runtime/systems, then tools.
const STACK = [
  ["TypeScript", "#3178c6"],
  ["React", "#61dafb"],
  ["Next.js", "ink"],
  ["Tailwind CSS", "#38bdf8"],
  ["CSS", "#663399"],
  ["Figma", "#a259ff"],
  ["Storybook", "#ff4785"],
  ["Node.js", "#5fa04e"],
  ["Rust", "#dea584"],
  ["Vercel", "ink"],
  ["Claude Code", "#d97757"],
  ["Codex", "ink"],
  ["GitHub", "ink"],
  ["Linear", "#5e6ad2"],
  ["Notion", "ink"],
];

// GitHub linguist colours
const LANG_COLOR = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572a5",
  XSLT: "#eb8ceb",
  SQL: "#e38c00", // PL/pgSQL, shown as SQL (linguist's PL/pgSQL blue is too close to Python's)
  CSS: "#663399",
  Dart: "#00b4ab",
  HTML: "#e34c26",
  Shell: "#89e051",
};

const gh = (...args) => JSON.parse(execFileSync("gh", args, { encoding: "utf8", maxBuffer: 1 << 26 }));

function languages() {
  const totals = {};
  let repos = 0;
  for (const owner of OWNERS) {
    const list = gh("repo", "list", owner, "--limit", "100", "--json", "name");
    for (const { name } of list) {
      const langs = gh("api", `repos/${owner}/${name}/languages`);
      if (!Object.keys(langs).length) continue;
      repos++;
      for (const [raw, bytes] of Object.entries(langs)) {
        const lang = raw === "PLpgSQL" ? "SQL" : raw;
        totals[lang] = (totals[lang] ?? 0) + bytes;
      }
    }
  }
  const sum = Object.values(totals).reduce((a, b) => a + b, 0);
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 5).map(([name, bytes]) => ({ name, share: bytes / sum }));
  const rest = sorted.slice(5).reduce((a, [, b]) => a + b, 0) / sum;
  if (rest > 0) top.push({ name: "Other", share: rest });
  return { top, sum, repos };
}

const THEMES = {
  light: { bg: "#ffffff", panel: "#f6f8fa", border: "#d1d9e0", text: "#1f2328", muted: "#59636e", faint: "#818b98", ink: "#1f2328", other: "#d1d9e0" },
  dark: { bg: "#0d1117", panel: "#151b23", border: "#3d444d", text: "#f0f6fc", muted: "#9198a1", faint: "#656c76", ink: "#f0f6fc", other: "#3d444d" },
};
const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif`;

// Approximate advance widths at 12px (system UI fonts); chips centre their label, so small errors split evenly.
function textWidth(s, size = 12) {
  let w = 0;
  for (const c of s) {
    if (c === " ") w += 0.28;
    else if (".,:;'|!il".includes(c)) w += 0.26;
    else if ("fjrt".includes(c)) w += 0.36;
    else if ("mwMW".includes(c)) w += 0.82;
    else if (/[A-Z]/.test(c)) w += 0.66;
    else if (/[0-9]/.test(c)) w += 0.56;
    else w += 0.53;
  }
  return w * size;
}

const W = 840;
const H = 272;
const PAD = 20;
const GAP = 12;
const LEFT_W = 468;
const RIGHT_X = PAD + LEFT_W + GAP;
const RIGHT_W = W - RIGHT_X - PAD;
const PANEL_Y = 60;
const PANEL_H = H - PANEL_Y - PAD;

function chips(t) {
  const out = [];
  let x = PAD + 16;
  let y = PANEL_Y + 44;
  const maxX = PAD + LEFT_W - 16;
  for (const [label, color] of STACK) {
    const w = Math.round(textWidth(label) + 34);
    if (x + w > maxX) {
      x = PAD + 16;
      y += 34;
    }
    const dot = color === "ink" ? t.ink : color;
    out.push(
      `<g transform="translate(${x} ${y})">` +
        `<rect width="${w}" height="24" rx="12" fill="${t.bg}" stroke="${t.border}"/>` +
        `<circle cx="13" cy="12" r="4" fill="${dot}"/>` +
        `<text x="${(w + 12) / 2}" y="16" text-anchor="middle" font-size="12" fill="${t.text}">${label}</text>` +
        `</g>`,
    );
    x += w + 8;
  }
  return out.join("");
}

function donut(t, { top, sum, repos }) {
  const cx = RIGHT_X + 72;
  const cy = PANEL_Y + PANEL_H / 2 + 4;
  const r = 44;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const arcs = top
    .map(({ name, share }) => {
      const len = share * c;
      const color = name === "Other" ? t.other : LANG_COLOR[name] ?? t.faint;
      const arc = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="14" stroke-dasharray="${Math.max(0, len - 1.5).toFixed(2)} ${c.toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
      offset += len;
      return arc;
    })
    .join("");
  const lx = RIGHT_X + 152;
  const legend = top
    .map(({ name, share }, i) => {
      const y = PANEL_Y + 34 + i * 21;
      const color = name === "Other" ? t.other : LANG_COLOR[name] ?? t.faint;
      const pct = share < 0.01 ? "<1%" : `${Math.round(share * 100)}%`;
      return (
        `<circle cx="${lx + 4}" cy="${y - 4}" r="4" fill="${color}"/>` +
        `<text x="${lx + 16}" y="${y}" font-size="12" fill="${t.text}">${name}</text>` +
        `<text x="${RIGHT_X + RIGHT_W - 16}" y="${y}" font-size="12" fill="${t.muted}" text-anchor="end">${pct.replace("<", "&lt;")}</text>`
      );
    })
    .join("");
  const mb = (sum / 1e6).toFixed(1);
  const langs = top.filter((l) => l.name !== "Other").length;
  return (
    arcs +
    `<text x="${cx}" y="${cy + 4}" font-size="11" fill="${t.muted}" text-anchor="middle">${langs} langs</text>` +
    legend +
    `<text x="${RIGHT_X + 16}" y="${PANEL_Y + PANEL_H - 14}" font-size="11" fill="${t.faint}">Based on ${mb} MB of code across ${repos} repos</text>`
  );
}

function card(theme, data) {
  const t = THEMES[theme];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}" role="img" aria-label="Tech stack and languages">
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="12" fill="${t.bg}" stroke="${t.border}"/>
<g fill="none" stroke="${t.muted}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" transform="translate(${PAD} 22)"><path d="M5 4 1 8l4 4M11 4l4 4-4 4M9.5 2.5 6.5 13.5"/></g>
<text x="${PAD + 24}" y="35" font-size="14" font-weight="600" fill="${t.text}">Tech Stack &amp; Languages</text>
<rect x="${PAD + 0.5}" y="${PANEL_Y + 0.5}" width="${LEFT_W - 1}" height="${PANEL_H - 1}" rx="8" fill="${t.panel}" stroke="${t.border}"/>
<text x="${PAD + 16}" y="${PANEL_Y + 24}" font-size="11" font-weight="600" letter-spacing="0.06em" fill="${t.muted}">CORE TECHNOLOGIES</text>
${chips(t)}
<rect x="${RIGHT_X + 0.5}" y="${PANEL_Y + 0.5}" width="${RIGHT_W - 1}" height="${PANEL_H - 1}" rx="8" fill="${t.panel}" stroke="${t.border}"/>
${donut(t, data)}
</svg>
`;
}

const data = languages();
for (const theme of ["light", "dark"]) writeFileSync(`stack-${theme}.svg`, card(theme, data));
console.log(`${data.repos} repos, ${(data.sum / 1e6).toFixed(1)} MB:`, data.top.map((l) => `${l.name} ${(l.share * 100).toFixed(1)}%`).join(", "));
