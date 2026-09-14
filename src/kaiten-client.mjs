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

  async request(path, { query, method = "GET" } = {}) {
    const url = this.buildUrl(path, query);

    for (let attempt = 0; ; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

      try {
        const response = await this.fetch(url, {
          method,
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
          const body = await response.text();
          const safeBody = body.slice(0, 500);
          throw new Error(`Kaiten API ${response.status}: ${safeBody || response.statusText}`);
        }

        if (response.status === 204) return null;
        return await response.json();
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  listSpaces() {
    return this.request("/spaces");
  }

  getSpace(spaceId) {
    return this.request(`/spaces/${spaceId}`);
  }

  getCard(cardId) {
    return this.request(`/cards/${cardId}`, { query: { broken_api: false } });
  }

  getCardComments(cardId, { limit = 100, offset = 0 } = {}) {
    return this.request(`/cards/${cardId}/comments`, { query: { limit, offset } });
  }

  getCardLocationHistory(cardId) {
    return this.request(`/cards/${cardId}/location-history`);
  }

  async listCards({ maxPages = 10, compact = true, ...filters } = {}) {
    const pageSize = Math.min(Math.max(Number(filters.limit || 100), 1), 100);
    const firstOffset = Math.max(Number(filters.offset || 0), 0);
    const cards = [];
    let pagesFetched = 0;

    while (pagesFetched < maxPages) {
      const offset = firstOffset + pagesFetched * pageSize;
      const page = await this.request("/cards", {
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
