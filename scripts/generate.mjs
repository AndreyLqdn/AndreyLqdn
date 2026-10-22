// Draws the profile README's cards, each in light and dark:
//   contributions-{light,dark}.svg — the last year's contribution calendar
//   stack-{light,dark}.svg         — Tech Stack: the core technologies as chips
// Run: node scripts/generate.mjs (needs `gh` logged in).
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

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

const gh = (...args) => JSON.parse(execFileSync("gh", args, { encoding: "utf8", maxBuffer: 1 << 26 }));

const THEMES = {
  light: { bg: "#ffffff", panel: "#f6f8fa", border: "#d1d9e0", text: "#1f2328", muted: "#59636e", faint: "#818b98", ink: "#1f2328" },
  dark: { bg: "#0d1117", panel: "#151b23", border: "#3d444d", text: "#f0f6fc", muted: "#9198a1", faint: "#656c76", ink: "#f0f6fc" },
};
const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif`;
const W = 840;
const PAD = 20;

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

// ── Tech Stack: one full-width panel of chips, wrapped into rows.

const PANEL_Y = 60;
const ROW = 34;

function stackCard(theme) {
  const t = THEMES[theme];
  // Balanced rows (never one chip alone on the last row)
  const perRow = Math.ceil(STACK.length / 2);
  const placed = [];
  let x = PAD + 16;
  let row = 0;
  STACK.forEach(([label, color], i) => {
    const w = Math.round(textWidth(label) + 34);
    if (i > 0 && i % perRow === 0) {
      x = PAD + 16;
      row++;
    }
    placed.push({ label, color, w, x, row });
    x += w + 8;
  });
  const chipsY = PANEL_Y + 40;
  const panelH = 40 + (row + 1) * ROW - 10 + 16;
  const H = PANEL_Y + panelH + PAD;
  const chips = placed
    .map(({ label, color, w, x, row }) => {
      const dot = color === "ink" ? t.ink : color;
      return (
        `<g transform="translate(${x} ${chipsY + row * ROW})">` +
        `<rect width="${w}" height="24" rx="12" fill="${t.bg}" stroke="${t.border}"/>` +
        `<circle cx="13" cy="12" r="4" fill="${dot}"/>` +
        `<text x="${(w + 12) / 2}" y="16" text-anchor="middle" font-size="12" fill="${t.text}">${label}</text>` +
        `</g>`
      );
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}" role="img" aria-label="Tech stack: ${STACK.map(([l]) => l).join(", ")}">
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="12" fill="${t.bg}" stroke="${t.border}"/>
<g fill="none" stroke="${t.muted}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" transform="translate(${PAD} 22)"><path d="M5 4 1 8l4 4M11 4l4 4-4 4M9.5 2.5 6.5 13.5"/></g>
<text x="${PAD + 24}" y="35" font-size="14" font-weight="600" fill="${t.text}">Tech Stack</text>
<rect x="${PAD + 0.5}" y="${PANEL_Y + 0.5}" width="${W - 2 * PAD - 1}" height="${panelH - 1}" rx="8" fill="${t.panel}" stroke="${t.border}"/>
<text x="${PAD + 16}" y="${PANEL_Y + 24}" font-size="11" font-weight="600" letter-spacing="0.06em" fill="${t.muted}">CORE TECHNOLOGIES</text>
${chips}
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
    const month = new Date(`${days[0].date}T00:00:00Z`).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
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

for (const theme of ["light", "dark"]) writeFileSync(`stack-${theme}.svg`, stackCard(theme));
console.log(`stack: ${STACK.length} technologies`);

const contrib = contributions();
for (const theme of ["light", "dark"]) writeFileSync(`contributions-${theme}.svg`, contributionCard(theme, contrib));
console.log(`${contrib.total} contributions, ${contrib.weeks.length} weeks`);
