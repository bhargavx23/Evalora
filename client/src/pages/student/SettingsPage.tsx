import React, { useEffect, useState } from "react";
import { api } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  getConnectedBrowserWallet,
  setConnectedBrowserWallet,
  connectPeraForPayment,
  signChallengeWithInjectedWallet,
} from "../../utils/algorandWallet";
import {
  Bell,
  LockKeyhole,
  Shield,
  Wallet,
  Link2,
  Unlink,
  History,
  Info,
  Receipt,
  Download,
} from "lucide-react";
import { triggerBlobDownload } from "../../utils/downloadFile";
import { PaymentReceiptModal } from "../../components/payment/PaymentReceiptModal";

export const SettingsPage: React.FC = () => {
  const toast = useToast();
  const { user, refreshProfile } = useAuth();
  const [settings, setSettings] = useState<any>({
    privacy: {
      profileVisible: false,
      resumeVisible: false,
      careerVisible: false,
    },
    notificationPreferences: {
      assessment: true,
      practice: true,
      results: true,
      resume: true,
    },
  });
  const [isSaving, setIsSaving] = useState(false);

  // Pera Wallet management state
  const [browserWallet, setBrowserWallet] = useState<string | null>(() =>
    getConnectedBrowserWallet()
  );
  const [isLinking, setIsLinking] = useState(false);
  const [unlinkingAddress, setUnlinkingAddress] = useState<string | null>(null);

  // Payment Transaction History
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedTxIdForReceipt, setSelectedTxIdForReceipt] = useState<string | null>(null);

  const handleDownloadReceipt = async (txId: string) => {
    try {
      const res = await api.get(`/payments/receipt/${txId}/pdf`, {
        responseType: "blob",
      });
      const filename = `Evalora-Payment-Receipt-${txId.slice(0, 10)}.pdf`;
      triggerBlobDownload(res.data, filename);
      toast.success("Payment receipt PDF downloaded.");
    } catch {
      toast.error("Failed to download payment receipt PDF.");
    }
  };

  const userWallets =
    user?.wallets && user.wallets.length > 0
      ? user.wallets.filter((w: any) => w.walletType === "pera" || w.network === "algorand")
      : user?.walletAddress
        ? [
            {
              address: user.walletAddress,
              walletType: "pera",
              network: "algorand",
              verified: true,
              linkedAt: new Date().toISOString(),
            },
          ]
        : [];

  useEffect(() => {
    api
      .get("/profile")
      .then((res) => {
        if (res.data.profile) {
          setSettings({
            privacy: {
              ...settings.privacy,
              ...(res.data.profile.privacy || {}),
            },
            notificationPreferences: {
              ...settings.notificationPreferences,
              ...(res.data.profile.notificationPreferences || {}),
            },
          });
        }
      })
      .catch(() => toast.error("Unable to load settings"));

    loadPaymentHistory();
  }, []);

  const loadPaymentHistory = () => {
    setIsLoadingHistory(true);
    api
      .get("/payments/history")
      .then((res) => {
        if (res.data.success) {
          setTransactions(res.data.transactions || []);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingHistory(false));
  };

  const toggle = (group: "privacy" | "notificationPreferences", key: string) =>
    setSettings((current: any) => ({
      ...current,
      [group]: { ...current[group], [key]: !current[group][key] },
    }));

  const save = async () => {
    setIsSaving(true);
    try {
      await api.put("/profile", settings);
      toast.success("Settings saved successfully.");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Unable to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnectAndLinkPera = async () => {
    setIsLinking(true);
    try {
      // 1. Connect via official Pera Wallet modal or deep link
      const connectedAddr = await connectPeraForPayment();
      if (!connectedAddr) return;
      setBrowserWallet(connectedAddr);

      // 2. Request single-use challenge nonce from backend
      const challengeRes = await api.post("/wallet/challenge", {
        walletAddress: connectedAddr,
        walletType: "pera",
        network: "algorand",
        purpose: "LINK_WALLET",
      });

      if (!challengeRes.data?.success || !challengeRes.data?.challenge) {
        throw new Error("Failed to generate wallet verification challenge.");
      }

      // 3. Cryptographically sign the nonce using Pera
      toast.info("Please approve the verification prompt in your Pera Wallet.");
      const signature = await signChallengeWithInjectedWallet(
        connectedAddr,
        challengeRes.data.challenge
      );

      if (!signature) {
        toast.warning("Signature was not completed in Pera Wallet.");
        return;
      }

      // 4. Atomically link and verify wallet on backend
      const linkRes = await api.post("/wallet/link", {
        walletAddress: connectedAddr,
        walletType: "pera",
        network: "algorand",
        challenge: challengeRes.data.challenge,
        signature: signature.trim(),
      });

      if (linkRes.data?.success) {
        await refreshProfile();
        toast.success("Pera Wallet successfully verified and linked to your Evalora account!");
      }
    } catch (err: any) {
      const msg = err.message || err.response?.data?.message || "Failed to link Pera Wallet.";
      if (!msg.toLowerCase().includes("cancel") && !msg.toLowerCase().includes("reject")) {
        toast.error(msg);
      }
    } finally {
      setIsLinking(false);
    }
  };

  const handleDisconnectBrowserWallet = () => {
    setConnectedBrowserWallet(null);
    setBrowserWallet(null);
    toast.info("Pera Wallet disconnected from local browser session.");
  };

  const handleUnlinkAccountWallet = async (
    targetAddress?: string,
    targetNetwork?: string
  ) => {
    setUnlinkingAddress(targetAddress || "primary");
    try {
      const res = await api.post("/wallet/unlink", {
        walletAddress: targetAddress,
        network: targetNetwork || "algorand",
      });
      if (res.data.success) {
        await refreshProfile();
        toast.success("Wallet unlinked from your account.");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Unable to unlink wallet.");
    } finally {
      setUnlinkingAddress(null);
    }
  };

  const hasVerifiedWallet = userWallets.some((w: any) => w.verified);

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="border-b border-border-subtle pb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-primary">
          Student workspace
        </p>
        <h1 className="font-serif text-3xl font-medium tracking-tight text-text-primary md:text-4xl">
          Account Settings
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manage your account preferences, Pera Wallet on Algorand, and transaction records.
        </p>
      </header>

      {/* Pera Wallet Management on Algorand */}
      <Card
        className="max-w-4xl"
        header={
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-light text-brand-primary">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <span className="text-sm font-semibold text-text-primary">
                  Pera Wallet (Algorand)
                </span>
                <span className="ml-2 text-xs text-text-muted">Non-custodial</span>
              </div>
            </div>
            {hasVerifiedWallet ? (
              <Badge variant="green">Verified & Linked</Badge>
            ) : (
              <Badge variant="neutral">Not Linked</Badge>
            )}
          </div>
        }
      >
        <div className="space-y-5 text-sm">
          {/* Non-custodial statement */}
          <div className="flex items-start gap-3 rounded-lg border border-border-subtle bg-surface-neutral p-3.5 text-xs text-text-secondary">
            <Info className="h-4 w-4 text-brand-primary flex-shrink-0 mt-0.5" />
            <span>
              <strong>Strictly Non-Custodial:</strong> Evalora never asks for or stores your seed
              phrase or private keys. You maintain full ownership of your Pera Wallet on Algorand.
              Linking your wallet enables passwordless single-click login and on-chain verification.
            </span>
          </div>

          {/* Stored Account Wallets */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Linked Wallet Status
            </h3>

            {userWallets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border-subtle bg-surface-neutral/60 p-5 text-center text-xs text-text-secondary">
                No Pera Wallet currently linked to your Evalora account. Connect and verify below.
              </div>
            ) : (
              userWallets.map((w: any) => (
                <div
                  key={`${w.network}-${w.address}`}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-border-subtle bg-white p-4 shadow-sm sm:flex-row sm:items-center"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-text-primary">
                        Pera Wallet (Algorand)
                      </span>
                      {w.verified ? (
                        <Badge variant="green">Verified</Badge>
                      ) : (
                        <Badge variant="amber">Unverified — Pending</Badge>
                      )}
                    </div>
                    <p className="break-all font-mono text-xs text-text-secondary">
                      {w.address}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      isLoading={unlinkingAddress === w.address}
                      icon={<Unlink className="h-3.5 w-3.5" />}
                      onClick={() => handleUnlinkAccountWallet(w.address, w.network)}
                    >
                      Unlink
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Connect / Change Pera Wallet */}
          <div className="space-y-3 border-t border-border-subtle pt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              {hasVerifiedWallet ? "Update Linked Wallet" : "Connect & Link Pera Wallet"}
            </h3>

            <p className="text-xs text-text-secondary">
              Connect via Pera Wallet app or QR code. Your wallet will be cryptographically verified with zero manual data entry.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="primary"
                isLoading={isLinking}
                icon={<Link2 className="h-4 w-4" />}
                onClick={handleConnectAndLinkPera}
              >
                {hasVerifiedWallet ? "Connect & Replace Wallet" : "Connect Pera Wallet"}
              </Button>

              {browserWallet && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-[#527565]">
                    Active: {browserWallet.slice(0, 8)}...{browserWallet.slice(-6)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDisconnectBrowserWallet}
                  >
                    Disconnect Session
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Algorand Blockchain Transaction History */}
      <Card
        className="max-w-4xl"
        header={
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E9F3ED] text-[#527565]">
                <History className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold text-text-primary">
                Algorand Payment & Transaction History
              </span>
            </div>
            <Badge variant="blue">
              {user?.paidAttempts?.total || 0} Paid Attempts Available
            </Badge>
          </div>
        }
      >
        {isLoadingHistory ? (
          <div className="py-6 text-center text-xs text-text-secondary">
            Loading blockchain transaction records...
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-8 text-center text-xs text-text-secondary">
            No Algorand transactions recorded yet. Practice attempts can be unlocked
            on-demand using ALGO in the Practice Builder.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border-subtle text-text-muted">
                  <th className="pb-2.5 font-semibold">Date</th>
                  <th className="pb-2.5 font-semibold">Purpose</th>
                  <th className="pb-2.5 font-semibold">Amount</th>
                  <th className="pb-2.5 font-semibold">Attempts</th>
                  <th className="pb-2.5 font-semibold">Status</th>
                  <th className="pb-2.5 font-semibold">Transaction ID</th>
                  <th className="pb-2.5 font-semibold text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {transactions.map((tx) => (
                  <tr key={tx._id || tx.transactionId} className="hover:bg-surface-neutral/40">
                    <td className="py-3 text-text-secondary">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 font-medium text-text-primary">
                      {tx.purpose} ({tx.planId})
                    </td>
                    <td className="py-3 font-mono font-medium text-text-primary">
                      {tx.amount} {tx.currency}
                    </td>
                    <td className="py-3 font-medium text-[#527565]">
                      +{tx.attemptsUnlocked || 0}
                    </td>
                    <td className="py-3">
                      <Badge
                        variant={
                          tx.status === "verified"
                            ? "green"
                            : tx.status === "pending"
                              ? "amber"
                              : "rose"
                        }
                      >
                        {tx.status}
                      </Badge>
                    </td>
                    <td className="py-3 font-mono text-[11px] text-text-muted">
                      {tx.transactionId.length > 18
                        ? `${tx.transactionId.slice(0, 10)}...${tx.transactionId.slice(-6)}`
                        : tx.transactionId}
                    </td>
                    <td className="py-3 text-right">
                      {tx.status === "verified" ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedTxIdForReceipt(tx.transactionId)}
                            icon={<Receipt className="w-3.5 h-3.5" />}
                          >
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDownloadReceipt(tx.transactionId)}
                            title="Download PDF Receipt"
                            icon={<Download className="w-3.5 h-3.5" />}
                          >
                            PDF
                          </Button>
                        </div>
                      ) : (
                        <span className="text-text-muted text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedTxIdForReceipt && (
          <PaymentReceiptModal
            isOpen={Boolean(selectedTxIdForReceipt)}
            onClose={() => setSelectedTxIdForReceipt(null)}
            transactionId={selectedTxIdForReceipt}
          />
        )}
      </Card>

      {/* Privacy and Notifications */}
      <div className="grid max-w-4xl gap-6 md:grid-cols-2">
        <Card
          header={
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-neutral text-text-secondary">
                <Shield className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold text-text-primary">Privacy Controls</span>
            </div>
          }
        >
          <div className="space-y-4">
            {[
              ["profileVisible", "Profile visibility"],
              ["resumeVisible", "Resume visibility"],
              ["careerVisible", "Career profile visibility"],
            ].map(([key, label]) => (
              <Toggle
                key={key}
                label={label}
                description="Off by default. Enable only when you choose to share this information."
                value={settings.privacy[key]}
                onChange={() => toggle("privacy", key)}
              />
            ))}
          </div>
        </Card>

        <Card
          header={
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-neutral text-text-secondary">
                <Bell className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold text-text-primary">Notifications</span>
            </div>
          }
        >
          <div className="space-y-4">
            {[
              ["assessment", "Assessment reminders"],
              ["practice", "Practice recommendations"],
              ["results", "Performance reports"],
              ["resume", "Skill analysis updates"],
            ].map(([key, label]) => (
              <Toggle
                key={key}
                label={label}
                description="Receive updates via your registered contact channels."
                value={settings.notificationPreferences[key]}
                onChange={() => toggle("notificationPreferences", key)}
              />
            ))}
          </div>
        </Card>
      </div>

      {/* Account Security */}
      <Card
        className="max-w-4xl"
        header={
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-neutral text-text-secondary">
              <LockKeyhole className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold text-text-primary">Preferences & Security</span>
          </div>
        }
      >
        <p className="text-xs text-text-secondary">
          Preferences are synced to your secure Evalora account profile. Click below to persist any changes.
        </p>
        <div className="mt-4 flex justify-end">
          <Button variant="primary" isLoading={isSaving} onClick={save}>
            Save Preferences
          </Button>
        </div>
      </Card>
    </div>
  );
};

const Toggle: React.FC<{
  label: string;
  description: string;
  value: boolean;
  onChange: () => void;
}> = ({ label, description, value, onChange }) => (
  <label className="flex cursor-pointer items-start justify-between gap-4">
    <span>
      <span className="block text-sm font-medium text-text-primary">
        {label}
      </span>
      <span className="mt-0.5 block text-xs leading-4 text-text-secondary">
        {description}
      </span>
    </span>
    <input
      type="checkbox"
      checked={value}
      onChange={onChange}
      className="mt-1 h-4 w-4 rounded border-border-subtle text-brand-primary accent-brand-primary focus:ring-brand-primary"
    />
  </label>
);
