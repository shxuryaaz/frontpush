import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { getCurrentUser } from '@/lib/firebaseAuth';
import { saveTrelloConfig } from '@/lib/firebaseUserConfig';

const TrelloCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Extract token from URL hash
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const token = params.get('token');
        const error = params.get('error');

        if (error) {
          setStatus('error');
          setError(error);
          return;
        }

        if (token) {
          // Get logged-in user
          const user = await getCurrentUser();
          if (!user) throw new Error('You must be logged in to connect Trello.');

          // Fetch boards and store the first boardId automatically
          const apiKey = import.meta.env.VITE_TRELLO_APP_KEY;
          const boardsRes = await fetch(`https://api.trello.com/1/members/me/boards?key=${apiKey}&token=${token}`);
          const boards = await boardsRes.json();
          let boardId = null;
          if (Array.isArray(boards) && boards.length > 0) {
            boardId = boards[0].id;
          }

          // Store the token and boardId in Firestore
          await saveTrelloConfig(user.uid, { token, boardId });

          setStatus('success');
          // Redirect to dashboard after a short delay
          setTimeout(() => {
            navigate('/dashboard', {
              state: {
                platform: 'trello',
                token: token,
                boardId: boardId
              }
            });
          }, 2000);
        } else {
          throw new Error('No token found in URL');
        }
      } catch (err) {
        console.error('Trello callback error:', err);
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    };

    handleCallback();
  }, [navigate]);

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Completing Trello Connection
              </h2>
              <p className="text-gray-600">
                Please wait while we complete your Trello connection...
              </p>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Successfully Connected!
              </h2>
              <p className="text-gray-600">
                You've successfully connected your Trello account. Redirecting to dashboard...
              </p>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Connection Failed
              </h2>
              <p className="text-gray-600 mb-4">
                {error || 'There was an error connecting to Trello.'}
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/select-app')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
              >
                Try Again
              </button>
              <button
                onClick={() => navigate('/')}
                className="text-gray-600 hover:text-gray-800 px-6 py-2"
              >
                Back to Home
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
          <CardContent className="p-8">
            {renderContent()}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default TrelloCallback; 