# Backlog Finder

Privacy-first Product Backlog Advisor for Kilo Code. It reads live Kaiten data through a local read-only MCP server and sends analysis only to a separately configured internal AI endpoint.

Подробная русскоязычная инструкция: [`docs/SETUP_RU.md`](docs/SETUP_RU.md).

## Data boundary

There are two independent credentials:

- `KAITEN_API_TOKEN` is read only by the local MCP process and is used only against your Kaiten company domain.
- `INTERNAL_AI_API_KEY` is read by Kilo Code and is used only against the internal model endpoint configured in your untracked `kilo.jsonc`.

Do not paste either key into prompts, source files, GitHub settings visible to untrusted users, or logs.

## First setup

Requirements: Node.js 20+, Kilo Code, network access from your workstation to Kaiten and the internal AI endpoint.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Export the Kaiten credential in the shell that launches Kilo Code:

   ```bash
   export KAITEN_BASE_URL="https://your-company.kaiten.ru"
   export KAITEN_API_TOKEN="..."
   export INTERNAL_AI_API_KEY="..."
   ```

   Prefer a corporate secret manager. `.env` is ignored, but this project does not load it automatically.

3. Merge `config/kilo.global.example.jsonc` into your trusted global Kilo configuration at `~/.config/kilo/kilo.jsonc`. Replace:

   - the internal AI `baseURL`;
   - `replace-model-id` in both the selected model and provider model map;
   - `/ABSOLUTE/PATH/TO/backlog_finder` with the real clone location;
   - context and output limits if your model differs.

   The credentials remain `{env:...}` references. Kilo intentionally does not interpolate secrets in an untrusted project configuration.

4. Optionally copy `kilo.project.example.jsonc` to `kilo.jsonc` for project-level instructions and permissions. This file contains no secrets.

5. Ensure the Kilo Gateway session is logged out and autocomplete is disabled or configured for the same internal provider.

6. Fill in `context/product-passport.md`, especially outcomes, constraints, Kaiten space/board scope, and custom-property mapping.

7. Open the repository in Kilo Code and select the `backlog-advisor` agent.

## Suggested first prompts

- `List the available Kaiten spaces and show me which boards should be added to the product passport.`
- `/prioritize-backlog for board 123; exclude done cards.`
- `/build-roadmap for the next six months using Now / Next / Later.`
- `/update-product-context Retention is now more important than acquisition this quarter.`

## Advisor phase

The MCP server intentionally exposes only read tools. If a user asks to change Kaiten, the agent returns a proposed change set but cannot apply it. Write tools should be added only after the team validates the recommendations and agrees on confirmation and audit rules.

## MCP tools

- `list_spaces`
- `get_space`
- `list_cards`
- `get_card`
- `get_card_comments`
- `get_card_location_history`

The card list tool uses `GET /api/latest/cards` with pagination and compact responses. It can fetch up to 25 pages per call, but the agent is instructed to query narrow scopes and load details only when needed.

## Verification

```bash
npm run check
npm test
```

Tests use mocked HTTP responses and never require real credentials.
