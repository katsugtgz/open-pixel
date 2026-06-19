import { useEffect, useReducer, useState } from "react";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  buildProofMessage,
  createGuestId,
  createRandomId,
  formatSupabaseError,
  normalizeLeaderboardRows,
  parseStoredQuestRun,
  SECURITY_RECEIPT,
  type LeaderboardRow,
} from "@open-pixel/shared";
import ProofCertificate from "@/components/ProofCertificate";
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
  issuedAt: string;
  expirationTime: string;
  proofMessage: string;
  claimNonce: number;
};

type AppAction =
  | { type: "displayName"; value: string }
  | { type: "walletAddress"; value: string }
  | { type: "status"; value: string }
  | { type: "claimNonce" }
  | {
      type: "proof";
      value: {
        signature: string;
        issuedAt: string;
        expirationTime: string;
        proofMessage: string;
      };
    };

function getGuestId() {
  const existing = localStorage.getItem("open_pixel_guest_id");
  if (existing) return existing;
  const next = createGuestId();
  localStorage.setItem("open_pixel_guest_id", next);
  return next;
}

const PROOF_SESSION_KEY = "open_pixel_proof_v1";

type ProofSession = {
  signature: string;
  issuedAt: string;
  expirationTime: string;
  proofMessage: string;
};

function loadProofSession(): ProofSession | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PROOF_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ProofSession>;
    if (
      typeof parsed.signature !== "string" ||
      typeof parsed.issuedAt !== "string" ||
      typeof parsed.expirationTime !== "string" ||
      typeof parsed.proofMessage !== "string" ||
      !parsed.signature ||
      !parsed.proofMessage
    ) {
      return null;
    }
    return {
      signature: parsed.signature,
      issuedAt: parsed.issuedAt,
      expirationTime: parsed.expirationTime,
      proofMessage: parsed.proofMessage,
    };
  } catch {
    return null;
  }
}

function saveProofSession(value: ProofSession): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(PROOF_SESSION_KEY, JSON.stringify(value));
  } catch {
    // sessionStorage unavailable (private mode, quota); non-fatal
  }
}

function initialState(): AppState {
  const proof = loadProofSession();
  return {
    guestId: getGuestId(),
    displayName: "Pixel Runner",
    walletAddress: "",
    signature: proof?.signature ?? "",
    status: "Ready. Play as guest; wallet proof is optional.",
    issuedAt: proof?.issuedAt ?? "",
    expirationTime: proof?.expirationTime ?? "",
    proofMessage: proof?.proofMessage ?? "",
    claimNonce: 0,
  };
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "displayName":
      return { ...state, displayName: action.value };
    case "walletAddress":
      return { ...state, walletAddress: action.value };
    case "status":
      return { ...state, status: action.value };
    case "claimNonce":
      return { ...state, claimNonce: state.claimNonce + 1 };
    case "proof":
      return {
        ...state,
        signature: action.value.signature,
        issuedAt: action.value.issuedAt,
        expirationTime: action.value.expirationTime,
        proofMessage: action.value.proofMessage,
      };
  }
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

type LeaderboardState = {
  rows: LeaderboardRow[];
  demoData: boolean;
  loading: boolean;
};

function useLeaderboard(deps: {
  enabled: boolean;
  claimNonce: number;
}): LeaderboardState {
  const [state, setState] = useState<LeaderboardState>(() => ({
    rows: [],
    demoData: !deps.enabled,
    loading: deps.enabled,
  }));

  useEffect(() => {
    if (!deps.enabled || !supabase) {
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("leaderboard")
          .select("*")
          .limit(10)
          .abortSignal(controller.signal);
        if (cancelled) return;
        if (error) {
          setState({ rows: [], demoData: true, loading: false });
          return;
        }
        setState({
          rows: normalizeLeaderboardRows(data),
          demoData: false,
          loading: false,
        });
      } catch {
        if (!cancelled) {
          setState({ rows: [], demoData: true, loading: false });
        }
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [deps.enabled, deps.claimNonce]);

  return state;
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

function LeaderboardPanel({
  rows,
  demoData,
  loading,
}: {
  rows: LeaderboardRow[];
  demoData: boolean;
  loading: boolean;
}) {
  return (
    <article className="panel leaderboard-panel">
      <p className="eyebrow">Leaderboard shell</p>
      <h2>Proof-ready scores</h2>
      {demoData && (
        <p className="demo-data-tag">
          demo data · connect Supabase to see live scores
        </p>
      )}
      {loading && <p className="leaderboard-loading">Loading live scores…</p>}
      {!loading && !demoData && rows.length === 0 && (
        <p className="leaderboard-empty">No runs yet — be the first.</p>
      )}
      {rows.map((row, index) => (
        <div className="leaderboard-row" key={row.guestId}>
          <strong>#{index + 1}</strong>
          <span>{row.displayName}</span>
          <em>{row.totalPoints} pts</em>
          <small>{row.completedRuns} run(s)</small>
        </div>
      ))}
    </article>
  );
}

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

      <LeaderboardPanel
        rows={leaderboard.rows}
        demoData={leaderboard.demoData}
        loading={leaderboard.loading}
      />
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
          {`Receipt: ${SECURITY_RECEIPT.method} only · no contract call · no token approval`}
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
  const leaderboard = useLeaderboard({
    enabled: !!supabase,
    claimNonce: state.claimNonce,
  });

  const [questRun, setQuestRun] = useState<QuestRunView>(() => {
    const stored = parseStoredQuestRun(
      typeof localStorage !== "undefined"
        ? localStorage.getItem("open_pixel_quest_run_v1")
        : null,
    );
    return (
      stored ?? {
        id: `run_${state.guestId.slice(-8)}`,
        guestId: state.guestId,
        displayName: state.displayName.trim() || "Pixel Runner",
        questId: "Quest #1 — Gather Pixel Shards",
        points: 130,
        shards: 3,
        completedAt: new Date().toISOString(),
      }
    );
  });

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== "open_pixel_quest_run_v1") return;
      const parsed = parseStoredQuestRun(event.newValue);
      if (parsed) setQuestRun(parsed);
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

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
    dispatch({ type: "claimNonce" });
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

    dispatch({
      type: "proof",
      value: {
        signature: sig,
        issuedAt: now.toISOString(),
        expirationTime: expires.toISOString(),
        proofMessage: message,
      },
    });
    saveProofSession({
      signature: sig,
      issuedAt: now.toISOString(),
      expirationTime: expires.toISOString(),
      proofMessage: message,
    });
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
      {state.signature && state.proofMessage && (
        <ProofCertificate
          walletAddress={state.walletAddress}
          questRunId={questRun.id}
          questId={questRun.questId}
          points={questRun.points}
          issuedAt={state.issuedAt}
          expirationTime={state.expirationTime}
          proofMessage={state.proofMessage}
          signature={state.signature}
        />
      )}
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
