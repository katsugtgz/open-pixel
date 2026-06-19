import { useEffect, useRef, useState } from "react";
import { SECURITY_RECEIPT } from "@open-pixel/shared";

type ProofCertificateProps = {
  walletAddress: string;
  questRunId: string;
  questId: string;
  points: number;
  issuedAt: string;
  expirationTime: string;
  proofMessage: string;
  signature: string;
};

const RECEIPT_LABELS: ReadonlyArray<{
  key: keyof typeof SECURITY_RECEIPT;
  label: string;
}> = [
  { key: "method", label: "Method" },
  { key: "transaction", label: "Transaction" },
  { key: "contractCall", label: "Contract call" },
  { key: "tokenApproval", label: "Token approval" },
  { key: "nftApproval", label: "NFT approval" },
  { key: "spender", label: "Spender" },
];

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatTimestamp(iso: string) {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString();
}

export default function ProofCertificate({
  walletAddress,
  questRunId,
  questId,
  points,
  issuedAt,
  expirationTime,
  proofMessage,
  signature,
}: ProofCertificateProps) {
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedSignature, setCopiedSignature] = useState(false);
  const timeouts = useRef<number[]>([]);

  useEffect(() => {
    const pending = timeouts.current;
    return () => {
      pending.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, []);

  function handleCopyMessage() {
    if (!navigator.clipboard) return;
    navigator.clipboard
      .writeText(proofMessage)
      .then(() => {
        setCopiedMessage(true);
        timeouts.current.push(
          window.setTimeout(() => setCopiedMessage(false), 1500),
        );
      })
      .catch(() => {
        setCopiedMessage(false);
      });
  }

  function handleCopySignature() {
    if (!navigator.clipboard) return;
    navigator.clipboard
      .writeText(signature)
      .then(() => {
        setCopiedSignature(true);
        timeouts.current.push(
          window.setTimeout(() => setCopiedSignature(false), 1500),
        );
      })
      .catch(() => {
        setCopiedSignature(false);
      });
  }

  return (
    <section
      className="certificate-panel panel"
      aria-label="Wallet proof certificate"
    >
      <p className="eyebrow">Proof certificate</p>
      <h2>Your readable proof</h2>

      <div className="certificate-summary">
        <div className="summary-field">
          <span>Wallet</span>
          <strong>{walletAddress}</strong>
          <em>{shortAddress(walletAddress)}</em>
        </div>
        <div className="summary-field">
          <span>Quest run</span>
          <strong>{questRunId}</strong>
        </div>
        <div className="summary-field">
          <span>Quest</span>
          <strong>{questId}</strong>
        </div>
        <div className="summary-field">
          <span>Points</span>
          <strong>{points} pts</strong>
        </div>
        <div className="summary-field">
          <span>Issued at</span>
          <strong>{formatTimestamp(issuedAt)}</strong>
        </div>
        <div className="summary-field">
          <span>Expires at</span>
          <strong>{formatTimestamp(expirationTime)}</strong>
        </div>
      </div>

      <pre className="certificate-message">{proofMessage}</pre>
      <pre className="certificate-signature">{signature}</pre>

      <div className="certificate-actions">
        <div className="copy-wrap">
          <button
            className="button secondary copy-button"
            type="button"
            onClick={handleCopyMessage}
          >
            Copy message
          </button>
          {copiedMessage && <span className="copied-tag">Copied</span>}
        </div>
        <div className="copy-wrap">
          <button
            className="button secondary copy-button"
            type="button"
            onClick={handleCopySignature}
          >
            Copy signature
          </button>
          {copiedSignature && <span className="copied-tag">Copied</span>}
        </div>
      </div>

      <div className="receipt-grid" aria-label="Security receipt">
        {RECEIPT_LABELS.map(({ key, label }) => (
          <div className="receipt-line" key={key}>
            <span>{label}</span>
            <strong>{SECURITY_RECEIPT[key]}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
