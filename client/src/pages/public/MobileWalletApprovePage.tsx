import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { LogoMark } from "../../components/ui/LogoMark";
import {
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Smartphone,
  XCircle,
} from "lucide-react";
import {
  connectInjectedAlgorandWallet,
  signChallengeWithInjectedWallet,
} from "../../utils/algorandWallet";

export const MobileWalletApprovePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("sessionId") || "";

  const [status, setStatus] = useState<
    | "LOADING"
    | "READY"
    | "SIGNING"
    | "APPROVED"
    | "REJECTED"
    | "EXPIRED"
    | "ERROR"
  >("LOADING");
  const [challenge, setChallenge] = useState("");
  const [connectedAddress, setConnectedAddress] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Notify backend that the QR code was scanned by the Pera Wallet mobile app
  useEffect(() => {
    if (!sessionId) {
      setStatus("ERROR");
      setErrorMessage("Missing Pera QR authentication session ID.");
      return;
    }

    let cancelled = false;
    api
      .post(`/wallet/qr/${encodeURIComponent(sessionId)}/scan`, {
        walletType: "pera",
        network: "algorand",
      })
      .then((res) => {
        if (cancelled) return;
        setChallenge(res.data.challenge || "");
        setStatus("READY");
      })
      .catch((err) => {
        if (cancelled) return;
        const msg =
          err.response?.data?.message ||
          "This QR session is invalid or has expired.";
        if (msg.toLowerCase().includes("expired")) {
          setStatus("EXPIRED");
        } else {
          setStatus("ERROR");
        }
        setErrorMessage(msg);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const handleConnectAndApprove = async () => {
    if (!sessionId) return;
    setIsSubmitting(true);
    setErrorMessage("");
    setStatus("SIGNING");

    try {
      let address = connectedAddress.trim().toUpperCase();

      if (!address) {
        const connected = await connectInjectedAlgorandWallet(true);
        if (connected) {
          address = connected.toUpperCase();
          setConnectedAddress(address);
        }
      }

      if (!address) {
        setStatus("READY");
        setErrorMessage(
          "Could not detect an active Pera Wallet session. Open this page inside Pera Wallet Mobile or connect Pera Wallet below."
        );
        return;
      }

      // Bind scanning Pera wallet address and retrieve formatted challenge
      const scanRes = await api.post(
        `/wallet/qr/${encodeURIComponent(sessionId)}/scan`,
        {
          walletAddress: address,
          walletType: "pera",
          network: "algorand",
        }
      );

      const challengeToSign = scanRes.data.challenge || challenge;
      setChallenge(challengeToSign);

      const signature = await signChallengeWithInjectedWallet(
        address,
        challengeToSign
      );

      if (!signature) {
        setStatus("READY");
        setErrorMessage(
          "Signature request was not completed in Pera Wallet. Please try again."
        );
        return;
      }

      await api.post(`/wallet/qr/${encodeURIComponent(sessionId)}/verify`, {
        walletAddress: address,
        walletType: "pera",
        network: "algorand",
        signature,
        requireProfileSetup: true,
      });

      setStatus("APPROVED");
    } catch (err: any) {
      setStatus("READY");
      setErrorMessage(
        err.response?.data?.message ||
          "Pera Wallet signature verification failed. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!sessionId) return;
    setIsSubmitting(true);
    try {
      await api.post(`/wallet/qr/${encodeURIComponent(sessionId)}/verify`, {
        rejected: true,
      });
      setStatus("REJECTED");
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message || "Unable to reject QR session."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentUrl = typeof window !== "undefined" ? window.location.href : "";
  const deepLinkHref = `perawallet://app/discover-browser?url=${encodeURIComponent(
    currentUrl
  )}`;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md flex-col justify-center px-4 py-10">
      <Card padding="lg" className="space-y-5">
        <div className="flex items-center justify-between border-b border-[#E8E8EF] pb-4">
          <div className="flex items-center gap-2.5">
            <LogoMark size="sm" />
            <div>
              <h1 className="text-base font-semibold text-[#18181F]">
                Pera Wallet Sign-In
              </h1>
              <p className="text-xs text-[#6B6B78]">
                Mobile Wallet Approval Request
              </p>
            </div>
          </div>
          <Badge variant="purple">Algorand</Badge>
        </div>

        {status === "LOADING" && (
          <div className="py-8 text-center text-xs text-[#6B6B78]">
            Connecting to Pera QR authentication session...
          </div>
        )}

        {(status === "READY" || status === "SIGNING") && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#E8E8EF] bg-[#F7F7FB] p-3.5 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[#6B6B78]">Wallet Provider</span>
                <span className="font-semibold text-[#18181F]">
                  Pera Wallet
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6B6B78]">Blockchain Network</span>
                <span className="font-mono text-[#18181F]">Algorand</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6B6B78]">Verification Type</span>
                <span className="text-emerald-700 font-semibold">
                  Zero-Fee Ownership Signature
                </span>
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
                {errorMessage}
              </div>
            )}

            <div className="space-y-2.5">
              <Button
                type="button"
                variant="primary"
                className="w-full"
                isLoading={isSubmitting}
                icon={<ShieldCheck className="h-4 w-4" />}
                onClick={handleConnectAndApprove}
              >
                Connect Pera Wallet & Approve Login
              </Button>

              <a
                href={deepLinkHref}
                className="flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-[#E8E8EF] bg-white px-3 py-2 text-xs font-semibold text-[#18181F] hover:bg-[#F7F7FB]"
              >
                <Smartphone className="h-3.5 w-3.5 text-[#5B5CE2]" />
                Open in Pera Wallet Mobile App
                <ExternalLink className="h-3 w-3 text-[#9494A3]" />
              </a>

              <Button
                type="button"
                variant="ghost"
                className="w-full text-rose-700 hover:bg-rose-50"
                disabled={isSubmitting}
                onClick={handleReject}
              >
                Reject Sign-In Request
              </Button>
            </div>
          </div>
        )}

        {status === "APPROVED" && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center text-xs text-emerald-900 space-y-2">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
            <p className="text-sm font-semibold">
              Wallet verified. Logging you in...
            </p>
            <p>
              Your desktop browser has been authenticated and is redirecting to
              your Evalora dashboard. You may close this mobile window.
            </p>
          </div>
        )}

        {status === "REJECTED" && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-center text-xs text-rose-900 space-y-2">
            <XCircle className="mx-auto h-8 w-8 text-rose-600" />
            <p className="text-sm font-semibold">
              Wallet approval was rejected.
            </p>
            <p>The desktop QR login session was cancelled.</p>
          </div>
        )}

        {(status === "EXPIRED" || status === "ERROR") && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center text-xs text-amber-900 space-y-3">
            <p className="font-semibold">
              {errorMessage ||
                "QR expired. Generate a new QR code on your desktop."}
            </p>
            <Link
              to="/login"
              className="inline-block font-semibold text-[#5B5CE2] underline"
            >
              Return to Evalora Login
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
};
