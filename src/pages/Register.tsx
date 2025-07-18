import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { register as firebaseRegister, getCurrentUser } from '../lib/firebaseAuth';
import { saveUserProfile, saveUserAuthState } from '../lib/firebaseUserConfig';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';

const Register = () => {
  const [form, setForm] = useState({ email: '', password: '', username: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Handle input changes
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Email registration
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { email, password, username } = form;
    try {
      await firebaseRegister(email, password);
      // After registration, store user profile in Firestore
      const user = await getCurrentUser();
      if (user) {
        await saveUserProfile(user.uid, {
          email: user.email,
          username: username,
          profile_picture: user.photoURL || null
        });
        await saveUserAuthState(user.uid, true);
        // Redirect to app selection after successful registration
        navigate('/select-app');
      }
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // Google registration
  const handleGoogleRegister = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      if (user) {
        await saveUserProfile(user.uid, {
          email: user.email,
          username: user.displayName || '',
          profile_picture: user.photoURL || null
        });
        await saveUserAuthState(user.uid, true);
        // Redirect to app selection after successful registration
        navigate('/select-app');
      }
    } catch (err) {
      setError(err.message || 'Google registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">Register</h2>
        <div className="text-center text-gray-500 mb-4">or</div>
        <form onSubmit={handleRegister} className="space-y-4">
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
          <input
            name="username"
            placeholder="Username"
            value={form.username}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border rounded"
          />
          <Button type="submit" className="w-full" disabled={loading}>
            Register with Email
          </Button>
          <Button type="button" className="w-full mt-2 bg-red-500 hover:bg-red-600" onClick={handleGoogleRegister} disabled={loading}>
            Register with Google
          </Button>
        </form>
        {error && <div className="text-red-500 mt-4 text-center">{error}</div>}
        <div className="mt-4 text-center">
          <p className="text-gray-600">
            Already have an account?{' '}
            <button 
              onClick={() => navigate('/login')}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Login here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register; 