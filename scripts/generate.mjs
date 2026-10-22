// Draws the "Tech Stack & Languages" card for the profile README, in light and
// dark (stack-light.svg, stack-dark.svg). Languages are measured by file type
// (git tree sizes) over every repo Andrey owns or works in, team repos
// included, so React (.tsx/.jsx) counts as React, not as TypeScript the way
// GitHub's linguist stats do. Skipped: a backend that wasn't his code, and
// generated/vendor files. Run: node scripts/generate.mjs (needs `gh` logged in).
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const OWNERS = ["AndreyLqdn", "weAltura", "weAltura-old", "ValloraDK"];
const SKIP_REPOS = ["ValloraDK/servitutter-backend"];
const SKIP_FILES =
  /(^|\/)(node_modules|dist|build|\.next|vendor|coverage|public|generated|__generated__|\.turbo|storybook-static)\/|\.d\.ts$|\.min\.|lock|\.map$/i;
const EXT = {
  tsx: "React",
  jsx: "React",
  ts: "TypeScript",
  mts: "TypeScript",
  js: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  css: "CSS",
  scss: "CSS",
  sql: "SQL",
  dart: "Dart",
  py: "Python",
  html: "HTML",
  mdx: "MDX",
  swift: "Swift",
  kt: "Kotlin",
  rs: "Rust",
  sh: "Shell",
};
// Always in the legend, even when small (the stack he designs in); the rest is Other.
const FEATURED = ["React", "TypeScript", "CSS", "SQL", "JavaScript"];

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
  ["Linear", "#5e6ad2"],
];

// GitHub linguist colours (React: its brand cyan)
const LANG_COLOR = {
  React: "#61dafb",
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  SQL: "#e38c00",
  CSS: "#663399",
};

const gh = (...args) => JSON.parse(execFileSync("gh", args, { encoding: "utf8", maxBuffer: 1 << 28 }));

function languages() {
  const totals = {};
  let repos = 0;
  for (const owner of OWNERS) {
    for (const { name, defaultBranchRef } of gh("repo", "list", owner, "--limit", "100", "--json", "name,defaultBranchRef")) {
      const full = `${owner}/${name}`;
      if (SKIP_REPOS.includes(full) || !defaultBranchRef?.name) continue;
      let tree;
      try {
        tree = gh("api", `repos/${full}/git/trees/${defaultBranchRef.name}?recursive=1`);
      } catch {
        continue;
      }
      let counted = false;
      for (const f of tree.tree) {
        if (f.type !== "blob" || SKIP_FILES.test(f.path)) continue;
        const lang = EXT[f.path.split(".").pop().toLowerCase()];
        if (!lang) continue;
        totals[lang] = (totals[lang] ?? 0) + f.size;
        counted = true;
      }
      if (counted) repos++;
    }
  }
  const sum = Object.values(totals).reduce((a, b) => a + b, 0);
  const top = FEATURED.map((name) => ({ name, share: (totals[name] ?? 0) / sum })).sort((a, b) => b.share - a.share);
  const rest = Object.entries(totals)
    .filter(([name]) => !FEATURED.includes(name))
    .reduce((a, [, b]) => a + b, 0);
  if (rest > 0) top.push({ name: "Other", share: rest / sum });
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
  // Lay the chips out in rows first, then centre the rows in the space under the label
  const placed = [];
  let x = PAD + 16;
  let row = 0;
  const maxX = PAD + LEFT_W - 16;
  for (const [label, color] of STACK) {
    const w = Math.round(textWidth(label) + 34);
    if (x + w > maxX) {
      x = PAD + 16;
      row++;
    }
    placed.push({ label, color, w, x, row });
    x += w + 8;
  }
  const rowsH = (row + 1) * 34 - 10;
  const top = PANEL_Y + 36 + (PANEL_H - 36 - rowsH) / 2;
  const out = [];
  for (const { label, color, w, x, row } of placed) {
    const y = Math.round(top + row * 34);
    const dot = color === "ink" ? t.ink : color;
    out.push(
      `<g transform="translate(${x} ${y})">` +
        `<rect width="${w}" height="24" rx="12" fill="${t.bg}" stroke="${t.border}"/>` +
        `<circle cx="13" cy="12" r="4" fill="${dot}"/>` +
        `<text x="${(w + 12) / 2}" y="16" text-anchor="middle" font-size="12" fill="${t.text}">${label}</text>` +
        `</g>`,
    );
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

// ── Contributions: the last year's calendar (GitHub GraphQL, private days included
// as counts only, like GitHub's own graph), drawn above the stack card — GitHub
// puts its native graph below the README, so the README carries its own.

const GREENS = {
  light: ["#eff2f5", "#aceebb", "#4ac26b", "#2da44e", "#116329"],
  dark: ["#151b23", "#033a16", "#196c2e", "#2ea043", "#56d364"],
};

function contributions() {
  const q = "{ viewer { contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date weekday contributionCount } } } } } }";
  const cal = gh("api", "graphql", "-f", `query=${q}`).data.viewer.contributionsCollection.contributionCalendar;
  const counts = cal.weeks.flatMap((w) => w.contributionDays.map((d) => d.contributionCount)).filter((c) => c > 0).sort((a, b) => a - b);
  // Four levels by quartile of active days, like GitHub's
  const cut = [0.25, 0.5, 0.75].map((p) => counts[Math.floor(p * (counts.length - 1))] ?? 1);
  const level = (c) => (c === 0 ? 0 : c <= cut[0] ? 1 : c <= cut[1] ? 2 : c <= cut[2] ? 3 : 4);
  return { total: cal.totalContributions, weeks: cal.weeks.map((w) => w.contributionDays.map((d) => ({ ...d, level: level(d.contributionCount) }))) };
}

const CELL = 11;
const STEP = 14;
const CH = 228;

function contributionCard(theme, { total, weeks }) {
  const t = THEMES[theme];
  const g = GREENS[theme];
  const gridX = PAD + 32;
  const gridY = 84;
  const cells = [];
  const months = [];
  let lastMonth = "";
  weeks.forEach((days, w) => {
    const first = days[0];
    const month = new Date(`${first.date}T00:00:00Z`).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    if (month !== lastMonth && w < weeks.length - 2) {
      if (lastMonth) months.push(`<text x="${gridX + w * STEP}" y="${gridY - 8}" font-size="11" fill="${t.muted}">${month}</text>`);
      lastMonth = month;
    }
    for (const d of days)
      cells.push(`<rect x="${gridX + w * STEP}" y="${gridY + d.weekday * STEP}" width="${CELL}" height="${CELL}" rx="2" fill="${g[d.level]}"><title>${d.contributionCount} on ${d.date}</title></rect>`);
  });
  const dayLabels = [["Mon", 1], ["Wed", 3], ["Fri", 5]]
    .map(([l, i]) => `<text x="${PAD}" y="${gridY + i * STEP + 9}" font-size="10" fill="${t.muted}">${l}</text>`)
    .join("");
  const legendX = W - PAD - 5 * STEP - 64;
  const legend =
    `<text x="${legendX}" y="${CH - 22}" font-size="11" fill="${t.faint}">Less</text>` +
    g.map((c, i) => `<rect x="${legendX + 30 + i * STEP}" y="${CH - 31}" width="${CELL}" height="${CELL}" rx="2" fill="${c}"/>`).join("") +
    `<text x="${legendX + 30 + 5 * STEP + 4}" y="${CH - 22}" font-size="11" fill="${t.faint}">More</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${CH}" viewBox="0 0 ${W} ${CH}" font-family="${FONT}" role="img" aria-label="${total} contributions in the last year">
<rect x="0.5" y="0.5" width="${W - 1}" height="${CH - 1}" rx="12" fill="${t.bg}" stroke="${t.border}"/>
<g fill="none" stroke="${t.muted}" stroke-width="1.5" stroke-linecap="round" transform="translate(${PAD} 22)"><path d="M2 14V9M6 14V4M10 14V7M14 14V2"/></g>
<text x="${PAD + 24}" y="35" font-size="14" font-weight="600" fill="${t.text}">Contributions</text>
<text x="${W - PAD}" y="35" font-size="12" fill="${t.muted}" text-anchor="end"><tspan font-weight="600" fill="${t.text}">${total.toLocaleString("en-US")}</tspan> in the last year</text>
${months.join("")}
${dayLabels}
${cells.join("")}
<text x="${PAD}" y="${CH - 22}" font-size="11" fill="${t.faint}">Last ${weeks.length} weeks of activity</text>
${legend}
</svg>
`;
}

const data = languages();
for (const theme of ["light", "dark"]) writeFileSync(`stack-${theme}.svg`, card(theme, data));
console.log(`${data.repos} repos, ${(data.sum / 1e6).toFixed(1)} MB:`, data.top.map((l) => `${l.name} ${(l.share * 100).toFixed(1)}%`).join(", "));

const contrib = contributions();
for (const theme of ["light", "dark"]) writeFileSync(`contributions-${theme}.svg`, contributionCard(theme, contrib));
console.log(`${contrib.total} contributions, ${contrib.weeks.length} weeks`);
