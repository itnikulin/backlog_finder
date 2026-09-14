import assert from "node:assert/strict";
import test from "node:test";

import { KaitenClient, compactCard } from "../src/kaiten-client.mjs";

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("buildUrl uses the configured company domain and API version", () => {
  const client = new KaitenClient(
    {
      baseUrl: "https://example.kaiten.ru",
      token: "token",
      apiVersion: "latest",
    },
    { fetch: async () => jsonResponse({}) },
  );

  assert.equal(
    client.buildUrl("/cards", { board_id: 42, states: [1, 2] }).toString(),
    "https://example.kaiten.ru/api/latest/cards?board_id=42&states=1%2C2",
  );
});

test("request sends bearer authentication without exposing the token in the URL", async () => {
  let captured;
  const client = new KaitenClient(
    {
      baseUrl: "https://example.kaiten.ru",
      token: "private-token",
      apiVersion: "latest",
    },
    {
      fetch: async (url, options) => {
        captured = { url: url.toString(), options };
        return jsonResponse({ id: 1 });
      },
    },
  );

  await client.getCard(1);

  assert.equal(captured.options.headers.Authorization, "Bearer private-token");
  assert.equal(captured.url.includes("private-token"), false);
});

test("listCards paginates and compacts the response", async () => {
  const pages = [
    [
      { id: 1, title: "One", board_id: 9, column: { id: 2, title: "Now" } },
      { id: 2, title: "Two", board_id: 9, column: { id: 2, title: "Now" } },
    ],
    [{ id: 3, title: "Three", board_id: 9, column: { id: 3, title: "Next" } }],
  ];
  const seenOffsets = [];
  const client = new KaitenClient(
    {
      baseUrl: "https://example.kaiten.ru",
      token: "token",
      apiVersion: "latest",
    },
    {
      fetch: async (url) => {
        seenOffsets.push(Number(url.searchParams.get("offset")));
        return jsonResponse(pages.shift());
      },
    },
  );

  const result = await client.listCards({ board_id: 9, limit: 2, maxPages: 5 });

  assert.deepEqual(seenOffsets, [0, 2]);
  assert.equal(result.cards.length, 3);
  assert.equal(result.cards[0].column, "Now");
  assert.equal(result.truncated, false);
  assert.equal(result.next_offset, 3);
});

test("compactCard keeps prioritization fields and drops verbose content", () => {
  const result = compactCard({
    id: 7,
    title: "Prioritize me",
    description: "long text",
    owner: { id: 4, full_name: "Owner" },
    properties: { id_12: "Outcome A" },
  });

  assert.equal(result.owner, "Owner");
  assert.deepEqual(result.properties, { id_12: "Outcome A" });
  assert.equal("description" in result, false);
});
