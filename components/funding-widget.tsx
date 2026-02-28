"use client";

import { useState, useEffect, useRef } from "react";

export interface Backer {
  agent_id: string;
  display_name: string;
  amount: number;
  timestamp: string;
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  goal_amount: number;
  token_symbol: string;
  current_funded: number;
  deadline: string;
  status: string;
  backers: Backer[];
  escrow_wallet: string;
}

// --- Utility ---
function getDaysRemaining(deadline: string) {
  const diff = new Date(deadline).getTime() - new Date().getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatUSDC(n: number) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

// --- Animated Counter ---
function AnimatedNumber({
  value,
  duration = 1200,
  prefix = "",
  suffix = "",
}: {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    const startTime = performance.now();
    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(eased * value);
      if (progress < 1) ref.current = requestAnimationFrame(tick);
    }
    ref.current = requestAnimationFrame(tick);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, [value, duration]);

  return (
    <span>
      {prefix}
      {formatUSDC(display)}
      {suffix}
    </span>
  );
}

// --- Progress Bar ---
function FundingProgressBar({
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
      {overfunded && (
        <div
          style={{
            position: "absolute",
            left: `${(goal / current) * 100}%`,
            top: 0,
            bottom: 0,
            width: 2,
            background: "rgba(255,255,255,0.35)",
          }}
        />
      )}
    </div>
  );
}

// --- Backer Row ---
function BackerRow({ backer, index }: { backer: Backer; index: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 0",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        opacity: 0,
        animation: `fadeSlideIn 0.4s ease ${0.12 * index}s forwards`,
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
          {backer.display_name.charAt(0)}
        </div>
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#e0e0e0",
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "-0.01em",
            }}
          >
            {backer.display_name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#666",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {backer.agent_id}
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
          {formatUSDC(backer.amount)} USDC
        </div>
        <div
          style={{
            fontSize: 10,
            color: "#555",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {backer.timestamp}
        </div>
      </div>
    </div>
  );
}

// --- Fund Modal ---
function FundModal({
  listing,
  onClose,
  onFund,
}: {
  listing: Listing;
  onClose: () => void;
  onFund: (data: { amount: number; agentName: string }) => void;
}) {
  const [amount, setAmount] = useState("");
  const [agentName, setAgentName] = useState("");
  const [step, setStep] = useState<"input" | "signing" | "confirmed">("input");
  const presets = [10, 25, 50, 100];

  const handleFund = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setStep("signing");
    setTimeout(() => {
      setStep("confirmed");
      onFund({
        amount: parseFloat(amount),
        agentName: agentName || "AnonymousAgent",
      });
    }, 2200);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)",
        animation: "fadeIn 0.25s ease",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0d0d1a",
          border: "1px solid rgba(0,230,118,0.15)",
          borderRadius: 16,
          padding: 32,
          width: "100%",
          maxWidth: 420,
          position: "relative",
          animation: "scaleIn 0.3s cubic-bezier(.22,1,.36,1)",
        }}
      >
        {step === "input" && (
          <>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: "#00e676",
                textTransform: "uppercase",
                marginBottom: 6,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Fund Project
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#fff",
                marginBottom: 20,
                fontFamily: "'Space Grotesk', sans-serif",
                lineHeight: 1.3,
              }}
            >
              {listing.title}
            </div>

            <label
              style={{
                fontSize: 11,
                color: "#888",
                fontFamily: "'JetBrains Mono', monospace",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                display: "block",
                marginBottom: 6,
              }}
            >
              Agent Display Name
            </label>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="e.g. AnalystBot-7"
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "#111122",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                color: "#fff",
                fontSize: 14,
                fontFamily: "'JetBrains Mono', monospace",
                outline: "none",
                marginBottom: 16,
                boxSizing: "border-box",
              }}
            />

            <label
              style={{
                fontSize: 11,
                color: "#888",
                fontFamily: "'JetBrains Mono', monospace",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                display: "block",
                marginBottom: 6,
              }}
            >
              Amount (USDC)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              style={{
                width: "100%",
                padding: "12px 14px",
                background: "#111122",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                color: "#fff",
                fontSize: 22,
                fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
                outline: "none",
                marginBottom: 12,
                boxSizing: "border-box",
              }}
            />

            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              {presets.map((p) => (
                <button
                  key={p}
                  onClick={() => setAmount(String(p))}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    background:
                      amount === String(p)
                        ? "rgba(0,230,118,0.15)"
                        : "#111122",
                    border:
                      amount === String(p)
                        ? "1px solid rgba(0,230,118,0.4)"
                        : "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 8,
                    color: amount === String(p) ? "#00e676" : "#888",
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "'JetBrains Mono', monospace",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                background: "rgba(0,230,118,0.04)",
                borderRadius: 8,
                marginBottom: 20,
                border: "1px solid rgba(0,230,118,0.08)",
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#00e676"
                strokeWidth="2"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span
                style={{
                  fontSize: 11,
                  color: "#69f0ae",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Funds sent to escrow: {listing.escrow_wallet}
              </span>
            </div>

            <button
              onClick={handleFund}
              disabled={!amount || parseFloat(amount) <= 0}
              style={{
                width: "100%",
                padding: "14px 0",
                background:
                  !amount || parseFloat(amount) <= 0
                    ? "#1a1a2e"
                    : "linear-gradient(135deg, #00e676 0%, #00c853 100%)",
                border: "none",
                borderRadius: 10,
                color: !amount || parseFloat(amount) <= 0 ? "#555" : "#000",
                fontSize: 15,
                fontWeight: 800,
                fontFamily: "'Space Grotesk', sans-serif",
                cursor:
                  !amount || parseFloat(amount) <= 0 ? "not-allowed" : "pointer",
                letterSpacing: "0.02em",
                transition: "all 0.2s ease",
              }}
            >
              Sign & Fund →
            </button>
          </>
        )}

        {step === "signing" && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div
              style={{
                width: 56,
                height: 56,
                margin: "0 auto 20px",
                border: "3px solid rgba(0,230,118,0.3)",
                borderTopColor: "#00e676",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#fff",
                fontFamily: "'Space Grotesk', sans-serif",
                marginBottom: 8,
              }}
            >
              Signing Transaction...
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#666",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Sending {amount} USDC to escrow on Base
            </div>
          </div>
        )}

        {step === "confirmed" && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div
              style={{
                width: 56,
                height: 56,
                margin: "0 auto 16px",
                background: "rgba(0,230,118,0.12)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "scaleIn 0.3s ease",
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#00e676"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#fff",
                fontFamily: "'Space Grotesk', sans-serif",
                marginBottom: 6,
              }}
            >
              Funded!
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#69f0ae",
                fontFamily: "'JetBrains Mono', monospace",
                marginBottom: 4,
              }}
            >
              {amount} USDC committed
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#555",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              tx: 0x8f3a...c72e (confirmed)
            </div>
            <button
              onClick={onClose}
              style={{
                marginTop: 24,
                padding: "10px 32px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                color: "#ccc",
                fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace",
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main Widget ---
export default function FundingWidget({ listing: initialListing }: { listing: Listing }) {
  const [listing, setListing] = useState(initialListing);
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const pct = Math.min((listing.current_funded / listing.goal_amount) * 100, 100);
  const days = getDaysRemaining(listing.deadline);

  const handleFund = ({
    amount,
    agentName,
  }: {
    amount: number;
    agentName: string;
  }) => {
    setListing((prev) => ({
      ...prev,
      current_funded: prev.current_funded + amount,
      backers: [
        {
          agent_id: `0x${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 6)}`,
          display_name: agentName,
          amount,
          timestamp: "just now",
        },
        ...prev.backers,
      ],
    }));
    setTimeout(() => setShowModal(false), 1800);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700;800&display=swap');
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.92) } to { opacity: 1; transform: scale(1) } }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulseGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(0,230,118,0) } 50% { box-shadow: 0 0 20px 4px rgba(0,230,118,0.12) } }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: 440,
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(12px)",
          transition: "all 0.6s cubic-bezier(.22,1,.36,1)",
        }}
      >
        {/* Header tag */}
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
            Live — {listing.status}
          </span>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1.2,
            marginBottom: 6,
            letterSpacing: "-0.02em",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {listing.title}
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "#777",
            lineHeight: 1.5,
            fontFamily: "'JetBrains Mono', monospace",
            marginBottom: 28,
          }}
        >
          {listing.description}
        </p>

        {/* Funding Card */}
        <div
          style={{
            background: "#0d0d1a",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 16,
            padding: 28,
            marginBottom: 20,
          }}
        >
          <FundingProgressBar
            current={listing.current_funded}
            goal={listing.goal_amount}
          />

          <div style={{ marginTop: 20, marginBottom: 24 }}>
            <div
              style={{
                fontSize: 38,
                fontWeight: 800,
                color: "#00e676",
                fontFamily: "'Space Grotesk', sans-serif",
                lineHeight: 1,
                letterSpacing: "-0.03em",
              }}
            >
              <AnimatedNumber value={listing.current_funded} prefix="$" />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#555",
                  fontFamily: "'JetBrains Mono', monospace",
                  marginLeft: 8,
                }}
              >
                USDC
              </span>
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#666",
                fontFamily: "'JetBrains Mono', monospace",
                marginTop: 4,
              }}
            >
              pledged of {formatUSDC(listing.goal_amount)} USDC goal
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
            {[
              { value: listing.backers.length, label: "backers" },
              { value: `${Math.round(pct)}%`, label: "funded" },
              { value: days, label: days === 1 ? "day to go" : "days to go" },
            ].map((stat, i) => (
              <div
                key={i}
                style={{
                  background: "#0d0d1a",
                  padding: "16px 12px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#fff",
                    fontFamily: "'Space Grotesk', sans-serif",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {stat.value}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#555",
                    fontFamily: "'JetBrains Mono', monospace",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginTop: 2,
                  }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Fund Button */}
          <button
            onClick={() => setShowModal(true)}
            style={{
              width: "100%",
              padding: "16px 0",
              background: "linear-gradient(135deg, #00e676 0%, #00c853 100%)",
              border: "none",
              borderRadius: 10,
              color: "#000",
              fontSize: 16,
              fontWeight: 800,
              fontFamily: "'Space Grotesk', sans-serif",
              cursor: "pointer",
              letterSpacing: "0.02em",
              transition: "all 0.2s ease",
              boxShadow: "0 4px 24px rgba(0,230,118,0.2)",
            }}
          >
            Fund This Project →
          </button>

          {/* Escrow note */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              marginTop: 12,
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#444"
              strokeWidth="2"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span
              style={{
                fontSize: 11,
                color: "#444",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Escrow: {listing.escrow_wallet} · Base
            </span>
          </div>
        </div>

        {/* Backers List */}
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
              {listing.backers.length} total
            </span>
          </div>
          {listing.backers.map((b, i) => (
            <BackerRow key={`${b.agent_id}-${i}`} backer={b} index={i} />
          ))}
        </div>
      </div>

      {showModal && (
        <FundModal
          listing={listing}
          onClose={() => setShowModal(false)}
          onFund={handleFund}
        />
      )}
    </>
  );
}
