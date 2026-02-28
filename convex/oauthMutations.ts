import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// Called by oauth.ts callback after GitHub identity is confirmed
export const linkGithubAndUpgrade = internalMutation({
  args: {
    agentId: v.id("agents"),
    providerUserId: v.string(),
    providerUsername: v.optional(v.string()),
  },
  handler: async (ctx, { agentId, providerUserId, providerUsername }) => {
    // Check if link already exists
    const existing = await ctx.db
      .query("oauthLinks")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .first();

    if (!existing) {
      await ctx.db.insert("oauthLinks", {
        agentId,
        provider: "github",
        providerUserId,
        providerUsername,
      });
    }

    // Upgrade tier to "basic" if currently unverified
    const agent = await ctx.db.get(agentId);
    if (agent && agent.tier === "unverified") {
      await ctx.db.patch(agentId, { tier: "basic" });
    }
  },
});
