import { db } from './firebase';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

// User authentication state tracking
export const saveUserAuthState = async (uid: string, isAuthenticated: boolean) => {
  await setDoc(doc(db, 'userAuthStates', uid), { 
    isAuthenticated, 
    lastLogin: new Date().toISOString() 
  }, { merge: true });
};

export const getUserAuthState = async (uid: string) => {
  const docSnap = await getDoc(doc(db, 'userAuthStates', uid));
  return docSnap.exists() ? docSnap.data() : null;
};

// User profile management
export const saveUserProfile = async (uid: string, profile: { 
  email: string; 
  username: string; 
  profile_picture?: string | null;
  selectedApp?: string;
}) => {
  await setDoc(doc(db, 'users', uid), profile, { merge: true });
};

export const getUserProfile = async (uid: string) => {
  const docSnap = await getDoc(doc(db, 'users', uid));
  return docSnap.exists() ? docSnap.data() : null;
};

// Trello configuration
export const saveTrelloConfig = async (uid: string, config: { 
  token: string; 
  boardId?: string;
  isAuthorized: boolean;
  lastAuthorized?: string;
}) => {
  // Create a clean config object without undefined values
  const cleanConfig: any = {
    token: config.token,
    isAuthorized: config.isAuthorized,
    lastUpdated: new Date().toISOString()
  };

  // Only add boardId if it exists and is not undefined
  if (config.boardId && config.boardId.trim() !== '') {
    cleanConfig.boardId = config.boardId;
  }

  // Only add lastAuthorized if it exists
  if (config.lastAuthorized) {
    cleanConfig.lastAuthorized = config.lastAuthorized;
  }

  await setDoc(doc(db, 'trelloConfigs', uid), cleanConfig, { merge: true });
};

export const getTrelloConfig = async (uid: string) => {
  const docSnap = await getDoc(doc(db, 'trelloConfigs', uid));
  return docSnap.exists() ? docSnap.data() : null;
};

export const updateTrelloConfig = async (uid: string, updates: Partial<{
  boardId: string;
  isAuthorized: boolean;
  lastAuthorized: string;
}>) => {
  await updateDoc(doc(db, 'trelloConfigs', uid), {
    ...updates,
    lastUpdated: new Date().toISOString()
  });
};

// Linear configuration
export const saveLinearConfig = async (uid: string, config: { 
  apiKey: string; 
  workspaceId: string;
  isConfigured: boolean;
}) => {
  await setDoc(doc(db, 'linearConfigs', uid), {
    ...config,
    lastUpdated: new Date().toISOString()
  }, { merge: true });
};

export const getLinearConfig = async (uid: string) => {
  const docSnap = await getDoc(doc(db, 'linearConfigs', uid));
  return docSnap.exists() ? docSnap.data() : null;
};

export const updateLinearConfig = async (uid: string, updates: Partial<{
  apiKey: string;
  workspaceId: string;
  isConfigured: boolean;
}>) => {
  await updateDoc(doc(db, 'linearConfigs', uid), {
    ...updates,
    lastUpdated: new Date().toISOString()
  });
};

// Asana configuration
export const saveAsanaConfig = async (uid: string, config: { 
  personalAccessToken: string; 
  projectId: string;
  isConfigured: boolean;
}) => {
  await setDoc(doc(db, 'asanaConfigs', uid), {
    ...config,
    lastUpdated: new Date().toISOString()
  }, { merge: true });
};

export const getAsanaConfig = async (uid: string) => {
  const docSnap = await getDoc(doc(db, 'asanaConfigs', uid));
  return docSnap.exists() ? docSnap.data() : null;
};

export const updateAsanaConfig = async (uid: string, updates: Partial<{
  personalAccessToken: string;
  projectId: string;
  isConfigured: boolean;
}>) => {
  await updateDoc(doc(db, 'asanaConfigs', uid), {
    ...updates,
    lastUpdated: new Date().toISOString()
  });
};

// App selection tracking
export const saveUserAppSelection = async (uid: string, appId: string) => {
  await setDoc(doc(db, 'userAppSelections', uid), {
    selectedApp: appId,
    lastSelected: new Date().toISOString()
  }, { merge: true });
};

export const getUserAppSelection = async (uid: string) => {
  const docSnap = await getDoc(doc(db, 'userAppSelections', uid));
  return docSnap.exists() ? docSnap.data() : null;
};

// Check if user has configuration for a specific app
export const hasAppConfiguration = async (uid: string, appId: string) => {
  switch (appId) {
    case 'trello':
      const trelloConfig = await getTrelloConfig(uid);
      return trelloConfig?.isAuthorized || false;
    case 'linear':
      const linearConfig = await getLinearConfig(uid);
      return linearConfig?.isConfigured || false;
    case 'asana':
      const asanaConfig = await getAsanaConfig(uid);
      return asanaConfig?.isConfigured || false;
    default:
      return false;
  }
}; 