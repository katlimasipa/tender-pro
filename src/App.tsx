import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
import Onboarding from "./pages/Onboarding.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import CompanyProfile from "./pages/CompanyProfile.tsx";
import TendersList from "./pages/TendersList.tsx";
import TenderBuilder from "./pages/TenderBuilder.tsx";
import SharedTender from "./pages/SharedTender.tsx";

const queryClient = new QueryClient();

// Force TenderBuilder to remount on every navigation to /tenders/new so the
// "+ New Tender" button always yields a fresh, empty form (even when the user
// is already on that route).
const TenderBuilderRoute = () => {
  const { id } = useParams();
  const location = useLocation();
  const key = id ? `edit-${id}` : `new-${location.key}`;
  return <TenderBuilder key={key} />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/company" element={<ProtectedRoute><CompanyProfile /></ProtectedRoute>} />
            <Route path="/tenders" element={<ProtectedRoute><TendersList /></ProtectedRoute>} />
            <Route path="/tenders/new" element={<ProtectedRoute><TenderBuilderRoute /></ProtectedRoute>} />
            <Route path="/tenders/:id" element={<ProtectedRoute><TenderBuilderRoute /></ProtectedRoute>} />
            <Route path="/shared/:token" element={<SharedTender />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
