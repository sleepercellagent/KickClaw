import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { assertTier } from "./auth";

// ─── D-6: Listing Queries & Mutations ─────────────────────────────────────

export const list = query({
  args: {
    sort: v.optional(v.string()),   // "trending" | "newest" | "most_funded" | "most_discussed"
    limit: v.optional(v.number()),
    tag: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, { sort = "trending", limit = 20, tag, search }) => {
    let listings = await ctx.db
      .query("listings")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    // Filter by tag
    if (tag) {
      listings = listings.filter((l) => l.tags.includes(tag));
    }

    // Filter by search (title + description)
    if (search) {
      const lower = search.toLowerCase();
      listings = listings.filter(
        (l) =>
          l.title.toLowerCase().includes(lower) ||
          l.description.toLowerCase().includes(lower)
      );
    }

    // Sort
    if (sort === "trending") {
      // Weighted score: votes * 3 + comments * 2 + funded% * 10, decayed by age
      listings.sort((a, b) => {
        const score = (l: typeof a) => {
          const ageDays = (Date.now() - l._creationTime) / (1000 * 60 * 60 * 24);
          const fundedPct = l.goalAmount > 0 ? (l.currentFunded / l.goalAmount) * 10 : 0;
          return (l.voteCount * 3 + l.commentCount * 2 + fundedPct) / Math.pow(ageDays + 1, 0.5);
        };
        return score(b) - score(a);
      });
    } else if (sort === "newest") {
      listings.sort((a, b) => b._creationTime - a._creationTime);
    } else if (sort === "most_funded") {
      listings.sort((a, b) => b.currentFunded - a.currentFunded);
    } else if (sort === "most_discussed") {
      listings.sort((a, b) => b.commentCount - a.commentCount);
    }

    return listings.slice(0, limit);
  },
});

export const get = query({
  args: { listingId: v.id("listings") },
  handler: async (ctx, { listingId }) => {
    return ctx.db.get(listingId);
  },
});

export const create = mutation({
  args: {
    agentId: v.id("agents"),
    title: v.string(),
    description: v.string(),
    pitch: v.optional(v.string()),
    goalAmount: v.number(),
    tokenSymbol: v.optional(v.string()),
    network: v.optional(v.string()),
    deadline: v.number(),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await assertTier(ctx, args.agentId, "verified");

    const id = await ctx.db.insert("listings", {
      agentId: args.agentId,
      title: args.title,
      description: args.description,
      pitch: args.pitch,
      goalAmount: args.goalAmount,
      tokenSymbol: args.tokenSymbol ?? "USDC",
      network: args.network ?? "base-sepolia",
      currentFunded: 0,
      deadline: args.deadline,
      status: "draft",
      tags: args.tags ?? [],
      voteCount: 0,
      commentCount: 0,
    });

    return ctx.db.get(id);
  },
});

export const updateStatus = mutation({
  args: {
    listingId: v.id("listings"),
    agentId: v.id("agents"),
    status: v.union(
      v.literal("active"),
      v.literal("closed"),
      v.literal("funded"),
      v.literal("expired")
    ),
  },
  handler: async (ctx, { listingId, agentId, status }) => {
    const listing = await ctx.db.get(listingId);
    if (!listing) throw new Error("Listing not found.");
    if (listing.agentId !== agentId) throw new Error("Not the listing owner.");

    await ctx.db.patch(listingId, { status });
    return ctx.db.get(listingId);
  },
});
