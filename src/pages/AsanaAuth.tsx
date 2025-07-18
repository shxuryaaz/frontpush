import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { getCurrentUser } from '@/lib/firebaseAuth';
import { saveAsanaConfig } from '@/lib/firebaseUserConfig';

const ASANA_CLIENT_ID = import.meta.env.VITE_ASANA_CLIENT_ID;
const REDIRECT_URI = `${window.location.origin}/asana-auth`;
const ASANA_AUTH_URL = `https://app.asana.com/-/oauth_authorize?client_id=${ASANA_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=default`;

const BACKEND_TOKEN_EXCHANGE_URL = `${import.meta.env.VITE_API_URL || 'https://pushing-1.onrender.com'}/asana/exchange-token`;

const AsanaAuth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>('');

  console.log('AsanaAuth component loaded. Current URL:', window.location.href);
  console.log('Search params:', Object.fromEntries(searchParams.entries()));

  useEffect(() => {
    const handleAsanaCallback = async () => {
      try {
        // Check for code in URL (Asana OAuth returns it here)
        let code = null;
        const urlParams = new URLSearchParams(window.location.search);
        code = urlParams.get('code');
        if (!code) {
          // No code, so start the OAuth flow
          console.log('Redirecting to Asana OAuth URL:', ASANA_AUTH_URL);
          window.location.href = ASANA_AUTH_URL;
          return;
        }
        // Exchange code for access token via backend
        const res = await fetch("https://pushing-1.onrender.com/asana/token-exchange", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirect_uri: REDIRECT_URI })
        });
        if (!res.ok) throw new Error('Failed to exchange code for token');
        const data = await res.json();
        console.log('Asana backend token exchange response:', data);
        const token = data.access_token;
        if (!token) throw new Error('No access token received from Asana');
        console.log('Saving Asana access token to Firebase:', token);
        // Get current user
        const user = await getCurrentUser();
        if (!user) {
          setError('You must be logged in to complete Asana authorization');
          setStatus('error');
          return;
        }
        try {
          await saveAsanaConfig(user.uid, {
            personalAccessToken: token,
            projectId: '',
            isConfigured: true
          });
          console.log('Asana config saved successfully');
        } catch (saveErr) {
          console.error('Error saving Asana config:', saveErr);
          setError('Failed to save Asana config');
          setStatus('error');
          return;
        }
        setStatus('success');
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          navigate('/dashboard', { state: { platform: 'asana' } });
        }, 2000);
      } catch (err: any) {
        console.error('Asana authorization error:', err);
        setError(err.message || 'Failed to complete Asana authorization');
        setStatus('error');
      }
    };
    handleAsanaCallback();
  }, [searchParams, navigate]);

  const handleRetry = () => {
    // Redirect back to app selection to try again
    window.location.href = ASANA_AUTH_URL;
  };

  const handleGoToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100 flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-center">
            {status === 'loading' && 'Connecting to Asana...'}
            {status === 'success' && 'Asana Connected Successfully!'}
            {status === 'error' && 'Connection Failed'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          {status === 'loading' && (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-orange-100 rounded-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
              </div>
              <p className="text-gray-600">
                Completing your Asana authorization...
              </p>
            </div>
          )}
          {status === 'success' && (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-gray-600">
                Your Asana account has been successfully connected to Agilow!
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

export default AsanaAuth; 
