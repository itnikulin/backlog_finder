import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, mkdirSync, cpSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

test("Git ignores working context, environment variants and private config", () => {
  const paths = ["context/product-passport.md", "context/decision-log.md", "private/export.json",
    ".env", ".env.local", ".env.production", "config/kilo.local.jsonc"];
  const ignored = execFileSync("git", ["check-ignore", "--no-index", ...paths], { cwd: root, encoding: "utf8" });
  assert.deepEqual(ignored.trim().split("\n"), paths);
});

test("context initializer preserves existing private documents", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "backlog-context-test-"));
  try {
    cpSync(path.join(root, "scripts"), path.join(directory, "scripts"), { recursive: true });
    cpSync(path.join(root, "templates"), path.join(directory, "templates"), { recursive: true });
    mkdirSync(path.join(directory, "context"));
    writeFileSync(path.join(directory, "context/product-passport.md"), "Synthetic existing context");
    execFileSync(process.execPath, [path.join(directory, "scripts/init-context.mjs")]);
    assert.equal(readFileSync(path.join(directory, "context/product-passport.md"), "utf8"), "Synthetic existing context");
    assert.match(readFileSync(path.join(directory, "context/decision-log.md"), "utf8"), /Decision Log/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
