import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { getCurrentUser } from '@/lib/firebaseAuth';
import { saveTrelloConfig } from '@/lib/firebaseUserConfig';

const TrelloAuth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const handleTrelloCallback = async () => {
      try {
        // Check for token in URL fragment first (Trello OAuth returns it here)
        let token = null;
        let boardId = null;

        // Check URL fragment for token
        const hash = window.location.hash;
        if (hash) {
          const hashParams = new URLSearchParams(hash.substring(1)); // Remove the # and parse
          token = hashParams.get('token');
        }

        // If not in hash, check search params as fallback
        if (!token) {
          token = searchParams.get('token');
          boardId = searchParams.get('boardId');
        }

        if (!token) {
          setError('No authorization token received from Trello');
          setStatus('error');
          return;
        }

        // Get current user
        const user = await getCurrentUser();
        if (!user) {
          setError('You must be logged in to complete Trello authorization');
          setStatus('error');
          return;
        }

        // Create the base configuration without boardId
        const baseConfig = {
          token: token,
          isAuthorized: true,
          lastAuthorized: new Date().toISOString()
        };

        // Only add boardId if it exists and is not empty
        if (boardId && boardId.trim() !== '') {
          // Create a new object with boardId included
          const configWithBoardId = {
            ...baseConfig,
            boardId: boardId
          };
          await saveTrelloConfig(user.uid, configWithBoardId);
        } else {
          // Save without boardId
          await saveTrelloConfig(user.uid, baseConfig);
        }

        setStatus('success');

        // Redirect to dashboard after a short delay
        setTimeout(() => {
          navigate('/dashboard', { state: { platform: 'trello' } });
        }, 2000);

      } catch (err: any) {
        console.error('Trello authorization error:', err);
        setError(err.message || 'Failed to complete Trello authorization');
        setStatus('error');
      }
    };

    handleTrelloCallback();
  }, [searchParams, navigate]);

  const handleRetry = () => {
    // Redirect back to app selection to try again
    navigate('/select-app');
  };

  const handleGoToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-center">
            {status === 'loading' && 'Connecting to Trello...'}
            {status === 'success' && 'Trello Connected Successfully!'}
            {status === 'error' && 'Connection Failed'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          {status === 'loading' && (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
              <p className="text-gray-600">
                Completing your Trello authorization...
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-gray-600">
                Your Trello account has been successfully connected to Agilow!
              </p>
              <p className="text-sm text-gray-500">
                Redirecting to dashboard...
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <p className="text-red-600 font-medium">
                {error}
              </p>
              <div className="space-y-2">
                <Button onClick={handleRetry} className="w-full">
                  Try Again
                </Button>
                <Button onClick={handleGoToDashboard} variant="outline" className="w-full">
                  Go to Dashboard
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TrelloAuth; 