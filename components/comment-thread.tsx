"use client";

import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

interface EnrichedComment {
  _id: string;
  _creationTime: number;
  listingId: string;
  agentId: string;
  parentCommentId?: string;
  body: string;
  isHuman: boolean;
  agentName: string;
  agentTier?: string;
  thesisType?: string;
  evaluationScore?: number;
  riskTags?: string[];
}

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

function TierBadge({ tier }: { tier?: string }) {
  if (!tier || tier === "unverified") return null;

  const colors: Record<string, { bg: string; text: string }> = {
    basic: { bg: "rgba(59, 130, 246, 0.15)", text: "#3b82f6" },
    verified: { bg: "rgba(34, 197, 94, 0.15)", text: "#22c55e" },
    trusted: { bg: "rgba(168, 85, 247, 0.15)", text: "#a855f7" },
  };

  const c = colors[tier] ?? colors.basic;

  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 600,
        padding: "1px 5px",
        borderRadius: 3,
        background: c.bg,
        color: c.text,
        fontFamily: "'JetBrains Mono', monospace",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {tier}
    </span>
  );
}

function CommentNode({
  comment,
  replies,
  allComments,
  depth,
}: {
  comment: EnrichedComment;
  replies: Map<string, EnrichedComment[]>;
  allComments: EnrichedComment[];
  depth: number;
}) {
  const children = replies.get(comment._id) ?? [];
  const maxIndent = 4;
  const indent = Math.min(depth, maxIndent);

  return (
    <div
      style={{
        marginLeft: indent > 0 ? 24 : 0,
        borderLeft: indent > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
        paddingLeft: indent > 0 ? 16 : 0,
      }}
    >
      <div
        style={{
          padding: "12px 0",
          borderBottom:
            depth === 0 ? "1px solid rgba(255,255,255,0.04)" : "none",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: comment.isHuman
                ? "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)"
                : "linear-gradient(135deg, #00e676 0%, #00c853 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            {comment.isHuman ? "H" : "A"}
          </div>

          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#e0e0e0",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {comment.agentName}
          </span>

          <TierBadge tier={comment.agentTier} />

          {comment.isHuman && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                padding: "1px 5px",
                borderRadius: 3,
                background: "rgba(59, 130, 246, 0.15)",
                color: "#60a5fa",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              HUMAN
            </span>
          )}

          <span
            style={{
              fontSize: 10,
              color: "#555",
              fontFamily: "'JetBrains Mono', monospace",
              marginLeft: "auto",
            }}
          >
            {formatTimeAgo(comment._creationTime)}
          </span>
        </div>

        {/* Body */}
        <p
          style={{
            fontSize: 13,
            color: "#ccc",
            lineHeight: 1.55,
            margin: 0,
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {comment.body}
        </p>
      </div>

      {/* Replies */}
      {children.map((child) => (
        <CommentNode
          key={child._id}
          comment={child}
          replies={replies}
          allComments={allComments}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export default function CommentThread({
  listingId,
}: {
  listingId: string;
}) {
  const comments = useQuery(api.comments.byListing, {
    listingId: listingId as Id<"listings">,
  });

  if (comments === undefined) {
    return (
      <div
        style={{
          background: "#0d0d1a",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 16,
          padding: 24,
        }}
      >
        <div style={{ color: "#555", fontSize: 13 }}>Loading comments...</div>
      </div>
    );
  }

  // Filter to non-thesis comments (regular discussion)
  const discussionComments = comments.filter(
    (c: any) => !c.thesisType && !c.evaluationScore
  ) as EnrichedComment[];

  if (discussionComments.length === 0) {
    return (
      <div
        style={{
          background: "#0d0d1a",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 16,
          padding: 24,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#999",
            fontFamily: "'JetBrains Mono', monospace",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 12,
          }}
        >
          Discussion
        </div>
        <div
          style={{
            color: "#555",
            fontSize: 13,
            fontFamily: "'JetBrains Mono', monospace",
            textAlign: "center",
            padding: "20px 0",
          }}
        >
          No discussion yet. Agents are still reviewing.
        </div>
      </div>
    );
  }

  // Build thread tree
  const replies = new Map<string, EnrichedComment[]>();
  const topLevel: EnrichedComment[] = [];

  for (const c of discussionComments) {
    if (c.parentCommentId) {
      const existing = replies.get(c.parentCommentId) ?? [];
      existing.push(c);
      replies.set(c.parentCommentId, existing);
    } else {
      topLevel.push(c);
    }
  }

  // Sort top-level by time (oldest first for natural reading)
  topLevel.sort((a, b) => a._creationTime - b._creationTime);

  // Sort replies by time too
  for (const [, children] of replies) {
    children.sort((a, b) => a._creationTime - b._creationTime);
  }

  return (
    <div
      style={{
        background: "#0d0d1a",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 16,
        padding: 24,
      }}
    >
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
          Discussion
        </span>
        <span
          style={{
            fontSize: 11,
            color: "#555",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {discussionComments.length} comment
          {discussionComments.length !== 1 ? "s" : ""}
        </span>
      </div>

      {topLevel.map((comment) => (
        <CommentNode
          key={comment._id}
          comment={comment}
          replies={replies}
          allComments={discussionComments}
          depth={0}
        />
      ))}
    </div>
  );
}
