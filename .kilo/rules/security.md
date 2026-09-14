# Product data boundary

- Use only the `internal-ai` model provider for any product or backlog data.
- Never copy Kaiten content into external websites, public model providers, or Kilo Gateway tools.
- Never read `.env` or print environment variables, tokens, or authorization headers.
- Never write secrets into files, logs, comments, prompts, or tool output.
- Kaiten is read-only in the advisor phase. Do not simulate writes with shell commands or direct HTTP calls.
- If an operation would change Kaiten, produce a proposed change set and ask for explicit approval instead.
