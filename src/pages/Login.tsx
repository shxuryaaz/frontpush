import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { login as firebaseLogin, getCurrentUser } from '../lib/firebaseAuth';
import { saveUserProfile, saveUserAuthState, getUserProfile } from '../lib/firebaseUserConfig';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [form, setForm] = useState({ email: '', password: '', username: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // Handle input changes
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Email login
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { email, password } = form;
    try {
      await firebaseLogin(email, password);
      const user = await getCurrentUser();
      setUser(user);
      if (user) {
        // Save authentication state
        await saveUserAuthState(user.uid, true);
        
        // Fetch user profile from Firestore
        const userProfile = await getUserProfile(user.uid);
        if (!userProfile || !userProfile.username) {
          setShowUsernamePrompt(true);
        } else {
          // Redirect to app selection after successful login
          navigate('/select-app');
        }
      }
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  // Save username after login if missing
  const handleSetUsername = async () => {
    if (!user) return;
    try {
      await saveUserProfile(user.uid, {
        email: user.email,
        username: form.username,
        profile_picture: user.photoURL || null
      });
      setShowUsernamePrompt(false);
      // Redirect to app selection after setting username
      navigate('/select-app');
    } catch (err) {
      setError(err.message || 'Failed to save username.');
    }
  };

  // Google login
  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      setUser(user);
      if (user) {
        // Save authentication state
        await saveUserAuthState(user.uid, true);
        
        // Fetch or create user profile
        const userProfile = await getUserProfile(user.uid);
        if (!userProfile) {
          await saveUserProfile(user.uid, {
            email: user.email,
            username: user.displayName || '',
            profile_picture: user.photoURL || null
          });
        }
        // Redirect to app selection after successful login
        navigate('/select-app');
      }
    } catch (err) {
      setError(err.message || 'Google login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>
        <div className="text-center text-gray-500 mb-4">or</div>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            name="email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border rounded"
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border rounded"
          />
          <Button type="submit" className="w-full" disabled={loading}>
            Login with Email
          </Button>
          <Button type="button" className="w-full mt-2 bg-red-500 hover:bg-red-600" onClick={handleGoogleLogin} disabled={loading}>
            Login with Google
          </Button>
        </form>
        {error && <div className="text-red-500 mt-4 text-center">{error}</div>}
        {showUsernamePrompt && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">Set your username</h3>
            <input
              name="username"
              placeholder="Username"
              value={form.username}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded mb-2"
            />
            <Button onClick={handleSetUsername} className="w-full">
              Save Username
            </Button>
          </div>
        )}
        <div className="mt-4 text-center">
          <p className="text-gray-600">
            Don't have an account?{' '}
            <button 
              onClick={() => navigate('/register')}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Register here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login; 