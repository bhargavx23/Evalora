import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import {
  ArrowRight,
  CheckCircle2,
  Lock,
  Mail,
  Phone,
  User,
  Wallet,
} from "lucide-react";
import {
  connectPeraForPayment,
  signChallengeWithInjectedWallet,
  setConnectedBrowserWallet,
} from "../../utils/algorandWallet";

export const RegisterPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });

  // Optional Pera Wallet state (Automated, zero manual typing)
  const [walletAddress, setWalletAddress] = useState("");
  const [walletChallenge, setWalletChallenge] = useState("");
  const [walletSignature, setWalletSignature] = useState("");
  const [isWalletLoading, setIsWalletLoading] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const { user, authStatus, loginWithToken } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (authStatus === "authenticated" && user) {
      if (user.role === "admin" || user.role === "platform_admin") {
        navigate("/admin", { replace: true });
      } else if (user.role === "student") {
        navigate("/dashboard", { replace: true });
      } else {
        navigate("/faculty/dashboard", { replace: true });
      }
    }
  }, [authStatus, user, navigate]);

  const handleConnectAndSignRegistrationWallet = async () => {
    setIsWalletLoading(true);
    try {
      // 1. Connect Pera Wallet via official Pera Connect modal
      const connectedAddr = await connectPeraForPayment();
      if (!connectedAddr) {
        throw new Error("Pera Wallet connection was cancelled.");
      }

      setWalletAddress(connectedAddr);

      // 2. Request ownership challenge from backend
      const res = await api.post("/wallet/challenge", {
        walletAddress: connectedAddr,
        walletType: "pera",
        network: "algorand",
        purpose: "REGISTER_WALLET",
      });

      if (res.data.success && res.data.challenge) {
        setWalletChallenge(res.data.challenge);

        // 3. Prompt user to sign challenge in Pera Wallet
        const signed = await signChallengeWithInjectedWallet(
          connectedAddr,
          res.data.challenge
        );

        if (signed) {
          setWalletSignature(signed);
          setConnectedBrowserWallet(connectedAddr, "pera", "algorand");
          toast.success("Pera Wallet connected and verified!");
        } else {
          toast.info("Wallet connected. Sign the challenge in Pera Wallet to verify ownership.");
        }
      }
    } catch (err: any) {
      const msg = err.message || err.response?.data?.message || "Failed to connect Pera Wallet.";
      if (!msg.toLowerCase().includes("cancel") && !msg.toLowerCase().includes("reject")) {
        toast.error(msg);
      }
    } finally {
      setIsWalletLoading(false);
    }
  };

  const handleDisconnectRegistrationWallet = () => {
    setWalletAddress("");
    setWalletChallenge("");
    setWalletSignature("");
    setConnectedBrowserWallet(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsLoading(true);
    try {
      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        password: formData.password,
      };

      if (walletAddress && walletSignature && walletChallenge) {
        payload.walletAddress = walletAddress.trim().toUpperCase();
        payload.walletType = "pera";
        payload.network = "algorand";
        payload.challenge = walletChallenge;
        payload.signature = walletSignature.trim();
      }

      const res = await api.post("/auth/register", payload);
      if (res.data.success) {
        const user = await loginWithToken(res.data.token);
        toast.success(`Welcome to Evalora, ${user.name}!`);
        navigate("/dashboard", { replace: true });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto py-12 px-4">
      <Card padding="lg" className="border-[#E8E8EF] bg-white shadow-xl">
        <div className="space-y-6">
          <div className="space-y-1.5">
            <div className="page-kicker">Student Registration</div>
            <h2 className="display-heading text-3xl text-[#18181F]">
              Create Your Evalora Account
            </h2>
            <p className="text-xs text-[#6B6B78]">
              Register your personal practice account to access questions, practice sessions, and skill analytics.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="field-label">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 h-4 w-4 text-[#9494A3]" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g. Alex Johnson"
                    className="field-control pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="field-label">Email Address *</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-[#9494A3]" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="alex@example.com"
                    className="field-control pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="field-label">Phone Number (Optional)</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 h-4 w-4 text-[#9494A3]" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="+91 98765 43210"
                    className="field-control pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="field-label">Password *</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 h-4 w-4 text-[#9494A3]" />
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder="Create a strong password"
                    className="field-control pl-10"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {/* Optional Pera Wallet Registration Section (Automated, Zero Manual Input) */}
              <div className="rounded-xl border border-[#E8E8EF] bg-[#F7F7FB] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-[#5B5CE2]" />
                    <span className="font-semibold text-xs text-[#18181F]">
                      Pera Wallet (Optional)
                    </span>
                  </div>
                  {walletAddress && walletSignature ? (
                    <Badge variant="green">Verified & Linked</Badge>
                  ) : (
                    <Badge variant="neutral">Algorand</Badge>
                  )}
                </div>

                {walletAddress && walletSignature ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-[11px] font-semibold text-emerald-950 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Pera Wallet Connected & Verified</span>
                      </div>
                      <div className="font-mono text-[10px] text-emerald-800">
                        {walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleDisconnectRegistrationWallet}
                    >
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-[#6B6B78] leading-relaxed">
                      Optionally connect your Pera Wallet now to enable instant QR login on Algorand and unlock paid practice attempts.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full justify-center"
                      onClick={handleConnectAndSignRegistrationWallet}
                      isLoading={isWalletLoading}
                      icon={<Wallet className="w-3.5 h-3.5 text-[#5B5CE2]" />}
                    >
                      Connect Pera Wallet
                    </Button>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full justify-center text-sm font-semibold"
                isLoading={isLoading}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Create Account
              </Button>
          </form>

          <div className="space-y-2 text-center text-xs text-[#6B6B78] pt-3 border-t border-[#E8E8EF]">
            <div>
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-semibold text-[#5B5CE2] hover:text-[#34358F]"
              >
                Sign In
              </Link>
            </div>
            <div>
              Are you an educational institution?{" "}
              <Link
                to="/college-register"
                className="font-semibold text-[#5B5CE2] hover:text-[#34358F]"
              >
                Register Your Institution
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
