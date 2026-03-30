// SplashScreen.jsx
import { motion } from "framer-motion";
import { useEffect } from "react";

export default function SplashScreen({ onFinish }) {

  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 2600);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 overflow-hidden relative">

      {/* soft animated glow */}
      <motion.div
        className="absolute w-[500px] h-[500px] bg-blue-400/20 blur-3xl rounded-full"
        animate={{ scale: [0.9, 1.15, 0.9] }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      <div className="flex flex-col items-center relative z-10">

        {/* logo */}
        <div className="flex items-end">

          <motion.span
            className="text-white font-bold text-8xl drop-shadow-xl"
            initial={{ scale: 0, rotate: -100 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: "spring",
              stiffness: 140,
              damping: 14
            }}
          >
            N
          </motion.span>

          <motion.span
            className="text-white font-light text-6xl tracking-widest ml-1"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              delay: 0.6,
              duration: 0.8
            }}
          >
            avita
          </motion.span>

        </div>

        {/* tagline */}
        <motion.p
          className="text-blue-200 text-sm tracking-wide mt-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          Smart Bus Tracking
        </motion.p>

        {/* loading dots */}
        <div className="flex gap-2 mt-8">
          {[0,1,2].map(i => (
            <motion.div
              key={i}
              className="w-2 h-2 bg-white rounded-full"
              animate={{ y: [0,-8,0] }}
              transition={{
                duration: 0.7,
                delay: i * 0.2,
                repeat: Infinity
              }}
            />
          ))}
        </div>

      </div>

      {/* footer */}
      <motion.div
        className="absolute bottom-6 text-blue-200/60 text-xs"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8 }}
      >
        © {new Date().getFullYear()} Navita
      </motion.div>

    </div>
  );
}