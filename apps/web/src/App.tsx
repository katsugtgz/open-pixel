import { useEffect, useMemo, useReducer } from "react";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  connectWallet,
  saveGuestClaim,
  signQuestProof,
  type WalletAdapter,
} from "@/lib/claimProof";
import { loadLeaderboard } from "@/lib/leaderboard";
import {
  createDemoQuestRun,
  createGuestId,
  DEMO_LEADERBOARD_ROWS,
  type LeaderboardEntry,
  type QuestRun,
} from "@open-pixel/shared";
import "./App.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
const configuredGameUrl = import.meta.env.VITE_GAME_URL as string | undefined;
const defaultGameUrl = import.meta.env.DEV
  ? `${window.location.protocol}//${window.location.hostname}:5174/`
  : "/game/";
const rawGameUrl = configuredGameUrl || defaultGameUrl;
const gameUrl = rawGameUrl.endsWith("/game") ? `${rawGameUrl}/` : rawGameUrl;
const repoUrl = "https://github.com/katsugtgz/open-pixel";

const supabase =
  supabaseUrl && supabasePublishableKey ? createSupabaseBrowserClient() : null;

const pillars = [
  {
    title: "Play",
    body: "Enter as guest. Arrow keys move; Space interacts.",
    stat: "guest-first",
  },
  {
    title: "Gather",
    body: "Talk to AI Guide, then restore 3 village nodes.",
    stat: "+130 pts",
  },
  {
    title: "Prove",
    body: "Claim a badge. Wallet proof stays optional and readable.",
    stat: "safe proof",
  },
];

type AppState = {
  guestId: string;
  displayName: string;
  walletAddress: string;
  signature: string;
  status: string;
  leaderboardRows: LeaderboardEntry[];
  leaderboardSource: "supabase" | "demo";
};

type AppAction =
  | { type: "displayName"; value: string }
  | { type: "walletAddress"; value: string }
  | { type: "signature"; value: string }
  | { type: "status"; value: string }
  | {
      type: "leaderboard";
      rows: LeaderboardEntry[];
      source: "supabase" | "demo";
    };

function getGuestId() {
  const existing = localStorage.getItem("open_pixel_guest_id");
  if (existing) return existing;

  const next = createGuestId();
  localStorage.setItem("open_pixel_guest_id", next);
  return next;
}

function initialState(): AppState {
  return {
    guestId: getGuestId(),
    displayName: "Pixel Runner",
    walletAddress: "",
    signature: "",
    status: "Ready. Play as guest; wallet proof is optional.",
    leaderboardRows: DEMO_LEADERBOARD_ROWS,
    leaderboardSource: "demo",
  };
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "displayName":
      return { ...state, displayName: action.value };
    case "walletAddress":
      return { ...state, walletAddress: action.value };
    case "signature":
      return { ...state, signature: action.value };
    case "status":
      return { ...state, status: action.value };
    case "leaderboard":
      return {
        ...state,
        leaderboardRows: action.rows,
        leaderboardSource: action.source,
      };
  }
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function Topbar() {
  return (
    <nav className="topbar" aria-label="Open Pixel navigation">
      <a className="brand" href="#top" aria-label="Open Pixel home">
        <img
          className="brand-logo"
          src="/brand/open-pixel-logo.jpg"
          alt=""
          aria-hidden="true"
        />
        <span>Open Pixel</span>
      </a>
      <div className="nav-links">
        <a className="nav-play" href={gameUrl}>
          Play demo
        </a>
        <a href="#loop">Loop</a>
        <a href="#claim">Claim</a>
        <a href="#proof">Proof</a>
        <a href={repoUrl} target="_blank">
          GitHub
        </a>
      </div>
    </nav>
  );
}

function HeroSection() {
  return (
    <section className="hero" id="top">
      <div className="hero-copy">
        <p className="eyebrow">Zero Cup 2026 - Cozy Web3 RPG</p>
        <h1>
          Play a cozy pixel quest.
          <span>No wallet required.</span>
        </h1>
        <div className="actions">
          <a className="button primary" href={gameUrl}>
            Play demo
          </a>
          <a className="button secondary" href="#claim">
            Claim badge
          </a>
        </div>
        <p>
          Talk to AI Guide, restore 3 village nodes, claim an off-chain badge.
          Wallet proof stays optional and readable.
        </p>
        <div className="control-guide" aria-label="Demo controls">
          <span className="desktop-control">Desktop: arrow keys move</span>
          <span className="desktop-control">Space collects</span>
          <span className="mobile-control">Mobile: on-screen button</span>
        </div>
        <div className="trust-row" aria-label="Safety summary">
          <span>guest-first</span>
          <span>no token</span>
          <span>personal_sign only</span>
        </div>
      </div>

      <div className="pixel-window" aria-label="Pixel village preview">
        <div className="cloud cloud-one" aria-hidden="true" />
        <div className="cloud cloud-two" aria-hidden="true" />
        <div className="island">
          <div className="tile grass" />
          <div className="tile flower" />
          <div className="tile path" />
          <div className="tile crystal" />
          <div className="tile grass" />
          <div className="tile path" />
          <div className="tile player" />
          <div className="tile npc" />
          <div className="tile crystal small" />
        </div>
        <div className="dialog-card">
          <strong>AI Guide</strong>
          <span>Restore 3 village nodes - +130 pts</span>
        </div>
      </div>
    </section>
  );
}

function LoopSection() {
  return (
    <section className="section" id="loop">
      <div className="section-heading">
        <p className="eyebrow">Demo loop</p>
        <h2>Three steps: talk, gather, claim.</h2>
      </div>
      <div className="pillar-grid">
        {pillars.map((pillar) => (
          <article className="pillar-card" key={pillar.title}>
            <span>{pillar.stat}</span>
            <h3>{pillar.title}</h3>
            <p>{pillar.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function DesignSection({
  rows,
  source,
}: {
  rows: LeaderboardEntry[];
  source: "supabase" | "demo";
}) {
  return (
    <section className="split-section">
      <article className="panel economy-panel">
        <p className="eyebrow">Design stance</p>
        <h2>Web3 proof, not Web3 economy.</h2>
        <p>
          Open Pixel keeps quests, identity, gathering, visible progress. It
          skips token emissions, staking, marketplace loops, speculative
          rewards.
        </p>
        <div className="comparison">
          <span>Off-chain points</span>
          <span>Guest badge</span>
          <span>Optional proof</span>
        </div>
      </article>

      <article className="panel leaderboard-panel">
        <p className="eyebrow">
          {source === "supabase" ? "Live leaderboard" : "Leaderboard demo"}
        </p>
        <h2>Proof-ready scores</h2>
        {rows.map((row, index) => (
          <div className="leaderboard-row" key={`${row.name}-${index}`}>
            <strong>#{index + 1}</strong>
            <span>{row.name}</span>
            <em>{row.score} pts</em>
            <small>{row.tag}</small>
          </div>
        ))}
      </article>
    </section>
  );
}

function VideoSection() {
  return (
    <section className="video-section" aria-labelledby="trailer-title">
      <div className="section-heading">
        <p className="eyebrow">Issue 14 trailer</p>
        <h2 id="trailer-title">Watch Open Pixel quest</h2>
        <p>
          Full audio trailer for judges: cozy RPG loop, AI Guide, village nodes,
          guest badge, optional wallet proof.
        </p>
      </div>
      <div className="video-frame">
        <video
          controls
          preload="metadata"
          playsInline
          poster="/generated/issue-14-thriller-760.png"
          src="/video/open-pixel-issue-14-thriller.mp4"
        >
          <a href="/video/open-pixel-issue-14-thriller.mp4">
            Download Open Pixel Issue 14 trailer.
          </a>
        </video>
      </div>
    </section>
  );
}

type ClaimSectionProps = {
  state: AppState;
  questRun: QuestRun;
  onDisplayNameChange(value: string): void;
  onClaim(): void;
  onConnectWallet(): void;
  onSignProof(): void;
};

function ClaimSection({
  state,
  questRun,
  onDisplayNameChange,
  onClaim,
  onConnectWallet,
  onSignProof,
}: ClaimSectionProps) {
  return (
    <section className="claim-grid" id="claim">
      <article className="panel claim-panel">
        <p className="eyebrow">Guest claim</p>
        <h2>Claim demo badge.</h2>
        <label>
          Display name
          <input
            value={state.displayName}
            onChange={(event) => onDisplayNameChange(event.target.value)}
          />
        </label>
        <div className="claim-stats">
          <p>
            <span>Guest ID</span>
            <strong>{state.guestId}</strong>
          </p>
          <p>
            <span>Quest</span>
            <strong>{questRun.questId}</strong>
          </p>
          <p>
            <span>Result</span>
            <strong>
              {questRun.shards}/3 nodes - {questRun.points} pts
            </strong>
          </p>
        </div>
        <button className="button primary" type="button" onClick={onClaim}>
          Claim guest badge
        </button>
      </article>

      <article className="panel wallet-panel" id="proof">
        <p className="eyebrow">Optional wallet proof</p>
        <h2>Sign only if you want proof.</h2>
        <p>Optional readable personal_sign receipt only.</p>
        <div className="safety-pills" aria-label="Wallet safety summary">
          <span>No gas</span>
          <span>No approvals</span>
          <span>No transaction</span>
        </div>
        <p className="security-receipt">
          Receipt: personal_sign only - no contract call - no token approval
        </p>
        <div className="wallet-actions">
          <button
            className="button secondary"
            type="button"
            onClick={onConnectWallet}
          >
            {state.walletAddress
              ? `Connected ${shortAddress(state.walletAddress)}`
              : "Connect wallet"}
          </button>
          <button
            className="button primary"
            type="button"
            onClick={onSignProof}
            disabled={!state.walletAddress}
          >
            Sign readable proof
          </button>
        </div>
        {!state.walletAddress && (
          <p className="wallet-helper">Connect wallet first to sign proof.</p>
        )}
        {state.signature && (
          <p className="proof-receipt">
            Signed: {shortAddress(state.signature)}
          </p>
        )}
      </article>
    </section>
  );
}

function StatusBar({ status }: { status: string }) {
  return (
    <section className="status-bar" aria-live="polite">
      <strong>Status</strong>
      <span>{status}</span>
    </section>
  );
}

function App() {
  const [state, dispatch] = useReducer(appReducer, undefined, initialState);
  const questRun = useMemo(
    () =>
      createDemoQuestRun({
        guestId: state.guestId,
        displayName: state.displayName,
      }),
    [state.displayName, state.guestId],
  );

  useEffect(() => {
    let cancelled = false;

    void loadLeaderboard(supabase).then((result) => {
      if (cancelled) return;

      dispatch({
        type: "leaderboard",
        rows: result.rows,
        source: result.source,
      });

      if (result.status) {
        dispatch({ type: "status", value: result.status });
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function setStatus(value: string) {
    dispatch({ type: "status", value });
  }

  async function handleClaim() {
    const result = await saveGuestClaim({
      supabase,
      questRun,
      walletAddress: state.walletAddress,
    });
    setStatus(result.status);
  }

  async function handleConnectWallet() {
    const result = await connectWallet(window.ethereum);
    if (result.ok && result.walletAddress) {
      dispatch({ type: "walletAddress", value: result.walletAddress });
    }
    setStatus(result.status);
  }

  async function handleSignProof() {
    const result = await signQuestProof({
      wallet: window.ethereum,
      supabase,
      questRun,
      walletAddress: state.walletAddress,
      domain: window.location.host,
    });

    if (result.signature) {
      dispatch({ type: "signature", value: result.signature });
    }
    setStatus(result.status);
  }

  return (
    <main className="site-shell">
      <Topbar />
      <HeroSection />
      <LoopSection />
      <DesignSection
        rows={state.leaderboardRows}
        source={state.leaderboardSource}
      />
      <VideoSection />
      <ClaimSection
        state={state}
        questRun={questRun}
        onDisplayNameChange={(value) =>
          dispatch({ type: "displayName", value })
        }
        onClaim={() => void handleClaim()}
        onConnectWallet={() => void handleConnectWallet()}
        onSignProof={() => void handleSignProof()}
      />
      <StatusBar status={state.status} />
    </main>
  );
}

declare global {
  interface Window {
    ethereum?: WalletAdapter;
  }
}

export default App;
