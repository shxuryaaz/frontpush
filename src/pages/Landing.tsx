import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/agilow-logo.jpeg';
import { useAuth } from '@/hooks/useAuth';

const agilowBlue = '#1A237E'; // Use a deep blue similar to the Agilow logo

const Landing = () => {
  const [showContent, setShowContent] = useState(false);
  const navigate = useNavigate();
  const { user, userProfile, loading, isAuthenticated } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // Redirect authenticated users to app selection
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/select-app');
    }
  }, [loading, isAuthenticated, navigate]);

  const handleGetStarted = () => {
    navigate('/register');
  };

  const handleLogin = () => {
    navigate('/login');
  };

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center"
        style={{ background: agilowBlue }}
      >
        <div className="text-center">
          <div className="w-20 h-20 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-6">
            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render content for authenticated users (they'll be redirected)
  if (isAuthenticated) {
    return null;
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center"
      style={{ background: agilowBlue }}
    >
      <div className="text-center space-y-8">
        {/* Logo Animation */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: showContent ? 1 : 0, scale: showContent ? 1 : 0.8 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="mb-8"
        >
          <img
            src={logo}
            alt="Agilow Logo"
            className="w-40 h-40 mx-auto rounded-full shadow-lg"
          />
        </motion.div>

        {/* Welcome Text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 20 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="space-y-4"
        >
          <h1 className="text-5xl md:text-7xl font-bold text-white drop-shadow-lg">
            Welcome to Agilow
          </h1>
          <p className="text-2xl text-blue-100 max-w-md mx-auto">
            Your AI-powered project management assistant
          </p>
        </motion.div>

        {/* Feature Highlights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 20 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="max-w-2xl mx-auto px-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-white">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-3">
                <span className="text-2xl">🎤</span>
              </div>
              <h3 className="font-semibold mb-2">Voice Commands</h3>
              <p className="text-blue-100 text-sm">Manage tasks with natural voice commands</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-3">
                <span className="text-2xl">🤖</span>
              </div>
              <h3 className="font-semibold mb-2">AI Powered</h3>
              <p className="text-blue-100 text-sm">Intelligent task extraction and management</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-3">
                <span className="text-2xl">🔗</span>
              </div>
              <h3 className="font-semibold mb-2">Multi-Platform</h3>
              <p className="text-blue-100 text-sm">Works with Trello, Linear, and Asana</p>
            </div>
          </div>
        </motion.div>

        {/* Register and Login Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 20 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Button
            onClick={handleGetStarted}
            size="lg"
            className="bg-white text-blue-900 px-10 py-4 text-xl font-bold rounded-full shadow-lg hover:bg-blue-100 transition-all duration-300"
          >
            Get Started
          </Button>
          <Button
            onClick={handleLogin}
            size="lg"
            className="bg-blue-100 text-blue-900 px-10 py-4 text-xl font-bold rounded-full shadow-lg hover:bg-white transition-all duration-300"
          >
            Login
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default Landing; 