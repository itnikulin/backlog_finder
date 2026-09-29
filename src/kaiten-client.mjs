const DEFAULT_RETRY_DELAYS_MS = [250, 750, 1500];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asSearchParams(query = {}) {
  const params = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(query)) {
    if (rawValue === undefined || rawValue === null || rawValue === "") continue;
    const value = Array.isArray(rawValue) ? rawValue.join(",") : String(rawValue);
    params.set(key, value);
  }

  return params;
}

export function compactCard(card) {
  return {
    id: card.id,
    uid: card.uid,
    title: card.title,
    state: card.state,
    archived: card.archived,
    board_id: card.board_id ?? card.board?.id,
    board: card.board?.title,
    column_id: card.column_id ?? card.column?.id,
    column: card.column?.title,
    lane_id: card.lane_id ?? card.lane?.id,
    lane: card.lane?.title,
    owner_id: card.owner_id ?? card.owner?.id,
    owner: card.owner?.full_name,
    size: card.size_text ?? card.size,
    estimate_workload: card.estimate_workload,
    due_date: card.due_date,
    planned_start: card.planned_start,
    planned_end: card.planned_end,
    blocked: card.blocked,
    blocking_card: card.blocking_card,
    parents_ids: card.parents_ids,
    children_ids: card.children_ids,
    comments_total: card.comments_total,
    updated: card.updated,
    properties: card.properties,
  };
}

export class KaitenClient {
  constructor(config, options = {}) {
    this.baseUrl = config.baseUrl;
    this.token = config.token;
    if (!Array.isArray(config.allowedBoardIds) || !config.allowedBoardIds.length ||
        config.allowedBoardIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
      throw new Error("KAITEN_ALLOWED_BOARD_IDS is required and must contain positive integer IDs");
    }
    this.allowedBoardIds = new Set(config.allowedBoardIds);
    this.apiVersion = config.apiVersion || "latest";
    this.requestTimeoutMs = config.requestTimeoutMs || 30_000;
    this.fetch = options.fetch || globalThis.fetch;
    this.retryDelaysMs = options.retryDelaysMs || DEFAULT_RETRY_DELAYS_MS;

    if (typeof this.fetch !== "function") {
      throw new Error("A fetch implementation is required");
    }
  }

  buildUrl(path, query) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`/api/${this.apiVersion}${normalizedPath}`, this.baseUrl);
    const params = asSearchParams(query);
    url.search = params.toString();
    return url;
  }

  async #request(path, { query } = {}) {
    const url = this.buildUrl(path, query);

    for (let attempt = 0; ; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

      try {
        const response = await this.fetch(url, {
          method: "GET",
          redirect: "error",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${this.token}`,
          },
          signal: controller.signal,
        });

        if ((response.status === 429 || response.status >= 500) && attempt < this.retryDelaysMs.length) {
          await sleep(this.retryDelaysMs[attempt]);
          continue;
        }

        if (!response.ok) {
          // Do not relay potentially sensitive upstream bodies into model context.
          throw new Error(`Kaiten API ${response.status}`);
        }

        if (response.status === 204) return null;
        return await response.json();
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  assertBoard(boardId) {
    if (!this.allowedBoardIds.has(boardId)) throw new Error("Board outside configured Kaiten scope");
  }

  scopedSpace(space) {
    const boards = (Array.isArray(space?.boards) ? space.boards : [])
      .filter((board) => this.allowedBoardIds.has(board.board_id ?? board.id))
      .map((board) => ({ id: board.board_id ?? board.id, title: board.title }));
    // Never return nested cards, unrelated boards, descriptions or email keys.
    return boards.length ? { id: space.id, title: space.title, boards } : null;
  }

  async listSpaces({ limit = 100, offset = 0, maxPages = 10 } = {}) {
    const spaces = [];
    let pagesFetched = 0;
    let scanned = 0;
    let fullPage = false;
    while (pagesFetched < maxPages) {
      const page = await this.#request("/spaces", { query: { limit, offset: offset + scanned } });
      if (!Array.isArray(page)) throw new Error("Unexpected Kaiten space list response");
      spaces.push(...page.map((space) => this.scopedSpace(space)).filter(Boolean));
      scanned += page.length;
      pagesFetched += 1;
      fullPage = page.length === limit;
      if (!fullPage) break;
    }
    return { spaces, page_size: limit, pages_fetched: pagesFetched,
      truncated: fullPage && pagesFetched === maxPages, next_offset: offset + scanned };
  }

  async getSpace(spaceId) {
    const space = this.scopedSpace(await this.#request(`/spaces/${spaceId}`));
    if (!space) throw new Error("Space outside configured Kaiten scope");
    return space;
  }

  async getCard(cardId) {
    // Resolve current membership on every call; never trust a stale session cache.
    const card = await this.#request(`/cards/${cardId}`, { query: { broken_api: false } });
    this.assertBoard(card?.board_id ?? card?.board?.id);
    return card;
  }

  async getCardComments(cardId, { limit = 100, offset = 0 } = {}) {
    await this.getCard(cardId);
    const comments = await this.#request(`/cards/${cardId}/comments`, { query: { limit, offset } });
    await this.getCard(cardId);
    return comments;
  }

  async getCardLocationHistory(cardId) {
    await this.getCard(cardId);
    const history = await this.#request(`/cards/${cardId}/location-history`);
    await this.getCard(cardId);
    if (!Array.isArray(history)) throw new Error("Unexpected Kaiten history response");
    return history.filter((event) => this.allowedBoardIds.has(event.board_id));
  }

  async listCards({ maxPages = 10, compact = true, ...filters } = {}) {
    this.assertBoard(filters.board_id);
    const pageSize = Math.min(Math.max(Number(filters.limit || 100), 1), 100);
    const firstOffset = Math.max(Number(filters.offset || 0), 0);
    const cards = [];
    let pagesFetched = 0;

    while (pagesFetched < maxPages) {
      const offset = firstOffset + pagesFetched * pageSize;
      const page = await this.#request("/cards", {
        query: {
          ...filters,
          limit: pageSize,
          offset,
          broken_api: false,
        },
      });

      if (!Array.isArray(page)) {
        throw new Error("Unexpected Kaiten card list response");
      }

      // Fail closed if the API ignores the board filter or omits board identity.
      for (const card of page) {
        if ((card.board_id ?? card.board?.id) !== filters.board_id) {
          throw new Error("Card list outside configured Kaiten scope");
        }
      }

      cards.push(...page);
      pagesFetched += 1;
      if (page.length < pageSize) break;
    }

    return {
      cards: compact ? cards.map(compactCard) : cards,
      page_size: pageSize,
      pages_fetched: pagesFetched,
      truncated: pagesFetched === maxPages && cards.length === pageSize * maxPages,
      next_offset: firstOffset + cards.length,
    };
  }
}
