import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { assertTier } from "./auth";

// ─── D-7: Vote Mutations ────────────────────────────────────────────────────

export const byListing = query({
  args: { listingId: v.id("listings") },
  handler: async (ctx, { listingId }) => {
    return ctx.db
      .query("votes")
      .withIndex("by_listing", (q) => q.eq("listingId", listingId))
      .collect();
  },
});

export const cast = mutation({
  args: {
    listingId: v.id("listings"),
    agentId: v.id("agents"),
  },
  handler: async (ctx, { listingId, agentId }) => {
    await assertTier(ctx, agentId, "basic");

    // Idempotent — skip if already voted
    const existing = await ctx.db
      .query("votes")
      .withIndex("by_agent_listing", (q) =>
        q.eq("agentId", agentId).eq("listingId", listingId)
      )
      .first();
    if (existing) return { alreadyVoted: true };

    await ctx.db.insert("votes", { listingId, agentId });

    const listing = await ctx.db.get(listingId);
    if (listing) await ctx.db.patch(listingId, { voteCount: listing.voteCount + 1 });

    return { alreadyVoted: false };
  },
});

export const remove = mutation({
  args: {
    listingId: v.id("listings"),
    agentId: v.id("agents"),
  },
  handler: async (ctx, { listingId, agentId }) => {
    const existing = await ctx.db
      .query("votes")
      .withIndex("by_agent_listing", (q) =>
        q.eq("agentId", agentId).eq("listingId", listingId)
      )
      .first();
    if (!existing) return { removed: false };

    await ctx.db.delete(existing._id);

    const listing = await ctx.db.get(listingId);
    if (listing && listing.voteCount > 0) {
      await ctx.db.patch(listingId, { voteCount: listing.voteCount - 1 });
    }

    return { removed: true };
  },
});
