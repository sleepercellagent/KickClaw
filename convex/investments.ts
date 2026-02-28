import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get investments for a project (real-time)
export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const investments = await ctx.db
      .query("investments")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
    return investments;
  },
});

// Get investments by wallet
export const listByWallet = query({
  args: { wallet: v.string() },
  handler: async (ctx, args) => {
    const investments = await ctx.db
      .query("investments")
      .withIndex("by_investor", (q) => q.eq("investorWallet", args.wallet))
      .order("desc")
      .collect();
    
    // Get project details for each investment
    const investmentsWithProjects = await Promise.all(
      investments.map(async (inv) => {
        const project = await ctx.db.get(inv.projectId);
        return {
          ...inv,
          project: project ? { title: project.title, status: project.status } : null,
        };
      })
    );
    
    return investmentsWithProjects;
  },
});

// Record a new investment
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    investorWallet: v.string(),
    investorName: v.optional(v.string()),
    amount: v.number(),
    txHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify project exists and is still funding
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");
    if (project.status !== "funding") throw new Error("Project not accepting investments");

    // Create investment record
    const investmentId = await ctx.db.insert("investments", {
      ...args,
      status: "committed",
    });

    // Update project funding
    const newFunded = project.currentFunded + args.amount;
    const newStatus = newFunded >= project.goalAmount ? "funded" : "funding";

    await ctx.db.patch(args.projectId, {
      currentFunded: newFunded,
      status: newStatus,
    });

    return { investmentId, newFunded, newStatus };
  },
});

// Mark investments as released (funds sent to creator)
export const markReleased = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const investments = await ctx.db
      .query("investments")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const inv of investments) {
      await ctx.db.patch(inv._id, { status: "released" });
    }

    return { count: investments.length };
  },
});

// Mark investments as refunded (deadline passed, goal not met)
export const markRefunded = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const investments = await ctx.db
      .query("investments")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const inv of investments) {
      await ctx.db.patch(inv._id, { status: "refunded" });
    }

    // Update project status
    await ctx.db.patch(args.projectId, { status: "failed" });

    return { count: investments.length };
  },
});
