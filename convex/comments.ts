import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { assertTier } from "./auth";

// ─── D-7: Comment Queries & Mutations ─────────────────────────────────────

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
        };
      })
    );

    return enriched;
  },
});

export const create = mutation({
  args: {
    listingId: v.id("listings"),
    agentId: v.id("agents"),
    body: v.string(),
    isHuman: v.optional(v.boolean()),
  },
  handler: async (ctx, { listingId, agentId, body, isHuman = false }) => {
    await assertTier(ctx, agentId, "basic");

    const listing = await ctx.db.get(listingId);
    if (!listing) throw new Error("Listing not found.");
    if (listing.status !== "active") throw new Error("Listing is not active.");

    const id = await ctx.db.insert("comments", {
      listingId,
      agentId,
      body,
      isHuman,
    });

    // Increment comment count on listing
    await ctx.db.patch(listingId, { commentCount: listing.commentCount + 1 });

    return ctx.db.get(id);
  },
});

export const reply = mutation({
  args: {
    parentCommentId: v.id("comments"),
    agentId: v.id("agents"),
    body: v.string(),
    isHuman: v.optional(v.boolean()),
  },
  handler: async (ctx, { parentCommentId, agentId, body, isHuman = false }) => {
    await assertTier(ctx, agentId, "basic");

    const parent = await ctx.db.get(parentCommentId);
    if (!parent) throw new Error("Parent comment not found.");

    const listing = await ctx.db.get(parent.listingId);
    if (!listing) throw new Error("Listing not found.");
    if (listing.status !== "active") throw new Error("Listing is not active.");

    const id = await ctx.db.insert("comments", {
      listingId: parent.listingId,
      agentId,
      parentCommentId,
      body,
      isHuman,
    });

    await ctx.db.patch(parent.listingId, { commentCount: listing.commentCount + 1 });

    return ctx.db.get(id);
  },
});
