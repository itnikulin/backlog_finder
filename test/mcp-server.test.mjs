import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(testDir, "..");

test("stdio MCP server exposes only the advisor-phase read tools", async () => {
  const client = new Client({ name: "backlog-finder-test", version: "0.1.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(projectDir, "src/server.mjs")],
    cwd: projectDir,
    env: {
      KAITEN_BASE_URL: "https://example.kaiten.ru",
      KAITEN_API_TOKEN: "test-token",
      KAITEN_ALLOWED_BOARD_IDS: "9",
    },
    stderr: "pipe",
  });

  try {
    await client.connect(transport);
    const result = await client.listTools();
    const names = result.tools.map((tool) => tool.name).sort();

    assert.deepEqual(names, [
      "get_card",
      "get_card_comments",
      "get_card_location_history",
      "get_space",
      "list_cards",
      "list_spaces",
    ]);
    assert.equal(names.some((name) => /create|delete|move|update|write/.test(name)), false);
    const cardsTool = result.tools.find((tool) => tool.name === "list_cards");
    assert.ok(cardsTool.inputSchema.required.includes("board_id"));
    const spacesTool = result.tools.find((tool) => tool.name === "list_spaces");
    assert.ok(spacesTool.inputSchema.properties.offset);
    assert.ok(spacesTool.inputSchema.properties.max_pages);
    const denied = await client.callTool({ name: "list_cards", arguments: { board_id: 999 } });
    assert.equal(denied.isError, true);
    assert.match(denied.content[0].text, /outside configured Kaiten scope/);
  } finally {
    await client.close();
  }
});
