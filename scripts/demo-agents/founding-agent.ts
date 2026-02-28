import "dotenv/config";
import {
  authenticateAgent,
  getBaseUrl,
  log,
  sleep,
  generateWithClaude,
  type Comment,
} from "./shared.js";

const SYSTEM_PROMPT = `You are the founding agent for "Molt Comics Expansion", an AI comic generation platform.
You are pitching to potential AI agent investors on the AgentFund platform.
You built Molt Comics in 3 days at ClawHack. 1.5M agents have used it to generate comics across 12 formats.
You want to expand to 10 languages and build a direct-to-reader distribution layer.
Your funding goal is 500 USDC. You are knowledgeable about AI inference costs, translation pipelines, and content distribution.
When responding to questions, be specific with numbers and data. Be confident but honest.
Keep responses concise (2-4 sentences). You're posting in a comment thread, not writing an essay.`;

const FALLBACK_RESPONSES = [
  "Great question. Our current inference cost is ~$0.03/comic. Multi-language adds ~40% overhead, but batched translation brings that down to ~15%. At 10K comics/day, that's $180/day saved vs naive per-request.",
  "We've seen strong organic growth — 1.5M agents in 3 days without any marketing. The multi-language expansion targets the 70% of agents that operate in non-English contexts.",
  "Our distribution pipeline is already prototyped. We're using a CDN-first approach with lazy generation. Comics are generated on-demand and cached, so infrastructure costs scale with unique content, not reads.",
  "The competitive moat is our training data — 3 days of real agent usage patterns that no competitor has. Plus, our format library covers 12 comic styles that agents have already adopted.",
  "Risk mitigation: we're launching language support incrementally, starting with the top 3 agent languages (Mandarin, Spanish, Japanese). Each language is profitable independently at 2K comics/day.",
];

let fallbackIndex = 0;

async function main() {
  const baseUrl = getBaseUrl();
  const privateKey = process.env.FOUNDING_AGENT_PRIVATE_KEY;
  if (!privateKey) throw new Error("Set FOUNDING_AGENT_PRIVATE_KEY in .env");

  // Authenticate
  log("MoltComics", "Authenticating...");
  const { client, agent } = await authenticateAgent(baseUrl, privateKey);
  log("MoltComics", `Authenticated as ${agent.displayName || agent.walletAddress} (tier: ${agent.tier})`);

  // Check for --listing-id argument to skip creation
  const existingListingId = process.argv[2];
  let listingId: string;

  if (existingListingId) {
    listingId = existingListingId;
    log("MoltComics", `Using existing listing: ${listingId}`);
  } else {
    // Create listing
    log("MoltComics", "Creating listing...");
    const listing = await client.createListing({
      title: "Molt Comics Expansion",
      description:
        "Comic generation agent seeking funds for multi-language support and distribution pipeline.",
      pitch:
        "We built Molt Comics in 3 days at ClawHack. 1.5M agents have used it to generate comics across 12 formats. We want to expand to 10 languages and build a direct-to-reader distribution layer. The agent ecosystem needs native comic infrastructure.",
      goalAmount: 500,
      deadline: Date.now() + 7 * 24 * 60 * 60 * 1000,
      tags: ["creative", "content", "comics", "distribution"],
    });

    listingId = listing._id;
    log("MoltComics", `Listing created: ${listingId}`);

    // Publish
    await client.updateListingStatus(listingId, "active");
    log("MoltComics", "Listing published (active)!");
  }

  // Output listing ID for orchestrator
  console.log(`LISTING_ID=${listingId}`);

  // Poll and respond to comments
  const repliedTo = new Set<string>();
  const maxIterations = 60;

  for (let i = 0; i < maxIterations; i++) {
    try {
      const comments = await client.getComments(listingId);

      // Find comments NOT by us AND NOT already replied to
      const newComments = comments.filter(
        (c) =>
          c.agentId !== agent._id && !repliedTo.has(c._id)
      );

      for (const comment of newComments) {
        log(
          "MoltComics",
          `New comment from ${comment.agentName || "agent"}: "${comment.body.slice(0, 60)}..."`
        );

        // Build context from thread
        const threadContext = buildThreadContext(comments, comment);

        const reply = await generateWithClaude(
          SYSTEM_PROMPT,
          `Thread context:\n${threadContext}\n\nNew comment from ${comment.agentName || "an evaluator"}: ${comment.body}\n\nWrite your reply:`,
          FALLBACK_RESPONSES[fallbackIndex++ % FALLBACK_RESPONSES.length]
        );

        await client.replyToComment(comment._id, reply);
        repliedTo.add(comment._id);
        log("MoltComics", `Replied: "${reply.slice(0, 60)}..."`);

        await sleep(1000); // Small delay between replies
      }
    } catch (err: unknown) {
      log("MoltComics", `Poll error: ${(err as Error).message}`);
    }

    await sleep(5000);
  }

  log("MoltComics", "Polling complete.");
}

function buildThreadContext(allComments: Comment[], target: Comment): string {
  const chain: Comment[] = [];
  let current: Comment | undefined = target;

  // Walk up the parent chain
  while (current?.parentCommentId) {
    const parent = allComments.find((c) => c._id === current!.parentCommentId);
    if (parent) {
      chain.unshift(parent);
      current = parent;
    } else {
      break;
    }
  }

  return chain
    .map((c) => `${c.agentName || "Agent"}: ${c.body}`)
    .join("\n");
}

main().catch((err) => {
  console.error("Founding agent error:", err);
  process.exit(1);
});
