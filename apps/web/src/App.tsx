import { useEffect, useMemo, useReducer } from "react";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  buildProofMessage,
  createGuestId,
  createRandomId,
  formatSupabaseError,
  type QuestRun,
  type QuestRunResources,
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
    body: "Harvest crops, gather wood and ore, fulfill village orders.",
    stat: "off-chain pts",
  },
  {
    title: "Prove",
    body: "Claim a badge. Wallet proof stays optional and readable.",
    stat: "safe proof",
  },
];

const mockLeaderboard = [
  { name: "Pixel Runner", score: 130, tag: "guest" },
  { name: "Shard Scout", score: 90, tag: "proof ready" },
  { name: "Moss Farmer", score: 70, tag: "guest" },
];

export type VillageProgress = {
  points: number;
  resources: QuestRunResources;
  completedAt?: string;
};

export type AppState = {
  guestId: string;
  displayName: string;
  walletAddress: string;
  signature: string;
  status: string;
  villageProgress?: VillageProgress;
};

export type AppAction =
  | { type: "displayName"; value: string }
  | { type: "walletAddress"; value: string }
  | { type: "signature"; value: string }
  | { type: "status"; value: string }
  | { type: "villageProgress"; value: VillageProgress };

export function getGuestId() {
  const existing = localStorage.getItem("open_pixel_guest_id");
  if (existing) return existing;
  const next = createGuestId();
  localStorage.setItem("open_pixel_guest_id", next);
  return next;
}

export function initialState(): AppState {
  return {
    guestId: getGuestId(),
    displayName: "Pixel Runner",
    walletAddress: "",
    signature: "",
    status: "Ready. Play as guest; wallet proof is optional.",
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "displayName":
      return { ...state, displayName: action.value };
    case "walletAddress":
      return { ...state, walletAddress: action.value };
    case "signature":
      return { ...state, signature: action.value };
    case "status":
      return { ...state, status: action.value };
    case "villageProgress":
      return { ...state, villageProgress: action.value };
  }
}

const DEFAULT_RESOURCES: QuestRunResources = {
  popberry: 0,
  whittlewood_log: 0,
  ochrux_matrix: 0,
};

/**
 * Build the QuestRun from live village state, not literals.
 */
export function buildQuestRunFromState(state: AppState): QuestRun {
  const progress = state.villageProgress;
  const completedAt = progress?.completedAt ?? new Date(0).toISOString();
  return {
    id: `run_${state.guestId.slice(-8)}`,
    guestId: state.guestId,
    displayName: state.displayName.trim() || "Pixel Runner",
    questId: "Quest #1 — Village Resource Loop",
    points: progress?.points ?? 0,
    resources: progress?.resources ?? DEFAULT_RESOURCES,
    shards: progress?.completedAt ? 3 : 0,
    completedAt,
  };
}

export function canClaimGuestBadge(state: AppState): boolean {
  return state.villageProgress?.completedAt != null;
}

// Security: postMessage is broadcast to any listener. Pin the expected game
// origin so a malicious iframe cannot forge a village:complete payload that
// persists fake points. Relative or unset VITE_GAME_URL falls back to same-origin.
const EXPECTED_GAME_ORIGIN = (() => {
  const configured = import.meta.env.VITE_GAME_URL as string | undefined;
  if (!configured) return window.location.origin;
  try {
    return new URL(configured, window.location.href).origin;
  } catch {
    return window.location.origin;
  }
})();

// Hackathon bridge: game runs on a separate origin and player.emit only reaches
// the in-game socket (see apps/game/src/modules/village/proof-bridge.ts). This
// handler accepts the same payload via window.postMessage (cross-origin iframe)
// or a CustomEvent-shaped event (same-page embedding) until a real socket lands.
export function makeVillageBridgeHandler(
  dispatch: (action: AppAction) => void,
): (event: MessageEvent | CustomEvent) => void {
  return (event) => {
    // Reject forged cross-origin postMessage; CustomEvent is same-page, no origin.
    if (
      event instanceof MessageEvent &&
      event.origin !== EXPECTED_GAME_ORIGIN
    ) {
      return;
    }
    const messageEvent = event as Partial<MessageEvent>;
    const customEvent = event as Partial<CustomEvent>;
    const data = (messageEvent.data ?? customEvent.detail) as
      | {
          type?: unknown;
          payload?: VillageProgress;
        }
      | undefined;
    if (!data || data.type !== "village:complete") return;
    if (!data.payload) return;
    dispatch({ type: "villageProgress", value: data.payload });
  };
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
          Harvest crops, gather wood and ore, fulfill village orders, then claim
          an off-chain badge. Wallet proof stays optional and readable.
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
          <strong>Village Loop</strong>
          <span>Popberry · WhittlewoodLog · OchruxMatrix → off-chain pts</span>
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
        <h2>Three steps: gather, fulfill, claim.</h2>
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

function DesignSection() {
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
        {mockLeaderboard.map((row, index) => (
          <div className="leaderboard-row" key={row.name}>
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
        <h2>Claim the demo badge.</h2>
        <p className="claim-note">
          Complete village orders in the game to earn resources and off-chain
          points, then claim your badge here. Your run syncs through Supabase;
          no wallet is required.
        </p>
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
            <span>Resources</span>
            <strong>
              {questRun.resources.popberry} Popberry ·{" "}
              {questRun.resources.whittlewood_log} WhittlewoodLog ·{" "}
              {questRun.resources.ochrux_matrix} OchruxMatrix ·{" "}
              {questRun.points} pts
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

  const questRun = useMemo(() => buildQuestRunFromState(state), [state]);

  // FIX 2 — register hackathon bridge listeners (postMessage + custom event).
  useEffect(() => {
    const handler = makeVillageBridgeHandler(dispatch);
    window.addEventListener("message", handler);
    window.addEventListener("village:complete", handler as EventListener);
    return () => {
      window.removeEventListener("message", handler);
      window.removeEventListener("village:complete", handler as EventListener);
    };
  }, []);

  function setStatus(value: string) {
    dispatch({ type: "status", value });
  }

  async function saveGuestClaim(showSuccess = true) {
    if (!canClaimGuestBadge(state)) {
      setStatus(
        "Complete the village quest first, then claim your guest badge.",
      );
      return false;
    }

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
      resources: questRun.resources,
      shards: questRun.shards ?? 0,
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

  return (
    <main className="site-shell">
      <Topbar />
      <HeroSection />
      <LoopSection />
      <DesignSection />
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
