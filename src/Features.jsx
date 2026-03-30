// Features.jsx
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import Profile from "./profile";
import Terms from "./Terms";
import FImage from "./f.png";
import SImage from "./s.png";
import { MapPin, Clock, Bus } from "lucide-react";

const transition = {
  type: "spring",
  stiffness: 140,
  damping: 20
};

export default function Features({ language, setLanguage, onFinish }) {

  const [step, setStep] = useState(0);

  const features = [
    {
      title: "Welcome to Navita",
      subtitle: "Smart bus tracking",
      desc: "Track buses in real time with smooth navigation.",
      image: FImage,
      icon: MapPin
    },
    {
      title: "Live Bus Tracking",
      subtitle: "Never miss your ride",
      desc: "Watch buses move live and get accurate arrival updates.",
      image: SImage,
      icon: Clock
    },
    {
      title: "Smart Travel",
      subtitle: "All bus info in one place",
      desc: "View routes, driver info and updates instantly.",
      image: FImage,
      icon: Bus
    }
  ];

  const next = () => {
    if (step < features.length) setStep(step + 1);
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSwipe = (event, info) => {
    if (info.offset.x < -80) next();
    if (info.offset.x > 80) prev();
  };

  return (
    <div className="min-h-screen bg-white flex flex-col overflow-hidden">

      {/* progress bar */}
      <div className="flex gap-1 px-4 pt-4">
        {features.map((_, i) => (
          <div key={i} className="flex-1 h-1 bg-gray-200 rounded">
            <motion.div
              className="h-full bg-blue-600 rounded"
              initial={{ width: 0 }}
              animate={{ width: step >= i ? "100%" : "0%" }}
              transition={{ duration: 0.4 }}
            />
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* slides */}
        {step < features.length && (
          <motion.div
            key={step}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={handleSwipe}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={transition}
            className="flex flex-col items-center justify-center flex-1 px-6 text-center"
          >

            <motion.img
              src={features[step].image}
              alt=""
              className="w-72 max-w-full mb-10 select-none"
              initial={{ scale: 0.9, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ duration: 0.5 }}
              draggable={false}
            />

            <div className="bg-blue-100 p-3 rounded-xl mb-4">
              {(() => {
                const Icon = features[step].icon;
                return <Icon className="h-6 w-6 text-blue-600" />;
              })()}
            </div>

            <h1 className="text-2xl font-semibold text-gray-900">
              {features[step].title}
            </h1>

            <p className="text-blue-600 text-sm mt-1">
              {features[step].subtitle}
            </p>

            <p className="text-gray-500 mt-3 max-w-sm">
              {features[step].desc}
            </p>

          </motion.div>
        )}

        {/* login */}
        {step === features.length && (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transition}
            className="flex flex-col justify-center flex-1 px-6"
          >

            <Profile
              selectedLanguage={language}
              onLanguageChange={(l) => setLanguage(l)}
              onLoginSuccess={onFinish}
            />

            <p className="text-xs text-gray-500 text-center mt-4">
              By continuing you agree to our{" "}
              <span
                className="text-blue-600 underline cursor-pointer"
                onClick={() => setStep("terms")}
              >
                Terms & Conditions
              </span>
            </p>

          </motion.div>
        )}

        {/* terms */}
        {step === "terms" && (
          <motion.div
            key="terms"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col flex-1"
          >
            <Terms onBack={() => setStep(features.length)} />
          </motion.div>
        )}

      </AnimatePresence>

      {/* bottom button */}
      {typeof step === "number" && step < features.length && (
        <div className="flex justify-center pb-10">

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={next}
            className="bg-blue-600 text-white px-8 py-3 rounded-xl shadow-md font-medium"
          >
            {step === features.length - 1 ? "Continue" : "Next"}
          </motion.button>

        </div>
      )}

    </div>
  );
}