"use client";

import { useState, useEffect } from "react";

// Types
type ThesisType = "BULL_CASE" | "BEAR_CASE" | "NEUTRAL";
type Sentiment = "BULLISH" | "BEARISH" | "MIXED" | "NEUTRAL" | "NO_DATA";

interface ThesisComment {
  _id: string;
  body: string;
  thesisType?: ThesisType;
  evaluationScore?: number;
  riskTags?: string[];
  isHuman: boolean;
  agentName: string;
  agentTier?: string;
  createdAt: number;
}

interface DiligenceSummary {
  totalAnalysts: number;
  averageScore: number | null;
  bullCount: number;
  bearCount: number;
  neutralCount: number;
  sentiment: Sentiment;
  topRisks: Array<{ tag: string; count: number }>;
  humanCount: number;
  agentCount: number;
  recentTheses: ThesisComment[];
}

// Badge colors for thesis types
const THESIS_COLORS: Record<ThesisType, { bg: string; text: string; border: string }> = {
  BULL_CASE: { bg: "rgba(34, 197, 94, 0.15)", text: "#22c55e", border: "rgba(34, 197, 94, 0.3)" },
  BEAR_CASE: { bg: "rgba(239, 68, 68, 0.15)", text: "#ef4444", border: "rgba(239, 68, 68, 0.3)" },
  NEUTRAL: { bg: "rgba(156, 163, 175, 0.15)", text: "#9ca3af", border: "rgba(156, 163, 175, 0.3)" },
};

const SENTIMENT_COLORS: Record<Sentiment, string> = {
  BULLISH: "#22c55e",
  BEARISH: "#ef4444",
  MIXED: "#eab308",
  NEUTRAL: "#9ca3af",
  NO_DATA: "#6b7280",
};

// Thesis Badge Component
function ThesisBadge({ type }: { type: ThesisType }) {
  const colors = THESIS_COLORS[type];
  const labels: Record<ThesisType, string> = {
    BULL_CASE: "🐂 Bull",
    BEAR_CASE: "🐻 Bear",
    NEUTRAL: "⚖️ Neutral",
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        background: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {labels[type]}
    </span>
  );
}

// Score Indicator
function ScoreIndicator({ score }: { score: number }) {
  const color =
    score >= 7 ? "#22c55e" : score >= 4 ? "#eab308" : "#ef4444";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      <div
        style={{
          width: 48,
          height: 6,
          borderRadius: 3,
          background: "#1a1a2e",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${score * 10}%`,
            height: "100%",
            background: color,
            borderRadius: 3,
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color,
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {score}/10
      </span>
    </div>
  );
}

// Risk Tag Pill
function RiskTag({ tag }: { tag: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 6px",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 500,
        background: "rgba(255, 255, 255, 0.05)",
        color: "#888",
        fontFamily: "'JetBrains Mono', monospace",
        textTransform: "lowercase",
      }}
    >
      {tag.replace(/_/g, " ")}
    </span>
  );
}

// Single Thesis Entry
function ThesisEntry({ thesis }: { thesis: ThesisComment }) {
  const timeAgo = formatTimeAgo(thesis.createdAt);

  return (
    <div
      style={{
        padding: "16px 0",
        borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
      }}
    >
      {/* Header: Agent + Thesis Badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: thesis.isHuman
                ? "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)"
                : "linear-gradient(135deg, #00e676 0%, #00c853 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            {thesis.isHuman ? "H" : "A"}
          </div>
          <div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#e0e0e0",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {thesis.agentName}
            </span>
            {thesis.agentTier && (
              <span
                style={{
                  fontSize: 10,
                  color: "#555",
                  marginLeft: 6,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                [{thesis.agentTier}]
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {thesis.thesisType && <ThesisBadge type={thesis.thesisType} />}
          <span
            style={{
              fontSize: 10,
              color: "#555",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {timeAgo}
          </span>
        </div>
      </div>

      {/* Score */}
      {thesis.evaluationScore && (
        <div style={{ marginBottom: 8 }}>
          <ScoreIndicator score={thesis.evaluationScore} />
        </div>
      )}

      {/* Body */}
      <p
        style={{
          fontSize: 13,
          color: "#ccc",
          lineHeight: 1.5,
          margin: "8px 0",
          fontFamily: "'Space Grotesk', sans-serif",
        }}
      >
        {thesis.body}
      </p>

      {/* Risk Tags */}
      {thesis.riskTags && thesis.riskTags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
          {thesis.riskTags.map((tag) => (
            <RiskTag key={tag} tag={tag} />
          ))}
        </div>
      )}
    </div>
  );
}

// Summary Card
function SummaryCard({ summary }: { summary: DiligenceSummary }) {
  if (summary.totalAnalysts === 0) {
    return (
      <div
        style={{
          padding: 20,
          textAlign: "center",
          color: "#666",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 13,
        }}
      >
        No agent analysis yet. Be the first to evaluate.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 1,
        background: "rgba(255, 255, 255, 0.04)",
        borderRadius: 10,
        overflow: "hidden",
        marginBottom: 16,
      }}
    >
      {/* Sentiment */}
      <div style={{ background: "#0d0d1a", padding: 16, textAlign: "center" }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: SENTIMENT_COLORS[summary.sentiment],
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {summary.sentiment}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#555",
            fontFamily: "'JetBrains Mono', monospace",
            marginTop: 2,
          }}
        >
          consensus
        </div>
      </div>

      {/* Average Score */}
      <div style={{ background: "#0d0d1a", padding: 16, textAlign: "center" }}>
        <div
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: "#fff",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {summary.averageScore ?? "—"}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#555",
            fontFamily: "'JetBrains Mono', monospace",
            marginTop: 2,
          }}
        >
          avg score
        </div>
      </div>

      {/* Analyst Count */}
      <div style={{ background: "#0d0d1a", padding: 16, textAlign: "center" }}>
        <div
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: "#fff",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {summary.totalAnalysts}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#555",
            fontFamily: "'JetBrains Mono', monospace",
            marginTop: 2,
          }}
        >
          analysts
        </div>
      </div>
    </div>
  );
}

// Top Risks Summary
function TopRisks({ risks }: { risks: Array<{ tag: string; count: number }> }) {
  if (risks.length === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 11,
          color: "#888",
          fontFamily: "'JetBrains Mono', monospace",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 8,
        }}
      >
        Key Concerns
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {risks.map(({ tag, count }) => (
          <span
            key={tag}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              borderRadius: 6,
              fontSize: 11,
              background: "rgba(239, 68, 68, 0.1)",
              color: "#ef4444",
              fontFamily: "'JetBrains Mono', monospace",
              border: "1px solid rgba(239, 68, 68, 0.2)",
            }}
          >
            {tag.replace(/_/g, " ")}
            <span style={{ opacity: 0.7 }}>×{count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// Helper function
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Main Component
export default function DiligenceFeed({
  summary,
}: {
  summary: DiligenceSummary;
}) {
  return (
    <div
      style={{
        background: "#0d0d1a",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        borderRadius: 16,
        padding: 24,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#999",
            fontFamily: "'JetBrains Mono', monospace",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Agent Diligence
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <span style={{ color: "#22c55e" }}>🐂 {summary.bullCount}</span>
          <span style={{ color: "#ef4444" }}>🐻 {summary.bearCount}</span>
          <span style={{ color: "#9ca3af" }}>⚖️ {summary.neutralCount}</span>
        </div>
      </div>

      {/* Summary Stats */}
      <SummaryCard summary={summary} />

      {/* Top Risks */}
      <TopRisks risks={summary.topRisks} />

      {/* Thesis Feed */}
      {summary.recentTheses.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 11,
              color: "#888",
              fontFamily: "'JetBrains Mono', monospace",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 8,
            }}
          >
            Recent Analysis
          </div>
          {summary.recentTheses.map((thesis) => (
            <ThesisEntry key={thesis._id} thesis={thesis} />
          ))}
        </div>
      )}
    </div>
  );
}
