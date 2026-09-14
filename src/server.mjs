import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { loadConfig } from "./config.mjs";
import { KaitenClient } from "./kaiten-client.mjs";

function jsonResult(value) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(error) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

export function createServer(client) {
  const server = new McpServer({
    name: "kaiten-readonly",
    version: "0.1.0",
  });

  server.registerTool(
    "list_spaces",
    {
      title: "List Kaiten spaces",
      description: "List accessible Kaiten spaces. Space responses include their board placements.",
      inputSchema: {},
    },
    async () => {
      try {
        return jsonResult(await client.listSpaces());
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "get_space",
    {
      title: "Get Kaiten space",
      description: "Get one Kaiten space and its board metadata. Use list_cards for board cards.",
      inputSchema: {
        space_id: z.number().int().positive(),
      },
    },
    async ({ space_id }) => {
      try {
        return jsonResult(await client.getSpace(space_id));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "list_cards",
    {
      title: "List Kaiten cards",
      description: "Retrieve a paginated, compact backlog slice. Fetch full card details only for shortlisted cards.",
      inputSchema: {
        space_id: z.number().int().positive().optional(),
        board_id: z.number().int().positive().optional(),
        column_ids: z.array(z.number().int().positive()).optional(),
        exclude_column_ids: z.array(z.number().int().positive()).optional(),
        owner_ids: z.array(z.number().int().positive()).optional(),
        member_ids: z.array(z.number().int().positive()).optional(),
        states: z.array(z.number().int().min(1).max(3)).optional(),
        created_after: z.string().datetime().optional(),
        updated_after: z.string().datetime().optional(),
        additional_card_fields: z.enum(["description"]).optional(),
        limit: z.number().int().min(1).max(100).default(100),
        offset: z.number().int().min(0).default(0),
        max_pages: z.number().int().min(1).max(25).default(10),
        compact: z.boolean().default(true),
      },
    },
    async ({ max_pages, compact, ...filters }) => {
      try {
        return jsonResult(await client.listCards({ ...filters, maxPages: max_pages, compact }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "get_card",
    {
      title: "Get Kaiten card",
      description: "Get the full current Kaiten card including dependencies, custom fields, owner, tags, and description.",
      inputSchema: {
        card_id: z.number().int().positive(),
      },
    },
    async ({ card_id }) => {
      try {
        return jsonResult(await client.getCard(card_id));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "get_card_comments",
    {
      title: "Get Kaiten card comments",
      description: "Get comments for an ambiguous or shortlisted card. Comments may contain personal data; use only when necessary.",
      inputSchema: {
        card_id: z.number().int().positive(),
        limit: z.number().int().min(1).max(100).default(100),
        offset: z.number().int().min(0).default(0),
      },
    },
    async ({ card_id, limit, offset }) => {
      try {
        return jsonResult(await client.getCardComments(card_id, { limit, offset }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "get_card_location_history",
    {
      title: "Get Kaiten card location history",
      description: "Get board, lane, column, and sprint movement history for a card.",
      inputSchema: {
        card_id: z.number().int().positive(),
      },
    },
    async ({ card_id }) => {
      try {
        return jsonResult(await client.getCardLocationHistory(card_id));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}

async function main() {
  const config = loadConfig();
  const client = new KaitenClient(config);
  const server = createServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    // MCP stdio reserves stdout for protocol traffic.
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
