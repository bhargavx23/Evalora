import React, { useEffect, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { LogoMark } from "../../components/ui/LogoMark";
import { QrCodeDisplay } from "../../components/wallet/QrCodeDisplay";
import {
  ArrowLeft,
  ArrowRight,
  Building,
  CheckCircle2,
  Lock,
  Mail,
  Phone,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  User,
  Wallet,
  XCircle,
} from "lucide-react";
import { UserRole } from "../../shared/types";
import {
  isValidAlgorandAddressFormat,
  connectInjectedAlgorandWallet,
  signChallengeWithInjectedWallet,
  setConnectedBrowserWallet,
  getPeraWalletInstance,
  resetPeraWalletInstance,
} from "../../utils/algorandWallet";

type AuthMode =
  | "select"
  | "pera_qr"
  | "onboarding_pera"
  | "password";

export const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [authMode, setAuthMode] = useState<AuthMode>("select");
  const [isLoading, setIsLoading] = useState(false);

  // Password sign-in state
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  // Pera Wallet state
  const [walletAddress, setWalletAddress] = useState("");
  const [walletStatusText, setWalletStatusText] = useState("");

  // Onboarding / Profile Setup state (Section 10 Case B & Section 24)
  const [onboardingToken, setOnboardingToken] = useState("");
  const [onboardingName, setOnboardingName] = useState("");
  const [onboardingEmail, setOnboardingEmail] = useState("");
  const [onboardingPhone, setOnboardingPhone] = useState("");

  // Desktop Pera QR Login state (Sections 13–21 & Section 35)
  const [qrSessionId, setQrSessionId] = useState("");
  const [qrUri, setQrUri] = useState("");
  const [qrChallenge, setQrChallenge] = useState("");
  const [qrStatus, setQrStatus] = useState<
    | "IDLE"
    | "GENERATING"
    | "PENDING"
    | "SCANNED"
    | "SIGNING"
    | "VERIFYING"
    | "VERIFIED"
    | "REJECTED"
    | "EXPIRED"
    | "CANCELLED"
    | "UNAVAILABLE"
  >("IDLE");
  const [qrExpiresAt, setQrExpiresAt] = useState<string>("");
  const [qrSecondsLeft, setQrSecondsLeft] = useState<number>(0);
  const [showMobileCompanion, setShowMobileCompanion] = useState(false);
  const [mobileSimAddress, setMobileSimAddress] = useState("");
  const [isSimulatingMobile, setIsSimulatingMobile] = useState(false);
  const qrPollIntervalRef = useRef<number | null>(null);

  const { user, authStatus, login, loginWithToken } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectParam = searchParams.get("redirect");
  const returnTo =
    (location.state as { from?: string } | null)?.from ||
    (redirectParam && redirectParam.startsWith("/") ? redirectParam : null);

  const redirectUser = (role: UserRole) => {
    if (returnTo && returnTo.startsWith("/")) {
      navigate(returnTo, { replace: true });
      return;
    }
    if (role === "student") navigate("/dashboard", { replace: true });
    else if (role === "faculty") navigate("/faculty/dashboard", { replace: true });
    else if (role === "college_admin") navigate("/admin/dashboard", { replace: true });
    else if (role === "platform_admin" || role === "admin") navigate("/admin", { replace: true });
    else navigate("/dashboard", { replace: true });
  };

  useEffect(() => {
    if (authStatus === "authenticated" && user) {
      redirectUser(user.role);
    }
  }, [authStatus, user]);

  useEffect(() => {
    const token = searchParams.get("token");
    const oauthError = searchParams.get("oauthError");

    if (oauthError) {
      toast.error(oauthError);
    }

    if (token) {
      loginWithToken(token)
        .then((user) => {
          toast.success(`Welcome back, ${user.name}!`);
          redirectUser(user.role);
        })
        .catch((err) => toast.error(err.message || "Sign in failed"));
    }
  }, []);

  const stopQrPolling = () => {
    if (qrPollIntervalRef.current) {
      window.clearInterval(qrPollIntervalRef.current);
      qrPollIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopQrPolling();
  }, []);

  // Countdown timer for active QR session
  useEffect(() => {
    if (
      !qrExpiresAt ||
      !["PENDING", "SCANNED", "SIGNING"].includes(qrStatus)
    ) {
      return;
    }

    const updateRemaining = () => {
      const diffSec = Math.max(
        0,
        Math.floor((new Date(qrExpiresAt).getTime() - Date.now()) / 1000)
      );
      setQrSecondsLeft(diffSec);
      if (diffSec <= 0) {
        setQrStatus("EXPIRED");
        stopQrPolling();
      }
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [qrExpiresAt, qrStatus]);

  // =========================================================================
  // 2. PERA WALLET REAL DESKTOP QR & MOBILE CONNECT FLOW (SECTIONS 81–95)
  // =========================================================================
  const startPeraQrSession = async () => {
    stopQrPolling();
    setAuthMode("pera_qr");
    setQrStatus("GENERATING");
    setWalletStatusText("Generating secure Pera Wallet connection request...");
    setQrUri("");

    try {
      // 1. Create secure backend session for tracking & nonce binding
      const res = await api.post("/wallet/qr/create", {
        walletType: "pera",
        network: "algorand",
      });

      if (!res.data.success) {
        throw new Error(res.data.message || "Failed to create QR session.");
      }

      const sid = res.data.sessionId;
      setQrSessionId(sid);
      setQrChallenge(res.data.challenge);
      setQrExpiresAt(res.data.expiresAt);
      setQrStatus("PENDING");
      setWalletStatusText("Scan this QR code using your Pera Wallet mobile app.");

      // 2. Initialize genuine Pera WalletConnect session
      const pera = resetPeraWalletInstance();

      // Monitor for genuine WalletConnect URI to render camera-scannable QR
      let uriFound = false;
      const checkInterval = window.setInterval(() => {
        const uri = pera.connector?.uri;
        if (uri && !uriFound) {
          uriFound = true;
          setQrUri(uri);
        }
      }, 100);

      // Start the Pera connection request
      pera
        .connect()
        .then(async (accounts) => {
          window.clearInterval(checkInterval);
          if (!accounts || accounts.length === 0) {
            throw new Error("No Algorand account returned from Pera Wallet.");
          }

          const address = accounts[0].toUpperCase();
          setWalletAddress(address);
          setConnectedBrowserWallet(address, "pera", "algorand");

          // Status: QR scanned & approved -> Requesting signature
          setQrStatus("SIGNING");
          setWalletStatusText("Wallet connected. Requesting authentication signature...");

          const chalRes = await api.post("/wallet/challenge", {
            walletAddress: address,
            walletType: "pera",
            network: "algorand",
            purpose: "LOGIN",
            sessionId: sid,
          });

          if (!chalRes.data.success) {
            throw new Error(chalRes.data.message || "Failed to issue authentication challenge.");
          }

          const challenge = chalRes.data.challenge;
          setQrStatus("VERIFYING");
          setWalletStatusText("Wallet authentication received. Verifying wallet...");

          const sig = await signChallengeWithInjectedWallet(address, challenge);
          if (!sig) {
            throw new Error("Authentication signature was not provided by Pera Wallet.");
          }

          // Backend verification
          const verifyRes = await api.post("/wallet/verify", {
            walletAddress: address,
            walletType: "pera",
            network: "algorand",
            challenge,
            signature: sig,
          });

          setQrStatus("VERIFIED");
          setWalletStatusText("Wallet verified. Logging you in...");

          // Existing user -> Dashboard
          if (verifyRes.data.token) {
            const user = await loginWithToken(verifyRes.data.token);
            toast.success(`Welcome back, ${user.name}!`);
            redirectUser(user.role);
            return;
          }

          // New user -> Registration / Profile Setup
          if (verifyRes.data.requiresProfileSetup) {
            setOnboardingToken(verifyRes.data.onboardingToken);
            setOnboardingName("");
            setOnboardingEmail("");
            setOnboardingPhone("");
            setAuthMode("onboarding_pera");
            toast.info("Pera Wallet verified! Complete your profile to create your Evalora account.");
          }
        })
        .catch((err: any) => {
          window.clearInterval(checkInterval);
          if (err?.message?.includes("closed") || err?.type === "CONNECT_MODAL_CLOSED") {
            handleCancelPeraQr();
          } else {
            setQrStatus("REJECTED");
            setWalletStatusText(err.message || "Pera Wallet connection failed or was rejected.");
          }
        });

      // Poll QR session status as fallback in case approved externally
      qrPollIntervalRef.current = window.setInterval(async () => {
        try {
          const pollRes = await api.get(
            `/wallet/qr/${encodeURIComponent(sid)}/status`
          );
          const st = pollRes.data.status;

          if (
            st === "SCANNED" ||
            st === "SIGNING" ||
            st === "AWAITING_APPROVAL"
          ) {
            setQrStatus(st === "AWAITING_APPROVAL" ? "SIGNING" : st);
          } else if (st === "REJECTED") {
            setQrStatus("REJECTED");
            stopQrPolling();
          } else if (st === "EXPIRED") {
            setQrStatus("EXPIRED");
            stopQrPolling();
          } else if (st === "CANCELLED") {
            setQrStatus("CANCELLED");
            stopQrPolling();
          } else if (st === "VERIFIED") {
            setQrStatus("VERIFIED");
            stopQrPolling();

            if (
              pollRes.data.requiresProfileSetup &&
              pollRes.data.onboardingToken
            ) {
              setWalletAddress(pollRes.data.walletAddress || "");
              setOnboardingToken(pollRes.data.onboardingToken);
              setOnboardingName("");
              setOnboardingEmail("");
              setOnboardingPhone("");
              setAuthMode("onboarding_pera");
              toast.info(
                "Pera Wallet verified! Complete your profile to create your Evalora account."
              );
              return;
            }

            if (pollRes.data.token) {
              if (pollRes.data.walletAddress) {
                setConnectedBrowserWallet(
                  pollRes.data.walletAddress,
                  "pera",
                  "algorand"
                );
              }
              const user = await loginWithToken(pollRes.data.token);
              toast.success(`Welcome back, ${user.name}!`);
              redirectUser(user.role);
            }
          }
        } catch (pollErr: any) {
          if (!pollErr.response) {
            setQrStatus("UNAVAILABLE");
            stopQrPolling();
          }
        }
      }, 2000);
    } catch {
      setQrStatus("UNAVAILABLE");
      toast.error(
        "Pera Wallet QR service is temporarily unavailable. Please try again."
      );
    }
  };

  const handleCancelPeraQr = async () => {
    stopQrPolling();
    try {
      const pera = getPeraWalletInstance();
      if (pera.isConnected) {
        await pera.disconnect();
      }
    } catch {
      // Ignore
    }
    if (qrSessionId) {
      try {
        await api.post(`/wallet/qr/${encodeURIComponent(qrSessionId)}/cancel`);
      } catch {
        // Ignore network errors on cancel
      }
    }
    setQrStatus("CANCELLED");
    setAuthMode("select");
  };

  // Direct Pera Wallet browser/modal connection fallback
  const handleDirectPeraConnect = async () => {
    setIsLoading(true);
    setWalletStatusText("Connecting to Pera Wallet...");
    try {
      const connectedAddr = await connectInjectedAlgorandWallet(true);
      if (!connectedAddr) {
        setWalletStatusText("");
        toast.info(
          "Scan the QR code displayed above using your Pera Wallet mobile app."
        );
        return;
      }

      setWalletStatusText("Requesting challenge from Evalora...");
      const challengeRes = await api.post("/wallet/challenge", {
        walletAddress: connectedAddr,
        walletType: "pera",
        network: "algorand",
        purpose: "LOGIN",
      });

      const issuedChallenge = challengeRes.data.challenge;
      const normalizedAddr =
        challengeRes.data.walletAddress || connectedAddr.toUpperCase();

      setWalletStatusText("Waiting for approval in Pera Wallet...");
      const signed = await signChallengeWithInjectedWallet(
        normalizedAddr,
        issuedChallenge
      );

      if (!signed) {
        setWalletStatusText("");
        toast.warning("Pera Wallet signature was cancelled.");
        return;
      }

      setWalletStatusText("Verifying wallet...");
      const verifyRes = await api.post("/wallet/verify", {
        walletAddress: normalizedAddr,
        walletType: "pera",
        network: "algorand",
        challenge: issuedChallenge,
        signature: signed,
        requireProfileSetup: true,
      });

      stopQrPolling();

      if (
        verifyRes.data.requiresProfileSetup &&
        verifyRes.data.onboardingToken
      ) {
        setWalletAddress(normalizedAddr);
        setOnboardingToken(verifyRes.data.onboardingToken);
        setOnboardingName("");
        setOnboardingEmail("");
        setOnboardingPhone("");
        setAuthMode("onboarding_pera");
        setWalletStatusText("");
        return;
      }

      if (verifyRes.data.success && verifyRes.data.token) {
        setConnectedBrowserWallet(normalizedAddr, "pera", "algorand");
        const user = await loginWithToken(verifyRes.data.token);
        toast.success(`Welcome back, ${user.name}!`);
        redirectUser(user.role);
      }
    } catch (err: any) {
      setWalletStatusText("");
      toast.error(
        err.response?.data?.message || "Pera Wallet verification failed."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Mobile Pera Testnet Companion helper for testing QR scan & approval in browser
  const handleSimulateMobilePera = async (
    action: "scan" | "approve" | "reject"
  ) => {
    if (!qrSessionId) return;
    setIsSimulatingMobile(true);
    try {
      if (action === "reject") {
        await api.post(
          `/wallet/qr/${encodeURIComponent(qrSessionId)}/verify`,
          { rejected: true }
        );
        setQrStatus("REJECTED");
        stopQrPolling();
        return;
      }

      const addr = mobileSimAddress.trim().toUpperCase();
      if (!isValidAlgorandAddressFormat(addr)) {
        toast.warning(
          "Enter a valid 58-character Algorand address to test Pera mobile approval."
        );
        return;
      }

      const scanRes = await api.post(
        `/wallet/qr/${encodeURIComponent(qrSessionId)}/scan`,
        {
          walletAddress: addr,
          walletType: "pera",
          network: "algorand",
        }
      );

      if (action === "scan") {
        setQrStatus("SCANNED");
        setQrChallenge(scanRes.data.challenge || qrChallenge);
        toast.info("QR detected. Waiting for approval...");
        return;
      }

      setQrStatus("VERIFYING");
      const challengeToSign = scanRes.data.challenge || qrChallenge;
      const sig = await signChallengeWithInjectedWallet(addr, challengeToSign);

      if (!sig) {
        toast.info(
          "Open the QR link on your mobile device or connect an injected Algorand signer to sign."
        );
        setQrStatus("SIGNING");
        return;
      }

      await api.post(`/wallet/qr/${encodeURIComponent(qrSessionId)}/verify`, {
        walletAddress: addr,
        walletType: "pera",
        network: "algorand",
        signature: sig,
        requireProfileSetup: true,
      });
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Pera mobile QR simulation failed."
      );
    } finally {
      setIsSimulatingMobile(false);
    }
  };

  // Complete Pera Wallet profile setup.
  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardingName.trim()) {
      toast.warning("Please enter your full name.");
      return;
    }
    if (!onboardingEmail.trim()) {
      toast.warning("Please enter your email address.");
      return;
    }
    if (!onboardingPhone.trim()) {
      toast.warning("Please enter your phone number.");
      return;
    }

    setIsLoading(true);
    try {
      const payload: Record<string, unknown> = {
        onboardingToken,
        name: onboardingName.trim(),
        email: onboardingEmail.trim().toLowerCase(),
        phone: onboardingPhone.trim(),
      };

      const res = await api.post("/wallet/complete-onboarding", payload);

      if (res.data.success && res.data.token) {
        if (walletAddress) {
          setConnectedBrowserWallet(walletAddress, "pera", "algorand");
        }
        const user = await loginWithToken(res.data.token);
        toast.success(`Welcome to Evalora, ${user.name}!`);
        redirectUser(user.role);
      }
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Unable to complete account setup."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // =========================================================================
  // EMAIL + PASSWORD SIGN-IN
  // =========================================================================
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.warning("Please enter both email and password");
      return;
    }

    setIsLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name}!`);
      redirectUser(user.role);
    } catch (err: any) {
      toast.error(err.message || "Login failed. Please verify credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-[calc(100vh-9rem)] max-w-[1160px] grid-cols-1 items-center gap-12 px-4 py-12 lg:grid-cols-[1fr_460px]">
      {/* Left Brand Column */}
      <section className="hidden max-w-xl space-y-8 lg:block">
        <LogoMark size="lg" />
        <div className="space-y-4">
          <div className="page-kicker">
            Adaptive Practice & Assessment Platform
          </div>
          <h1 className="display-heading text-5xl leading-[1.04] text-[#3C4B63]">
            Practice smarter.
            <span className="block text-[#5288B8]">Evaluate better.</span>
          </h1>
          <p className="text-base leading-7 text-[#748199]">
            Sign in with your email and password or connect your Pera Wallet on
            Algorand to access adaptive DSA, Aptitude, Reasoning, and Coding
            practice sessions.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 border-t border-[#E0E5EF] pt-6 text-sm">
          <div className="rounded-xl border border-[#E0E5EF] bg-white p-3.5">
            <div className="font-semibold text-[#3C4B63]">Email + Password</div>
            <div className="mt-1 text-xs text-[#748199]">
              Secure account sign-in
            </div>
          </div>
          <div className="rounded-xl border border-[#E0E5EF] bg-white p-3.5">
            <div className="font-semibold text-[#3C4B63]">Pera Wallet</div>
            <div className="mt-1 text-xs text-[#748199]">
              Algorand QR authentication
            </div>
          </div>
          <div className="rounded-xl border border-[#E0E5EF] bg-white p-3.5">
            <div className="font-semibold text-[#3C4B63]">10 Free Sessions</div>
            <div className="mt-1 text-xs text-[#748199]">
              Included for new accounts
            </div>
          </div>
        </div>
      </section>

      {/* Right Authentication Card */}
      <Card padding="lg" className="border-[#E0E5EF] bg-white">
        <div className="space-y-6">
          {/* =============================================================== */}
          {/* VIEW 1: PRIMARY AUTH SELECTION (SECTION 9 & SECTION 35)         */}
          {/* =============================================================== */}
          {authMode === "select" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="display-heading text-3xl text-[#3C4B63]">
                  Welcome to Evalora
                </h2>
                <p className="text-sm text-[#748199]">
                  Select how you'd like to access your account.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  className="w-full justify-between px-5 font-semibold"
                  icon={<Mail className="h-4 w-4" />}
                  onClick={() => {
                    setAuthMode("password");
                  }}
                >
                  <span className="flex-1 text-left">Continue with Email + Password</span>
                  <ArrowRight className="h-4 w-4 opacity-80" />
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="w-full justify-between px-5 font-semibold"
                  icon={<Wallet className="h-4 w-4 text-[#5288B8]" />}
                  onClick={() => startPeraQrSession()}
                >
                  <span className="flex-1 text-left">Continue with Pera Wallet</span>
                  <QrCode className="h-4 w-4 text-[#5288B8]" />
                </Button>
              </div>

              {/* Distinct User Account vs Institution Account paths */}
              <div className="space-y-3 pt-1">
                {/* 1. Normal User / Student Account */}
                <div className="rounded-xl border border-[#E0E5EF] bg-[#F7F8FF] p-4 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-[#3C4B63]">
                      New to Evalora?
                    </span>
                    <Badge variant="blue" size="sm">
                      Student / User Account
                    </Badge>
                  </div>
                  <p className="text-[#748199] text-[11px] leading-relaxed">
                    Create a personal student account to practice questions, take exams, and track skill growth.
                  </p>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    className="w-full justify-center font-medium"
                    onClick={() => navigate("/register")}
                    icon={<ArrowRight className="h-3.5 w-3.5" />}
                  >
                    Create User Account
                  </Button>
                </div>

                {/* 2. Educational Institution / Organization */}
                <div className="rounded-xl border border-[#E0E5EF] bg-white p-4 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-[#3C4B63]">
                      Are you an organization?
                    </span>
                    <Badge variant="neutral" size="sm">
                      College / University
                    </Badge>
                  </div>
                  <p className="text-[#748199] text-[11px] leading-relaxed">
                    Set up an isolated institutional workspace for faculty, departments, and assessments.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-center font-medium"
                    onClick={() => navigate("/college-register")}
                    icon={<Building className="h-3.5 w-3.5" />}
                  >
                    Register Your Institution
                  </Button>
                </div>
              </div>

            </div>
          )}

          {/* =============================================================== */}
          {/* VIEW 3: CONTINUE WITH PERA (DESKTOP QR FLOW) (SECTIONS 81–95)   */}
          {/* =============================================================== */}
          {authMode === "pera_qr" && (
            <div className="space-y-5 text-center">
              <div className="flex items-center justify-between text-left">
                <div>
                  <h2 className="display-heading text-2xl text-[#3C4B63]">
                    Connect with Pera Wallet
                  </h2>
                  <p className="text-xs text-[#748199]">
                    Scan this QR code using your Pera Wallet mobile app
                  </p>
                </div>
                <Badge variant="purple">Algorand</Badge>
              </div>

              {qrStatus === "GENERATING" && (
                <div className="py-12 text-xs font-medium text-[#748199]">
                  <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin text-[#5288B8]" />
                  Generating secure Pera Wallet connection request...
                </div>
              )}

              {["PENDING", "SCANNED", "SIGNING", "VERIFYING"].includes(qrStatus) && (
                <div className="flex flex-col items-center space-y-4 py-1">
                  {qrUri ? (
                    <QrCodeDisplay
                      value={qrUri}
                      size={210}
                      walletLabel="Pera Wallet"
                    />
                  ) : (
                    <div className="flex h-[210px] w-[210px] items-center justify-center rounded-xl border border-stone-200 bg-[#F7F8FC]">
                      <RefreshCw className="h-6 w-6 animate-spin text-[#5288B8]" />
                    </div>
                  )}

                  <div className="w-full rounded-xl border border-[#D6D8F8] bg-[#EAF1F9]/70 px-4 py-3 text-xs">
                    <p className="font-semibold text-[#3C648E]">
                      {qrStatus === "PENDING" && "Waiting for wallet approval..."}
                      {qrStatus === "SCANNED" && "QR scanned. Waiting for approval in Pera Wallet..."}
                      {qrStatus === "SIGNING" && "Wallet connected. Requesting authentication signature..."}
                      {qrStatus === "VERIFYING" && "Wallet authentication received. Verifying wallet..."}
                    </p>
                    <p className="mt-1 text-[11px] text-[#748199]">
                      {qrStatus === "PENDING" && "Open Pera Wallet on your phone and scan the QR code."}
                      {qrStatus === "SCANNED" && "Please review and approve the connection in Pera Wallet."}
                      {qrStatus === "SIGNING" && "Approve the signature request in Pera Wallet to complete sign-in."}
                      {qrStatus === "VERIFYING" && "Cryptographically verifying your Algorand wallet address..."}
                    </p>
                    {qrSecondsLeft > 0 && (
                      <p className="mt-1 text-[10px] text-[#8490A2]">
                        Request expires in {qrSecondsLeft}s
                      </p>
                    )}
                  </div>

                  {/* Direct Mobile Launch Button (Section 92) */}
                  {qrUri && (
                    <div className="w-full pt-1 sm:hidden">
                      <a
                        href={`perawallet://wc?uri=${encodeURIComponent(qrUri)}`}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#5288B8] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#5288B8]"
                      >
                        <Smartphone className="h-4 w-4" />
                        Open in Pera Wallet App
                      </a>
                    </div>
                  )}

                  <div className="w-full space-y-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      isLoading={isLoading}
                      icon={<Wallet className="h-3.5 w-3.5 text-[#5288B8]" />}
                      onClick={handleDirectPeraConnect}
                    >
                      Connect Pera Extension on This Device
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      onClick={handleCancelPeraQr}
                      className="w-full text-xs font-medium text-[#748199] hover:text-[#3C4B63]"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {qrStatus === "VERIFIED" && (
                <div className="rounded-xl border border-[#C6DFD2] bg-[#E5F2EB] p-5 text-xs text-[#4C765D]">
                  <CheckCircle2 className="mx-auto mb-2 h-7 w-7 text-[#4C765D]" />
                  <p className="text-sm font-semibold">
                    Wallet verified. Logging you in...
                  </p>
                </div>
              )}

              {qrStatus === "REJECTED" && (
                <div className="rounded-xl border border-[#EACBC4] bg-[#F8EDEF] p-5 text-xs text-[#A36162] space-y-3">
                  <XCircle className="mx-auto h-7 w-7 text-[#A36162]" />
                  <p className="font-semibold">
                    Wallet connection was rejected or cancelled.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={handleCancelPeraQr}
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      className="flex-1"
                      icon={<RefreshCw className="h-3.5 w-3.5" />}
                      onClick={() => startPeraQrSession()}
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              )}

              {qrStatus === "EXPIRED" && (
                <div className="rounded-xl border border-[#E9DAB5] bg-[#F8F3E8] p-5 text-xs text-[#8A7047] space-y-3">
                  <p className="font-semibold">
                    This wallet connection request has expired.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={handleCancelPeraQr}
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      className="flex-1"
                      icon={<RefreshCw className="h-3.5 w-3.5" />}
                      onClick={() => startPeraQrSession()}
                    >
                      Generate New QR
                    </Button>
                  </div>
                </div>
              )}

              {qrStatus === "UNAVAILABLE" && (
                <div className="rounded-xl border border-[#E0E5EF] bg-[#F7F8FC] p-5 text-xs text-[#748199] space-y-3">
                  <p className="font-semibold text-[#3C4B63]">
                    Pera Wallet service is temporarily unavailable.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={handleCancelPeraQr}
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      className="flex-1"
                      onClick={() => startPeraQrSession()}
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* VIEW 4: NEW PERA WALLET USER REGISTRATION (SECTION 24 & 35)     */}
          {/* =============================================================== */}
          {authMode === "onboarding_pera" && (
            <form onSubmit={handleCompleteOnboarding} className="space-y-4">
              <div className="space-y-1">
                <Badge variant="green">Wallet Verified</Badge>
                <h2 className="display-heading pt-1 text-2xl text-[#3C4B63]">
                  Complete your Evalora account
                </h2>
                <p className="text-xs text-[#748199]">
                  Your Pera Wallet has been verified. Enter your details below
                  to create your account.
                </p>
              </div>

              <div>
                <label className="field-label">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 h-4 w-4 text-[#8490A2]" />
                  <input
                    type="text"
                    value={onboardingName}
                    onChange={(e) => setOnboardingName(e.target.value)}
                    placeholder="Enter your full name"
                    className="field-control pl-10"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="field-label">Email Address *</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-[#8490A2]" />
                  <input
                    type="email"
                    value={onboardingEmail}
                    onChange={(e) => setOnboardingEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="field-control pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="field-label">Phone Number *</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 h-4 w-4 text-[#8490A2]" />
                  <input
                    type="tel"
                    value={onboardingPhone}
                    onChange={(e) => setOnboardingPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="field-control pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="field-label">
                  Connected Pera Wallet (Verified)
                </label>
                <div className="rounded-xl border border-[#C6DFD2] bg-[#E5F2EB]/70 px-3.5 py-2.5 font-mono text-[11px] text-[#4C765D] break-all">
                  {walletAddress}
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                isLoading={isLoading}
                icon={<ArrowRight className="h-4 w-4" />}
              >
                Create Account
              </Button>

              <button
                type="button"
                className="w-full text-xs font-medium text-[#748199] hover:text-[#3C4B63]"
                onClick={() => setAuthMode("select")}
              >
                Cancel
              </button>
            </form>
          )}

          {/* =============================================================== */}
          {/* VIEW 5: NEW PERA WALLET ACCOUNT PROFILE SETUP                  */}
          {/* =============================================================== */}

          {/* =============================================================== */}
          {/* VIEW 5: EMAIL + PASSWORD SIGN-IN                                */}
          {/* =============================================================== */}
          {authMode === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setAuthMode("select")}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#748199] hover:text-[#3C4B63]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to primary login</span>
                </button>
                <Badge variant="neutral">Email + Password</Badge>
              </div>

              <div className="space-y-1">
                <h2 className="display-heading text-2xl text-[#3C4B63]">
                  Password Sign In
                </h2>
                <p className="text-xs text-[#748199]">
                  Sign in with your email address and password.
                </p>
              </div>

              <div>
                <label className="field-label">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-[#8490A2]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="field-control pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="field-label mb-0">Password</label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 h-4 w-4 text-[#8490A2]" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="field-control pl-10"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                isLoading={isLoading}
                icon={<ArrowRight className="h-4 w-4" />}
              >
                Sign In
              </Button>
            </form>
          )}

        </div>
      </Card>
    </div>
  );
};
