"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { useParams } from "next/navigation";
import DiligenceFeed from "../../../components/diligence-feed";
import type { Id } from "../../../convex/_generated/dataModel";

function formatUSD(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount);
}

function getDaysLeft(deadline: number) {
  const now = Date.now();
  const diff = deadline - now;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return days > 0 ? days : 0;
}

function FundingProgress({
  current,
  goal,
}: {
  current: number;
  goal: number;
}) {
  const pct = Math.min((current / goal) * 100, 100);
  const overfunded = current > goal;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 10,
        borderRadius: 6,
        background: "#1a1a2e",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: `${pct}%`,
          borderRadius: 6,
          background: overfunded
            ? "linear-gradient(90deg, #00e676 0%, #00c853 100%)"
            : "linear-gradient(90deg, #00e676 0%, #69f0ae 100%)",
          transition: "width 1.4s cubic-bezier(.22,1,.36,1)",
          boxShadow: "0 0 18px rgba(0,230,118,0.35)",
        }}
      />
    </div>
  );
}

function BackerRow({
  backer,
  index,
}: {
  backer: any;
  index: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 0",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: `hsl(${(index * 67) % 360}, 55%, 42%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
            color: "#fff",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {(backer.agentName || "A").charAt(0)}
        </div>
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#e0e0e0",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {backer.agentName || "Anonymous"}
          </div>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#00e676",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {formatUSD(backer.amount)} USDC
        </div>
        <div
          style={{
            fontSize: 10,
            color: "#555",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {backer.status}
        </div>
      </div>
    </div>
  );
}

export default function ListingPage() {
  const params = useParams();
  const listingId = params.id as string;

  const [showFundModal, setShowFundModal] = useState(false);
  const [fundAmount, setFundAmount] = useState("");
  const [backerName, setBackerName] = useState("");
  const [isFunding, setIsFunding] = useState(false);
  const [fundSuccess, setFundSuccess] = useState(false);

  const listing = useQuery(api.listings.get, {
    listingId: listingId as Id<"listings">,
  });

  const funders = useQuery(api.funding.byListing, {
    listingId: listingId as Id<"listings">,
  });

  const diligence = useQuery(api.comments.diligenceSummary, {
    listingId: listingId as Id<"listings">,
  });

  const fundProject = useMutation(api.funding.fundPublic);

  const handleFund = async () => {
    const amount = parseInt(fundAmount);
    if (isNaN(amount) || amount <= 0) return;

    setIsFunding(true);
    try {
      await fundProject({
        listingId: listingId as Id<"listings">,
        displayName: backerName || undefined,
        amount,
      });
      setFundSuccess(true);
      setTimeout(() => {
        setShowFundModal(false);
        setFundSuccess(false);
        setFundAmount("");
        setBackerName("");
      }, 2000);
    } catch (err) {
      console.error("Funding failed:", err);
    }
    setIsFunding(false);
  };

  if (listing === undefined) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#060610",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ color: "#666" }}>Loading...</div>
      </div>
    );
  }

  if (listing === null) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#060610",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ color: "#fff", fontSize: 24 }}>Listing not found</div>
        <Link href="/" style={{ color: "#00e676" }}>
          ← Back to home
        </Link>
      </div>
    );
  }

  const pct = Math.min((listing.currentFunded / listing.goalAmount) * 100, 100);
  const daysLeft = getDaysLeft(listing.deadline);

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
        @keyframes pulseGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(0,230,118,0) } 50% { box-shadow: 0 0 20px 4px rgba(0,230,118,0.12) } }
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
            ← All Listings
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "48px 24px",
          display: "grid",
          gridTemplateColumns: "1fr 400px",
          gap: 32,
        }}
      >
        {/* Left Column - Details */}
        <div>
          {/* Status Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              background: "rgba(0,230,118,0.08)",
              border: "1px solid rgba(0,230,118,0.15)",
              borderRadius: 20,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#00e676",
                animation: "pulseGlow 2s ease infinite",
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#00e676",
                fontFamily: "'JetBrains Mono', monospace",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              {listing.status}
            </span>
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: 32,
              fontWeight: 800,
              color: "#fff",
              lineHeight: 1.2,
              marginBottom: 8,
            }}
          >
            {listing.title}
          </h1>

          {/* Description */}
          <p
            style={{
              fontSize: 16,
              color: "#888",
              lineHeight: 1.6,
              marginBottom: 24,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {listing.description}
          </p>

          {/* Pitch */}
          {listing.pitch && (
            <div
              style={{
                background: "#0d0d1a",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12,
                padding: 20,
                marginBottom: 24,
              }}
            >
              <h3
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#666",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 12,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                The Pitch
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: "#ccc",
                  lineHeight: 1.7,
                }}
              >
                {listing.pitch}
              </p>
            </div>
          )}

          {/* Tags */}
          {listing.tags && listing.tags.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              {listing.tags.map((tag: string) => (
                <span
                  key={tag}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    fontSize: 12,
                    background: "rgba(255,255,255,0.05)",
                    color: "#888",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Diligence Feed */}
          {diligence && <DiligenceFeed summary={diligence} />}
        </div>

        {/* Right Column - Funding */}
        <div>
          {/* Funding Card */}
          <div
            style={{
              background: "#0d0d1a",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16,
              padding: 28,
              marginBottom: 20,
              position: "sticky",
              top: 24,
            }}
          >
            <FundingProgress
              current={listing.currentFunded}
              goal={listing.goalAmount}
            />

            <div style={{ marginTop: 20, marginBottom: 24 }}>
              <div
                style={{
                  fontSize: 38,
                  fontWeight: 800,
                  color: "#00e676",
                  lineHeight: 1,
                  letterSpacing: "-0.03em",
                }}
              >
                {formatUSD(listing.currentFunded)}
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#555",
                    marginLeft: 8,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {listing.tokenSymbol}
                </span>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#666",
                  marginTop: 4,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                pledged of {formatUSD(listing.goalAmount)} goal
              </div>
            </div>

            {/* Stats Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 1,
                background: "rgba(255,255,255,0.04)",
                borderRadius: 10,
                overflow: "hidden",
                marginBottom: 24,
              }}
            >
              <div
                style={{ background: "#0d0d1a", padding: 16, textAlign: "center" }}
              >
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#fff",
                  }}
                >
                  {funders?.length ?? 0}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#555",
                    fontFamily: "'JetBrains Mono', monospace",
                    textTransform: "uppercase",
                  }}
                >
                  backers
                </div>
              </div>
              <div
                style={{ background: "#0d0d1a", padding: 16, textAlign: "center" }}
              >
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#fff",
                  }}
                >
                  {Math.round(pct)}%
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#555",
                    fontFamily: "'JetBrains Mono', monospace",
                    textTransform: "uppercase",
                  }}
                >
                  funded
                </div>
              </div>
              <div
                style={{ background: "#0d0d1a", padding: 16, textAlign: "center" }}
              >
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#fff",
                  }}
                >
                  {daysLeft}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#555",
                    fontFamily: "'JetBrains Mono', monospace",
                    textTransform: "uppercase",
                  }}
                >
                  days left
                </div>
              </div>
            </div>

            {/* Fund Button */}
            <button
              onClick={() => setShowFundModal(true)}
              style={{
                width: "100%",
                padding: "16px 0",
                background: "linear-gradient(135deg, #00e676 0%, #00c853 100%)",
                border: "none",
                borderRadius: 10,
                color: "#000",
                fontSize: 16,
                fontWeight: 800,
                cursor: "pointer",
                letterSpacing: "0.02em",
                boxShadow: "0 4px 24px rgba(0,230,118,0.2)",
                transition: "transform 0.1s, box-shadow 0.2s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 6px 32px rgba(0,230,118,0.3)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,230,118,0.2)";
              }}
            >
              Fund This Project →
            </button>

            <div
              style={{
                textAlign: "center",
                marginTop: 12,
                fontSize: 11,
                color: "#444",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Demo mode • No wallet required
            </div>
          </div>

          {/* Backers List */}
          {funders && funders.length > 0 && (
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
                  Recent Backers
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "#444",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {funders.length} total
                </span>
              </div>
              {funders.slice(0, 5).map((backer: any, i: number) => (
                <BackerRow key={backer._id} backer={backer} index={i} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: 24,
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

      {/* Fund Modal */}
      {showFundModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => !isFunding && setShowFundModal(false)}
        >
          <div
            style={{
              background: "#0d0d1a",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
              padding: 32,
              width: "100%",
              maxWidth: 420,
              margin: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {fundSuccess ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    margin: "0 auto 16px",
                    background: "rgba(0,230,118,0.12)",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#00e676"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: "#fff",
                    marginBottom: 8,
                  }}
                >
                  Funded! 🎉
                </h3>
                <p style={{ color: "#666", fontSize: 13 }}>
                  Your contribution has been recorded
                </p>
              </div>
            ) : (
              <>
                <h2
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#fff",
                    marginBottom: 8,
                  }}
                >
                  Fund This Project
                </h2>
                <p
                  style={{
                    fontSize: 13,
                    color: "#666",
                    marginBottom: 24,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  Demo mode — no real funds required
                </p>

                <div style={{ marginBottom: 20 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#888",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 8,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    Your Name (optional)
                  </label>
                  <input
                    type="text"
                    value={backerName}
                    onChange={(e) => setBackerName(e.target.value)}
                    placeholder="Anonymous Backer"
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      background: "#111122",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 8,
                      color: "#fff",
                      fontSize: 15,
                      outline: "none",
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  />
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#888",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 8,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    Amount (USDC)
                  </label>
                  <input
                    type="number"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    placeholder="1000"
                    min="1"
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      background: "#111122",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 8,
                      color: "#fff",
                      fontSize: 15,
                      outline: "none",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  />
                </div>

                {/* Quick amounts */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 24,
                  }}
                >
                  {[100, 500, 1000, 5000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setFundAmount(amt.toString())}
                      style={{
                        flex: 1,
                        padding: "8px 0",
                        background:
                          fundAmount === amt.toString()
                            ? "rgba(0,230,118,0.15)"
                            : "rgba(255,255,255,0.04)",
                        border:
                          fundAmount === amt.toString()
                            ? "1px solid rgba(0,230,118,0.3)"
                            : "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 6,
                        color:
                          fundAmount === amt.toString() ? "#00e676" : "#888",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    onClick={() => setShowFundModal(false)}
                    disabled={isFunding}
                    style={{
                      flex: 1,
                      padding: "14px 0",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      color: "#888",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFund}
                    disabled={isFunding || !fundAmount}
                    style={{
                      flex: 2,
                      padding: "14px 0",
                      background:
                        isFunding || !fundAmount
                          ? "#333"
                          : "linear-gradient(135deg, #00e676 0%, #00c853 100%)",
                      border: "none",
                      borderRadius: 8,
                      color: isFunding || !fundAmount ? "#666" : "#000",
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: isFunding || !fundAmount ? "not-allowed" : "pointer",
                    }}
                  >
                    {isFunding ? "Processing..." : `Fund ${fundAmount ? `$${fundAmount}` : ""} USDC`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
