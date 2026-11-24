import { test } from "node:test";
import assert from "node:assert/strict";
import { pickRepos, renderLines, replaceBlock, formatDate } from "./recent.mjs";

const repo = (name, pushed_at, extra = {}) => ({ name, pushed_at, html_url: `https://github.com/u/${name}`, description: "d", fork: false, archived: false, private: false, ...extra });

test("pickRepos drops forks, archived, private and the profile repo, newest first", () => {
  const out = pickRepos([
    repo("old", "2026-01-01T00:00:00Z"),
    repo("fork", "2026-11-01T00:00:00Z", { fork: true }),
    repo("arch", "2026-11-01T00:00:00Z", { archived: true }),
    repo("priv", "2026-11-01T00:00:00Z", { private: true }),
    repo("U", "2026-11-02T00:00:00Z"),
    repo("new", "2026-11-01T00:00:00Z"),
  ], "u");
  assert.deepEqual(out.map((r) => r.name), ["new", "old"]);
});

test("renderLines shows one compact line with release or update date", () => {
  const r = repo("a", "2026-11-23T10:00:00Z");
  assert.equal(renderLines([{ repo: r, release: null }]), "- [**a**](https://github.com/u/a) <sub>· updated · Nov 23, 2026</sub>");
  const rel = { tag_name: "v1.0.0", html_url: "https://x/rel", published_at: "2026-11-20T00:00:00Z" };
  assert.equal(renderLines([{ repo: r, release: rel }]), "- [**a**](https://github.com/u/a) <sub>· released [v1.0.0](https://x/rel) · Nov 20, 2026</sub>");
});

test("replaceBlock only rewrites between markers and is idempotent", () => {
  const md = "top\n<!-- RECENT:START -->\nold\n<!-- RECENT:END -->\nbottom\n";
  const once = replaceBlock(md, "new");
  assert.equal(once, "top\n<!-- RECENT:START -->\nnew\n<!-- RECENT:END -->\nbottom\n");
  assert.equal(replaceBlock(once, "new"), once);
});

test("replaceBlock fails without markers", () => {
  assert.throws(() => replaceBlock("no markers", "x"), /missing the RECENT markers/);
});

test("formatDate uses UTC", () => assert.equal(formatDate("2026-01-05T23:59:00Z"), "Jan 5, 2026"));
