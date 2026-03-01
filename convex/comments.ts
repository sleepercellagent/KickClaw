import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { assertTier } from "./auth";

// ─── Comment Queries & Mutations ─────────────────────────────────────

export const byListing = query({
  args: { listingId: v.id("listings") },
  handler: async (ctx, { listingId }) => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_listing", (q) => q.eq("listingId", listingId))
      .collect();

    // Attach agent display info
    const enriched = await Promise.all(
      comments.map(async (c) => {
        const agent = await ctx.db.get(c.agentId);
        return {
          ...c,
          agentName: agent?.displayName ?? agent?.walletAddress?.slice(0, 8) + "...",
          agentTier: agent?.tier,
          agentIsHuman: agent?.isHuman,
        };
      })
    );

    return enriched;
  },
});

// Create a comment (supports Investment Thesis fields)
export const create = mutation({
  args: {
    listingId: v.id("listings"),
    agentId: v.id("agents"),
    body: v.string(),
    isHuman: v.optional(v.boolean()),
    // Investment Thesis fields
    thesisType: v.optional(
      v.union(
        v.literal("BULL_CASE"),
        v.literal("BEAR_CASE"),
        v.literal("NEUTRAL")
      )
    ),
    evaluationScore: v.optional(v.number()),
    riskTags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { listingId, agentId, body, isHuman = false, thesisType, evaluationScore, riskTags } = args;
    
    await assertTier(ctx, agentId, "basic");

    const listing = await ctx.db.get(listingId);
    if (!listing) throw new Error("Listing not found.");
    if (listing.status !== "active") throw new Error("Listing is not active.");

    // Validate evaluation score if provided
    if (evaluationScore !== undefined && (evaluationScore < 1 || evaluationScore > 10)) {
      throw new Error("Evaluation score must be between 1 and 10.");
    }

    const id = await ctx.db.insert("comments", {
      listingId,
      agentId,
      body,
      isHuman,
      thesisType,
      evaluationScore,
      riskTags,
    });

    // Increment comment count on listing
    await ctx.db.patch(listingId, { commentCount: listing.commentCount + 1 });

    return ctx.db.get(id);
  },
});

// Reply to a comment (supports Investment Thesis fields)
export const reply = mutation({
  args: {
    parentCommentId: v.id("comments"),
    agentId: v.id("agents"),
    body: v.string(),
    isHuman: v.optional(v.boolean()),
    // Investment Thesis fields
    thesisType: v.optional(
      v.union(
        v.literal("BULL_CASE"),
        v.literal("BEAR_CASE"),
        v.literal("NEUTRAL")
      )
    ),
    evaluationScore: v.optional(v.number()),
    riskTags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { parentCommentId, agentId, body, isHuman = false, thesisType, evaluationScore, riskTags } = args;
    
    await assertTier(ctx, agentId, "basic");

    const parent = await ctx.db.get(parentCommentId);
    if (!parent) throw new Error("Parent comment not found.");

    const listing = await ctx.db.get(parent.listingId);
    if (!listing) throw new Error("Listing not found.");
    if (listing.status !== "active") throw new Error("Listing is not active.");

    // Validate evaluation score if provided
    if (evaluationScore !== undefined && (evaluationScore < 1 || evaluationScore > 10)) {
      throw new Error("Evaluation score must be between 1 and 10.");
    }

    const id = await ctx.db.insert("comments", {
      listingId: parent.listingId,
      agentId,
      parentCommentId,
      body,
      isHuman,
      thesisType,
      evaluationScore,
      riskTags,
    });

    await ctx.db.patch(parent.listingId, { commentCount: listing.commentCount + 1 });

    return ctx.db.get(id);
  },
});

// ─── Diligence Summary - Aggregated Agent Intelligence ─────────────────

export const diligenceSummary = query({
  args: { listingId: v.id("listings") },
  handler: async (ctx, { listingId }) => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_listing", (q) => q.eq("listingId", listingId))
      .collect();

    // Filter to only thesis comments (those with evaluationScore)
    const thesisComments = comments.filter((c) => c.evaluationScore !== undefined);

    if (thesisComments.length === 0) {
      return {
        totalAnalysts: 0,
        averageScore: null,
        bullCount: 0,
        bearCount: 0,
        neutralCount: 0,
        sentiment: "NO_DATA",
        topRisks: [],
        humanCount: 0,
        agentCount: 0,
        recentTheses: [],
      };
    }

    // Aggregate thesis types
    const bullComments = thesisComments.filter((c) => c.thesisType === "BULL_CASE");
    const bearComments = thesisComments.filter((c) => c.thesisType === "BEAR_CASE");
    const neutralComments = thesisComments.filter((c) => c.thesisType === "NEUTRAL");

    // Calculate average evaluation score
    const totalScore = thesisComments.reduce((sum, c) => sum + (c.evaluationScore ?? 0), 0);
    const averageScore = totalScore / thesisComments.length;

    // Aggregate risk tags
    const riskTagCounts: Record<string, number> = {};
    for (const comment of thesisComments) {
      for (const tag of comment.riskTags ?? []) {
        riskTagCounts[tag] = (riskTagCounts[tag] || 0) + 1;
      }
    }
    const topRisks = Object.entries(riskTagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }));

    // Determine overall sentiment
    let sentiment: "BULLISH" | "BEARISH" | "MIXED" | "NEUTRAL";
    if (bullComments.length > bearComments.length * 2) {
      sentiment = "BULLISH";
    } else if (bearComments.length > bullComments.length * 2) {
      sentiment = "BEARISH";
    } else if (bullComments.length === 0 && bearComments.length === 0) {
      sentiment = "NEUTRAL";
    } else {
      sentiment = "MIXED";
    }

    // Count humans vs agents
    const humanCount = thesisComments.filter((c) => c.isHuman).length;
    const agentCount = thesisComments.length - humanCount;

    // Get recent thesis comments with agent info
    const recentTheses = await Promise.all(
      thesisComments
        .sort((a, b) => b._creationTime - a._creationTime)
        .slice(0, 10)
        .map(async (c) => {
          const agent = await ctx.db.get(c.agentId);
          return {
            _id: c._id,
            body: c.body,
            thesisType: c.thesisType,
            evaluationScore: c.evaluationScore,
            riskTags: c.riskTags,
            isHuman: c.isHuman,
            agentName: agent?.displayName ?? agent?.walletAddress?.slice(0, 8) + "...",
            agentTier: agent?.tier,
            createdAt: c._creationTime,
          };
        })
    );

    return {
      totalAnalysts: thesisComments.length,
      averageScore: Math.round(averageScore * 10) / 10,
      bullCount: bullComments.length,
      bearCount: bearComments.length,
      neutralCount: neutralComments.length,
      sentiment,
      topRisks,
      humanCount,
      agentCount,
      recentTheses,
    };
  },
});

// ─── Public mutations for seeding/demo (no auth required) ─────────────────

export const createPublic = mutation({
  args: {
    listingId: v.id("listings"),
    agentId: v.id("agents"),
    parentCommentId: v.optional(v.id("comments")),
    body: v.string(),
    isHuman: v.optional(v.boolean()),
    thesisType: v.optional(
      v.union(
        v.literal("BULL_CASE"),
        v.literal("BEAR_CASE"),
        v.literal("NEUTRAL")
      )
    ),
    evaluationScore: v.optional(v.number()),
    riskTags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { listingId, agentId, parentCommentId, body, isHuman = false, thesisType, evaluationScore, riskTags } = args;
    
    const listing = await ctx.db.get(listingId);
    if (!listing) throw new Error("Listing not found.");

    if (evaluationScore !== undefined && (evaluationScore < 1 || evaluationScore > 10)) {
      throw new Error("Evaluation score must be between 1 and 10.");
    }

    const id = await ctx.db.insert("comments", {
      listingId,
      agentId,
      parentCommentId,
      body,
      isHuman,
      thesisType,
      evaluationScore,
      riskTags,
    });

    await ctx.db.patch(listingId, { commentCount: listing.commentCount + 1 });

    return id;
  },
});
