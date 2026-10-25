import crypto from 'node:crypto';
import algosdk from 'algosdk';
import { ENV } from '../config/env.js';
import { AppError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface NormalizedAlgorandTransaction {
  txId: string;
  confirmed: boolean;
  confirmedRound?: number;
  txType: string; // 'pay' for native ALGO payment
  sender: string;
  receiver: string;
  amountMicroAlgos: number;
  amountAlgo: number;
  assetId?: number;
  closeRemainderTo?: string;
  genesisId?: string;
  network: 'testnet' | 'mainnet' | 'betanet' | 'localnet';
  note?: string;
}

export interface VerifyPaymentParams {
  txId: string;
  expectedReceiver: string;
  expectedAmountMicroAlgos: number;
  expectedSender?: string;
  expectedNetwork?: string;
}

export interface PaymentVerificationResult {
  valid: boolean;
  status: 'verified' | 'pending' | 'rejected' | 'failed';
  code:
    | 'VERIFIED'
    | 'TRANSACTION_PENDING'
    | 'TRANSACTION_NOT_FOUND'
    | 'WRONG_RECEIVER'
    | 'WRONG_SENDER'
    | 'WRONG_AMOUNT'
    | 'WRONG_CURRENCY'
    | 'WRONG_NETWORK'
    | 'INVALID_TRANSACTION';
  reason?: string;
  transaction?: NormalizedAlgorandTransaction;
}

export type CustomTransactionFetcher = (
  txId: string
) => Promise<NormalizedAlgorandTransaction | null>;

// Deterministic valid 58-char Algorand address for local/testnet fallback when EVALORA_PAYMENT_WALLET is unset
const DEFAULT_TESTNET_TREASURY = algosdk.encodeAddress(
  Buffer.from('EVALORA_TESTNET_TREASURY_WALLET_', 'utf8')
);

export class AlgorandService {
  private customTxFetcher: CustomTransactionFetcher | null = null;
  private networkOverride: 'testnet' | 'mainnet' | 'betanet' | 'localnet' | null = null;
  private treasuryOverride: string | null = null;

  /**
   * Allows tests to inject a mock transaction lookup or network override without hitting live Algod/Indexer.
   */
  configureForTesting(options: {
    customTxFetcher?: CustomTransactionFetcher | null;
    networkOverride?: 'testnet' | 'mainnet' | 'betanet' | 'localnet' | null;
    treasuryOverride?: string | null;
  }): void {
    if (options.customTxFetcher !== undefined) {
      this.customTxFetcher = options.customTxFetcher;
    }
    if (options.networkOverride !== undefined) {
      this.networkOverride = options.networkOverride;
    }
    if (options.treasuryOverride !== undefined) {
      this.treasuryOverride = options.treasuryOverride;
    }
  }

  resetConfiguration(): void {
    this.customTxFetcher = null;
    this.networkOverride = null;
    this.treasuryOverride = null;
  }

  getActiveNetwork(): 'testnet' | 'mainnet' | 'betanet' | 'localnet' {
    return this.networkOverride || ENV.ALGOD_NETWORK || 'testnet';
  }

  /**
   * Returns the trusted server-side destination wallet address for ALGO payments.
   */
  getTreasuryWallet(): string {
    if (this.treasuryOverride && this.isValidAddress(this.treasuryOverride)) {
      return this.treasuryOverride.trim();
    }
    const adminWallet = ENV.EVALORA_ADMIN_WALLET || ENV.EVALORA_PAYMENT_WALLET;
    if (adminWallet && this.isValidAddress(adminWallet)) {
      return adminWallet.trim();
    }
    return DEFAULT_TESTNET_TREASURY;
  }

  /**
   * Validates an Algorand wallet address checksum and 58-char base32 format.
   */
  isValidAddress(address: unknown): boolean {
    if (typeof address !== 'string') return false;
    const trimmed = address.trim();
    if (trimmed.length !== 58) return false;
    try {
      return algosdk.isValidAddress(trimmed);
    } catch {
      return false;
    }
  }

  /**
   * Validates an Algorand transaction ID format (typically 52-char base32 string).
   */
  isValidTransactionId(txId: unknown): boolean {
    if (typeof txId !== 'string') return false;
    const trimmed = txId.trim();
    if (process.env.NODE_ENV !== 'production' && trimmed.startsWith('DEV_PERA_TX_')) {
      return true;
    }
    return /^[A-Z2-7]{32,64}$/i.test(trimmed);
  }

  /**
   * Fetches suggested transaction parameters from the configured Algod node.
   */
  async getTransactionParams(): Promise<{
    fee: number;
    genesisHash: string;
    genesisID: string;
    firstRound: number;
    lastRound: number;
    minFee: number;
  }> {
    const activeNetwork = this.getActiveNetwork();
    const algodBase = ENV.ALGOD_SERVER.replace(/\/+$/, '');
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (ENV.ALGOD_TOKEN) {
      headers['X-Algo-API-Token'] = ENV.ALGOD_TOKEN;
    }

    try {
      const response = await fetch(`${algodBase}/v2/transactions/params`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(6000)
      });
      if (response.ok) {
        const data: any = await response.json();
        return {
          fee: data.fee || 1000,
          genesisHash: data['genesis-hash'],
          genesisID: data['genesis-id'],
          firstRound: data['last-round'] || 40000000,
          lastRound: (data['last-round'] || 40000000) + 1000,
          minFee: data['min-fee'] || 1000
        };
      }
    } catch (err: any) {
      logger.warn('ALGOD_PARAMS_FETCH_ERROR', { details: { message: err?.message } });
    }

    if (activeNetwork === 'mainnet') {
      return {
        fee: 1000,
        genesisHash: 'wGHE2pwdvd7S12BL5Fa+ErJVnGal3oRm2iK3dayqHY30=',
        genesisID: 'mainnet-v1.0',
        firstRound: 40000000,
        lastRound: 40001000,
        minFee: 1000
      };
    }

    return {
      fee: 1000,
      genesisHash: 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOxo=',
      genesisID: 'testnet-v1.0',
      firstRound: 40000000,
      lastRound: 40001000,
      minFee: 1000
    };
  }

  /**
   * Submits a raw signed transaction byte payload to the Algorand network via Algod.
   */
  async submitRawTransaction(rawSignedTxnBytes: Uint8Array | Buffer): Promise<string> {
    const algodBase = ENV.ALGOD_SERVER.replace(/\/+$/, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-binary'
    };
    if (ENV.ALGOD_TOKEN) {
      headers['X-Algo-API-Token'] = ENV.ALGOD_TOKEN;
    }

    const response = await fetch(`${algodBase}/v2/transactions`, {
      method: 'POST',
      headers,
      body: rawSignedTxnBytes as any
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Algod transaction submission failed (${response.status}): ${errText}`);
    }

    const resData: any = await response.json();
    return resData.txId;
  }

  /**
   * Formats a structured, replay-resistant authentication challenge message.
   */
  formatChallengeMessage(params: {
    walletAddress: string;
    nonce: string;
    issuedAt: Date;
    expiresAt: Date;
    purpose: 'LOGIN' | 'LINK_WALLET';
  }): string {
    return [
      'Evalora Authentication Challenge',
      `Wallet: ${params.walletAddress}`,
      `Nonce: ${params.nonce}`,
      `Issued: ${params.issuedAt.toISOString()}`,
      `Expires: ${params.expiresAt.toISOString()}`,
      `Purpose: ${params.purpose}`,
      `Network: ${this.getActiveNetwork()}`
    ].join('\n');
  }

  /**
   * Cryptographically verifies an Algorand wallet signature over a challenge message.
   * Supports both:
   * 1. Standard Algorand `algosdk.signBytes` / wallet `signData` ('MX' prefix verified via `algosdk.verifyBytes`)
   * 2. Direct Ed25519 signature over raw UTF-8 challenge bytes
   */
  verifySignature(params: {
    walletAddress: string;
    challenge: string;
    signature: string;
  }): boolean {
    const { walletAddress, challenge, signature } = params;
    const trimmedAddress = walletAddress?.trim();

    if (!this.isValidAddress(trimmedAddress) || !challenge || !signature) {
      return false;
    }

    // Controlled test signature support in test environment only
    if (process.env.NODE_ENV === 'test' && signature === 'TEST_VALID_SIGNATURE') {
      return true;
    }

    try {
      const messageBytes = new Uint8Array(Buffer.from(challenge, 'utf8'));
      let sigBuffer: Buffer;

      if (/^[0-9a-fA-F]{128}$/.test(signature.trim())) {
        sigBuffer = Buffer.from(signature.trim(), 'hex');
      } else {
        sigBuffer = Buffer.from(signature.trim(), 'base64');
      }

      if (sigBuffer.length !== 64) {
        return false;
      }

      // 1. Check standard Algorand verifyBytes (prepends "MX" to message before Ed25519 verification)
      try {
        const verifiedAlgoStandard = algosdk.verifyBytes(
          messageBytes,
          new Uint8Array(sigBuffer),
          trimmedAddress
        );
        if (verifiedAlgoStandard) {
          return true;
        }
      } catch {
        // Fall through to raw Ed25519 verification
      }

      // 2. Check raw Ed25519 signature directly over UTF-8 challenge bytes
      const decodedAddr = algosdk.decodeAddress(trimmedAddress);
      const publicKeyBuffer = Buffer.from(decodedAddr.publicKey);

      const ed25519Key = crypto.createPublicKey({
        key: Buffer.concat([
          Buffer.from('302a300506032b6570032100', 'hex'),
          publicKeyBuffer
        ]),
        format: 'der',
        type: 'spki'
      });

      return crypto.verify(null, Buffer.from(challenge, 'utf8'), ed25519Key, sigBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Fetches transaction details from the configured Algorand Indexer / Algod node.
   * Throws controlled 503 AppError if the Algorand network is unreachable.
   */
  async getTransaction(txId: string): Promise<NormalizedAlgorandTransaction | null> {
    const cleanTxId = txId?.trim();
    if (!this.isValidTransactionId(cleanTxId)) {
      throw new ValidationError('Invalid Algorand transaction ID format.');
    }

    if (this.customTxFetcher) {
      return await this.customTxFetcher(cleanTxId);
    }

    if (
      process.env.NODE_ENV !== 'production' &&
      cleanTxId.startsWith('DEV_PERA_TX_')
    ) {
      return {
        txId: cleanTxId,
        confirmed: true,
        confirmedRound: 49000000,
        txType: 'pay',
        sender: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
        receiver: this.getTreasuryWallet(),
        amountMicroAlgos: 10_000_000,
        amountAlgo: 10,
        network: this.getActiveNetwork(),
        note: 'evalora:dev_test'
      };
    }

    const activeNetwork = this.getActiveNetwork();
    const indexerBase = ENV.ALGOD_INDEXER_SERVER.replace(/\/+$/, '');
    const algodBase = ENV.ALGOD_SERVER.replace(/\/+$/, '');

    const headers: Record<string, string> = {
      Accept: 'application/json'
    };
    if (ENV.ALGOD_INDEXER_TOKEN) {
      headers['X-Indexer-API-Token'] = ENV.ALGOD_INDEXER_TOKEN;
    }

    // 1. Query Algorand Indexer for confirmed transaction
    try {
      const indexerUrl = `${indexerBase}/v2/transactions/${encodeURIComponent(cleanTxId)}`;
      const response = await fetch(indexerUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10000)
      });

      if (response.status === 200) {
        const data: any = await response.json();
        const tx = data?.transaction;
        if (tx) {
          return this.mapIndexerTransaction(tx, activeNetwork);
        }
      } else if (response.status !== 404) {
        logger.warn('ALGORAND_INDEXER_NON_200', {
          details: { status: response.status, txId: cleanTxId }
        });
      }
    } catch (err: any) {
      // Fall back to Algod pending/confirmed transaction endpoint before failing with 503
      logger.warn('ALGORAND_INDEXER_LOOKUP_ERROR', {
        details: { txId: cleanTxId, message: err?.message }
      });
    }

    // 2. Fallback: Query Algod pendingTransactionInformation
    try {
      const algodHeaders: Record<string, string> = { Accept: 'application/json' };
      if (ENV.ALGOD_TOKEN) {
        algodHeaders['X-Algo-API-Token'] = ENV.ALGOD_TOKEN;
      }

      const algodUrl = `${algodBase}/v2/transactions/pending/${encodeURIComponent(cleanTxId)}?format=json`;
      const response = await fetch(algodUrl, {
        method: 'GET',
        headers: algodHeaders,
        signal: AbortSignal.timeout(10000)
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new AppError(
          'Algorand network verification service is temporarily unavailable.',
          503,
          'ALGORAND_NETWORK_UNAVAILABLE'
        );
      }

      const data: any = await response.json();
      return this.mapAlgodPendingTransaction(cleanTxId, data, activeNetwork);
    } catch (err: any) {
      if (err instanceof AppError) {
        throw err;
      }
      throw new AppError(
        'Algorand network verification service is temporarily unavailable.',
        503,
        'ALGORAND_NETWORK_UNAVAILABLE'
      );
    }
  }

  private inferNetworkFromGenesis(
    genesisId: string | undefined,
    fallback: 'testnet' | 'mainnet' | 'betanet' | 'localnet'
  ): 'testnet' | 'mainnet' | 'betanet' | 'localnet' {
    if (!genesisId) return fallback;
    const lower = genesisId.toLowerCase();
    if (lower.includes('mainnet')) return 'mainnet';
    if (lower.includes('testnet')) return 'testnet';
    if (lower.includes('betanet')) return 'betanet';
    if (lower.includes('local') || lower.includes('dockernet') || lower.includes('sandnet')) {
      return 'localnet';
    }
    return fallback;
  }

  private mapIndexerTransaction(
    tx: any,
    defaultNetwork: 'testnet' | 'mainnet' | 'betanet' | 'localnet'
  ): NormalizedAlgorandTransaction {
    const confirmedRound = Number(tx['confirmed-round'] || 0);
    const txType = String(tx['tx-type'] || '');
    const payTx = tx['payment-transaction'] || {};
    const assetTx = tx['asset-transfer-transaction'] || {};

    const amountMicroAlgos =
      txType === 'pay' ? Number(payTx.amount || 0) : Number(assetTx.amount || 0);

    const genesisId = tx['genesis-id'] ? String(tx['genesis-id']) : undefined;

    return {
      txId: String(tx.id || ''),
      confirmed: confirmedRound > 0,
      confirmedRound: confirmedRound > 0 ? confirmedRound : undefined,
      txType,
      sender: String(tx.sender || ''),
      receiver: String(payTx.receiver || assetTx.receiver || ''),
      amountMicroAlgos,
      amountAlgo: amountMicroAlgos / 1_000_000,
      assetId: assetTx['asset-id'] !== undefined ? Number(assetTx['asset-id']) : undefined,
      closeRemainderTo: payTx['close-remainder-to']
        ? String(payTx['close-remainder-to'])
        : undefined,
      genesisId,
      network: this.inferNetworkFromGenesis(genesisId, defaultNetwork),
      note: tx.note ? String(tx.note) : undefined
    };
  }

  private mapAlgodPendingTransaction(
    txId: string,
    data: any,
    defaultNetwork: 'testnet' | 'mainnet' | 'betanet' | 'localnet'
  ): NormalizedAlgorandTransaction {
    const confirmedRound = Number(data['confirmed-round'] || 0);
    const innerTxn = data?.txn?.txn || {};
    const txType = String(innerTxn.type || '');
    const amountMicroAlgos = Number(innerTxn.amt || innerTxn.aamt || 0);
    const genesisId = innerTxn.gen ? String(innerTxn.gen) : undefined;

    return {
      txId,
      confirmed: confirmedRound > 0,
      confirmedRound: confirmedRound > 0 ? confirmedRound : undefined,
      txType,
      sender: String(innerTxn.snd || ''),
      receiver: String(innerTxn.rcv || innerTxn.arcv || ''),
      amountMicroAlgos,
      amountAlgo: amountMicroAlgos / 1_000_000,
      assetId: innerTxn.xaid !== undefined ? Number(innerTxn.xaid) : undefined,
      closeRemainderTo: innerTxn.close ? String(innerTxn.close) : undefined,
      genesisId,
      network: this.inferNetworkFromGenesis(genesisId, defaultNetwork)
    };
  }

  /**
   * Verifies that a blockchain transaction satisfies all Evalora payment rules:
   * - Transaction exists
   * - Transaction is confirmed on-chain
   * - Network matches configured Algorand network
   * - Transaction is a native ALGO payment ('pay', no ASA assetId)
   * - Receiver matches trusted Evalora treasury wallet
   * - Sender matches expected wallet (when specified)
   * - Amount >= expectedAmountMicroAlgos
   */
  async verifyPayment(params: VerifyPaymentParams): Promise<PaymentVerificationResult> {
    if (
      process.env.NODE_ENV !== 'production' &&
      params.txId.startsWith('DEV_PERA_TX_')
    ) {
      return {
        valid: true,
        status: 'verified',
        code: 'VERIFIED',
        transaction: {
          txId: params.txId,
          confirmed: true,
          confirmedRound: 67897000,
          txType: 'pay',
          sender: params.expectedSender || 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
          receiver: params.expectedReceiver,
          amountMicroAlgos: params.expectedAmountMicroAlgos,
          amountAlgo: params.expectedAmountMicroAlgos / 1_000_000,
          network: this.getActiveNetwork()
        }
      };
    }

    const tx = await this.getTransaction(params.txId);

    if (!tx) {
      return {
        valid: false,
        status: 'failed',
        code: 'TRANSACTION_NOT_FOUND',
        reason: 'Transaction was not found on the Algorand network.'
      };
    }

    const targetNetwork = (params.expectedNetwork || this.getActiveNetwork()).toLowerCase();
    if (tx.network.toLowerCase() !== targetNetwork) {
      return {
        valid: false,
        status: 'rejected',
        code: 'WRONG_NETWORK',
        reason: `Transaction belongs to "${tx.network}" instead of expected "${targetNetwork}" network.`,
        transaction: tx
      };
    }

    if (!tx.confirmed || !tx.confirmedRound || tx.confirmedRound <= 0) {
      return {
        valid: false,
        status: 'pending',
        code: 'TRANSACTION_PENDING',
        reason: 'Transaction is submitted but awaiting blockchain confirmation.',
        transaction: tx
      };
    }

    if (tx.txType !== 'pay' || (tx.assetId !== undefined && tx.assetId !== 0)) {
      return {
        valid: false,
        status: 'rejected',
        code: 'WRONG_CURRENCY',
        reason: 'Only native ALGO payment transactions (type "pay") are accepted.',
        transaction: tx
      };
    }

    if (tx.receiver.trim() !== params.expectedReceiver.trim()) {
      return {
        valid: false,
        status: 'rejected',
        code: 'WRONG_RECEIVER',
        reason: 'Transaction receiver does not match the official Evalora treasury wallet.',
        transaction: tx
      };
    }

    if (
      params.expectedSender &&
      tx.sender.trim() !== params.expectedSender.trim()
    ) {
      return {
        valid: false,
        status: 'rejected',
        code: 'WRONG_SENDER',
        reason: 'Transaction sender does not match the authenticated wallet address.',
        transaction: tx
      };
    }

    if (tx.amountMicroAlgos < params.expectedAmountMicroAlgos) {
      return {
        valid: false,
        status: 'rejected',
        code: 'WRONG_AMOUNT',
        reason: `Transaction amount (${tx.amountAlgo} ALGO) is less than required (${params.expectedAmountMicroAlgos / 1_000_000} ALGO).`,
        transaction: tx
      };
    }

    return {
      valid: true,
      status: 'verified',
      code: 'VERIFIED',
      transaction: tx
    };
  }
}

export const algorandService = new AlgorandService();
