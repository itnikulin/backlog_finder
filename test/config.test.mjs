import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../src/config.mjs";

test("loadConfig normalizes a Kaiten base URL", () => {
  const config = loadConfig({
    KAITEN_BASE_URL: "https://example.kaiten.ru/",
    KAITEN_API_TOKEN: "secret",
  });

  assert.equal(config.baseUrl, "https://example.kaiten.ru");
  assert.equal(config.apiVersion, "latest");
});

test("loadConfig rejects a missing token", () => {
  assert.throws(
    () => loadConfig({ KAITEN_BASE_URL: "https://example.kaiten.ru" }),
    /KAITEN_API_TOKEN is required/,
  );
});
