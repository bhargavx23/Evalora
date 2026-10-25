# Google OAuth Setup

Evalora supports Google sign-in through the backend OAuth flow. The frontend never accepts arbitrary Google profile data.

1. Create OAuth credentials in Google Cloud Console.
2. Add this authorized redirect URI:

   `http://localhost:5000/api/auth/google/callback`

3. Set these environment variables on the API server:

   `GOOGLE_CLIENT_ID`
   `GOOGLE_CLIENT_SECRET`
   `GOOGLE_CALLBACK_URL`
   `CLIENT_URL`

4. Restart the server.

Google sign-in links an existing Evalora account by verified email. If no Evalora account exists for the Google email, the user must create the Evalora account first to avoid duplicate or unscoped users.
