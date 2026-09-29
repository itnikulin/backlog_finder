import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../src/config.mjs";

test("loadConfig normalizes a Kaiten base URL", () => {
  const config = loadConfig({
    KAITEN_BASE_URL: "https://example.kaiten.ru/",
    KAITEN_API_TOKEN: "secret",
    KAITEN_ALLOWED_BOARD_IDS: "9, 42,9",
  });

  assert.equal(config.baseUrl, "https://example.kaiten.ru");
  assert.equal(config.apiVersion, "latest");
  assert.deepEqual(config.allowedBoardIds, [9, 42]);
});

test("loadConfig fails closed without a valid board allowlist", () => {
  for (const value of [undefined, "", "*", "0", "-1", "1,,2", "1.5", "1e2", "9007199254740992"]) {
    assert.throws(() => loadConfig({ KAITEN_BASE_URL: "https://example.kaiten.ru",
      KAITEN_API_TOKEN: "test", KAITEN_ALLOWED_BOARD_IDS: value }), /KAITEN_ALLOWED_BOARD_IDS/);
  }
});

test("loadConfig rejects a missing token", () => {
  assert.throws(
    () => loadConfig({ KAITEN_BASE_URL: "https://example.kaiten.ru" }),
    /KAITEN_API_TOKEN is required/,
  );
});
