import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Check, ArrowRight, Shield, Zap, BarChart3 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useSignIn, useSignUp, useAuth } from "@clerk/clerk-react";

// ── Google icon ──────────────────────────────────────────────────────────────
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="h-5 w-5 shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.14-3.08-.4-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 5.99c4.51-4.18 7.09-10.36 7.09-17.64Z" />
      <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.77 24c0-1.6.27-3.14.76-4.59l-7.98-6.19A24 24 0 0 0 0 24c0 3.87.93 7.54 2.56 10.78l7.97-6.19Z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-5.99c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48Z" />
    </svg>
  );
}

// ── TrustRAG Hexagon brand icon ───────────────────────────────────────────────
function BrandIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <path d="M32 4L56 18V46L32 60L8 46V18L32 4Z" stroke="rgba(255,255,255,0.85)" strokeWidth="3.5" strokeLinejoin="round" fill="rgba(255,255,255,0.12)" />
      <path d="M32 14L46 22V38L32 46L18 38V22L32 14Z" fill="rgba(255,255,255,0.9)" />
      <circle cx="32" cy="32" r="5" fill="rgba(30,64,175,0.9)" />
    </svg>
  );
}

// ── Feature pill ─────────────────────────────────────────────────────────────
function FeaturePill({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 backdrop-blur-sm">
      <Icon size={13} className="text-white/80" />
      <span className="text-[12px] font-medium text-white/90">{label}</span>
    </div>
  );
}

// ── Password input with show/hide ─────────────────────────────────────────────
function PasswordField({
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        required
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder || "••••••••••••••"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50/80 px-4 pr-11 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

// ── Main AuthPage ─────────────────────────────────────────────────────────────
export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const signup = mode === "signup";
  const navigate = useNavigate();

  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();

  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // If already authenticated, redirect straight to /app
  useEffect(() => {
    if (authLoaded && isSignedIn) {
      void navigate({ to: "/app" });
    }
  }, [authLoaded, isSignedIn, navigate]);

  // Ensure video begins playing reliably across all browsers
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!signInLoaded || !signUpLoaded) return;
    setError(null);
    setSubmitting(true);

    try {
      if (signup) {
        const parts = fullName.trim().split(" ");
        const firstName = parts[0] || "User";
        const lastName = parts.slice(1).join(" ") || "";

        const result = await signUp!.create({
          emailAddress: email,
          password,
          firstName,
          lastName,
          username: username.trim() ? username.trim().toLowerCase() : undefined,
        });

        if (result.status === "complete") {
          await setSignUpActive!({ session: result.createdSessionId });
          void navigate({ to: "/app" });
        } else {
          await signUp!.prepareEmailAddressVerification({ strategy: "email_code" });
          setError("Please check your email for a verification code to complete registration.");
        }
      } else {
        const result = await signIn!.create({
          identifier: email,
          password,
        });
        if (result.status === "complete") {
          await setSignInActive!({ session: result.createdSessionId });
          void navigate({ to: "/app" });
        } else {
          setError("Additional verification required. Please try again.");
        }
      }
    } catch (err: unknown) {
      const clerkError = err as { errors?: Array<{ longMessage?: string; message: string }> };
      const msg =
        clerkError?.errors?.[0]?.longMessage ||
        clerkError?.errors?.[0]?.message ||
        "Authentication failed. Please verify your credentials.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    if (!signInLoaded) return;
    setGoogleLoading(true);
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:8080";
    try {
      await signIn!.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: `${origin}/sso-callback`,
        redirectUrlComplete: `${origin}/app`,
      });
    } catch {
      setError("Google authentication failed. Please try again.");
      setGoogleLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden p-4 sm:p-6 lg:p-8">
      {/* ── Background animated video theme (outside the card) ───────────── */}
      <div className="fixed inset-0 z-0 overflow-hidden bg-[#1d8fb8]">
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          poster="https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/693205bf-8048-456a-879e-4e0a1b85a098.webp"
          aria-label="Painted alpine panorama: a lone hiker with a pink backpack faces a snow-capped peak above a sea of clouds"
          className="absolute inset-0 h-full w-full object-cover filter saturate-[0.86]"
        >
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260826_123836_11a3c5e0-713f-4bef-a8e9-7dd93bdea3b0.mp4"
            type="video/mp4"
          />
        </video>

        {/* Ambient light scrim: keeps the animated video bright and clear */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(6, 22, 34, 0.20) 0%, rgba(6, 22, 34, 0.05) 50%, rgba(6, 22, 34, 0.15) 100%)",
          }}
        />
      </div>

      {/* ── Frosted glass blur outer frame (blurs card corners & edges) ── */}
      <div className="relative z-10 w-full max-w-5xl rounded-[36px] bg-white/25 p-2.5 sm:p-3 backdrop-blur-xl border border-white/50 shadow-[0_8px_32px_0_rgba(255,255,255,0.2)]">
        {/* ── Solid inner card (not blurred inside, pristine contrast) ── */}
        <div className="overflow-hidden rounded-[26px] bg-white lg:flex lg:min-h-[620px]">

          {/* ═══════════════════════════════════════════════════════════════════
              LEFT PANEL — Vibrant gradient branding (desktop: 44% wide)
          ═══════════════════════════════════════════════════════════════════ */}
          <div
            className="relative flex flex-col justify-between overflow-hidden p-7 sm:p-8 lg:w-[44%] lg:shrink-0 lg:p-10 lg:py-12"
            style={{
              background:
                "linear-gradient(145deg, #1034a6 0%, #1e50e2 40%, #3b82f6 80%, #60a5fa 100%)",
            }}
          >
          {/* Ambient top glow */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 70% 50% at 50% 10%, rgba(255,255,255,0.2) 0%, transparent 65%)",
            }}
          />
          {/* Bottom mesh glow */}
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-1/2"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(30,64,175,0.4) 0%, transparent 70%)",
            }}
          />

          {/* Logo row */}
          <div className="relative z-10 flex items-center gap-2.5">
            <BrandIcon size={28} />
            <span className="text-xl font-bold tracking-tight text-white">TrustRAG</span>
          </div>

          {/* Hero text — hidden on small mobile, shown from sm */}
          <div className="relative z-10 my-6 lg:my-0 lg:flex-1 lg:flex lg:flex-col lg:justify-center space-y-5 lg:py-8">
            {/* Badge */}
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3.5 py-1 text-[11px] font-semibold tracking-wide text-white uppercase backdrop-blur-sm">
              {signup ? "Create Account" : "Welcome Back"}
            </span>

            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl lg:text-[38px] lg:leading-[1.12]">
              {signup ? (
                <>Unlock AI you<br className="hidden sm:block" /> can trust</>
              ) : (
                <>Your evidence-first<br className="hidden sm:block" /> AI workspace</>
              )}
            </h1>

            <p className="max-w-[300px] text-sm text-white/75 leading-relaxed">
              {signup
                ? "Multi-agent RAG with real confidence scores, source citations, and consensus reasoning."
                : "Inspect trust scores, confidence metrics, and multi-agent consensus from your documents."}
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 pt-1">
              <FeaturePill icon={Shield} label="Trust-aware" />
              <FeaturePill icon={Zap} label="Multi-agent" />
              <FeaturePill icon={BarChart3} label="Confidence scores" />
            </div>
          </div>

          {/* Bottom quote */}
          <div className="relative z-10 hidden lg:block">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
              <p className="text-[12.5px] italic text-white/80 leading-relaxed">
                "TrustRAG gave us visibility into why the AI answered the way it did — not just what it said."
              </p>
              <p className="mt-2 text-[11px] font-semibold text-white/60">— Research Lead, AI Systems Lab</p>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            RIGHT PANEL — Crisp solid white form (not blurred inside)
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-1 flex-col justify-center px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-10 bg-white">
          <div className="mx-auto w-full max-w-[400px]">
            {/* Heading */}
            <div className="mb-7">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                {signup ? "Create your account" : "Sign in to TrustRAG"}
              </h2>
              <p className="mt-1.5 text-sm text-gray-500">
                {signup
                  ? "Already have an account? "
                  : "Don't have an account? "}
                <Link
                  to={signup ? "/login" : "/signup"}
                  className="font-semibold text-blue-600 hover:underline"
                >
                  {signup ? "Log in" : "Sign up free"}
                </Link>
              </p>
            </div>

            {/* Google button */}
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={googleLoading}
              className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow active:scale-[0.99] disabled:opacity-60"
            >
              <GoogleMark />
              {googleLoading
                ? "Connecting to Google…"
                : signup
                ? "Sign up with Google"
                : "Sign in with Google"}
            </button>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-gray-200" />
              <span className="text-xs font-medium text-gray-400">or continue with email</span>
              <span className="h-px flex-1 bg-gray-200" />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name + Username row (signup only) */}
              {signup && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-gray-700">Full Name</label>
                    <input
                      required
                      type="text"
                      autoComplete="name"
                      placeholder="Jane Smith"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50/80 px-4 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-gray-700">Username</label>
                    <div className="relative">
                      <input
                        type="text"
                        autoComplete="username"
                        placeholder="janesmith"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50/80 px-4 pr-9 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
                      />
                      {username.trim().length > 2 && (
                        <Check size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700">
                  Email address
                </label>
                <input
                  required
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50/80 px-4 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-gray-700">Password</label>
                  {!signup && (
                    <button
                      type="button"
                      onClick={() =>
                        setError(
                          "Use the 'Forgot password' flow via Google, or contact support."
                        )
                      }
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <PasswordField
                  value={password}
                  onChange={setPassword}
                  autoComplete={signup ? "new-password" : "current-password"}
                />
                {signup && (
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Min. 8 characters — mix of uppercase, lowercase, numbers &amp; symbols.
                  </p>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 leading-relaxed">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="group mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-bold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg active:scale-[0.99] disabled:opacity-60"
              >
                {submitting ? (
                  "Please wait…"
                ) : (
                  <>
                    {signup ? "Create account" : "Sign in"}
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            {/* Privacy */}
            {signup && (
              <p className="mt-5 text-center text-[11px] leading-relaxed text-gray-400">
                By signing up, you agree to our{" "}
                <span className="font-medium text-gray-600">Terms of Service</span> and{" "}
                <span className="font-medium text-gray-600">Privacy Policy</span>.
              </p>
            )}
          </div>
        </div>
        {/* End of solid inner card */}
        </div>
      {/* End of frosted glass outer frame */}
      </div>
    </main>
  );
}
