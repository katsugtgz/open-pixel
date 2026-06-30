import { useEffect, useMemo, useReducer, useState } from "react";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  buildProofMessage,
  createGuestId,
  createRandomId,
  formatSupabaseError,
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
    body: "Talk to the AI Guide, then collect 3 cyan Pixel Shards.",
    stat: "+130 pts",
  },
  {
    title: "Prove",
    body: "Claim a badge. Wallet proof stays optional and readable.",
    stat: "safe proof",
  },
];

const mockLeaderboard: LeaderboardEntry[] = [
  { name: "Pixel Runner", score: 130, tag: "guest" },
  { name: "Shard Scout", score: 90, tag: "proof ready" },
  { name: "Moss Farmer", score: 70, tag: "guest" },
];

const initialLeaderboard: LeaderboardState = {
  rows: mockLeaderboard,
  loading: false,
};

type QuestRunView = {
  id: string;
  guestId: string;
  displayName: string;
  questId: string;
  points: number;
  shards: number;
  completedAt: string;
};

type AppState = {
  guestId: string;
  displayName: string;
  walletAddress: string;
  signature: string;
  status: string;
};

type AppAction =
  | { type: "displayName"; value: string }
  | { type: "walletAddress"; value: string }
  | { type: "signature"; value: string }
  | { type: "status"; value: string };

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
  }
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function Topbar() {
  return (
    <nav className="topbar" aria-label="Open Pixel navigation">
      <a className="brand" href="#top" aria-label="Open Pixel home">
        <span className="brand-mark" aria-hidden="true">
          OP
        </span>
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
        <p className="eyebrow">Zero Cup 2026 · Cozy Web3 RPG</p>
        <h1>Play a cozy pixel quest. No wallet required.</h1>
        <div className="actions">
          <a className="button primary" href={gameUrl}>
            Play demo
          </a>
          <a className="button secondary" href="#claim">
            Claim badge
          </a>
        </div>
        <p className="subtitle">
          Talk to the AI Guide, collect 3 Pixel Shards, claim an off-chain
          badge. Wallet proof stays optional and readable.
        </p>
        <div className="control-guide" aria-label="Demo controls">
          <span className="desktop-control">Desktop: Arrow keys to move</span>
          <span className="desktop-control">Space to talk / collect</span>
          <span className="mobile-control">Mobile: joystick + A button</span>
        </div>
        <div className="trust-row" aria-label="Safety summary">
          <span>guest-first</span>
          <span>no gas / no token</span>
          <span>optional personal_sign</span>
        </div>
      </div>

      <div className="pixel-window" aria-label="Pixel quest world preview">
        <div className="sun" />
        <div className="cloud cloud-one" />
        <div className="cloud cloud-two" />
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
          <span>Gather 3 Pixel Shards → +130 pts</span>
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

type LeaderboardEntry = {
  name: string;
  score: number;
  tag: string;
};

type LeaderboardState = {
  rows: LeaderboardEntry[];
  loading: boolean;
};

function DesignSection({ leaderboard }: { leaderboard: LeaderboardState }) {
  return (
    <section className="split-section">
      <article className="panel economy-panel">
        <p className="eyebrow">Design stance</p>
        <h2>Web3 proof, not Web3 economy.</h2>
        <p>
          Open Pixel keeps quests, identity, gathering, and visible progress. It
          skips token emissions, staking, marketplace loops, and speculative
          rewards.
        </p>
        <div className="comparison">
          <span>Off-chain points</span>
          <span>Guest badge</span>
          <span>Optional proof</span>
        </div>
      </article>

      <article className="panel leaderboard-panel">
        <p className="eyebrow">Leaderboard shell</p>
        <h2>Proof-ready scores</h2>
        {leaderboard.loading ? (
          <div className="leaderboard-row">
            <strong>…</strong>
            <span>Loading live scores…</span>
          </div>
        ) : (
          leaderboard.rows.map((row, index) => (
            <div className="leaderboard-row" key={`${row.name}-${index}`}>
              <strong>#{index + 1}</strong>
              <span>{row.name}</span>
              <em>{row.score} pts</em>
              <small>{row.tag}</small>
            </div>
          ))
        )}
      </article>
    </section>
  );
}

type ClaimSectionProps = {
  state: AppState;
  questRun: QuestRunView;
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
        <h2>Claim the demo badge.</h2>
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
              {questRun.shards}/3 shards · {questRun.points} pts
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
          Receipt: personal_sign only · no contract call · no token approval
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
  const [leaderboard, setLeaderboard] =
    useState<LeaderboardState>(initialLeaderboard);

  const questRun = useMemo(
    () => ({
      id: `run_${state.guestId.slice(-8)}`,
      guestId: state.guestId,
      displayName: state.displayName.trim() || "Pixel Runner",
      questId: "Quest #1 — Gather Pixel Shards",
      points: 130,
      shards: 3,
      completedAt: new Date().toISOString(),
    }),
    [state.displayName, state.guestId],
  );

  function setStatus(value: string) {
    dispatch({ type: "status", value });
  }

  async function saveGuestClaim(showSuccess = true) {
    if (!supabase) {
      setStatus("Guest badge ready locally. Add Supabase env to sync online.");
      return true;
    }

    const { error: playerError } = await supabase.from("players").upsert(
      {
        guest_id: questRun.guestId,
        wallet_address: state.walletAddress || null,
        display_name: questRun.displayName,
      },
      { onConflict: "guest_id" },
    );

    if (playerError) {
      setStatus(
        formatSupabaseError("Supabase player save failed", playerError),
      );
      return false;
    }

    const { error: questError } = await supabase.from("quest_runs").upsert({
      id: questRun.id,
      guest_id: questRun.guestId,
      display_name: questRun.displayName,
      quest_id: questRun.questId,
      points: questRun.points,
      shards: questRun.shards,
      completed_at: questRun.completedAt,
    });

    if (questError) {
      setStatus(formatSupabaseError("Supabase quest save failed", questError));
      return false;
    }

    if (showSuccess) {
      setStatus("Guest badge synced. Wallet proof remains optional.");
    }
    return true;
  }

  async function connectWallet() {
    const ethereum = window.ethereum;
    if (!ethereum) {
      setStatus("No wallet detected. You can still use guest claim.");
      return;
    }
    const accounts = (await ethereum.request({
      method: "eth_requestAccounts",
    })) as string[];
    dispatch({ type: "walletAddress", value: accounts[0] || "" });
    setStatus("Wallet connected. No approval or transaction requested.");
  }

  async function signProof() {
    const ethereum = window.ethereum;
    if (!ethereum || !state.walletAddress) {
      setStatus("Connect wallet first, or stay in guest mode.");
      return;
    }

    const claimSaved = await saveGuestClaim(false);
    if (!claimSaved) return;

    const now = new Date();
    const expires = new Date(now.getTime() + 10 * 60 * 1000);
    const message = buildProofMessage({
      domain: window.location.host,
      walletAddress: state.walletAddress,
      questRunId: questRun.id,
      questId: questRun.questId,
      points: questRun.points,
      nonce: createRandomId(),
      issuedAt: now.toISOString(),
      expirationTime: expires.toISOString(),
    });

    const sig = (await ethereum.request({
      method: "personal_sign",
      params: [message, state.walletAddress],
    })) as string;

    dispatch({ type: "signature", value: sig });
    setStatus("Proof signed with personal_sign. No transaction sent.");

    if (supabase) {
      const { error } = await supabase.from("wallet_proofs").upsert(
        {
          quest_run_id: questRun.id,
          wallet_address: state.walletAddress,
          message,
          signature: sig,
          method: "personal_sign",
          verified_at: new Date().toISOString(),
        },
        { onConflict: "quest_run_id,wallet_address" },
      );

      if (error) {
        setStatus(
          formatSupabaseError(
            "Proof signed, but Supabase proof save failed",
            error,
          ),
        );
        return;
      }
      setStatus("Proof signed and synced. personal_sign only; no tx.");
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function fetchLeaderboard() {
      if (!supabase) return;

      setLeaderboard((prev) => ({ ...prev, loading: true }));

      const { data, error } = await supabase
        .from("leaderboard")
        .select("display_name, total_points, completed_runs, last_completed_at")
        .order("total_points", { ascending: false })
        .limit(5);

      if (cancelled) return;

      if (error || !data || data.length === 0) {
        setLeaderboard({ rows: mockLeaderboard, loading: false });
        return;
      }

      const rows: LeaderboardEntry[] = data.map((row) => ({
        name: row.display_name || "Anonymous",
        score: row.total_points ?? 0,
        tag: row.completed_runs > 1 ? `${row.completed_runs} runs` : "guest",
      }));

      setLeaderboard({ rows, loading: false });
    }

    void fetchLeaderboard();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="site-shell">
      <Topbar />
      <HeroSection />
      <LoopSection />
      <DesignSection leaderboard={leaderboard} />
      <ClaimSection
        state={state}
        questRun={questRun}
        onDisplayNameChange={(value) =>
          dispatch({ type: "displayName", value })
        }
        onClaim={() => void saveGuestClaim()}
        onConnectWallet={() => void connectWallet()}
        onSignProof={() => void signProof()}
      />
      <StatusBar status={state.status} />
    </main>
  );
}

declare global {
  interface Window {
    ethereum?: {
      request(args: { method: string; params?: unknown[] }): Promise<unknown>;
    };
  }
}

export default App;
