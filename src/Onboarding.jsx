// Onboarding.jsx
import { useState } from "react";
import { motion } from "framer-motion";

export default function Onboarding({ onFinish }) {
  const [step, setStep] = useState(1);

  const next = () => {
    if (step === 3) {
      localStorage.setItem("onboardingSeen", "true");
      onFinish();
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-white text-center p-6">
      {step === 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          <h1 className="text-3xl font-bold text-blue-600">Welcome to Navita</h1>
          <p className="text-gray-600">Your smart bus tracking companion</p>
        </motion.div>
      )}

      {step === 2 && (
        <motion.div
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="space-y-4"
        >
          <h1 className="text-2xl font-bold text-blue-600">Features</h1>
          <p className="text-gray-600">✔ Real-time bus tracking</p>
          <p className="text-gray-600">✔ Live driver details</p>
          <p className="text-gray-600">✔ Route search & updates</p>
          <img src="/bus-demo.png" alt="Bus demo" className="mx-auto w-48" />
        </motion.div>
      )}

      {step === 3 && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="space-y-4"
        >
          <h1 className="text-2xl font-bold text-blue-600">Get Started</h1>
          {/* Here reuse your SignIn/SignUp component */}
          <p className="text-gray-600 text-sm mt-4">
            By continuing you agree to our{" "}
            <span className="text-blue-600">Terms and Conditions</span>.
          </p>
        </motion.div>
      )}

      <button
        onClick={next}
        className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-lg shadow"
      >
        {step === 3 ? "Continue" : "Next"}
      </button>
    </div>
  );
}
