# Trello Voice Command Fix

## Issue Fixed
The voice commands were failing with "Trello API key is missing or invalid" because the frontend was not including the Trello API key in the configuration sent to the backend.

## Changes Made

### 1. Updated VoiceManager.tsx
- **File**: `src/components/VoiceManager.tsx`
- **Change**: Added fallback to environment variable for Trello API key
- **Code**: 
  ```typescript
  // Use API key from cookies or fallback to environment variable
  const trelloApiKey = apiKey || import.meta.env.VITE_TRELLO_APP_KEY;
  if (trelloApiKey && token && boardId) {
    setSelectedTool("trello");
    setIsConfigured(true);
    setPlatformConfig({ apiKey: trelloApiKey, token, boardId });
    setShowConfigForm(false);
  }
  ```

### 2. Resolved Merge Conflicts
- Cleaned up all merge conflict markers in the VoiceManager component
- Ensured proper TypeScript types and component structure

## Setup Required

### 1. Create Environment File
Create a `.env` file in the frontend directory with your Trello API key:

```env
# Trello OAuth Configuration
VITE_TRELLO_APP_KEY=your_actual_trello_app_key_here
VITE_TRELLO_APP_SECRET=your_actual_trello_app_secret_here

# Backend API URL
VITE_API_URL=http://localhost:8000

# Development Settings
NODE_ENV=development
```

### 2. Get Your Trello API Key
1. Go to [Trello App Key](https://trello.com/app-key)
2. Create a new app with the following settings:
   - **App Name**: Agilow
   - **App Description**: AI-powered project management assistant
   - **Redirect URL**: `http://localhost:5173/trello-callback` (for development)

### 3. Update Environment Variables
Replace `your_actual_trello_app_key_here` with your real Trello API key in the `.env` file.

## How It Works Now

1. **Fallback Logic**: The VoiceManager now checks for the API key in this order:
   - First: Cookies (if user has configured via UI)
   - Second: Environment variable `VITE_TRELLO_APP_KEY`
   - If neither exists, configuration fails

2. **Backend Integration**: The `sendAudioToBackend` function in `audioRecorder.ts` already correctly sends the API key to the backend when available.

3. **Error Handling**: If the API key is missing, the backend will provide clear error messages about what's missing.

## Testing

1. Set up your `.env` file with the real Trello API key
2. Restart your development server
3. Go through the Trello OAuth flow
4. Try voice commands - they should now work without the "API key missing" error

## Troubleshooting

### Still getting "API key missing" error?
1. Check that your `.env` file exists in the frontend directory
2. Verify the environment variable name is exactly `VITE_TRELLO_APP_KEY`
3. Restart your development server after adding the `.env` file
4. Check browser console for any errors

### Voice commands not working?
1. Ensure you've completed the Trello OAuth flow
2. Check that you have boards in your Trello account
3. Verify the backend is running on the correct port
4. Check the browser console and backend logs for detailed error messages

## Files Modified
- `src/components/VoiceManager.tsx` - Added environment variable fallback for Trello API key
- Resolved merge conflicts and cleaned up component structure 