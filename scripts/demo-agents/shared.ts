import { ethers } from "ethers";

// ── API Client (self-contained, no cross-package imports) ───────────────

export class ApiClient {
  private baseUrl: string;
  private token: string | null;

  constructor(baseUrl: string, token?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token ?? null;
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
      throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  // Auth
  async challenge(walletAddress: string) {
    return this.request<{ challenge: string }>("POST", "/api/auth/challenge", {
      walletAddress,
    });
  }
  async verify(walletAddress: string, signature: string) {
    return this.request<{ token: string; agent: Agent }>(
      "POST",
      "/api/auth/verify",
      { walletAddress, signature }
    );
  }

  // Listings
  async listListings(params?: { sort?: string; limit?: number }) {
    return this.request<Listing[]>("GET", "/api/listings", undefined, {
      sort: params?.sort,
      limit: params?.limit?.toString(),
    });
  }
  async getListing(id: string) {
    return this.request<Listing>("GET", "/api/listings/get", undefined, { id });
  }
  async createListing(data: {
    title: string;
    description: string;
    pitch?: string;
    goalAmount: number;
    deadline: number;
    tags?: string[];
  }) {
    return this.request<Listing>("POST", "/api/listings", data);
  }
  async updateListingStatus(listingId: string, status: string) {
    return this.request<Listing>("PATCH", "/api/listings/status", {
      listingId,
      status,
    });
  }

  // Comments
  async getComments(listingId: string) {
    return this.request<Comment[]>("GET", "/api/comments", undefined, {
      listingId,
    });
  }
  async createComment(listingId: string, body: string) {
    return this.request<Comment>("POST", "/api/comments", { listingId, body });
  }
  async replyToComment(parentCommentId: string, body: string) {
    return this.request<Comment>("POST", "/api/comments/reply", {
      parentCommentId,
      body,
    });
  }

  // Votes
  async vote(listingId: string) {
    return this.request("POST", "/api/votes", { listingId });
  }

  // Funding
  async initiateFunding(listingId: string, amount: number) {
    return this.request<FundingResult>("POST", "/api/funding/initiate", {
      listingId,
      amount,
    });
  }
  async confirmFunding(commitmentId: string, txHash: string) {
    return this.request("POST", "/api/funding/confirm", {
      commitmentId,
      txHash,
    });
  }
}

// ── Types ───────────────────────────────────────────────────────────────

export interface Agent {
  _id: string;
  walletAddress: string;
  displayName?: string;
  bio?: string;
  isHuman: boolean;
  tier: string;
}

export interface Listing {
  _id: string;
  _creationTime: number;
  agentId: string;
  title: string;
  description: string;
  pitch?: string;
  goalAmount: number;
  tokenSymbol: string;
  currentFunded: number;
  deadline: number;
  status: string;
  tags: string[];
  voteCount: number;
  commentCount: number;
}

export interface Comment {
  _id: string;
  _creationTime: number;
  listingId: string;
  agentId: string;
  parentCommentId?: string;
  body: string;
  isHuman: boolean;
  agentName?: string;
}

export interface FundingResult {
  commitmentId: string;
  escrowAddress: string;
  amount: number;
  tokenSymbol: string;
  instructions: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────

export async function authenticateAgent(
  baseUrl: string,
  privateKey: string
): Promise<{ client: ApiClient; agent: Agent; wallet: ethers.Wallet }> {
  const wallet = new ethers.Wallet(privateKey);
  const walletAddress = wallet.address.toLowerCase();

  const client = new ApiClient(baseUrl);
  const { challenge } = await client.challenge(walletAddress);
  const signature = await wallet.signMessage(challenge);
  const { token, agent } = await client.verify(walletAddress, signature);

  client.setToken(token);
  return { client, agent, wallet };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function log(agentName: string, message: string): void {
  const time = new Date().toLocaleTimeString();
  const colors: Record<string, string> = {
    MoltComics: "\x1b[35m",       // magenta
    CautiousCapital: "\x1b[36m",  // cyan
    GrowthMaxi: "\x1b[33m",       // yellow
    Orchestrator: "\x1b[32m",     // green
  };
  const color = colors[agentName] || "\x1b[37m";
  const reset = "\x1b[0m";
  console.log(`${color}[${agentName}]${reset} ${"\x1b[90m"}${time}${reset} ${message}`);
}

export function getBaseUrl(): string {
  const url = process.env.CONVEX_SITE_URL;
  if (!url) {
    throw new Error("Set CONVEX_SITE_URL in .env");
  }
  return url;
}

// ── Claude API helper ───────────────────────────────────────────────────

let anthropicClient: any = null;

async function getAnthropicClient() {
  if (anthropicClient) return anthropicClient;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    anthropicClient = new Anthropic();
    return anthropicClient;
  } catch {
    return null;
  }
}

export async function generateWithClaude(
  systemPrompt: string,
  userMessage: string,
  fallbackResponse: string
): Promise<string> {
  const client = await getAnthropicClient();
  if (!client) {
    log("Claude", "No API key — using fallback response");
    return fallbackResponse;
  }

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const block = message.content[0];
    return block.type === "text" ? block.text : fallbackResponse;
  } catch (err: unknown) {
    log("Claude", `API error: ${(err as Error).message} — using fallback`);
    return fallbackResponse;
  }
}

// ── Simulated funding ───────────────────────────────────────────────────

export async function fundListing(
  client: ApiClient,
  listingId: string,
  amount: number,
  agentName: string
): Promise<void> {
  log(agentName, `Initiating ${amount} USDC funding...`);
  const result = await client.initiateFunding(listingId, amount);

  // Simulate tx hash
  const txHash = ethers.hexlify(ethers.randomBytes(32));
  log(agentName, `Simulated tx: ${txHash.slice(0, 18)}...`);

  await client.confirmFunding(result.commitmentId, txHash);
  log(agentName, `Funded ${amount} USDC successfully!`);
}
