import { createClient } from "@supabase/supabase-js";
import { useMemo, useState } from "react";
import {
  buildProofMessage,
  createGuestId,
  SECURITY_RECEIPT,
} from "@open-pixel/shared";
import "./App.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
const configuredGameUrl = import.meta.env.VITE_GAME_URL as string | undefined;
const rawGameUrl = configuredGameUrl || "/game/";
const gameUrl = rawGameUrl.endsWith("/game") ? `${rawGameUrl}/` : rawGameUrl;
const repoUrl = "https://github.com/katsugtgz/open-pixel";

const supabase =
  supabaseUrl && supabasePublishableKey
    ? createClient(supabaseUrl, supabasePublishableKey)
    : null;

const pillars = [
  {
    title: "Explore",
    body: "Start as a guest, meet the AI Guide, and enter a cozy pixel field.",
    stat: "guest-first",
  },
  {
    title: "Gather",
    body: "Collect 3 Pixel Shards, complete the quest, and earn off-chain points.",
    stat: "+130 pts",
  },
  {
    title: "Prove",
    body: "Optional wallet receipt uses readable personal_sign only. No tx. No token.",
    stat: "safe proof",
  },
];

const mockLeaderboard = [
  { name: "Pixel Runner", score: 130, tag: "guest" },
  { name: "Shard Scout", score: 90, tag: "proof ready" },
  { name: "Moss Farmer", score: 70, tag: "guest" },
];

function getGuestId() {
  const existing = localStorage.getItem("open_pixel_guest_id");
  if (existing) return existing;
  const next = createGuestId();
  localStorage.setItem("open_pixel_guest_id", next);
  return next;
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function receiptLabel(key: string) {
  return key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`);
}

function App() {
  const [guestId] = useState(getGuestId);
  const [displayName, setDisplayName] = useState("Pixel Runner");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [signature, setSignature] = useState<string>("");
  const [status, setStatus] = useState(
    "Ready. Play as guest; wallet proof is optional.",
  );

  const questRun = useMemo(
    () => ({
      id: `run_${guestId.slice(-8)}`,
      guestId,
      displayName: displayName.trim() || "Pixel Runner",
      questId: "Quest #1 — Gather Pixel Shards",
      points: 130,
      shards: 3,
      completedAt: new Date().toISOString(),
    }),
    [displayName, guestId],
  );

  async function saveGuestClaim(showSuccess = true) {
    if (!supabase) {
      setStatus("Guest badge ready locally. Add Supabase env to sync online.");
      return true;
    }

    const { error: playerError } = await supabase.from("players").upsert(
      {
        guest_id: questRun.guestId,
        wallet_address: walletAddress || null,
        display_name: questRun.displayName,
      },
      { onConflict: "guest_id" },
    );

    if (playerError) {
      setStatus(`Supabase player save failed: ${playerError.message}`);
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
      setStatus(`Supabase quest save failed: ${questError.message}`);
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
    setWalletAddress(accounts[0] || "");
    setStatus("Wallet connected. No approval or transaction requested.");
  }

  async function signProof() {
    const ethereum = window.ethereum;
    if (!ethereum || !walletAddress) {
      setStatus("Connect wallet first, or stay in guest mode.");
      return;
    }

    const claimSaved = await saveGuestClaim(false);
    if (!claimSaved) return;

    const now = new Date();
    const expires = new Date(now.getTime() + 10 * 60 * 1000);
    const message = buildProofMessage({
      domain: window.location.host,
      walletAddress,
      questRunId: questRun.id,
      questId: questRun.questId,
      points: questRun.points,
      nonce: crypto.randomUUID(),
      issuedAt: now.toISOString(),
      expirationTime: expires.toISOString(),
    });

    const sig = (await ethereum.request({
      method: "personal_sign",
      params: [message, walletAddress],
    })) as string;

    setSignature(sig);
    setStatus("Proof signed with personal_sign. No transaction sent.");

    if (supabase) {
      const { error } = await supabase.from("wallet_proofs").upsert(
        {
          quest_run_id: questRun.id,
          wallet_address: walletAddress,
          message,
          signature: sig,
          method: "personal_sign",
          verified_at: new Date().toISOString(),
        },
        { onConflict: "quest_run_id,wallet_address" },
      );

      if (error) {
        setStatus(
          `Proof signed, but Supabase proof save failed: ${error.message}`,
        );
        return;
      }
      setStatus("Proof signed and synced. personal_sign only; no tx.");
    }
  }

  return (
    <main className="site-shell">
      <nav className="topbar" aria-label="Open Pixel navigation">
        <a className="brand" href="#top" aria-label="Open Pixel home">
          <span className="brand-mark" aria-hidden="true">
            OP
          </span>
          <span>Open Pixel</span>
        </a>
        <div className="nav-links">
          <a href="#loop">Loop</a>
          <a href="#claim">Claim</a>
          <a href="#proof">Proof</a>
          <a href={repoUrl} target="_blank">
            GitHub
          </a>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Zero Cup 2026 · Cozy Web3 RPG</p>
          <h1>Quest, gather, prove — without a token economy.</h1>
          <p className="subtitle">
            A Pixels-inspired browser world where guests complete cozy AI
            quests, collect shards, earn off-chain points, then optionally sign
            a readable wallet proof. No gas, no approvals, no RMT loop.
          </p>
          <div className="actions">
            <a className="button primary" href={gameUrl}>
              Play demo
            </a>
            <a className="button secondary" href="#claim">
              Claim badge
            </a>
          </div>
          <div className="trust-row" aria-label="Safety summary">
            <span>guest-first</span>
            <span>no token</span>
            <span>personal_sign only</span>
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

      <section className="section" id="loop">
        <div className="section-heading">
          <p className="eyebrow">Gameplay loop</p>
          <h2>Small, playable, submission-ready.</h2>
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

      <section className="split-section">
        <article className="panel economy-panel">
          <p className="eyebrow">Design stance</p>
          <h2>Borrow the cozy world feel, not the fragile economy.</h2>
          <p>
            Open Pixel keeps the fun parts: quests, social identity, resource
            gathering, visible progress. It skips token emissions, staking,
            marketplace loops, and speculative rewards for this contest build.
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

      <section className="claim-grid" id="claim">
        <article className="panel claim-panel">
          <p className="eyebrow">Guest claim</p>
          <h2>Claim the demo badge.</h2>
          <label>
            Display name
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
          <div className="claim-stats">
            <p>
              <span>Guest ID</span>
              <strong>{guestId}</strong>
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
          <button
            className="button primary"
            onClick={() => void saveGuestClaim()}
          >
            Claim guest badge
          </button>
        </article>

        <article className="panel wallet-panel" id="proof">
          <p className="eyebrow">Optional wallet proof</p>
          <h2>Readable signature. Nothing else.</h2>
          <ul>
            <li>No transaction</li>
            <li>No gas</li>
            <li>No token or NFT approval</li>
            <li>No swap, permit, or contract call</li>
            <li>Only a readable personal_sign message</li>
          </ul>
          <div className="wallet-actions">
            <button className="button secondary" onClick={connectWallet}>
              {walletAddress
                ? `Connected ${shortAddress(walletAddress)}`
                : "Connect wallet"}
            </button>
            <button
              className="button primary"
              onClick={signProof}
              disabled={!walletAddress}
            >
              Sign readable proof
            </button>
          </div>
        </article>

        <article className="panel receipt-panel">
          <p className="eyebrow">Security receipt</p>
          <h2>What happened?</h2>
          {Object.entries(SECURITY_RECEIPT).map(([key, value]) => (
            <p key={key}>
              <span>{receiptLabel(key)}</span>
              <strong>{String(value)}</strong>
            </p>
          ))}
          {signature && (
            <p>
              <span>signature</span>
              <strong>{shortAddress(signature)}</strong>
            </p>
          )}
        </article>
      </section>

      <section className="status-bar" aria-live="polite">
        <strong>Status</strong>
        <span>{status}</span>
      </section>
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
