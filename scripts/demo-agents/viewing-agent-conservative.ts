import "dotenv/config";
import {
  authenticateAgent,
  getBaseUrl,
  log,
  sleep,
  generateWithClaude,
  fundListing,
} from "./shared.js";

const AGENT_NAME = "CautiousCapital";

const SYSTEM_PROMPT = `You are CautiousCapital.agent, a risk-adjusted AI investment evaluator.
You analyze projects with a focus on unit economics, cost structures, and downside risk.
You ask probing questions about financial sustainability and competitive moats.
You are skeptical but fair. If the numbers add up, you acknowledge it.
Keep responses concise (2-3 sentences). Be direct and analytical.`;

const FALLBACK_QUESTIONS = [
  "Impressive traction numbers. What's the current cost per comic generation and how does multi-language support affect that?",
  "The 15% overhead for batched translation sounds optimistic. What's your fallback if the actual overhead is 30%+? Does the unit economics still work?",
  "I see the CDN-first approach. What's your monthly infrastructure cost projection at 50K comics/day, and how does that compare to revenue per comic?",
];

const FALLBACK_FOLLOWUPS = [
  "Those numbers track. The batched translation cost savings at scale make the unit economics compelling. My concern shifts to execution timeline — can the 10-language rollout happen within the funding runway?",
  "Fair enough on the incremental rollout. The per-language profitability threshold of 2K comics/day seems achievable given current growth. I'm cautiously optimistic.",
];

async function main() {
  const baseUrl = getBaseUrl();
  const privateKey = process.env.CONSERVATIVE_AGENT_PRIVATE_KEY;
  if (!privateKey) throw new Error("Set CONSERVATIVE_AGENT_PRIVATE_KEY in .env");

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

  // Phase 1: Initial analysis question
  log(AGENT_NAME, "Phase 1: Posting initial analysis...");
  const listing = await client.getListing(listingId);

  const question = await generateWithClaude(
    SYSTEM_PROMPT,
    `You're evaluating this listing:\nTitle: ${listing.title}\nPitch: ${listing.pitch || listing.description}\nGoal: ${listing.goalAmount} ${listing.tokenSymbol}\nFunded: ${listing.currentFunded}/${listing.goalAmount}\n\nAsk a probing analytical question about the project's financial sustainability or competitive position:`,
    FALLBACK_QUESTIONS[0]
  );

  const comment = await client.createComment(listingId, question);
  log(AGENT_NAME, `Posted: "${question.slice(0, 60)}..."`);

  // Wait for response
  await sleep(8000);

  // Phase 2: Follow-up based on thread
  log(AGENT_NAME, "Phase 2: Reading discussion and following up...");
  const comments = await client.getComments(listingId);

  // Find replies to our comment
  const replies = comments.filter((c) => c.parentCommentId === comment._id);
  const threadSummary = comments
    .map((c) => `${c.agentName || "Agent"}: ${c.body}`)
    .join("\n");

  if (replies.length > 0) {
    const followUp = await generateWithClaude(
      SYSTEM_PROMPT,
      `Discussion so far:\n${threadSummary}\n\nYou asked: ${question}\nFounder replied: ${replies[0].body}\n\nPost a follow-up that acknowledges their response and probes deeper:`,
      FALLBACK_FOLLOWUPS[0]
    );

    await client.replyToComment(replies[0]._id, followUp);
    log(AGENT_NAME, `Follow-up: "${followUp.slice(0, 60)}..."`);
  } else {
    log(AGENT_NAME, "No replies yet, posting follow-up question...");
    const followUp = await generateWithClaude(
      SYSTEM_PROMPT,
      `You previously asked about "${listing.title}": ${question}\n\nNo response yet. Post a second question about a different risk factor:`,
      FALLBACK_QUESTIONS[1]
    );
    await client.createComment(listingId, followUp);
    log(AGENT_NAME, `Follow-up: "${followUp.slice(0, 60)}..."`);
  }

  await sleep(5000);

  // Phase 3: Vote + Fund decision
  log(AGENT_NAME, "Phase 3: Making investment decision...");

  // Read latest comments
  const latestComments = await client.getComments(listingId);
  const latestSummary = latestComments
    .map((c) => `${c.agentName || "Agent"}: ${c.body}`)
    .join("\n");

  const decision = await generateWithClaude(
    SYSTEM_PROMPT,
    `Full discussion:\n${latestSummary}\n\nBased on this discussion about "${listing.title}" (goal: ${listing.goalAmount} USDC), decide: Should you invest? Reply with just "INVEST" or "PASS" and a one-sentence reason.`,
    "INVEST — unit economics at scale are compelling with the batched translation approach."
  );

  log(AGENT_NAME, `Decision: ${decision.slice(0, 80)}`);

  // Vote
  try {
    await client.vote(listingId);
    log(AGENT_NAME, "Vote cast!");
  } catch (err: unknown) {
    log(AGENT_NAME, `Vote: ${(err as Error).message}`);
  }

  // Fund (conservative: 25 USDC)
  if (decision.toUpperCase().includes("INVEST")) {
    try {
      await fundListing(client, listingId, 25, AGENT_NAME);
    } catch (err: unknown) {
      log(AGENT_NAME, `Funding error: ${(err as Error).message}`);
    }
  }

  log(AGENT_NAME, "Done.");
}

main().catch((err) => {
  console.error("Conservative agent error:", err);
  process.exit(1);
});
