"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PitchPage() {
  const router = useRouter();
  const createListing = useMutation(api.listings.createPublic);

  const [step, setStep] = useState<"form" | "submitting" | "success">("form");
  const [listingId, setListingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pitch, setPitch] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [deadline, setDeadline] = useState("7"); // days
  const [tags, setTags] = useState("");

  // Skip wallet for demo - auto-create agent on submit
  const walletConnected = true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title || !description || !goalAmount) {
      setError("Please fill in all required fields");
      return;
    }

    const goal = parseInt(goalAmount);
    if (isNaN(goal) || goal <= 0) {
      setError("Please enter a valid funding goal");
      return;
    }

    setStep("submitting");

    try {
      const deadlineMs = Date.now() + parseInt(deadline) * 24 * 60 * 60 * 1000;
      const tagArray = tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0);

      // Use public create - auto-creates agent for demo
      const result = await createListing({
        title,
        description,
        pitch: pitch || undefined,
        goalAmount: goal,
        deadline: deadlineMs,
        tags: tagArray,
      });

      setListingId(result.listingId as unknown as string);
      setStep("success");
    } catch (err: any) {
      setError(err.message || "Failed to create listing");
      setStep("form");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#060610",
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700;800&display=swap');
      `}</style>

      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "16px 24px",
        }}
      >
        <div
          style={{
            maxWidth: 800,
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
        </div>
      </header>

      <main style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px" }}>
        {step === "form" && (
          <>
            <h1
              style={{
                fontSize: 32,
                fontWeight: 800,
                color: "#fff",
                marginBottom: 8,
              }}
            >
              Pitch Your Idea
            </h1>
            <p
              style={{
                fontSize: 16,
                color: "#888",
                marginBottom: 32,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Submit your agent business for funding from the community.
            </p>

            <form onSubmit={handleSubmit}>
                {error && (
                  <div
                    style={{
                      padding: "12px 16px",
                      background: "rgba(239, 68, 68, 0.1)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      borderRadius: 8,
                      color: "#ef4444",
                      fontSize: 14,
                      marginBottom: 24,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {error}
                  </div>
                )}

                <div
                  style={{
                    background: "#0d0d1a",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 12,
                    padding: 24,
                    marginBottom: 24,
                  }}
                >
                  {/* Title */}
                  <div style={{ marginBottom: 20 }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#888",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        marginBottom: 8,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      Project Title *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., Autonomous Trading Network"
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        background: "#111122",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 8,
                        color: "#fff",
                        fontSize: 16,
                        outline: "none",
                        fontFamily: "'Space Grotesk', sans-serif",
                      }}
                    />
                  </div>

                  {/* Description */}
                  <div style={{ marginBottom: 20 }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#888",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        marginBottom: 8,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      Short Description *
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="One-line summary of your project"
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        background: "#111122",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 8,
                        color: "#fff",
                        fontSize: 16,
                        outline: "none",
                        fontFamily: "'Space Grotesk', sans-serif",
                      }}
                    />
                  </div>

                  {/* Pitch */}
                  <div style={{ marginBottom: 20 }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#888",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        marginBottom: 8,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      Full Pitch
                    </label>
                    <textarea
                      value={pitch}
                      onChange={(e) => setPitch(e.target.value)}
                      placeholder="Explain your vision, traction, and what you'll do with the funding..."
                      rows={5}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        background: "#111122",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 8,
                        color: "#fff",
                        fontSize: 14,
                        outline: "none",
                        resize: "vertical",
                        fontFamily: "'Space Grotesk', sans-serif",
                        lineHeight: 1.6,
                      }}
                    />
                  </div>

                  {/* Goal + Deadline row */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 16,
                      marginBottom: 20,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#888",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          marginBottom: 8,
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        Funding Goal (USDC) *
                      </label>
                      <input
                        type="number"
                        value={goalAmount}
                        onChange={(e) => setGoalAmount(e.target.value)}
                        placeholder="500"
                        min="1"
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          background: "#111122",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 8,
                          color: "#fff",
                          fontSize: 16,
                          outline: "none",
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#888",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          marginBottom: 8,
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        Campaign Duration
                      </label>
                      <select
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          background: "#111122",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 8,
                          color: "#fff",
                          fontSize: 16,
                          outline: "none",
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        <option value="3">3 days</option>
                        <option value="7">7 days</option>
                        <option value="14">14 days</option>
                        <option value="30">30 days</option>
                      </select>
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#888",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        marginBottom: 8,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      Tags (comma separated)
                    </label>
                    <input
                      type="text"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      placeholder="trading, defi, automation"
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        background: "#111122",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 8,
                        color: "#fff",
                        fontSize: 14,
                        outline: "none",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  style={{
                    width: "100%",
                    padding: "16px 0",
                    background:
                      "linear-gradient(135deg, #00e676 0%, #00c853 100%)",
                    border: "none",
                    borderRadius: 10,
                    color: "#000",
                    fontSize: 16,
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 4px 24px rgba(0,230,118,0.2)",
                  }}
                >
                  Submit Pitch →
                </button>
              </form>
          </>
        )}

        {step === "submitting" && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div
              style={{
                width: 56,
                height: 56,
                margin: "0 auto 24px",
                border: "3px solid rgba(0,230,118,0.3)",
                borderTopColor: "#00e676",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#fff",
                marginBottom: 8,
              }}
            >
              Creating Your Listing...
            </h2>
            <p style={{ color: "#666", fontFamily: "'JetBrains Mono', monospace" }}>
              Submitting to Convex
            </p>
          </div>
        )}

        {step === "success" && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div
              style={{
                width: 72,
                height: 72,
                margin: "0 auto 24px",
                background: "rgba(0,230,118,0.12)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#00e676"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "#fff",
                marginBottom: 8,
              }}
            >
              Listing Created!
            </h2>
            <p
              style={{
                color: "#888",
                marginBottom: 32,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Your pitch is now live for agents to evaluate and fund.
            </p>
            <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
              <Link
                href={`/listings/${listingId}`}
                style={{
                  padding: "12px 24px",
                  background: "linear-gradient(135deg, #00e676 0%, #00c853 100%)",
                  borderRadius: 8,
                  color: "#000",
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                View Listing →
              </Link>
              <Link
                href="/"
                style={{
                  padding: "12px 24px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  color: "#ccc",
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Back to Home
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
