// Fetches a public tender listing page, but only if the site's rules allow it.
const UA = "QuentTenderFinderBot/1.0 (+https://tenders.bidprompt.si/about-bot)";

// Reads robots.txt and checks whether our robot may fetch this path.
export async function robotsAllows(url: string): Promise<{ allowed: boolean; why: string }> {
  let u: URL;
  try { u = new URL(url); } catch { return { allowed: false, why: "bad url" }; }
  try {
    const res = await fetch(`${u.origin}/robots.txt`, {
      headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(12000),
    });
    if (res.status === 404) return { allowed: true, why: "no robots.txt" };
    if (!res.ok) return { allowed: false, why: `robots.txt returned ${res.status}` };
    const txt = (await res.text()).slice(0, 200000);
    const rules = parseRobots(txt);
    const path = u.pathname + (u.search || "");
    const allowed = isAllowed(rules, path);
    return { allowed, why: allowed ? "robots.txt allows" : "robots.txt disallows this page" };
  } catch (e) {
    return { allowed: false, why: `robots.txt unreachable: ${e instanceof Error ? e.message : "error"}` };
  }
}

type Rule = { allow: boolean; path: string };

// Collects the rules that apply to us: our own name first, else the "*" group.
function parseRobots(txt: string): Rule[] {
  const lines = txt.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim()).filter(Boolean);
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;
  for (const line of lines) {
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === "user-agent") {
      if (!current || !lastWasAgent) { current = { agents: [], rules: [] }; groups.push(current); }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (field === "allow" || field === "disallow") {
      if (!current) { current = { agents: ["*"], rules: [] }; groups.push(current); }
      current.rules.push({ allow: field === "allow", path: value });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }
  const mine = groups.find((g) => g.agents.some((a) => UA.toLowerCase().startsWith(a.split("/")[0]) && a !== "*"));
  if (mine) return mine.rules;
  const star = groups.filter((g) => g.agents.includes("*")).flatMap((g) => g.rules);
  return star;
}

// Longest matching rule wins; an empty Disallow means "allow everything".
function isAllowed(rules: Rule[], path: string): boolean {
  let best: { len: number; allow: boolean } | null = null;
  for (const r of rules) {
    if (r.path === "") { if (!r.allow) continue; }
    if (!matches(r.path, path)) continue;
    const len = r.path.replace(/\*/g, "").length;
    if (!best || len > best.len || (len === best.len && r.allow)) best = { len, allow: r.allow };
  }
  return best ? best.allow : true;
}

function matches(pattern: string, path: string): boolean {
  if (pattern === "" || pattern === "/") return pattern === "" ? false : path.startsWith("/");
  const mustEnd = pattern.endsWith("$");
  const p = mustEnd ? pattern.slice(0, -1) : pattern;
  const parts = p.split("*");
  let i = 0;
  for (let k = 0; k < parts.length; k++) {
    const seg = parts[k];
    if (seg === "") continue;
    const at = path.indexOf(seg, i);
    if (k === 0 && at !== 0) return false;
    if (at === -1) return false;
    i = at + seg.length;
  }
  return mustEnd ? i === path.length : true;
}

// Downloads the page and turns it into plain text for the AI to read.
export async function fetchAsText(url: string): Promise<{ text: string; status: number }> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,application/xml" },
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
  const raw = await res.text();
  return { text: htmlToText(raw), status: res.status };
}

function safeChar(code: number): string {
  if (!isFinite(code) || code < 9 || code > 0x10ffff) return " ";
  try { return String.fromCodePoint(code); } catch { return " "; }
}

export function htmlToText(html: string, limit = 45000): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(tr|p|div|li|h[1-6]|table)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, limit);
}
