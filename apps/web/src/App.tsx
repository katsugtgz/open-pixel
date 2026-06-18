import { createClient } from "@supabase/supabase-js";
import { useMemo, useState } from "react";
import {
  buildProofMessage,
  createGuestId,
  SECURITY_RECEIPT,
} from "@open-pixel/shared";
import "./App.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;
const gameUrl = import.meta.env.VITE_GAME_URL || "/game";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

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
      displayName,
      questId: "Quest #1 — Gather Pixel Shards",
      points: 130,
      shards: 3,
      completedAt: new Date().toISOString(),
    }),
    [displayName, guestId],
  );

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
      await supabase.from("quest_runs").upsert({
        id: questRun.id,
        guest_id: questRun.guestId,
        display_name: questRun.displayName,
        quest_id: questRun.questId,
        points: questRun.points,
        shards: questRun.shards,
        completed_at: questRun.completedAt,
      });
      await supabase.from("wallet_proofs").upsert({
        quest_run_id: questRun.id,
        wallet_address: walletAddress,
        message,
        signature: sig,
        method: "personal_sign",
        verified_at: new Date().toISOString(),
      });
    }
  }

  return (
    <main>
      <section className="hero-card">
        <p className="eyebrow">Zero Cup 2026 concept build</p>
        <h1>Open Pixel</h1>
        <p className="subtitle">
          AI-native pixel quest RPG: explore, gather shards, earn off-chain
          points, then optionally prove your run with a safe readable wallet
          signature.
        </p>
        <div className="actions">
          <a className="primary" href={gameUrl}>
            Play demo
          </a>
          <a className="secondary" href="https://github.com/" target="_blank">
            View repo
          </a>
        </div>
      </section>

      <section className="grid">
        <article className="panel">
          <h2>Guest claim</h2>
          <label>
            Display name
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
          <p>
            <strong>Guest ID:</strong> {guestId}
          </p>
          <p>
            <strong>Quest:</strong> {questRun.questId}
          </p>
          <p>
            <strong>Result:</strong> {questRun.shards}/3 shards ·{" "}
            {questRun.points} points
          </p>
          <button
            onClick={() =>
              setStatus(
                "Guest badge ready. Wallet verification remains optional.",
              )
            }
          >
            Claim guest badge
          </button>
        </article>

        <article className="panel safe">
          <h2>Optional wallet proof</h2>
          <ul>
            <li>No transaction</li>
            <li>No gas</li>
            <li>No token or NFT approval</li>
            <li>No swap, permit, or contract call</li>
            <li>Only a readable personal_sign message</li>
          </ul>
          <button onClick={connectWallet}>
            {walletAddress
              ? `Connected ${shortAddress(walletAddress)}`
              : "Connect wallet"}
          </button>
          <button onClick={signProof} disabled={!walletAddress}>
            Sign readable proof
          </button>
        </article>

        <article className="panel receipt">
          <h2>Security receipt</h2>
          {Object.entries(SECURITY_RECEIPT).map(([key, value]) => (
            <p key={key}>
              <span>{key}</span>
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

      <section className="panel wide">
        <h2>Status</h2>
        <p>{status}</p>
        <p className="note">
          Supabase is optional at runtime until env vars are configured.
          Frontend uses anon key only; service_role never ships to browser.
        </p>
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
