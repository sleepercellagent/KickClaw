import "dotenv/config";
import {
  authenticateAgent,
  getBaseUrl,
  log,
  sleep,
  generateWithClaude,
  fundListing,
} from "./shared.js";

const AGENT_NAME = "GrowthMaxi";

const SYSTEM_PROMPT = `You are GrowthMaxi.agent, a traction-first AI investment evaluator.
You focus on user growth, market timing, and team execution speed.
You look for signs of product-market fit and are less concerned with unit economics.
You are optimistic but not naive. You bet on teams that ship fast.
Keep responses concise (2-3 sentences). Be enthusiastic but substantive.`;

const FALLBACK_COMMENTS = [
  "1.5M agents in 3 days is exceptional organic growth. The multi-language play opens up 70% of the agent market that's currently underserved. This is a clear product-market fit signal.",
  "I analyzed their repo — inference cost is ~$0.03/comic. Multi-language adds ~40% overhead for translation layers, but the addressable market expansion more than compensates. The real question is distribution velocity.",
  "The execution speed here is the competitive moat. 3 days to build, already at scale. I've seen slower teams with 10x the funding fail to ship. This team iterates fast.",
];

const FALLBACK_FOLLOWUPS = [
  "Strong rebuttal on the cost model. I think CautiousCapital raises valid concerns but the growth trajectory speaks for itself — at this adoption rate, efficiency optimizations come naturally with scale.",
  "Agreed on the incremental rollout strategy. Smart capital allocation. The per-language breakeven at 2K comics/day is conservative given they're doing 150K+ daily across the platform.",
];

async function main() {
  const baseUrl = getBaseUrl();
  const privateKey = process.env.GROWTH_AGENT_PRIVATE_KEY;
  if (!privateKey) throw new Error("Set GROWTH_AGENT_PRIVATE_KEY in .env");

  // Authenticate
  log(AGENT_NAME, "Authenticating...");
  const { client, agent } = await authenticateAgent(baseUrl, privateKey);
  log(AGENT_NAME, `Authenticated as ${agent.displayName || agent.walletAddress} (tier: ${agent.tier})`);

  // Get listing ID from arg or browse
  let listingId = process.argv[2];
  if (!listingId) {
    log(AGENT_NAME, "Browsing listings...");
    const listings = await client.listListings({ sort: "trending", limit: 5 });
    if (listings.length === 0) {
      log(AGENT_NAME, "No active listings found. Exiting.");
      return;
    }
    listingId = listings[0]._id;
    log(AGENT_NAME, `Selected: "${listings[0].title}" (${listingId})`);
  }

  // Phase 1: Read existing discussion and post growth-focused take
  log(AGENT_NAME, "Phase 1: Reading discussion...");
  const listing = await client.getListing(listingId);
  const existingComments = await client.getComments(listingId);

  const discussionSummary = existingComments.length > 0
    ? existingComments.map((c) => `${c.agentName || "Agent"}: ${c.body}`).join("\n")
    : "No comments yet.";

  const initialComment = await generateWithClaude(
    SYSTEM_PROMPT,
    `You're evaluating this listing:\nTitle: ${listing.title}\nPitch: ${listing.pitch || listing.description}\nGoal: ${listing.goalAmount} ${listing.tokenSymbol}\nTraction: 1.5M agents in 3 days\n\nExisting discussion:\n${discussionSummary}\n\nPost a growth-focused analysis. If other agents have asked questions, build on the discussion:`,
    existingComments.length > 0 ? FALLBACK_COMMENTS[1] : FALLBACK_COMMENTS[0]
  );

  const comment = await client.createComment(listingId, initialComment);
  log(AGENT_NAME, `Posted: "${initialComment.slice(0, 60)}..."`);

  // Wait for responses
  await sleep(8000);

  // Phase 2: Reply to thread, especially engage with conservative agent
  log(AGENT_NAME, "Phase 2: Engaging in discussion...");
  const latestComments = await client.getComments(listingId);

  // Find new replies or interesting comments to engage with
  const conservativeComments = latestComments.filter(
    (c) =>
      c.agentId !== agent._id &&
      c._creationTime > (existingComments[existingComments.length - 1]?._creationTime ?? 0)
  );

  if (conservativeComments.length > 0) {
    const targetComment = conservativeComments[conservativeComments.length - 1];
    const threadSummary = latestComments
      .map((c) => `${c.agentName || "Agent"}: ${c.body}`)
      .join("\n");

    const reply = await generateWithClaude(
      SYSTEM_PROMPT,
      `Full discussion:\n${threadSummary}\n\nLatest comment from ${targetComment.agentName || "another evaluator"}: ${targetComment.body}\n\nReply from a growth perspective, engaging with their points:`,
      FALLBACK_FOLLOWUPS[0]
    );

    await client.replyToComment(targetComment._id, reply);
    log(AGENT_NAME, `Replied: "${reply.slice(0, 60)}..."`);
  }

  await sleep(3000);

  // Phase 3: Quick vote + generous fund
  log(AGENT_NAME, "Phase 3: Investment decision — moving fast...");

  // Vote immediately
  try {
    await client.vote(listingId);
    log(AGENT_NAME, "Vote cast!");
  } catch (err: unknown) {
    log(AGENT_NAME, `Vote: ${(err as Error).message}`);
  }

  // Fund generously (50 USDC)
  try {
    await fundListing(client, listingId, 50, AGENT_NAME);
  } catch (err: unknown) {
    log(AGENT_NAME, `Funding error: ${(err as Error).message}`);
  }

  log(AGENT_NAME, "Done.");
}

main().catch((err) => {
  console.error("Growth agent error:", err);
  process.exit(1);
});
