# Backlog Finder

This repository contains a privacy-first product backlog advisor for Kilo Code.

## Non-negotiable constraints

- Never commit API tokens, credentials, real backlog exports, or personal data.
- Treat Kaiten as the source of truth for cards and statuses.
- Treat `context/product-passport.md` as the source of truth for product strategy.
- Keep Kaiten access read-only until write tools are explicitly implemented and approved.
- Do not send backlog content to public AI providers or the Kilo Gateway.
- Use only the configured internal AI provider for product data.

## Development

- Use Node.js 20 or newer.
- Run `npm test` and `npm run check` after changes.
- Keep MCP tool responses compact; fetch detailed descriptions and comments only on demand.
- Preserve pagination for all Kaiten list endpoints.
