import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Shield, Zap, Database, Check } from "lucide-react";
import { useState, useEffect } from "react";
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

// ── TrustRAG brand icon ──────────────────────────────────────────────────────
function BrandIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
      <circle cx="12" cy="4" r="2.5" fill="currentColor" fillOpacity="0.9" />
      <circle cx="19" cy="8" r="2.5" fill="currentColor" fillOpacity="0.9" />
      <circle cx="19" cy="16" r="2.5" fill="currentColor" fillOpacity="0.9" />
      <circle cx="12" cy="20" r="2.5" fill="currentColor" fillOpacity="0.9" />
      <circle cx="5" cy="16" r="2.5" fill="currentColor" fillOpacity="0.9" />
      <circle cx="5" cy="8" r="2.5" fill="currentColor" fillOpacity="0.9" />
    </svg>
  );
}

// ── Step card ────────────────────────────────────────────────────────────────
function StepCard({
  num,
  label,
  active,
}: {
  num: number;
  label: string;
  active: boolean;
}) {
  return (
    <div
      className={`flex flex-1 flex-col justify-between rounded-2xl p-3.5 transition-all duration-300 min-h-[110px] ${
        active
          ? "bg-white text-gray-900 shadow-lg"
          : "bg-white/20 border border-white/25 text-white backdrop-blur-md"
      }`}
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
          active ? "bg-[#1d4ed8] text-white" : "bg-white/25 text-white"
        }`}
      >
        {num}
      </span>
      <p
        className={`text-[12px] font-medium leading-snug line-clamp-2 ${
          active ? "text-gray-900" : "text-white/95"
        }`}
      >
        {label}
      </p>
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
        className="h-11 w-full rounded-xl border border-gray-100 bg-[#f8f9fc] px-3.5 pr-10 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
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

  // If already authenticated, redirect straight to /app
  useEffect(() => {
    if (authLoaded && isSignedIn) {
      void navigate({ to: "/app" });
    }
  }, [authLoaded, isSignedIn, navigate]);

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
      // Always use signIn.authenticateWithRedirect for OAuth.
      // Clerk automatically creates an account if none exists — using signUp OAuth
      // causes Clerk to redirect new users to the hosted Account Portal instead.
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

  const steps = [
    { label: "Register your account" },
    { label: "Set up your profile information" },
    { label: "Verify your identity through passport/ID" },
  ];

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[#14151a] p-3 sm:p-6 lg:p-10 font-sans">
      {/* ── Main rounded modal card ────────────────────────────────────────── */}
      <div className="relative flex w-full max-w-[1100px] flex-col overflow-hidden rounded-[28px] sm:rounded-[36px] bg-white p-3 shadow-2xl lg:flex-row lg:gap-4 lg:p-3.5">
        
        {/* ── Left panel: blue gradient ──────────────────────────────────── */}
        <div
          className="relative flex flex-col justify-between overflow-hidden rounded-[24px] sm:rounded-[28px] p-6 sm:p-8 lg:w-[490px] lg:shrink-0 lg:p-10 min-h-[380px] lg:min-h-[640px]"
          style={{
            background: "linear-gradient(145deg, #133bb7 0%, #2564df 45%, #4696ff 85%, #69aaff 100%)",
          }}
        >
          {/* Subtle radial ambient glow */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: "radial-gradient(ellipse 65% 55% at 50% 30%, rgba(255,255,255,0.22) 0%, transparent 70%)",
            }}
          />

          {/* Top: Brand Logo */}
          <div className="relative z-10 flex items-center gap-2.5">
            <BrandIcon />
            <span className="text-lg font-semibold tracking-tight text-white">TrustRAG</span>
          </div>

          {/* Middle: Badge & Headline */}
          <div className="relative z-10 my-auto space-y-4 pt-8 lg:pt-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3.5 py-1 text-xs font-medium text-white backdrop-blur-md shadow-sm">
              {signup ? "Join Us to Build 🤩" : "Welcome Back 👋"}
            </span>

            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[42px] lg:leading-[1.15]">
              {signup ? "Start your Journey" : "Continue your Journey"}
            </h1>

            <p className="text-sm font-normal text-white/85 max-w-[340px]">
              {signup
                ? "Follow these simple steps to set up your account."
                : "Log back in to inspect trust scores and multi-agent consensus."}
            </p>
          </div>

          {/* Bottom: 3 Step Cards */}
          <div className="relative z-10 flex gap-2.5 pt-6">
            {steps.map((s, i) => (
              <StepCard
                key={i}
                num={i + 1}
                label={s.label}
                active={i === 0}
              />
            ))}
          </div>
        </div>

        {/* ── Right panel: clean white form ──────────────────────────────── */}
        <div className="flex flex-1 flex-col justify-center px-4 py-8 sm:px-10 sm:py-10 lg:px-14">
          <div className="mx-auto w-full max-w-[380px]">
            {/* Header */}
            <h2 className="text-center text-2xl sm:text-[28px] font-bold tracking-tight text-gray-900">
              {signup ? "Join Us" : "Welcome Back"}
            </h2>

            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              {/* Email input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700">
                  Email address
                </label>
                <div className="relative">
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    placeholder="johndoe@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 w-full rounded-xl border border-gray-100 bg-[#f8f9fc] px-3.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
                  />
                </div>
              </div>

              {/* Full Name & Username row for signup */}
              {signup && (
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-gray-700">Full Name</label>
                    <input
                      required
                      type="text"
                      autoComplete="name"
                      placeholder="Juliette Karapetyan"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="h-11 w-full rounded-xl border border-gray-100 bg-[#f8f9fc] px-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-gray-700">Username</label>
                    <div className="relative">
                      <input
                        type="text"
                        autoComplete="username"
                        placeholder="julietux"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-100 bg-[#f8f9fc] px-3 pr-8 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
                      />
                      {username.trim().length > 2 && (
                        <Check
                          size={15}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-500"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-gray-700">Password</label>
                  {!signup && (
                    <a
                      href="#forgot"
                      onClick={(e) => {
                        e.preventDefault();
                        setError("Please use Google sign-in or check Clerk dashboard for password reset.");
                      }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Forgot?
                    </a>
                  )}
                </div>
                <PasswordField
                  value={password}
                  onChange={setPassword}
                  autoComplete={signup ? "new-password" : "current-password"}
                />
                {signup && (
                  <p className="text-[11px] leading-relaxed text-gray-400">
                    At least 8 characters. Uppercase letters, lowercase letters, numbers, and symbols.
                  </p>
                )}
              </div>

              {/* Error notification */}
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                  {error}
                </div>
              )}

              {/* Continue button */}
              <button
                type="submit"
                disabled={submitting}
                className="mt-2 h-11 w-full rounded-xl bg-[#2354e6] text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#1d45c7] active:scale-[0.99] disabled:opacity-60"
              >
                {submitting ? "Please wait…" : "Continue"}
              </button>
            </form>

            {/* Toggle link */}
            <p className="mt-4 text-center text-xs text-gray-500">
              {signup ? "Already have an account? " : "Don't have an account? "}
              <Link
                to={signup ? "/login" : "/signup"}
                className="font-semibold text-blue-600 hover:underline"
              >
                {signup ? "Log in" : "Sign up"}
              </Link>
            </p>

            {/* Or Divider */}
            <div className="my-4 flex items-center gap-3 text-xs text-gray-400">
              <span className="h-px flex-1 bg-gray-200" />
              Or
              <span className="h-px flex-1 bg-gray-200" />
            </div>

            {/* Google Sign-in */}
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={googleLoading}
              className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-[0.99] disabled:opacity-60"
            >
              <GoogleMark />
              {googleLoading
                ? "Connecting to Google…"
                : signup
                ? "Sign up with Google"
                : "Sign in with Google"}
            </button>

            {/* Privacy Policy disclaimer */}
            {signup && (
              <p className="mt-5 text-center text-[10.5px] leading-relaxed text-gray-400">
                By signing up I confirm that I carefully have read and agree to the TrustRAG{" "}
                <span className="font-medium text-gray-600">Privacy Policy and Terms of Service</span>.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
