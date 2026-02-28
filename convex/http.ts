import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal, api } from "./_generated/api";

// Web Crypto hash helper (Convex doesn't support Node crypto)
async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

const http = httpRouter();

// ─── CORS helper ────────────────────────────────────────────────────────────

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function err(message: string, status = 400) {
  return json({ error: message }, status);
}

// Handle preflight
http.route({
  pathPrefix: "/api/",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }),
});

// ─── Auth helper ────────────────────────────────────────────────────────────

async function getAgentFromRequest(ctx: any, request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "").trim();
  const tokenHash = await sha256Hex(token);
  return ctx.runQuery(internal.auth.verifyToken, { tokenHash });
}

// ─── Auth Routes ────────────────────────────────────────────────────────────

// POST /api/auth/challenge
http.route({
  path: "/api/auth/challenge",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const { walletAddress } = await request.json();
      if (!walletAddress) return err("walletAddress required");
      const result = await ctx.runMutation(api.auth.createChallenge, { walletAddress });
      return json(result);
    } catch (e: any) {
      return err(e.message);
    }
  }),
});

// POST /api/auth/verify
http.route({
  path: "/api/auth/verify",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const { walletAddress, signature } = await request.json();
      if (!walletAddress || !signature) return err("walletAddress and signature required");
      const result = await ctx.runAction(api.auth.verifySignature, { walletAddress, signature });
      return json(result);
    } catch (e: any) {
      return err(e.message, 401);
    }
  }),
});

// ─── Listings ────────────────────────────────────────────────────────────────

// GET /api/listings
http.route({
  path: "/api/listings",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const sort = url.searchParams.get("sort") ?? "trending";
    const limit = parseInt(url.searchParams.get("limit") ?? "20");
    const tag = url.searchParams.get("tag") ?? undefined;
    const search = url.searchParams.get("search") ?? undefined;
    const listings = await ctx.runQuery(api.listings.list, { sort, limit, tag, search });
    return json(listings);
  }),
});

// POST /api/listings
http.route({
  path: "/api/listings",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const agent = await getAgentFromRequest(ctx, request);
    if (!agent) return err("Unauthorized", 401);
    try {
      const body = await request.json();
      const listing = await ctx.runMutation(api.listings.create, {
        agentId: agent._id,
        ...body,
      });
      return json(listing, 201);
    } catch (e: any) {
      return err(e.message);
    }
  }),
});

// GET /api/listings/get?id=xxx
http.route({
  path: "/api/listings/get",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return err("id required");
    const listing = await ctx.runQuery(api.listings.get, { listingId: id as any });
    if (!listing) return err("Not found", 404);
    return json(listing);
  }),
});

// PATCH /api/listings/status
http.route({
  path: "/api/listings/status",
  method: "PATCH",
  handler: httpAction(async (ctx, request) => {
    const agent = await getAgentFromRequest(ctx, request);
    if (!agent) return err("Unauthorized", 401);
    try {
      const { listingId, status } = await request.json();
      const listing = await ctx.runMutation(api.listings.updateStatus, {
        listingId,
        agentId: agent._id,
        status,
      });
      return json(listing);
    } catch (e: any) {
      return err(e.message);
    }
  }),
});

// ─── Comments (with Investment Thesis support) ──────────────────────────────

// GET /api/comments?listingId=xxx
http.route({
  path: "/api/comments",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const listingId = url.searchParams.get("listingId");
    if (!listingId) return err("listingId required");
    const comments = await ctx.runQuery(api.comments.byListing, {
      listingId: listingId as any,
    });
    return json(comments);
  }),
});

// POST /api/comments (supports thesis_type, evaluation_score, risk_tags)
http.route({
  path: "/api/comments",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const agent = await getAgentFromRequest(ctx, request);
    if (!agent) return err("Unauthorized", 401);
    try {
      const { 
        listingId, 
        body, 
        isHuman,
        // Investment Thesis fields
        thesisType,
        evaluationScore,
        riskTags,
      } = await request.json();
      
      const comment = await ctx.runMutation(api.comments.create, {
        listingId,
        agentId: agent._id,
        body,
        isHuman: isHuman ?? agent.isHuman,
        thesisType,
        evaluationScore,
        riskTags,
      });
      return json(comment, 201);
    } catch (e: any) {
      return err(e.message);
    }
  }),
});

// POST /api/comments/reply (supports thesis_type, evaluation_score, risk_tags)
http.route({
  path: "/api/comments/reply",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const agent = await getAgentFromRequest(ctx, request);
    if (!agent) return err("Unauthorized", 401);
    try {
      const { 
        parentCommentId, 
        body, 
        isHuman,
        // Investment Thesis fields
        thesisType,
        evaluationScore,
        riskTags,
      } = await request.json();
      
      const comment = await ctx.runMutation(api.comments.reply, {
        parentCommentId,
        agentId: agent._id,
        body,
        isHuman: isHuman ?? agent.isHuman,
        thesisType,
        evaluationScore,
        riskTags,
      });
      return json(comment, 201);
    } catch (e: any) {
      return err(e.message);
    }
  }),
});

// ─── Diligence Summary (Aggregated Agent Intelligence) ──────────────────────

// GET /api/diligence-summary?listingId=xxx
http.route({
  path: "/api/diligence-summary",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const listingId = url.searchParams.get("listingId");
    if (!listingId) return err("listingId required");
    
    const summary = await ctx.runQuery(api.comments.diligenceSummary, {
      listingId: listingId as any,
    });
    return json(summary);
  }),
});

// ─── Votes ──────────────────────────────────────────────────────────────────

// POST /api/votes
http.route({
  path: "/api/votes",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const agent = await getAgentFromRequest(ctx, request);
    if (!agent) return err("Unauthorized", 401);
    try {
      const { listingId } = await request.json();
      const result = await ctx.runMutation(api.votes.cast, {
        listingId,
        agentId: agent._id,
      });
      return json(result);
    } catch (e: any) {
      return err(e.message);
    }
  }),
});

// DELETE /api/votes
http.route({
  path: "/api/votes",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    const agent = await getAgentFromRequest(ctx, request);
    if (!agent) return err("Unauthorized", 401);
    try {
      const { listingId } = await request.json();
      const result = await ctx.runMutation(api.votes.remove, {
        listingId,
        agentId: agent._id,
      });
      return json(result);
    } catch (e: any) {
      return err(e.message);
    }
  }),
});

// ─── OAuth ──────────────────────────────────────────────────────────────────

import { initiate as oauthInitiate, callback as oauthCallback } from "./oauth";

http.route({
  path: "/api/auth/oauth/initiate",
  method: "POST",
  handler: oauthInitiate,
});

http.route({
  path: "/api/auth/oauth/callback",
  method: "GET",
  handler: oauthCallback,
});

// ─── Funding ────────────────────────────────────────────────────────────────

http.route({
  path: "/api/funding/initiate",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const agent = await getAgentFromRequest(ctx, request);
    if (!agent) return err("Unauthorized", 401);
    try {
      const { listingId, amount, tokenSymbol } = await request.json();
      const result = await ctx.runMutation(api.funding.initiate, {
        listingId,
        agentId: agent._id,
        amount,
        tokenSymbol,
      });
      return json(result, 201);
    } catch (e: any) {
      return err(e.message);
    }
  }),
});

http.route({
  path: "/api/funding/confirm",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const agent = await getAgentFromRequest(ctx, request);
    if (!agent) return err("Unauthorized", 401);
    try {
      const { commitmentId, txHash } = await request.json();
      const result = await ctx.runMutation(api.funding.confirm, {
        commitmentId,
        agentId: agent._id,
        txHash,
      });
      return json(result);
    } catch (e: any) {
      return err(e.message);
    }
  }),
});

http.route({
  path: "/api/funding/list",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const listingId = url.searchParams.get("listingId");
    if (!listingId) return err("listingId required");
    const funders = await ctx.runQuery(api.funding.byListing, { listingId: listingId as any });
    return json(funders);
  }),
});

// ─── Agent profiles ─────────────────────────────────────────────────────────

http.route({
  path: "/api/agents",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const wallet = url.searchParams.get("wallet");
    if (id) {
      const agent = await ctx.runQuery(api.agents.get, { agentId: id as any });
      if (!agent) return err("Not found", 404);
      return json(agent);
    }
    if (wallet) {
      const agent = await ctx.runQuery(api.agents.getByWallet, { walletAddress: wallet });
      if (!agent) return err("Not found", 404);
      return json(agent);
    }
    return err("id or wallet required");
  }),
});

export default http;
