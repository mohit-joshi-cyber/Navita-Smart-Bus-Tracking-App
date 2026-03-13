// SplashScreen.jsx
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function SplashScreen({ onFinish }) {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 3200); // total duration
    
    // Progress animation
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 100/32; // 32 intervals over 3200ms
      });
    }, 100);
    
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [onFinish]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-800 via-blue-900 to-indigo-900 overflow-hidden relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white/5"
            initial={{ 
              scale: 0,
              opacity: 0,
              x: Math.random() * 100 - 50 + '%',
              y: Math.random() * 100 - 50 + '%'
            }}
            animate={{ 
              scale: 1,
              opacity: 0.3,
            }}
            transition={{ 
              duration: 2,
              delay: i * 0.2,
              ease: "easeOut"
            }}
            style={{
              width: Math.random() * 100 + 50 + 'px',
              height: Math.random() * 100 + 50 + 'px',
            }}
          />
        ))}
      </div>
      
      <div className="flex flex-col items-center justify-center relative z-10">
        {/* Logo container */}
        <div className="flex items-center mb-6">
          {/* Big N with subtle shine effect */}
          <motion.span
            className="text-white font-bold text-7xl md:text-8xl lg:text-9xl tracking-tighter drop-shadow-xl"
            initial={{ scale: 0, opacity: 0, rotate: -180 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          >
            N
          </motion.span>

          {/* avita text with smooth slide */}
          <motion.span
            className="text-white font-light text-5xl md:text-6xl lg:text-7xl tracking-widest drop-shadow-md"
            initial={{ x: -120, opacity: 0, clipPath: "inset(0 100% 0 0)" }}
            animate={{ x: 0, opacity: 1, clipPath: "inset(0 0% 0 0)" }}
            transition={{ delay: 0.8, duration: 1.2, ease: [0.23, 1, 0.32, 1] }}
          >
            avita
          </motion.span>
        </div>
        
        {/* Tagline with fade-in */}
        <motion.p
          className="text-blue-100 font-light text-sm md:text-base tracking-wider mt-2 mb-8 opacity-0"
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 0.6 }}
        >
          Premium Experiences
        </motion.p>
        
        {/* Progress bar */}
        <div className="w-48 md:w-56 h-1 bg-blue-600/30 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-white/80"
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
      </div>
      
      {/* Footer copyright */}
      <motion.div 
        className="absolute bottom-6 text-blue-200/60 text-xs"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 0.5 }}
      >
        © {new Date().getFullYear()} Navita
      </motion.div>
    </div>
  );
}