import { useState, useEffect } from 'react';
import { getCurrentUser } from '@/lib/firebaseAuth';
import { getUserProfile } from '@/lib/firebaseUserConfig';

interface User {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}

interface UserProfile {
  username?: string;
  profile_picture?: string | null;
  selectedApp?: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          
          // Get user profile from Firestore
          try {
            const profile = await getUserProfile(currentUser.uid);
            setUserProfile(profile);
          } catch (error) {
            console.error('Error fetching user profile:', error);
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const refreshUserProfile = async () => {
    if (user) {
      try {
        const profile = await getUserProfile(user.uid);
        setUserProfile(profile);
      } catch (error) {
        console.error('Error refreshing user profile:', error);
      }
    }
  };

  return {
    user,
    userProfile,
    loading,
    refreshUserProfile,
    isAuthenticated: !!user
  };
}; 