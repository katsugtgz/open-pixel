import {
  createProofMessage,
  formatSupabaseError,
  formatWalletRequestError,
  SUPABASE_TABLES,
  toPlayerRow,
  toQuestRunRow,
  toWalletProofRow,
  type QuestRun,
} from "@open-pixel/shared";

type SupabaseAdapter = {
  from(table: string): {
    upsert(
      row: Record<string, unknown>,
      options?: { onConflict?: string },
    ): PromiseLike<{ error: unknown | null }>;
  };
};

export type WalletAdapter = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

export type ClaimProofStatus = {
  ok: boolean;
  status: string;
  signature?: string;
  walletAddress?: string;
};

export async function saveGuestClaim(input: {
  supabase: SupabaseAdapter | null;
  questRun: QuestRun;
  walletAddress?: string;
  showSuccess?: boolean;
}): Promise<ClaimProofStatus> {
  if (!input.supabase) {
    return {
      ok: true,
      status: "Guest badge ready locally. Add Supabase env to sync online.",
    };
  }

  const { error: playerError } = await input.supabase
    .from(SUPABASE_TABLES.players)
    .upsert(toPlayerRow(input), { onConflict: "guest_id" });

  if (playerError) {
    return {
      ok: false,
      status: formatSupabaseError("Supabase player save failed", playerError),
    };
  }

  const { error: questError } = await input.supabase
    .from(SUPABASE_TABLES.questRuns)
    .upsert(toQuestRunRow(input.questRun));

  if (questError) {
    return {
      ok: false,
      status: formatSupabaseError("Supabase quest save failed", questError),
    };
  }

  return {
    ok: true,
    status:
      input.showSuccess === false
        ? "Guest badge synced."
        : "Guest badge synced. Wallet proof remains optional.",
  };
}

export async function connectWallet(
  wallet: WalletAdapter | undefined,
): Promise<ClaimProofStatus> {
  if (!wallet) {
    return {
      ok: false,
      status: "No wallet detected. You can still use guest claim.",
    };
  }

  try {
    const accounts = (await wallet.request({
      method: "eth_requestAccounts",
    })) as string[];

    return {
      ok: true,
      walletAddress: accounts[0] || "",
      status: "Wallet connected. No approval or transaction requested.",
    };
  } catch (error) {
    return { ok: false, status: formatWalletRequestError(error) };
  }
}

export async function signQuestProof(input: {
  wallet: WalletAdapter | undefined;
  supabase: SupabaseAdapter | null;
  questRun: QuestRun;
  walletAddress: string;
  domain: string;
}): Promise<ClaimProofStatus> {
  if (!input.wallet || !input.walletAddress) {
    return {
      ok: false,
      status: "Connect wallet first, or stay in guest mode.",
    };
  }

  const claim = await saveGuestClaim({
    supabase: input.supabase,
    questRun: input.questRun,
    walletAddress: input.walletAddress,
    showSuccess: false,
  });

  if (!claim.ok) return claim;

  const proof = createProofMessage({
    domain: input.domain,
    walletAddress: input.walletAddress,
    questRun: input.questRun,
  });

  try {
    const signature = (await input.wallet.request({
      method: "personal_sign",
      params: [proof.message, input.walletAddress],
    })) as string;

    if (!input.supabase) {
      return {
        ok: true,
        signature,
        status: "Proof signed locally with personal_sign. No transaction sent.",
      };
    }

    const { error } = await input.supabase
      .from(SUPABASE_TABLES.walletProofs)
      .upsert(
        toWalletProofRow({
          questRun: input.questRun,
          walletAddress: input.walletAddress,
          message: proof.message,
          signature,
        }),
        { onConflict: "quest_run_id,wallet_address" },
      );

    if (error) {
      return {
        ok: false,
        signature,
        status: formatSupabaseError(
          "Proof signed, but Supabase proof save failed",
          error,
        ),
      };
    }

    return {
      ok: true,
      signature,
      status: "Proof signed and synced. personal_sign only; no tx.",
    };
  } catch (error) {
    return { ok: false, status: formatWalletRequestError(error) };
  }
}
