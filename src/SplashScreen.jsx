import { motion } from "framer-motion";
import { useEffect } from "react";

export default function SplashScreen({ onFinish }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 2500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // <-- Fix: Empty array ensures this only runs ONCE

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-black overflow-hidden relative font-sans">
      {/* subtle radial vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0) 60%)",
        }}
      />

      {/* faint grid texture */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      {/* slow rotating ambient ring */}
      <motion.div
        className="absolute w-[620px] h-[620px] rounded-full border border-white/5"
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute w-[420px] h-[420px] rounded-full border border-white/10"
        animate={{ rotate: -360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      />

      {/* center content */}
      <div className="flex flex-col items-center relative z-10 px-6">
        {/* monogram mark */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative mb-7"
        >
          <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center shadow-[0_8px_40px_rgba(255,255,255,0.15)]">
            <span className="text-black font-bold text-4xl tracking-tight leading-none">
              N
            </span>
          </div>
          {/* soft pulse halo */}
          <motion.div
            className="absolute inset-0 rounded-2xl border border-white/30"
            animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>

        {/* wordmark */}
        <div className="overflow-hidden">
          <motion.h1
            className="text-white font-semibold text-5xl tracking-[-0.02em] leading-none"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            Navita
          </motion.h1>
        </div>

        {/* divider */}
        <motion.div
          className="h-px bg-white/30 mt-5"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 56, opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.6, ease: "easeOut" }}
        />

        {/* tagline */}
        <motion.p
          className="text-white/60 text-[11px] uppercase tracking-[0.35em] mt-4"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.6 }}
        >
          Smart Bus Tracking
        </motion.p>

        {/* loading bar */}
        <div className="mt-12 w-40 h-[2px] bg-white/10 rounded-full overflow-hidden relative">
          <motion.div
            className="absolute top-0 left-0 h-full w-1/2 bg-white rounded-full"
            initial={{ x: "-100%" }}
            animate={{ x: "200%" }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>
      </div>

      {/* footer */}
      <motion.div
        className="absolute bottom-8 flex flex-col items-center gap-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.6 }}
      >
        <span className="text-white/40 text-[10px] uppercase tracking-[0.3em]">
          Made with precision
        </span>
        <span className="text-white/30 text-[10px] tracking-wider">
          © {new Date().getFullYear()} Navita
        </span>
      </motion.div>
    </div>
  );
}