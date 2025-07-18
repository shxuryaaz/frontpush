import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import AppSelection from "./pages/AppSelection";
import TrelloAuth from "./pages/TrelloAuth";
import ConfigureApp from "./pages/ConfigureApp";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import Register from './pages/Register';
import Login from './pages/Login';
import AuthGuard from './components/AuthGuard';
import AsanaAuth from './pages/AsanaAuth';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/select-app" element={
            <AuthGuard>
              <AppSelection />
            </AuthGuard>
          } />
          <Route path="/trello-auth" element={
            <AuthGuard>
              <TrelloAuth />
            </AuthGuard>
          } />
          <Route path="/asana-auth" element={
            <AuthGuard>
              <AsanaAuth />
            </AuthGuard>
          } />
          <Route path="/configure/:appId" element={
            <AuthGuard>
              <ConfigureApp />
            </AuthGuard>
          } />
          <Route path="/dashboard" element={
            <AuthGuard>
              <Dashboard />
            </AuthGuard>
          } />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
