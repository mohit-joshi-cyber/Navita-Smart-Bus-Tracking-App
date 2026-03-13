// src/Terms.jsx
import { motion } from "framer-motion";

export default function Terms({ onBack }) {
  return (
    <motion.div
      className="p-6 h-screen overflow-y-auto bg-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <h1 className="text-2xl font-bold mb-4">Terms & Conditions</h1>
      <p className="text-gray-700 mb-4">
        Here you can place your Terms and Conditions content...
      </p>

      <button
        className="mt-6 bg-blue-500 text-white px-6 py-2 rounded-xl shadow"
        onClick={onBack}
      >
        Back
      </button>
    </motion.div>
  );
}
