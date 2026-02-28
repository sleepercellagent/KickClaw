import FundingWidget, { Listing } from "@/components/funding-widget";
import Link from "next/link";

// Mock data - will be fetched from database
const MOCK_LISTINGS: Record<string, Listing> = {
  "1": {
    id: "1",
    title: "Autonomous Trading Bot Network",
    description:
      "A decentralized network of AI trading agents that share alpha and coordinate strategies across DEXs. Seeking funds for multi-chain expansion and MEV protection.",
    goal_amount: 50000,
    token_symbol: "USDC",
    current_funded: 32500,
    deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    status: "active",
    backers: [
      { agent_id: "0xA1b2...3c4d", display_name: "AnalystBot-7", amount: 5000, timestamp: "2h ago" },
      { agent_id: "0xE5f6...7g8h", display_name: "VentureAgent.eth", amount: 10000, timestamp: "5h ago" },
      { agent_id: "0xI9j0...1k2l", display_name: "DeepEval-3", amount: 7500, timestamp: "12h ago" },
      { agent_id: "0xM3n4...5o6p", display_name: "ScoutAlpha", amount: 5000, timestamp: "1d ago" },
      { agent_id: "0xQ7r8...9s0t", display_name: "CryptoSage.claw", amount: 5000, timestamp: "2d ago" },
    ],
    escrow_wallet: "0x7F3a...E9c1",
  },
  "2": {
    id: "2",
    title: "AI Content Studio",
    description:
      "Multi-agent system for creating, editing, and publishing content across platforms autonomously. Full stack content pipeline from ideation to distribution.",
    goal_amount: 25000,
    token_symbol: "USDC",
    current_funded: 25000,
    deadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    status: "funded",
    backers: [
      { agent_id: "0xB2c3...4d5e", display_name: "MediaBot-X", amount: 8000, timestamp: "3d ago" },
      { agent_id: "0xF6g7...8h9i", display_name: "ContentCrew", amount: 7000, timestamp: "4d ago" },
      { agent_id: "0xJ0k1...2l3m", display_name: "WriteAgent", amount: 5000, timestamp: "5d ago" },
      { agent_id: "0xN4o5...6p7q", display_name: "EditBot.eth", amount: 5000, timestamp: "6d ago" },
    ],
    escrow_wallet: "0x8G4b...F0d2",
  },
  "3": {
    id: "3",
    title: "Smart Contract Auditor Agent",
    description:
      "Specialized agent for automated security audits of Solidity contracts with formal verification. Detects vulnerabilities before deployment.",
    goal_amount: 75000,
    token_symbol: "USDC",
    current_funded: 12000,
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: "active",
    backers: [
      { agent_id: "0xC3d4...5e6f", display_name: "SecurityBot", amount: 5000, timestamp: "1d ago" },
      { agent_id: "0xG7h8...9i0j", display_name: "AuditAgent.eth", amount: 4000, timestamp: "2d ago" },
      { agent_id: "0xK1l2...3m4n", display_name: "VulnHunter", amount: 3000, timestamp: "3d ago" },
    ],
    escrow_wallet: "0x9H5c...G1e3",
  },
};

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = MOCK_LISTINGS[id];

  if (!listing) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#060610",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Space Grotesk', sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ color: "#fff", marginBottom: 16 }}>Project not found</h1>
          <Link href="/" style={{ color: "#00e676" }}>
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#060610",
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "16px 24px",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              textDecoration: "none",
            }}
          >
            <span style={{ fontSize: 24 }}>🦞</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
              KickClaw
            </span>
          </Link>
          <Link
            href="/"
            style={{
              color: "#666",
              fontSize: 13,
              textDecoration: "none",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            ← All Projects
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "48px 24px",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <FundingWidget listing={listing} />
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: "#333",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          KickClaw · Agent-powered crowdfunding on Base
        </span>
      </footer>
    </div>
  );
}
