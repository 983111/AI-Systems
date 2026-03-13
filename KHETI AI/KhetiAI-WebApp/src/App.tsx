/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "./components/Layout";
import AuthPage from "./pages/AuthPage";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Assistant from "./pages/Assistant";
import DiseaseDetection from "./pages/DiseaseDetection";
import MarketPrices from "./pages/MarketPrices";
import Weather from "./pages/Weather";
import LoanEligibility from "./pages/LoanEligibility";
import IntelligenceHub from "./pages/IntelligenceHub";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/auth" element={<AuthPage />} />

          {/* Password reset — must be public so the email link works before login */}
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="intelligence" element={<IntelligenceHub />} />
            <Route path="assistant" element={<Assistant />} />
            <Route path="disease" element={<DiseaseDetection />} />
            <Route path="market" element={<MarketPrices />} />
            <Route path="weather" element={<Weather />} />
            <Route path="loan" element={<LoanEligibility />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
