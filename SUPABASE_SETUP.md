# Supabase OAuth Setup Guide

## Overview
This guide explains how to set up Supabase OAuth for the Agilow application.

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note down your project URL and anon key

## 2. Environment Variables

Create a `.env` file in the frontend directory with:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:8000
```

## 3. Configure OAuth Providers

### Trello OAuth Setup

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers**
3. Enable **Trello** provider
4. Configure the following:
   - **Client ID**: Your Trello app key
   - **Client Secret**: Your Trello app secret
   - **Redirect URL**: `https://your-domain.com/auth/callback`

### Creating Trello App

1. Go to [Trello App Key](https://trello.com/app-key)
2. Create a new app
3. Set the redirect URL to your Supabase auth callback URL
4. Copy the app key and secret to Supabase

## 4. Database Schema

Create the following tables in your Supabase database:

```sql
-- User connections table
CREATE TABLE user_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User boards table (for Trello)
CREATE TABLE user_boards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  board_id TEXT NOT NULL,
  board_name TEXT NOT NULL,
  board_url TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_boards ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own connections" ON user_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own connections" ON user_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connections" ON user_connections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own boards" ON user_boards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own boards" ON user_boards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own boards" ON user_boards
  FOR UPDATE USING (auth.uid() = user_id);
```

## 5. Supabase Functions (Optional)

Create a Supabase Edge Function to handle Trello API calls:

```typescript
// supabase/functions/trello-api/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { method, url } = req
  
  if (method === 'POST') {
    const { access_token, endpoint } = await req.json()
    
    const response = await fetch(`https://api.trello.com/1${endpoint}?key=${Deno.env.get('TRELLO_APP_KEY')}&token=${access_token}`)
    const data = await response.json()
    
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  return new Response('Method not allowed', { status: 405 })
})
```

## 6. Testing the Setup

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to the app selection page
3. Click "Connect Trello"
4. Complete the OAuth flow
5. Verify you're redirected to the dashboard

## 7. Troubleshooting

### Common Issues

1. **OAuth redirect not working**
   - Check that the redirect URL in Supabase matches your domain
   - Ensure the Trello app redirect URL is correct

2. **Session not persisting**
   - Check that cookies are enabled
   - Verify the Supabase URL and anon key are correct

3. **Trello API errors**
   - Ensure the Trello app has the correct permissions
   - Check that the access token is being passed correctly

### Debug Steps

1. Check browser console for errors
2. Verify environment variables are loaded
3. Test Supabase connection in the browser console:
   ```javascript
   import { supabase } from './lib/supabase'
   const { data, error } = await supabase.auth.getSession()
   console.log(data, error)
   ```

## 8. Production Deployment

1. Update environment variables for production
2. Set up custom domain in Supabase
3. Update OAuth redirect URLs for production domain
4. Test the complete flow in production

## 9. Security Considerations

- Never expose Supabase service role key in frontend
- Use Row Level Security (RLS) policies
- Validate all user inputs
- Implement proper error handling
- Use HTTPS in production 