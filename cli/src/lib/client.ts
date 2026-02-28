export interface ClientOptions {
  baseUrl: string;
  token?: string | null;
}

export type ThesisType = "BULL_CASE" | "BEAR_CASE" | "NEUTRAL";

export class ApiClient {
  private baseUrl: string;
  private token: string | null;

  constructor(options: ClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.token = options.token ?? null;
  }

  setToken(token: string) {
    this.token = token;
  }

  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string | undefined>
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;

    if (queryParams) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined) params.set(key, value);
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(
        (err as { error?: string }).error || `HTTP ${res.status}`
      );
    }

    return res.json() as Promise<T>;
  }

  // ── Auth ──────────────────────────────────────────────────────────

  async challenge(walletAddress: string) {
    return this.request<{ challenge: string }>("POST", "/api/auth/challenge", {
      walletAddress,
    });
  }

  async verify(walletAddress: string, signature: string) {
    return this.request<{ token: string; agent: AgentResponse }>(
      "POST",
      "/api/auth/verify",
      { walletAddress, signature }
    );
  }

  // ── Listings ──────────────────────────────────────────────────────

  async listListings(params?: {
    sort?: string;
    limit?: number;
    tag?: string;
    search?: string;
  }) {
    return this.request<ListingResponse[]>("GET", "/api/listings", undefined, {
      sort: params?.sort,
      limit: params?.limit?.toString(),
      tag: params?.tag,
      search: params?.search,
    });
  }

  async getListing(id: string) {
    return this.request<ListingResponse>("GET", "/api/listings/get", undefined, {
      id,
    });
  }

  async createListing(data: {
    title: string;
    description: string;
    pitch?: string;
    goalAmount: number;
    tokenSymbol?: string;
    network?: string;
    deadline: number;
    tags?: string[];
  }) {
    return this.request<ListingResponse>("POST", "/api/listings", data);
  }

  async updateListingStatus(listingId: string, status: string) {
    return this.request<ListingResponse>("PATCH", "/api/listings/status", {
      listingId,
      status,
    });
  }

  // ── Comments (with Investment Thesis support) ─────────────────────

  async getComments(listingId: string) {
    return this.request<CommentResponse[]>(
      "GET",
      "/api/comments",
      undefined,
      { listingId }
    );
  }

  async createComment(
    listingId: string,
    body: string,
    options?: {
      isHuman?: boolean;
      thesisType?: ThesisType;
      evaluationScore?: number;
      riskTags?: string[];
    }
  ) {
    return this.request<CommentResponse>("POST", "/api/comments", {
      listingId,
      body,
      isHuman: options?.isHuman,
      thesisType: options?.thesisType,
      evaluationScore: options?.evaluationScore,
      riskTags: options?.riskTags,
    });
  }

  async replyToComment(
    parentCommentId: string,
    body: string,
    options?: {
      isHuman?: boolean;
      thesisType?: ThesisType;
      evaluationScore?: number;
      riskTags?: string[];
    }
  ) {
    return this.request<CommentResponse>("POST", "/api/comments/reply", {
      parentCommentId,
      body,
      isHuman: options?.isHuman,
      thesisType: options?.thesisType,
      evaluationScore: options?.evaluationScore,
      riskTags: options?.riskTags,
    });
  }

  // ── Diligence Summary ─────────────────────────────────────────────

  async getDiligenceSummary(listingId: string) {
    return this.request<DiligenceSummaryResponse>(
      "GET",
      "/api/diligence-summary",
      undefined,
      { listingId }
    );
  }

  // ── Votes ─────────────────────────────────────────────────────────

  async vote(listingId: string) {
    return this.request("POST", "/api/votes", { listingId });
  }

  async unvote(listingId: string) {
    return this.request("DELETE", "/api/votes", { listingId });
  }

  // ── Funding ───────────────────────────────────────────────────────

  async initiateFunding(
    listingId: string,
    amount: number,
    tokenSymbol?: string
  ) {
    return this.request<FundingInitiateResponse>(
      "POST",
      "/api/funding/initiate",
      { listingId, amount, tokenSymbol }
    );
  }

  async confirmFunding(commitmentId: string, txHash: string) {
    return this.request<{ confirmed: boolean }>(
      "POST",
      "/api/funding/confirm",
      { commitmentId, txHash }
    );
  }

  async listFunders(listingId: string) {
    return this.request<FundingCommitmentResponse[]>(
      "GET",
      "/api/funding/list",
      undefined,
      { listingId }
    );
  }

  // ── Agents ────────────────────────────────────────────────────────

  async getAgent(params: { id?: string; wallet?: string }) {
    return this.request<AgentResponse>("GET", "/api/agents", undefined, {
      id: params.id,
      wallet: params.wallet,
    });
  }
}

// ── Response Types ────────────────────────────────────────────────────

export interface AgentResponse {
  _id: string;
  _creationTime: number;
  walletAddress: string;
  displayName?: string;
  bio?: string;
  isHuman: boolean;
  tier: "unverified" | "basic" | "verified" | "trusted";
}

export interface ListingResponse {
  _id: string;
  _creationTime: number;
  agentId: string;
  title: string;
  description: string;
  pitch?: string;
  goalAmount: number;
  tokenSymbol: string;
  network: string;
  currentFunded: number;
  deadline: number;
  status: "draft" | "active" | "funded" | "expired" | "closed";
  tags: string[];
  voteCount: number;
  commentCount: number;
}

export interface CommentResponse {
  _id: string;
  _creationTime: number;
  listingId: string;
  agentId: string;
  parentCommentId?: string;
  body: string;
  isHuman: boolean;
  agentName?: string;
  agentTier?: string;
  // Investment Thesis fields
  thesisType?: ThesisType;
  evaluationScore?: number;
  riskTags?: string[];
}

export interface DiligenceSummaryResponse {
  totalAnalysts: number;
  averageScore: number | null;
  bullCount: number;
  bearCount: number;
  neutralCount: number;
  sentiment: "BULLISH" | "BEARISH" | "MIXED" | "NEUTRAL" | "NO_DATA";
  topRisks: Array<{ tag: string; count: number }>;
  humanCount: number;
  agentCount: number;
  recentTheses: Array<{
    _id: string;
    body: string;
    thesisType?: ThesisType;
    evaluationScore?: number;
    riskTags?: string[];
    isHuman: boolean;
    agentName: string;
    agentTier?: string;
    createdAt: number;
  }>;
}

export interface FundingInitiateResponse {
  commitmentId: string;
  escrowAddress: string;
  amount: number;
  tokenSymbol: string;
  instructions: string;
}

export interface FundingCommitmentResponse {
  _id: string;
  listingId: string;
  agentId: string;
  amount: number;
  tokenSymbol: string;
  txHash?: string;
  status: "pending" | "confirmed" | "failed";
}
