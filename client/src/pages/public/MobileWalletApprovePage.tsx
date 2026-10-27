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
        <div className="flex items-center justify-between border-b border-[#E9E7F0] pb-4">
          <div className="flex items-center gap-2.5">
            <LogoMark size="sm" />
            <div>
              <h1 className="text-base font-semibold text-[#49465B]">
                Pera Wallet Sign-In
              </h1>
              <p className="text-xs text-[#777486]">
                Mobile Wallet Approval Request
              </p>
            </div>
          </div>
          <Badge variant="purple">Algorand</Badge>
        </div>

        {status === "LOADING" && (
          <div className="py-8 text-center text-xs text-[#777486]">
            Connecting to Pera QR authentication session...
          </div>
        )}

        {(status === "READY" || status === "SIGNING") && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#E9E7F0] bg-[#F8F7FC] p-3.5 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[#777486]">Wallet Provider</span>
                <span className="font-semibold text-[#49465B]">
                  Pera Wallet
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#777486]">Blockchain Network</span>
                <span className="font-mono text-[#49465B]">Algorand</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#777486]">Verification Type</span>
                <span className="text-[#527565] font-semibold">
                  Zero-Fee Ownership Signature
                </span>
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-[#E8CFD2] bg-[#F8EDEF] p-3 text-xs text-[#9A646D]">
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
                className="flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-[#E9E7F0] bg-white px-3 py-2 text-xs font-semibold text-[#49465B] hover:bg-[#F8F7FC]"
              >
                <Smartphone className="h-3.5 w-3.5 text-[#7779C5]" />
                Open in Pera Wallet Mobile App
                <ExternalLink className="h-3 w-3 text-[#9895A8]" />
              </a>

              <Button
                type="button"
                variant="ghost"
                className="w-full text-[#9A646D] hover:bg-[#F8EDEF]"
                disabled={isSubmitting}
                onClick={handleReject}
              >
                Reject Sign-In Request
              </Button>
            </div>
          </div>
        )}

        {status === "APPROVED" && (
          <div className="rounded-xl border border-[#C8DFD1] bg-[#E9F3ED] p-5 text-center text-xs text-[#527565] space-y-2">
            <CheckCircle2 className="mx-auto h-8 w-8 text-[#527565]" />
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
          <div className="rounded-xl border border-[#E8CFD2] bg-[#F8EDEF] p-5 text-center text-xs text-[#9A646D] space-y-2">
            <XCircle className="mx-auto h-8 w-8 text-[#9A646D]" />
            <p className="text-sm font-semibold">
              Wallet approval was rejected.
            </p>
            <p>The desktop QR login session was cancelled.</p>
          </div>
        )}

        {(status === "EXPIRED" || status === "ERROR") && (
          <div className="rounded-xl border border-[#E8D9B9] bg-[#F8F3E8] p-5 text-center text-xs text-[#896D45] space-y-3">
            <p className="font-semibold">
              {errorMessage ||
                "QR expired. Generate a new QR code on your desktop."}
            </p>
            <Link
              to="/login"
              className="inline-block font-semibold text-[#7779C5] underline"
            >
              Return to Evalora Login
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
};
