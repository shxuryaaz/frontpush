import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Trello OAuth Configuration
export const TRELLO_APP_KEY = import.meta.env.VITE_TRELLO_APP_KEY;
export const TRELLO_APP_SECRET = import.meta.env.VITE_TRELLO_APP_SECRET;

// OAuth providers configuration
export const oauthProviders = {
  trello: {
    name: 'Trello',
    icon: '🎯',
    color: 'from-blue-500 to-blue-600',
    description: 'Seamless integration with automatic board discovery'
  },
  linear: {
    name: 'Linear',
    icon: '⚡',
    color: 'from-purple-500 to-purple-600',
    description: 'Manual configuration with API key'
  },
  asana: {
    name: 'Asana',
    icon: '📋',
    color: 'from-orange-500 to-orange-600',
    description: 'Manual configuration with personal access token'
  }
};

// Helper function to initiate Trello OAuth
export const initiateTrelloOAuth = () => {
  const redirectUri = `${window.location.origin}/trello-callback`;
  const scope = 'read,write';
  const expiration = 'never';
  const name = 'Agilow';
  
  const oauthUrl = `https://trello.com/1/authorize?expiration=${expiration}&name=${encodeURIComponent(name)}&scope=${scope}&response_type=token&key=${TRELLO_APP_KEY}&return_url=${encodeURIComponent(redirectUri)}`;
  
  window.location.href = oauthUrl;
};

// Helper function to get stored Trello token
export const getTrelloToken = () => {
  return localStorage.getItem('trello_token');
};

// Helper function to store Trello token
export const storeTrelloToken = (token: string) => {
  localStorage.setItem('trello_token', token);
};

// Helper function to clear Trello token
export const clearTrelloToken = () => {
  localStorage.removeItem('trello_token');
}; 