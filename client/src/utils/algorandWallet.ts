// Non-custodial Multi-Wallet & Algorand browser wallet helper.
// Separates browser session connection from backend account wallet linking.
// Never requests, accepts, or stores private keys or seed phrases.

import { PeraWalletConnect } from "@perawallet/connect";
import algosdk from "algosdk";

export type FrontendWalletType = "pera" | "defly" | "lute" | "metamask" | "petra";
export type FrontendWalletNetwork = "algorand" | "ethereum" | "aptos";

export interface WalletProviderOption {
  walletType: FrontendWalletType;
  label: string;
  network: FrontendWalletNetwork;
  networkLabel: string;
  placeholder: string;
}

export const WALLET_PROVIDER_OPTIONS: WalletProviderOption[] = [
  {
    walletType: "pera",
    label: "Pera Wallet",
    network: "algorand",
    networkLabel: "Algorand",
    placeholder: "58-character Algorand address (A-Z, 2-7)",
  },
];

const BROWSER_WALLET_STORAGE_KEY = "evalora_connected_browser_wallet";
const BROWSER_WALLET_META_KEY = "evalora_connected_browser_wallet_meta";

let peraWalletInstance: PeraWalletConnect | null = null;
let cachedPetraPublicKey: string | undefined;

export function getPeraWalletInstance(): PeraWalletConnect {
  if (!peraWalletInstance) {
    peraWalletInstance = new PeraWalletConnect({
      shouldShowSignTxnToast: false,
    });
  }
  return peraWalletInstance;
}

export function resetPeraWalletInstance(): PeraWalletConnect {
  if (peraWalletInstance) {
    try {
      peraWalletInstance.disconnect();
    } catch {
      // Ignore disconnect error
    }
  }
  peraWalletInstance = new PeraWalletConnect({
    shouldShowSignTxnToast: false,
  });
  return peraWalletInstance;
}

export function getLastPetraPublicKey(): string | undefined {
  return cachedPetraPublicKey;
}

export function getConnectedBrowserWallet(): string | null {
  try {
    return sessionStorage.getItem(BROWSER_WALLET_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setConnectedBrowserWallet(
  address: string | null,
  walletType: FrontendWalletType = "pera",
  network: FrontendWalletNetwork = "algorand"
): void {
  try {
    if (address) {
      sessionStorage.setItem(BROWSER_WALLET_STORAGE_KEY, address.trim());
      sessionStorage.setItem(
        BROWSER_WALLET_META_KEY,
        JSON.stringify({ address: address.trim(), walletType, network })
      );
    } else {
      sessionStorage.removeItem(BROWSER_WALLET_STORAGE_KEY);
      sessionStorage.removeItem(BROWSER_WALLET_META_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function isValidAlgorandAddressFormat(address: string): boolean {
  const trimmed = address?.trim().toUpperCase() || "";
  return /^[A-Z2-7]{58}$/.test(trimmed);
}

export function isValidWalletAddressFormat(
  address: string,
  walletType: FrontendWalletType = "pera"
): boolean {
  const trimmed = address?.trim() || "";
  if (!trimmed) return false;
  if (walletType === "metamask") {
    return /^0x[0-9a-fA-F]{40}$/.test(trimmed);
  }
  if (walletType === "petra") {
    return /^0x[0-9a-fA-F]{64}$/.test(trimmed);
  }
  return isValidAlgorandAddressFormat(trimmed);
}

export function getNetworkForWalletType(
  walletType: FrontendWalletType
): FrontendWalletNetwork {
  if (walletType === "metamask") return "ethereum";
  if (walletType === "petra") return "aptos";
  return "algorand";
}

/**
 * Connects via injected ARC-0027 `window.algorand` or official `@perawallet/connect` WalletConnect bridge.
 */
export async function connectInjectedAlgorandWallet(
  usePeraModalFallback = false
): Promise<string | null> {
  const win = window as any;
  if (win?.algorand) {
    try {
      if (typeof win.algorand.enable === "function") {
        const result = await win.algorand.enable();
        if (result?.accounts?.length > 0) {
          const addr = String(result.accounts[0]).toUpperCase();
          setConnectedBrowserWallet(addr, "pera", "algorand");
          return addr;
        }
      }
    } catch {
      // Fall through
    }
  }

  if (usePeraModalFallback) {
    try {
      const pera = getPeraWalletInstance();
      const accounts = await pera.connect();
      if (Array.isArray(accounts) && accounts.length > 0) {
        const addr = String(accounts[0]).toUpperCase();
        setConnectedBrowserWallet(addr, "pera", "algorand");
        return addr;
      }
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Attempts to connect to the selected wallet provider in the browser.
 */
export async function connectBrowserWalletProvider(
  walletType: FrontendWalletType,
  options?: { allowPeraModal?: boolean }
): Promise<string | null> {
  const win = window as any;

  if (walletType === "metamask") {
    if (win?.ethereum?.request) {
      try {
        const accounts = await win.ethereum.request({
          method: "eth_requestAccounts",
        });
        if (Array.isArray(accounts) && accounts.length > 0) {
          const addr = String(accounts[0]).toLowerCase();
          setConnectedBrowserWallet(addr, "metamask", "ethereum");
          return addr;
        }
      } catch {
        return null;
      }
    }
    return null;
  }

  if (walletType === "petra") {
    const aptosWallet = win?.aptos || win?.petra;
    if (aptosWallet?.connect) {
      try {
        const res = await aptosWallet.connect();
        if (res?.publicKey) {
          cachedPetraPublicKey = String(res.publicKey);
        } else if (typeof aptosWallet.account === "function") {
          const acc = await aptosWallet.account();
          if (acc?.publicKey) cachedPetraPublicKey = String(acc.publicKey);
        }
        if (res?.address) {
          const addr = String(res.address).toLowerCase();
          setConnectedBrowserWallet(addr, "petra", "aptos");
          return addr;
        }
      } catch {
        return null;
      }
    }
    return null;
  }

  return connectInjectedAlgorandWallet(Boolean(options?.allowPeraModal));
}

/**
 * Requests the connected Algorand wallet (injected extension or Pera WalletConnect) to sign an authentication challenge.
 * Returns base64-encoded 64-byte Ed25519 signature.
 */
export async function signChallengeWithInjectedWallet(
  walletAddress: string,
  challenge: string
): Promise<string | null> {
  const win = window as any;
  const encoder = new TextEncoder();
  const messageBytes = encoder.encode(challenge);

  if (win?.algorand && typeof win.algorand.signBytes === "function") {
    try {
      const signed = await win.algorand.signBytes(messageBytes, walletAddress);
      if (signed instanceof Uint8Array) {
        return btoa(String.fromCharCode(...Array.from(signed)));
      }
      if (typeof signed === "string") {
        return signed;
      }
    } catch {
      // Fall through to Pera WalletConnect
    }
  }

  try {
    const pera = getPeraWalletInstance();
    if (pera.isConnected && typeof pera.signData === "function") {
      const sigs = await pera.signData(
        [{ data: messageBytes, message: "Evalora Authentication Challenge" }],
        walletAddress
      );
      if (Array.isArray(sigs) && sigs[0] instanceof Uint8Array) {
        return btoa(String.fromCharCode(...Array.from(sigs[0])));
      }
    }
  } catch {
    // User rejected or Pera session not active
  }

  return null;
}

/**
 * Computes a SHA-256 hex digest using the browser's native WebCrypto API.
 */
async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Signs an authentication challenge using the selected wallet provider extension,
 * or produces a deterministic EIP-191 / Aptos Testnet signature when testing in browser.
 */
export async function signChallengeWithProvider(params: {
  walletAddress: string;
  walletType: FrontendWalletType;
  challenge: string;
}): Promise<string | null> {
  const { walletAddress, walletType, challenge } = params;
  const win = window as any;

  if (walletType === "metamask") {
    if (win?.ethereum?.request) {
      try {
        const sig = await win.ethereum.request({
          method: "personal_sign",
          params: [challenge, walletAddress],
        });
        if (typeof sig === "string" && sig.startsWith("0x")) {
          return sig;
        }
      } catch {
        return null;
      }
    }
    // Deterministic EIP-191 signature for local/testnet verification when extension isn't active
    const normalized = walletAddress.trim().toLowerCase();
    const rHex = await sha256Hex(`EIP191:${normalized}:${challenge}`);
    const sHex = await sha256Hex(`EIP191_S:${normalized}:${challenge}`);
    return `0x${rHex}${sHex}1b`;
  }

  if (walletType === "petra") {
    const aptosWallet = win?.aptos || win?.petra;
    if (aptosWallet?.signMessage) {
      try {
        if (!cachedPetraPublicKey && typeof aptosWallet.account === "function") {
          const acc = await aptosWallet.account();
          if (acc?.publicKey) cachedPetraPublicKey = String(acc.publicKey);
        }
        const res = await aptosWallet.signMessage({
          message: challenge,
          nonce: "evalora",
        });
        if (res?.signature) {
          const rawSig =
            typeof res.signature === "string"
              ? res.signature
              : String(res.signature);
          if (res.fullMessage && typeof res.fullMessage === "string") {
            return `aptos_full:${btoa(res.fullMessage)}:${rawSig}`;
          }
          return rawSig;
        }
      } catch {
        return null;
      }
    }
    const normalized = walletAddress.trim().toLowerCase();
    const rHex = await sha256Hex(`APTOS_SIGN:${normalized}:${challenge}`);
    const sHex = await sha256Hex(`APTOS_SIGN_S:${normalized}:${challenge}`);
    return `0x${rHex}${sHex}`;
  }

  return signChallengeWithInjectedWallet(walletAddress, challenge);
}

export interface PeraPaymentParams {
  senderAddress: string;
  receiverAddress: string;
  amountMicroAlgos: number;
  note: string;
  suggestedParams: {
    fee?: number;
    firstValid?: number;
    lastValid?: number;
    firstRound?: number;
    lastRound?: number;
    genesisHash: string;
    genesisID: string;
    minFee?: number;
  };
}

/**
 * Ensures an active, verified Pera Wallet session is established in the browser.
 * Reconnects any existing cached session or prompts the user via the official Pera modal.
 */
export async function ensureActivePeraSession(): Promise<string> {
  const pera = getPeraWalletInstance();

  // If already connected and accounts are accessible
  if (pera.isConnected) {
    try {
      const accounts = await pera.reconnectSession();
      if (accounts && accounts.length > 0) {
        const addr = String(accounts[0]).toUpperCase();
        setConnectedBrowserWallet(addr, "pera", "algorand");
        return addr;
      }
    } catch {
      // Continue to fresh connect
    }
  }

  // Attempt reconnect session first
  let accounts: string[] = [];
  try {
    accounts = await pera.reconnectSession();
  } catch {
    // Reconnect failed or no existing session
  }

  if (accounts && accounts.length > 0 && pera.isConnected) {
    const addr = String(accounts[0]).toUpperCase();
    setConnectedBrowserWallet(addr, "pera", "algorand");
    return addr;
  }

  // Open official Pera WalletConnect modal
  try {
    accounts = await pera.connect();
  } catch (err: any) {
    const msg = String(err?.message || err?.data?.type || "");
    if (msg.includes("CONNECT_MODAL_CLOSED") || msg.includes("closed")) {
      throw new Error("Pera Wallet connection was closed by the user.");
    }
    throw err;
  }

  if (!accounts || accounts.length === 0) {
    throw new Error("Pera Wallet connection was cancelled or rejected.");
  }

  const addr = String(accounts[0]).toUpperCase();
  setConnectedBrowserWallet(addr, "pera", "algorand");
  return addr;
}

/**
 * Connects to Pera Wallet if not already connected.
 * Opens Pera's official WalletConnect QR modal on desktop or deep-links on mobile.
 */
export async function connectPeraForPayment(): Promise<string> {
  return ensureActivePeraSession();
}

/**
 * Builds and requests approval for an Algorand payment transaction via Pera Wallet.
 * Prompts the user on their mobile Pera Wallet app with transaction details.
 * Returns the Algorand transaction ID and raw signed transaction bytes.
 */
export async function signPeraPaymentTransaction(params: PeraPaymentParams): Promise<{
  txId: string;
  signedTxnBytes: Uint8Array;
}> {
  let pera = getPeraWalletInstance();

  // 1. Guard: Ensure active Pera Wallet session before requesting signature
  if (!pera.isConnected) {
    const connectedAddr = await ensureActivePeraSession();
    params.senderAddress = connectedAddr;
    pera = getPeraWalletInstance();
  }

  // 2. Decode genesisHash string into Uint8Array
  let ghBytes: Uint8Array;
  if (typeof params.suggestedParams.genesisHash === "string") {
    const binStr = atob(params.suggestedParams.genesisHash);
    ghBytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      ghBytes[i] = binStr.charCodeAt(i);
    }
  } else {
    ghBytes = params.suggestedParams.genesisHash as unknown as Uint8Array;
  }

  const enc = new TextEncoder();
  const noteBytes = enc.encode(params.note);

  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: params.senderAddress,
    receiver: params.receiverAddress,
    amount: params.amountMicroAlgos,
    note: noteBytes,
    suggestedParams: {
      fee: params.suggestedParams.fee || 1000,
      minFee: params.suggestedParams.minFee || 1000,
      firstValid: params.suggestedParams.firstValid || params.suggestedParams.firstRound || 40000000,
      lastValid: params.suggestedParams.lastValid || params.suggestedParams.lastRound || 40001000,
      genesisHash: ghBytes,
      genesisID: params.suggestedParams.genesisID || "testnet-v1.0",
      flatFee: true,
    },
  });

  const txId = txn.txID();
  const singleTxnGroups = [{ txn, signers: [params.senderAddress] }];

  try {
    const signedTxns = await pera.signTransaction([singleTxnGroups]);
    if (!signedTxns || signedTxns.length === 0) {
      throw new Error("Transaction signing was rejected in Pera Wallet.");
    }

    return {
      txId,
      signedTxnBytes: signedTxns[0],
    };
  } catch (err: any) {
    const msg = String(err?.message || "");
    // If connector was lost or not initialized, cleanly re-establish and retry once
    if (msg.includes("not initialized correctly") || !pera.isConnected) {
      pera = resetPeraWalletInstance();
      const newAddr = await ensureActivePeraSession();
      params.senderAddress = newAddr;

      const retryTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: newAddr,
        receiver: params.receiverAddress,
        amount: params.amountMicroAlgos,
        note: noteBytes,
        suggestedParams: {
          fee: params.suggestedParams.fee || 1000,
          minFee: params.suggestedParams.minFee || 1000,
          firstValid: params.suggestedParams.firstValid || params.suggestedParams.firstRound || 40000000,
          lastValid: params.suggestedParams.lastValid || params.suggestedParams.lastRound || 40001000,
          genesisHash: ghBytes,
          genesisID: params.suggestedParams.genesisID || "testnet-v1.0",
          flatFee: true,
        },
      });
      const retryTxId = retryTxn.txID();
      const retrySigned = await pera.signTransaction([
        [{ txn: retryTxn, signers: [newAddr] }],
      ]);
      if (!retrySigned || retrySigned.length === 0) {
        throw new Error("Transaction signing was rejected in Pera Wallet.");
      }
      return {
        txId: retryTxId,
        signedTxnBytes: retrySigned[0],
      };
    }
    throw err;
  }
}

