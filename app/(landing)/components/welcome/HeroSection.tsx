import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="text-center px-6 pt-12 pb-10 relative z-2">
      <span className="inline-block border border-primary/30 rounded-full px-5 py-1 text-xs font-medium tracking-[0.12em] text-primary bg-white/45 mb-7">
        HEALTHCARE CONTINUITY
      </span>

      <h1 className="text-lg font-bold md:text-3xl text-[#0d1f4a] leading-tight mb-5">
        Welcome to <span className="text-primary">Tracmedy</span>
      </h1>

      <p className="text-lg text-[#3a5080] max-w-md mx-auto leading-relaxed mb-9">
        Bridging the gap between hospital care and patient recovery through
        real-time post-discharge monitoring.
      </p>

      <div className="flex gap-4 justify-center flex-wrap">
        <Link
          href="/register"
          className="bg-primary text-white rounded-lg px-9 py-3.5 text-base font-semibold hover:bg-[#01317a] transition-colors"
        >
          Sign Up
        </Link>
        <Link
          href="/login"
          className="bg-transparent text-primary border-2 border-primary rounded-lg px-9 py-3.5 text-base font-semibold hover:bg-primary/5 transition-colors"
        >
          Log In
        </Link>
      </div>
    </section>
  );
}

