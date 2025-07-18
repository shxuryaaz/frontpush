import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Trello, Zap, Notebook } from 'lucide-react';
import { getCurrentUser } from '@/lib/firebaseAuth';
import { 
  hasAppConfiguration, 
  saveUserAppSelection, 
  getTrelloConfig,
  getLinearConfig,
  getAsanaConfig
} from '@/lib/firebaseUserConfig';

interface AppOption {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: 'recommended' | 'available' | 'coming-soon' | 'configured';
  features: string[];
  color: string;
  isConfigured?: boolean;
}

const AppSelection = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [appOptions, setAppOptions] = useState<AppOption[]>([]);
  const [user, setUser] = useState<any>(null);

  // Check user authentication and existing configurations
  useEffect(() => {
    const checkUserAndConfigurations = async () => {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        navigate('/login');
        return;
      }
      setUser(currentUser);

      // Check existing configurations for each app
      const trelloConfigured = await hasAppConfiguration(currentUser.uid, 'trello');
      const linearConfigured = await hasAppConfiguration(currentUser.uid, 'linear');
      const asanaConfigured = await hasAppConfiguration(currentUser.uid, 'asana');

      const options: AppOption[] = [
        {
          id: 'trello',
          name: 'Trello',
          description: trelloConfigured 
            ? 'Your Trello account is connected and ready to use' 
            : 'Seamless integration with automatic board discovery',
          icon: (
            <img
              src="https://images.icon-icons.com/836/PNG/512/Trello_icon-icons.com_66775.png"
              alt="Trello Logo"
              className="w-full h-full object-cover rounded-full"
              draggable="false"
            />
          ),
          status: trelloConfigured ? 'configured' : 'recommended',
          features: ['OAuth Integration', 'Auto Board Discovery', 'Voice Commands'],
          color: 'from-blue-500 to-blue-600',
          isConfigured: trelloConfigured
        },
        {
          id: 'linear',
          name: 'Linear',
          description: linearConfigured 
            ? 'Your Linear workspace is configured and ready to use'
            : 'Manual configuration with API key',
          icon: (
            <img
              src="https://cdn.brandfetch.io/linear.app/fallback/lettermark/theme/dark/h/256/w/256/icon?c=1bfwsmEH20zzEfSNTed"
              alt="Linear Logo"
              className="w-full h-full object-cover rounded-full"
              draggable="false"
            />
          ),
          status: linearConfigured ? 'configured' : 'available',
          features: ['API Key Setup', 'Workspace Management', 'Voice Commands'],
          color: 'from-purple-500 to-purple-600',
          isConfigured: linearConfigured
        },
        {
          id: 'asana',
          name: 'Asana',
          description: asanaConfigured 
            ? 'Your Asana project is configured and ready to use'
            : 'Manual configuration with personal access token',
          icon: (
            <img
              src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcScD1nIKyMQn9x7WWbGxQqVk31VJ5Vb5YFnwg&s"
              alt="Asana Logo"
              className="w-full h-full object-cover rounded-full"
              draggable="false"
            />
          ),
          status: asanaConfigured ? 'configured' : 'available',
          features: ['Personal Access Token', 'Project Management', 'Voice Commands'],
          color: 'from-orange-500 to-orange-600',
          isConfigured: asanaConfigured
        }
      ];

      setAppOptions(options);
    };

    checkUserAndConfigurations();
  }, [navigate]);

  const handleAppSelection = async (appId: string) => {
    if (!user) {
      navigate('/login');
      return;
    }

    setIsLoading(appId);
    
    try {
      // Save user's app selection
      await saveUserAppSelection(user.uid, appId);

      if (appId === 'trello') {
        // Check if Trello is already configured
        const trelloConfig = await getTrelloConfig(user.uid);
        if (trelloConfig?.isAuthorized) {
          // User is already authorized, go directly to dashboard
          navigate('/dashboard', { state: { platform: 'trello' } });
        } else {
          // Need to authorize Trello - initiate OAuth flow
          const TRELLO_APP_KEY = import.meta.env.VITE_TRELLO_APP_KEY;
          const REDIRECT_URI = `${window.location.origin}/trello-auth`;
          const TRELLO_AUTH_URL = `https://trello.com/1/authorize?expiration=never&name=Agilow&scope=read,write&response_type=token&key=${TRELLO_APP_KEY}&return_url=${encodeURIComponent(REDIRECT_URI)}`;
          
          // Redirect to Trello OAuth
          window.location.href = TRELLO_AUTH_URL;
        }
      } else if (appId === 'asana') {
        // Check if Asana is already configured
        const asanaConfig = await getAsanaConfig(user.uid);
        if (asanaConfig?.isConfigured) {
          // Already configured, go to dashboard
          navigate('/dashboard', { state: { platform: 'asana' } });
        } else {
          // Need to authorize Asana - initiate OAuth flow
          navigate('/asana-auth');
        }
      } else {
        // For Linear, check if already configured
        const config = await getLinearConfig(user.uid);
        if (config?.isConfigured) {
          // Already configured, go to dashboard
          navigate('/dashboard', { state: { platform: appId } });
        } else {
          // Need to configure
          navigate(`/configure/${appId}`);
        }
      }
    } catch (error) {
      console.error('App selection error:', error);
      // Fallback to configuration page
      navigate(`/configure/${appId}`);
    } finally {
      setIsLoading(null);
    }
  };

  const getStatusBadge = (status: AppOption['status']) => {
    switch (status) {
      case 'recommended':
        return <Badge className="bg-green-100 text-green-800">Recommended</Badge>;
      case 'available':
        return <Badge className="bg-blue-100 text-blue-800">Available</Badge>;
      case 'configured':
        return <Badge className="bg-green-100 text-green-800">✓ Connected</Badge>;
      case 'coming-soon':
        return <Badge className="bg-gray-100 text-gray-800">Coming Soon</Badge>;
      default:
        return null;
    }
  };

  const getButtonText = (app: AppOption) => {
    if (isLoading === app.id) {
      return 'Connecting...';
    }
    if (app.isConfigured) {
      return 'Use App';
    }
    return `Connect ${app.name}`;
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#1A237E] relative overflow-x-hidden">
      {/* Decorative blurred background circles */}
      <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-blue-900 rounded-full blur-3xl opacity-30 z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-purple-800 rounded-full blur-3xl opacity-30 z-0" />
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="text-center mb-16 z-10"
      >
        <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-4 drop-shadow-lg tracking-tight">
          Choose Your App
        </h1>
        <p className="text-xl text-blue-100 max-w-2xl mx-auto">
          Select the project management platform you'd like to integrate with Agilow
        </p>
      </motion.div>
      {/* App Logos with hover-to-expand details */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-12 z-10">
        {appOptions.map((app, index) => (
          <motion.div
            key={app.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: index * 0.12 }}
            className="relative group flex flex-col items-center"
          >
            {/* Logo Circle + Name Clickable Area */}
            <motion.div
              className="flex flex-col items-center group/logo-select"
            >
              <motion.div
                className={`w-32 h-32 md:w-36 md:h-36 rounded-full shadow-2xl border-4 border-white/30 bg-gradient-to-br ${app.color} cursor-pointer transition-transform duration-300 group-hover:scale-110 z-20 relative overflow-hidden flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-blue-300 ${app.isConfigured ? 'ring-4 ring-green-400' : ''}`}
                whileHover={{ scale: 1.12 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleAppSelection(app.id)}
                role="button"
                tabIndex={0}
                aria-label={`Connect ${app.name}`}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleAppSelection(app.id);
                  }
                }}
              >
                <div className="absolute inset-0 w-full h-full">
                  {app.icon}
                </div>
                {app.isConfigured && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
              </motion.div>
              {/* App Name below logo */}
              <div
                className="mt-4 text-xl md:text-2xl font-bold text-white text-center drop-shadow-lg select-none cursor-pointer focus:outline-none"
                onClick={() => handleAppSelection(app.id)}
                role="button"
                tabIndex={0}
                aria-label={`Connect ${app.name}`}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleAppSelection(app.id);
                  }
                }}
              >
                {app.name}
              </div>
            </motion.div>
            {/* Details Card (hidden until hover) */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              whileHover={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="absolute top-36 left-1/2 -translate-x-1/2 w-80 md:w-96 bg-white/90 backdrop-blur-lg rounded-2xl shadow-2xl p-6 z-30 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-2 opacity-0 scale-95 translate-y-4 transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-bold text-gray-900">{app.name}</span>
                {getStatusBadge(app.status)}
              </div>
              <p className="text-gray-700 text-base mb-4">{app.description}</p>
              <div className="space-y-2 mb-6">
                {app.features.map((feature, featureIndex) => (
                  <div key={featureIndex} className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-sm text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>
              <Button
                onClick={() => handleAppSelection(app.id)}
                className={`w-full bg-gradient-to-r ${app.color} hover:opacity-95 text-white font-bold text-base py-2 rounded-lg shadow-lg transition-all duration-200 ${app.status === 'coming-soon' ? 'cursor-not-allowed opacity-60' : ''}`}
                disabled={app.status === 'coming-soon' || isLoading === app.id}
                aria-label={
                  isLoading === app.id
                    ? `Connecting to ${app.name}`
                    : app.status === 'coming-soon'
                    ? `${app.name} coming soon`
                    : `Connect ${app.name}`
                }
              >
                {isLoading === app.id ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Connecting...
                  </>
                ) : app.status === 'coming-soon' ? (
                  'Coming Soon'
                ) : (
                  getButtonText(app)
                )}
              </Button>
            </motion.div>
          </motion.div>
        ))}
      </div>
      {/* Back Button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="text-center mt-20 z-10"
      >
        <Button
          variant="outline"
          onClick={() => navigate('/')} 
          className="text-blue-100 hover:text-white px-8 py-3 text-lg rounded-full border-2 border-blue-200 shadow-sm bg-white/10 hover:bg-white/20"
          aria-label="Back to Home"
        >
          ← Back to Home
        </Button>
      </motion.div>
    </div>
  );
};

export default AppSelection; 