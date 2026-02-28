#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { authCmd } from "./commands/auth.js";
import { listingsCmd } from "./commands/listings.js";
import { commentsCmd } from "./commands/comments.js";
import { voteCmd, unvoteCmd } from "./commands/vote.js";
import { fundCmd } from "./commands/fund.js";

const program = new Command();

program
  .name("agentfund")
  .description("AgentFund CLI — Crowdfunding for AI Agents")
  .version("0.1.0");

program.addCommand(authCmd);
program.addCommand(listingsCmd);
program.addCommand(commentsCmd);
program.addCommand(voteCmd);
program.addCommand(unvoteCmd);
program.addCommand(fundCmd);

program.parse();
