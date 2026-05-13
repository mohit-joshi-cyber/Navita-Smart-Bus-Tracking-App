// src/Terms.jsx
import { motion } from "framer-motion";

export default function Terms({ onAccept, onReject, onBack }) {
  // Fallback to onBack just in case to prevent undefined errors
  const handleAccept = onAccept || onBack;

  return (
    <motion.div
      className="p-6 h-screen overflow-y-auto bg-gray-50 pt-safe"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="max-w-3xl mx-auto bg-white shadow-sm rounded-2xl p-8 mb-8">
        {/* Navigation */}
        <button
          className="mb-6 text-blue-600 font-medium hover:underline flex items-center gap-2"
          onClick={handleAccept}
        >
          ← Back to App
        </button>

        {/* --- TERMS AND CONDITIONS SECTION --- */}
        <section className="mb-12">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Terms and Conditions</h1>
          <p className="text-sm text-gray-500 mb-6 font-medium">Last Updated: May 6, 2026</p>

          <div className="space-y-6 text-gray-700 leading-relaxed">
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">1. Acceptance of Terms</h2>
              <p>
                By continuing to access or use the Navita application, you explicitly agree to be legally bound by these Terms and Conditions and our Privacy Policy. If you do not agree, you must immediately cease all use of the application and uninstall it from your device.
              </p>
            </div>

            {/* Consent Tracking & Enforcement Section */}
            <div className="p-4 border-l-4 border-blue-500 bg-blue-50 rounded-r-lg">
              <h2 className="text-xl font-bold text-blue-900 mb-2">2. Consent Logging & Account Validation</h2>
              <p className="text-sm text-blue-800">
                To ensure service integrity, we collect and store a digital record of your acceptance of these policies, linked directly to your authenticated email address. 
              </p>
              <ul className="list-disc pl-5 mt-2 text-sm text-blue-800 space-y-1">
                <li><strong>Validation:</strong> We flag accounts that access our services without a verified policy acceptance record.</li>
                <li><strong>Access Restriction:</strong> Users found bypassing the acceptance process will have their access revoked and accounts flagged for review.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">3. Nature of Service</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Tracking Platform:</strong> Navita operates strictly as a tracking interface designed to monitor bus routes and provide live location data.</li>
                <li><strong>Non-Ownership:</strong> We do not own, operate, manage, or maintain the physical buses displayed on the map.</li>
                <li><strong>Operational Liability:</strong> Navita is not responsible for real-world physical issues, including mechanical failures, transit delays, or accidents.</li>
                <li><strong>GPS Technology:</strong> Location tracking is facilitated through private GPS hardware installed in tracked vehicles.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-2 text-red-600">4. Prohibited Activities & Enforcement</h2>
              <p className="mb-2">The following actions are strictly forbidden and will result in a <strong>permanent ban</strong>:</p>
              <ul className="list-disc pl-5 space-y-1 bg-red-50 p-4 rounded-lg border border-red-100">
                <li>Manipulation of servers, API abuse, or exploiting system endpoints.</li>
                <li>Unauthorized app modification, route modification, or data manipulation.</li>
                <li>Use of hacks, scripts, or methods designed to bypass security protocols.</li>
              </ul>
              <p className="mt-2 text-sm italic">In instances of serious damage, Navita reserves the right to pursue legal action against responsible parties.</p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">5. Service Limitations</h2>
              <p>
                The service is provided on an "as-is" basis. We do not guarantee uninterrupted service, constant quality, or 100% GPS accuracy due to potential signal interference or server maintenance downtime.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">6. Intellectual Property</h2>
              <p>
                All proprietary software, tracking algorithms, and interface designs are the exclusive property of Navita. Reproduction or reverse-engineering is strictly prohibited.
              </p>
            </div>
          </div>
        </section>

        <hr className="my-10 border-gray-200" />

        {/* --- PRIVACY POLICY SECTION --- */}
        <section>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mb-6 font-medium">Last Updated: May 6, 2026</p>

          <div className="space-y-6 text-gray-700 leading-relaxed">
            <p>
              At Navita, we prioritize your security. This policy outlines how we handle your information to provide a safe bus tracking experience.
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 border border-gray-100 rounded-xl bg-blue-50">
                <h3 className="font-bold text-blue-900 mb-1">Data We Collect</h3>
                <p className="text-sm">Email, profile data, and <strong>acceptance status</strong> via Google Firebase for authentication and compliance monitoring.</p>
              </div>
              <div className="p-4 border border-gray-100 rounded-xl bg-green-50">
                <h3 className="font-bold text-green-900 mb-1">Device Permissions</h3>
                <p className="text-sm">We only require Internet Access. No access to camera, contacts, or storage is requested.</p>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">1. Third-Party Integrations</h2>
              <p>
                We utilize <strong>Google Firebase</strong> for authentication/analytics and <strong>Google Maps</strong> for geospatial visualization. Your use of Navita is subject to their respective privacy terms.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-2 text-orange-600">2. Account Deletion</h2>
              <p>
                Users maintain full control. You may delete your account at any time via settings. Upon deletion, all associated data (including email and policy acceptance records) is <strong>permanently purged</strong> and cannot be recovered.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">3. Contact & Support</h2>
              <p>
                For legal concerns or privacy inquiries, please reach out to us at:
                <br />
                <span className="font-semibold text-blue-600">makerstudiovu@gmail.com</span>
              </p>
            </div>
          </div>
        </section>

        {/* --- ACTION BUTTONS --- */}
        <div className="mt-12 flex flex-col items-center gap-4">
          <p className="text-xs text-gray-400 text-center max-w-sm">
            By clicking Accept, you acknowledge that Navita will record your acceptance alongside your account details to validate your access.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
            <button
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-8 py-3 rounded-2xl transition-all active:scale-95 w-full sm:w-auto"
              onClick={onReject}
            >
              Reject & Exit
            </button>
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-10 py-3 rounded-2xl shadow-lg transition-all active:scale-95 w-full sm:w-auto"
              onClick={handleAccept}
            >
              I Understand and Accept
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}