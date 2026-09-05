import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Hexagon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const FALCON_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260813_052122_e77a27e6-17f1-4794-889b-3ceaa0e9e8cb.mp4";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="h-[19px] w-[19px]">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.14-3.08-.4-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 5.99c4.51-4.18 7.09-10.36 7.09-17.64Z" />
      <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.77 24c0-1.6.27-3.14.76-4.59l-7.98-6.19A24 24 0 0 0 0 24c0 3.87.93 7.54 2.56 10.78l7.97-6.19Z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-5.99c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48Z" />
    </svg>
  );
}

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const signup = mode === "signup";
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const enterDemo = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    window.setTimeout(() => void navigate({ to: "/app" }), 420);
  };

  return (
    <main className="min-h-screen bg-[#fefefe] text-[#2c3343] lg:grid lg:h-screen lg:grid-cols-[57.1%_42.9%] lg:overflow-hidden">
      <section className="relative h-[300px] overflow-hidden lg:h-full">
        <video autoPlay muted loop playsInline preload="auto" className="absolute inset-0 h-full w-full scale-[1.015] object-cover object-[64%_48%] lg:scale-100 lg:object-[100%_50%]">
          <source src={FALCON_VIDEO} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-linear-to-b from-black/5 via-black/10 to-black/80 lg:bg-linear-to-t lg:from-white/40 lg:via-transparent lg:to-transparent" />
        <Link to="/" className="absolute left-6 top-6 z-10 flex items-center gap-2 rounded-full bg-black/80 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md lg:left-8 lg:top-8">
          <Hexagon size={19} className="text-cyan-400" /> TrustRAG
        </Link>
        <div className="absolute inset-x-0 bottom-0 z-10 p-6 text-white lg:p-8 lg:text-black">
          <div className="inline-flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-xs text-white backdrop-blur-md">
            <Check size={14} /> Built for evidence-first teams
          </div>
          <h2 className="mt-5 max-w-3xl text-[38px] font-semibold leading-[0.96] tracking-[-0.04em] sm:text-5xl lg:text-[64px]">
            Find evidence.
            <br />Decide with confidence.
          </h2>
        </div>
      </section>

      <section className="relative -mt-7 min-h-[calc(100svh-273px)] rounded-t-[28px] bg-[#fefefe] px-6 py-10 shadow-[0_-10px_28px_rgba(20,28,36,0.10)] sm:px-10 lg:mt-0 lg:min-h-0 lg:rounded-none lg:p-3 lg:shadow-none">
        <div className="mx-auto flex h-full max-w-[613px] flex-col justify-center rounded-[26px] border border-black/[0.04] bg-white/95 px-6 py-10 shadow-[1px_10px_14px_rgba(10,14,20,0.14),0_1px_3px_rgba(10,14,20,0.05)] sm:px-12 lg:px-[62px]">
          <div className="animate-rise">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#797979]">{signup ? "Create your workspace" : "Welcome back"}</span>
            <h1 className="mt-3 text-[38px] font-semibold leading-none tracking-[-0.05em] text-[#2c3343] sm:text-[43px]">{signup ? "Start with TrustRAG" : "Welcome Back!"}</h1>
            <p className="mt-4 text-[16px] text-[#797979]">{signup ? "Create an account to begin building trustworthy answers." : <><strong className="text-[#2c3343]">Log in</strong> to continue monitoring your evidence.</>}</p>
          </div>

          <form onSubmit={enterDemo}>
            <div className="mt-9 space-y-3">
              {signup && <input required type="text" autoComplete="name" aria-label="Full name" placeholder="Full name" className="h-14 w-full rounded-xl border border-[#acacae] bg-[#fafafa] px-[18px] text-base outline-hidden transition-[border-color,box-shadow] focus:ring-2 focus:ring-[#283139]/20" />}
              <input required type="email" autoComplete="email" aria-label="Email address" placeholder="Eg. johndoe@gmail.com" className="h-14 w-full rounded-xl border border-[#acacae] bg-[#fafafa] px-[18px] text-base outline-hidden transition-[border-color,box-shadow] focus:ring-2 focus:ring-[#283139]/20" />
              <input required type="password" autoComplete={signup ? "new-password" : "current-password"} aria-label="Password" placeholder="Password" className="h-14 w-full rounded-xl border border-transparent bg-[#f3f3f3] px-[18px] text-base outline-hidden transition-[border-color,box-shadow] focus:border-[#acacae] focus:ring-2 focus:ring-[#283139]/20" />
            </div>

            <Button disabled={submitting} type="submit" className="mt-6 h-[58px] w-full rounded-full bg-[#283139] text-base font-medium text-white shadow-[0_8px_20px_rgba(18,26,34,0.16)] transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-[#34414b]">
              {submitting ? "Opening workspace…" : signup ? "Create account" : "Login"} <ArrowRight size={16} />
            </Button>
          </form>

          <div className="my-7 flex items-center gap-4 text-[11px] font-bold tracking-[0.08em] text-[#5a5a5b]">
            <span className="h-px flex-1 bg-[#b1b1b2]" /> OR <span className="h-px flex-1 bg-[#b1b1b2]" />
          </div>

          <Button type="button" variant="outline" className="h-14 w-full rounded-full border-[#c8c8ca] bg-white text-base font-normal text-[#232424] hover:bg-[#fafafa]">
            <GoogleMark /> {signup ? "Sign up with Google" : "Sign in with Google"}
          </Button>

          <p className="mt-6 text-center text-sm text-[#0a0a0a]">
            {signup ? "Already have an account? " : "Don’t have an account? "}
            <Link to={signup ? "/login" : "/signup"} className="font-bold underline decoration-2 underline-offset-4">
              {signup ? "Log in" : "Start Free"}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}