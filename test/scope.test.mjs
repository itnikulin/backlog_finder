import assert from "node:assert/strict";
import test from "node:test";
import { KaitenClient } from "../src/kaiten-client.mjs";

function fixture(responses) {
  const calls = [];
  const client = new KaitenClient({ baseUrl: "https://example.kaiten.ru", token: "test", allowedBoardIds: [9] }, {
    fetch: async (url, options) => {
      calls.push({ url, options });
      assert.ok(responses.length, "Unexpected extra HTTP request");
      return new Response(JSON.stringify(responses.shift()), { status: 200 });
    },
  });
  return { client, calls };
}

test("client requires an explicit allowlist even outside the environment loader", () => {
  for (const allowedBoardIds of [undefined, [], [0], ["9"], [NaN]]) {
    assert.throws(() => new KaitenClient({ allowedBoardIds }), /KAITEN_ALLOWED_BOARD_IDS/);
  }
});

test("unscoped and forbidden card lists are rejected before HTTP", async () => {
  const { client, calls } = fixture([]);
  for (const filters of [{}, { space_id: 1 }, { board_id: 10 }]) {
    await assert.rejects(client.listCards(filters), /outside configured/);
  }
  assert.equal(calls.length, 0);
});

test("card list rejects wrong or unknown board identity even with compact disabled", async () => {
  for (const card of [{ id: 1, board_id: 10 }, { id: 1 }]) {
    const { client } = fixture([[card]]);
    await assert.rejects(client.listCards({ board_id: 9, compact: false }), /outside configured/);
  }
});

test("forbidden cards cannot be returned or used to fetch comments/history", async () => {
  for (const method of ["getCard", "getCardComments", "getCardLocationHistory"]) {
    const { client, calls } = fixture([{ id: 1, board_id: 10, description: "PRIVATE" }]);
    await assert.rejects(client[method](1), (error) => {
      assert.equal(error.message.includes("PRIVATE"), false);
      return /outside configured/.test(error.message);
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url.pathname, "/api/latest/cards/1");
  }
});

test("membership is checked again after comments load", async () => {
  const { client } = fixture([{ id: 1, board_id: 9 }, [{ text: "PRIVATE" }], { id: 1, board_id: 10 }]);
  await assert.rejects(client.getCardComments(1), /outside configured/);
});

test("allowed comments preserve pagination and only use GET", async () => {
  const card = { id: 1, board_id: 9 };
  const { client, calls } = fixture([card, [{ id: 3, text: "test" }], card]);
  assert.deepEqual(await client.getCardComments(1, { limit: 5, offset: 10 }), [{ id: 3, text: "test" }]);
  assert.equal(calls[1].url.searchParams.get("offset"), "10");
  assert.ok(calls.every(({ options }) => options.method === "GET" && options.redirect === "error"));
});

test("history excludes events on forbidden or unidentified boards", async () => {
  const card = { id: 1, board_id: 9 };
  const { client } = fixture([card, [{ board_id: 10 }, { board_id: 9 }, {}], card]);
  assert.deepEqual(await client.getCardLocationHistory(1), [{ board_id: 9 }]);
});

test("spaces are paginated before filtering and unrelated nested content is removed", async () => {
  const { client, calls } = fixture([
    [{ id: 1, boards: [{ id: 10 }] }, { id: 2, boards: [] }],
    [{ id: 3, title: "Product", description: "PRIVATE", boards: [
      { board_id: 9, title: "Allowed", cards: [{ title: "PRIVATE" }], email_key: "SECRET" },
      { board_id: 10, title: "PRIVATE" },
    ] }],
  ]);
  const result = await client.listSpaces({ limit: 2 });
  assert.deepEqual(result.spaces, [{ id: 3, title: "Product", boards: [{ id: 9, title: "Allowed" }] }]);
  assert.deepEqual(calls.map(({ url }) => url.searchParams.get("offset")), ["0", "2"]);
  assert.equal(result.next_offset, 3);
  assert.equal(result.truncated, false);
});

test("empty filtered spaces still signal pagination continuation", async () => {
  const { client } = fixture([[{ id: 1, boards: [] }, { id: 2, boards: [] }]]);
  const result = await client.listSpaces({ limit: 2, offset: 100, maxPages: 1 });
  assert.deepEqual(result.spaces, []);
  assert.equal(result.truncated, true);
  assert.equal(result.next_offset, 102);
});

test("getSpace fails closed or returns only allowed board metadata", async () => {
  const { client } = fixture([{ id: 1, boards: [{ id: 10 }] }, { id: 2, boards: [{ id: 9 }] }]);
  await assert.rejects(client.getSpace(1), /outside configured/);
  assert.deepEqual(await client.getSpace(2), { id: 2, title: undefined, boards: [{ id: 9, title: undefined }] });
});

test("upstream error bodies never reach model context", async () => {
  const client = new KaitenClient({ baseUrl: "https://example.kaiten.ru", token: "test", allowedBoardIds: [9] }, {
    fetch: async () => new Response("PRIVATE token", { status: 403 }),
  });
  await assert.rejects(client.getCard(1), { message: "Kaiten API 403" });
});
