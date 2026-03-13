// Features.jsx
import { motion, AnimatePresence } from "framer-motion";
import Profile from "./profile";
import Terms from "./Terms";
import { useState } from "react";
// ✅ Import images like modules
import FImage from "./f.png";
import SImage from "./s.png";
import { ChevronRight, ChevronLeft, MapPin, Clock } from "lucide-react";

export default function Features({ language, setLanguage, onFinish }) {
  const [featureStep, setFeatureStep] = useState(0);

  const features = [
    {
      title: "Welcome to Navita",
      subtitle: "Your smart bus tracking companion",
      description: "Experience the future of public transportation with real-time tracking and intelligent route planning.",
      image: FImage,
      icon: <MapPin className="h-8 w-8" />,
      color: "bg-blue-500"
    },
    {
      title: "Real-Time Bus Tracking",
      subtitle: "Never miss your bus again",
      description: "Track buses live on the map with accurate arrival times and driver details for a stress-free commute.",
      image: SImage,
      icon: <Clock className="h-8 w-8" />,
      color: "bg-green-500"
    }
  ];

  const nextStep = () => {
    if (featureStep < features.length) {
      setFeatureStep(featureStep + 1);
    }
  };

  const prevStep = () => {
    if (featureStep > 0) {
      setFeatureStep(featureStep - 1);
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200 rounded-full blur-3xl opacity-50"></div>
      </div>

      {/* Progress indicator */}
      <div className="absolute top-6 left-1/2 transform -translate-x-1/2 flex space-x-2 z-20">
        {features.map((_, index) => (
          <div
            key={index}
            className={`h-2 w-2 rounded-full transition-all duration-300 ${
              index === featureStep ? "bg-blue-600 w-6" : "bg-gray-300"
            }`}
          ></div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Feature screens */}
        {featureStep < features.length && (
          <motion.div
            key={featureStep}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.5 }}
            className="relative w-full max-w-4xl h-[80vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row mx-4"
          >
            {/* Image section */}
            <div className="relative w-full md:w-1/2 h-1/2 md:h-full">
              <img
                src={features[featureStep].image}
                alt={features[featureStep].title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white/80 to-transparent md:bg-gradient-to-r md:from-white/80 md:to-transparent"></div>
              
              {/* Feature icon badge */}
              <div className={`absolute top-6 left-6 p-3 rounded-xl text-white ${features[featureStep].color}`}>
                {features[featureStep].icon}
              </div>
            </div>

            {/* Content section */}
            <div className="relative w-full md:w-1/2 h-1/2 md:h-full flex flex-col justify-center p-8 md:p-12">
              <div className="mb-6">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                  {features[featureStep].title}
                </h1>
                <p className="text-lg text-blue-600 font-medium mb-4">
                  {features[featureStep].subtitle}
                </p>
                <p className="text-gray-600 mb-6">
                  {features[featureStep].description}
                </p>
              </div>

              {/* Navigation buttons */}
              <div className="flex justify-between mt-8">
                <button
                  onClick={prevStep}
                  disabled={featureStep === 0}
                  className={`flex items-center px-4 py-2 rounded-lg transition-all ${
                    featureStep === 0 
                      ? "text-gray-400 cursor-not-allowed" 
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <ChevronLeft className="h-5 w-5 mr-1" />
                  Back
                </button>
                
                <button
                  onClick={nextStep}
                  className="flex items-center bg-blue-600 text-white px-6 py-3 rounded-xl shadow-lg hover:bg-blue-700 transition-all font-medium"
                >
                  {featureStep === features.length - 1 ? "Get Started" : "Next"}
                  <ChevronRight className="h-5 w-5 ml-1" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Login Step */}
        {featureStep === features.length && (
          <motion.div
            key="login"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.5 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <Profile
              selectedLanguage={language}
              onLanguageChange={(lang) => setLanguage(lang)}
              onLoginSuccess={onFinish}
            />
            
            <div className="px-6 pb-6">
              <p className="text-xs text-gray-500 text-center">
                By continuing, you agree to our{" "}
                <span
                  className="text-blue-500 underline cursor-pointer hover:text-blue-700"
                  onClick={() => setFeatureStep("terms")}
                >
                  Terms & Conditions
                </span>
              </p>
              
              <button
                onClick={() => setFeatureStep(features.length - 1)}
                className="flex items-center justify-center mt-4 text-gray-500 hover:text-gray-700 text-sm"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to features
              </button>
            </div>
          </motion.div>
        )}

        {/* Terms Page */}
        {featureStep === "terms" && (
          <motion.div
            key="terms"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.5 }}
            className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <Terms onBack={() => setFeatureStep(features.length)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
