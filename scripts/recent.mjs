#!/usr/bin/env node
// Rewrites the "Recently" block of README.md with the latest public activity.
// Usage: node scripts/recent.mjs  (env: GITHUB_TOKEN optional, PROFILE_USER default Yoryoboy)
import { readFile, writeFile } from "node:fs/promises";

const START = "<!-- RECENT:START -->";
const END = "<!-- RECENT:END -->";
const LIMIT = 5;
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function formatDate(iso) {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function pickRepos(repos, user, limit = LIMIT) {
  return repos
    .filter((r) => !r.fork && !r.archived && !r.private && r.name.toLowerCase() !== user.toLowerCase())
    .sort((a, b) => Date.parse(b.pushed_at) - Date.parse(a.pushed_at))
    .slice(0, limit);
}

export function renderLines(items) {
  return items.map(({ repo, release }) => {
    const what = release
      ? `released [${release.tag_name}](${release.html_url})`
      : "updated";
    const date = formatDate(release ? release.published_at : repo.pushed_at);
    return `- [**${repo.name}**](${repo.html_url}) <sub>· ${what} · ${date}</sub>`;
  }).join("\n");
}

export function replaceBlock(readme, body) {
  const s = readme.indexOf(START);
  const e = readme.indexOf(END);
  if (s === -1 || e === -1 || e < s) throw new Error("README is missing the RECENT markers");
  return readme.slice(0, s + START.length) + "\n" + body + "\n" + readme.slice(e);
}

async function gh(path) {
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "profile-recent" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API ${path}: ${res.status}`);
  return res.json();
}

async function main() {
  const user = process.env.PROFILE_USER || "Yoryoboy";
  const repos = pickRepos(await gh(`/users/${user}/repos?type=owner&sort=pushed&per_page=100`), user);
  const items = await Promise.all(repos.map(async (repo) => {
    const release = await gh(`/repos/${user}/${repo.name}/releases/latest`);
    // Only show a release when it is the most recent thing that happened to the repo.
    const fresh = release && Date.parse(release.published_at) >= Date.parse(repo.pushed_at) - 86_400_000;
    return { repo, release: fresh ? release : null };
  }));
  const readme = await readFile("README.md", "utf8");
  const next = replaceBlock(readme, renderLines(items));
  if (next === readme) return console.log("README unchanged");
  await writeFile("README.md", next);
  console.log("README updated");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => { console.error(err.message); process.exit(1); });
}
