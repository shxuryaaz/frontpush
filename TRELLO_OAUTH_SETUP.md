# Trello OAuth Setup Guide

## Overview
This guide explains how to set up direct Trello OAuth for the Agilow application.

## 1. Create Trello App

1. Go to [Trello App Key](https://trello.com/app-key)
2. Create a new app with the following settings:
   - **App Name**: Agilow
   - **App Description**: AI-powered project management assistant
   - **Redirect URL**: `https://your-domain.com/trello-callback` (or `http://localhost:5173/trello-callback` for development)

## 2. Environment Variables

Create a `.env` file in the frontend directory:

```env
# Trello OAuth Configuration
VITE_TRELLO_APP_KEY=your_trello_app_key_here
VITE_TRELLO_APP_SECRET=your_trello_app_secret_here

# Backend API URL
VITE_API_URL=http://localhost:8000

# Development Settings
NODE_ENV=development
```

## 3. How It Works

### User Flow:
1. **User clicks "Connect Trello"** → Redirected to Trello OAuth
2. **User authorizes Agilow** → Trello redirects back with token
3. **Token is stored** → User can now use voice commands
4. **Auto board discovery** → User sees all their Trello boards

### Technical Flow:
1. **Frontend** redirects to: `https://trello.com/1/authorize?expiration=never&name=Agilow&scope=read,write&response_type=token&key=YOUR_APP_KEY&return_url=YOUR_CALLBACK_URL`
2. **Trello** shows authorization page
3. **User approves** → Trello redirects to callback with token in URL hash
4. **Frontend** extracts token and stores it
5. **Dashboard** uses token to fetch boards and make API calls

## 4. Security Features

- **Token Storage**: Stored in localStorage (can be upgraded to secure storage)
- **Scope Limitation**: Only requests `read,write` permissions
- **Token Expiration**: Set to `never` (user can revoke anytime)
- **Error Handling**: Graceful fallback to manual configuration

## 5. Testing

### Development Testing:
1. Set up local environment:
   ```bash
   cd agilow-frontend-main/frontend
   cp env.example .env
   # Edit .env with your Trello app credentials
   npm run dev
   ```

2. Test the flow:
   - Go to app selection
   - Click "Connect Trello"
   - Complete OAuth flow
   - Verify token is stored
   - Check dashboard loads with boards

### Production Testing:
1. Update Trello app redirect URL to production domain
2. Deploy frontend
3. Test complete flow in production

## 6. Troubleshooting

### Common Issues:

1. **"Invalid redirect URL"**
   - Check that Trello app redirect URL matches exactly
   - Include protocol (http/https)
   - Include port number for localhost

2. **"No token found"**
   - Check browser console for errors
   - Verify Trello app key is correct
   - Ensure callback URL is properly configured

3. **"Failed to fetch boards"**
   - Check that token is valid
   - Verify Trello API permissions
   - Check network requests in browser dev tools

### Debug Steps:

1. **Check environment variables**:
   ```javascript
   console.log(import.meta.env.VITE_TRELLO_APP_KEY)
   ```

2. **Test OAuth URL**:
   ```javascript
   const oauthUrl = `https://trello.com/1/authorize?expiration=never&name=Agilow&scope=read,write&response_type=token&key=${YOUR_APP_KEY}&return_url=${encodeURIComponent('http://localhost:5173/trello-callback')}`
   console.log(oauthUrl)
   ```

3. **Check stored token**:
   ```javascript
   console.log(localStorage.getItem('trello_token'))
   ```

## 7. Production Deployment

1. **Update Trello App Settings**:
   - Change redirect URL to production domain
   - Update app description if needed

2. **Environment Variables**:
   - Use production backend URL
   - Ensure all variables are set

3. **HTTPS Required**:
   - Trello OAuth requires HTTPS in production
   - Ensure your domain has valid SSL certificate

## 8. Backend Integration

The backend will receive Trello tokens from the frontend and can:
- Make Trello API calls on behalf of users
- Store tokens securely in database
- Handle token refresh if needed
- Implement proper error handling

## 9. Future Enhancements

- **Secure Token Storage**: Use encrypted storage instead of localStorage
- **Token Refresh**: Implement automatic token refresh
- **Multiple Boards**: Allow users to connect multiple Trello accounts
- **Webhook Integration**: Real-time updates from Trello
- **Team Support**: Handle team boards and permissions 