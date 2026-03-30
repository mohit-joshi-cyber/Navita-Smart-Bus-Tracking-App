// Onboarding.jsx
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";



const slides = [
  {
    title: "Welcome to Navita",
    desc: "Track buses in real-time with a smooth and reliable experience.",
    icon: "🚌",
  },
  {
    title: "Live Bus Tracking",
    desc: "Know exactly where your bus is with real-time updates.",
    icon: "📍",
  },
  {
    title: "Smart Travel",
    desc: "Get driver details, routes and updates instantly.",
    icon: "⚡",
  },
];

export default function Onboarding({ onFinish }) {

  const [index, setIndex] = useState(0);

  // 🔎 Developer hint
  useEffect(() => {
    console.log("✅ Navita New Onboarding UI Loaded Successfully");
  }, []);

  const next = () => {
    if (index === slides.length - 1) {
      localStorage.setItem("onboardingSeen", "true");
      onFinish();
    } else {
      setIndex(index + 1);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between items-center bg-gradient-to-br from-blue-50 via-white to-blue-100 px-6 py-10 overflow-hidden">

      {/* 🔎 Visible hint for developer */}
      <div className="absolute top-2 text-xs text-green-600 font-medium opacity-70">
        Dev Hint: New Onboarding UI Active
      </div>

      {/* slide container */}
      <div className="flex-1 flex items-center justify-center w-full max-w-md">

        <AnimatePresence mode="wait">

          <motion.div
            key={index}
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -80 }}
            transition={{ duration: 0.5 }}
            className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-xl p-8 text-center space-y-6 w-full"
          >

            <div className="text-6xl">
              {slides[index].icon}
            </div>

            <h1 className="text-2xl font-bold text-blue-700">
              {slides[index].title}
            </h1>

            <p className="text-gray-600 leading-relaxed">
              {slides[index].desc}
            </p>

          </motion.div>

        </AnimatePresence>

      </div>

      {/* progress dots */}
      <div className="flex gap-2 mb-6">
        {slides.map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === i ? "bg-blue-600 w-6" : "bg-gray-300 w-2"
            }`}
          />
        ))}
      </div>

      {/* button */}
      <button
        onClick={next}
        className="w-full max-w-xs bg-blue-600 text-white py-3 rounded-xl shadow-lg font-medium active:scale-95 transition-all"
      >
        {index === slides.length - 1 ? "Get Started" : "Next"}
      </button>

      {/* terms */}
      {index === slides.length - 1 && (
        <p className="text-xs text-gray-500 mt-4 text-center max-w-xs">
          By continuing you agree to our{" "}
          <span className="text-blue-600 font-medium">
            Terms & Conditions
          </span>
        </p>
      )}

    </div>
  );
}