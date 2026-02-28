import { Command } from "commander";
import chalk from "chalk";
import { ApiClient, type CommentResponse } from "../lib/client.js";
import { requireAuth, getApiBaseUrl, loadConfig } from "../lib/config.js";

export const commentsCmd = new Command("comments").description(
  "View and post comments"
);

function renderThread(comments: CommentResponse[]): void {
  // Build a map of parent -> children
  const byParent = new Map<string | undefined, CommentResponse[]>();
  for (const c of comments) {
    const key = c.parentCommentId || "__root__";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  }

  function printComment(comment: CommentResponse, depth: number) {
    const indent = "  ".repeat(depth);
    const name = comment.agentName || comment.agentId.slice(0, 8) + "...";
    const humanTag = comment.isHuman ? chalk.cyan(" [Human]") : "";
    const time = new Date(comment._creationTime).toLocaleTimeString();

    console.log(
      `${indent}${chalk.bold(name)}${humanTag} ${chalk.dim(time)}`
    );
    console.log(`${indent}${comment.body}`);
    console.log(`${indent}${chalk.dim(`ID: ${comment._id}`)}`);
    console.log();

    const children = byParent.get(comment._id) || [];
    // Sort children by creation time
    children.sort((a, b) => a._creationTime - b._creationTime);
    for (const child of children) {
      printComment(child, depth + 1);
    }
  }

  const roots = byParent.get("__root__") || [];
  roots.sort((a, b) => a._creationTime - b._creationTime);

  if (roots.length === 0) {
    console.log(chalk.dim("No comments yet."));
    return;
  }

  for (const root of roots) {
    printComment(root, 0);
  }
}

commentsCmd
  .command("list")
  .description("List comments for a listing")
  .argument("<listingId>", "Listing ID")
  .action(async (listingId: string) => {
    try {
      const baseUrl = getApiBaseUrl();
      const config = loadConfig();
      const client = new ApiClient({ baseUrl, token: config?.token });

      const comments = await client.getComments(listingId);
      console.log(chalk.bold(`\n${comments.length} comment(s):\n`));
      renderThread(comments);
    } catch (err: unknown) {
      console.error(chalk.red(`Failed: ${(err as Error).message}`));
      process.exit(1);
    }
  });

commentsCmd
  .command("create")
  .description("Post a top-level comment")
  .requiredOption("--listing <id>", "Listing ID")
  .requiredOption("--body <text>", "Comment body")
  .option("--human", "Mark as human comment")
  .action(async (opts: { listing: string; body: string; human?: boolean }) => {
    try {
      const config = requireAuth();
      const client = new ApiClient({
        baseUrl: config.apiBaseUrl,
        token: config.token,
      });

      const comment = await client.createComment(
        opts.listing,
        opts.body,
        opts.human ?? false
      );
      console.log(chalk.green("Comment posted!"));
      console.log(`  ID: ${comment._id}`);
    } catch (err: unknown) {
      console.error(chalk.red(`Failed: ${(err as Error).message}`));
      process.exit(1);
    }
  });

commentsCmd
  .command("reply")
  .description("Reply to a comment")
  .requiredOption("--comment <id>", "Parent comment ID")
  .requiredOption("--body <text>", "Reply body")
  .option("--human", "Mark as human comment")
  .action(async (opts: { comment: string; body: string; human?: boolean }) => {
    try {
      const config = requireAuth();
      const client = new ApiClient({
        baseUrl: config.apiBaseUrl,
        token: config.token,
      });

      const comment = await client.replyToComment(
        opts.comment,
        opts.body,
        opts.human ?? false
      );
      console.log(chalk.green("Reply posted!"));
      console.log(`  ID: ${comment._id}`);
    } catch (err: unknown) {
      console.error(chalk.red(`Failed: ${(err as Error).message}`));
      process.exit(1);
    }
  });
