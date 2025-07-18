import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Mic, Square, RefreshCw, LogOut, ArrowLeft, CheckCircle, AlertTriangle, Info, MessageCircle, X, Trello, Notebook, Zap } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AudioRecorder, sendAudioToBackend } from '@/utils/audioRecorder';
import ConfigurationForm from './ConfigurationForm';
import Cookies from 'js-cookie';
import agilowLogo from '@/assets/agilow-logo.jpeg';
import linearLogo from '@/assets/linear-logo.svg';
import { supabase } from '../lib/supabase';
import { getCurrentUser, logout } from '../lib/firebaseAuth';
import { getTrelloConfig, getLinearConfig, getAsanaConfig, saveLinearConfig, saveAsanaConfig } from '../lib/firebaseUserConfig';

type ProjectTool = "trello" | "linear" | "asana" | "notion";
type RecordingMode = "batch" | "continuous";
type RecordingStatus = "idle" | "recording" | "processing";

interface LogEntry {
  id: string;
  timestamp: string;
  type: "info" | "success" | "warning" | "error" | "voice" | "transcribed" | "task" | "due-date";
  message: string;
  details?: {
    transcription?: string;
    taskName?: string;
    taskStatus?: string;
    dueDate?: string;
  };
}

interface TrelloConfig {
  apiKey: string;
  token: string;
  boardId: string;
}

interface LinearConfig {
  apiKey: string;
  workspaceId: string;
}

interface AsanaConfig {
  personalAccessToken: string;
  projectId: string;
}

type PlatformConfig = TrelloConfig | LinearConfig | AsanaConfig;

interface UnifiedDashboardProps {
  platform?: string;
}

const UnifiedDashboard = ({ platform }: UnifiedDashboardProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // State management
  const [selectedTool, setSelectedTool] = useState<ProjectTool | null>(null);
  const [recordingMode, setRecordingMode] = useState<RecordingMode>("batch");
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig | null>(null);
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);
  const [latestResponse, setLatestResponse] = useState('How can I help you today?');
  const [trelloBoards, setTrelloBoards] = useState<{id: string, name: string}[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [trelloBoardError, setTrelloBoardError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ username?: string; profile_picture?: string } | null>(null);

  // Refs
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);
  const audioRecorder = useRef<AudioRecorder>(new AudioRecorder());

  // Platform detection from props or navigation state
  useEffect(() => {
    const checkFirebaseConfigurations = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          navigate('/login');
          return;
        }

        // Use platform from props if available
        if (platform) {
          setSelectedTool(platform as ProjectTool);
          
          // Check Firebase configuration for the platform
          if (platform === 'trello') {
            const trelloConfig = await getTrelloConfig(user.uid);
            console.log("Loaded Trello config from Firebase:", trelloConfig);
            if (trelloConfig?.isAuthorized && trelloConfig.token) {
              setPlatformConfig({
                apiKey: import.meta.env.VITE_TRELLO_APP_KEY || '',
                token: trelloConfig.token,
                boardId: trelloConfig.boardId || ''
              });
              setIsConfigured(true);
              addLog("info", "Connected to Trello");
              return;
            }
          } else if (platform === 'linear') {
            const linearConfig = await getLinearConfig(user.uid);
            console.log("Loaded Linear config from Firebase:", linearConfig);
            if (linearConfig?.isConfigured && linearConfig.apiKey && linearConfig.workspaceId) {
              setPlatformConfig({
                apiKey: linearConfig.apiKey,
                workspaceId: linearConfig.workspaceId
              });
              setIsConfigured(true);
              addLog("info", "Connected to Linear");
              return;
            }
          } else if (platform === 'asana') {
            const asanaConfig = await getAsanaConfig(user.uid);
            console.log("Loaded Asana config from Firebase:", asanaConfig);
            if (asanaConfig?.isConfigured && asanaConfig.personalAccessToken && asanaConfig.projectId) {
              setPlatformConfig({
                personalAccessToken: asanaConfig.personalAccessToken,
                projectId: asanaConfig.projectId
              });
              setIsConfigured(true);
              addLog("info", "Connected to Asana");
              return;
            }
          }
        }

        // Fallback to navigation state
        const state = location.state as { platform?: string; token?: string; config?: any };
        if (state && state.platform) {
          setSelectedTool(state.platform as ProjectTool);
          if (state.config) {
            setPlatformConfig(state.config);
            setIsConfigured(true);
          }
          addLog("info", `Connected to ${state.platform.charAt(0).toUpperCase() + state.platform.slice(1)}`);
          return;
        }

        // Check localStorage for Linear/Asana config (legacy)
        const linearConfig = localStorage.getItem('linear_config');
        if (linearConfig) {
          try {
            const config = JSON.parse(linearConfig);
            setSelectedTool('linear');
            setPlatformConfig(config);
            setIsConfigured(true);
            addLog("info", "Connected to Linear");
            return;
          } catch (e) {
            console.error('Error parsing Linear config:', e);
          }
        }

        const asanaConfig = localStorage.getItem('asana_config');
        if (asanaConfig) {
          try {
            const config = JSON.parse(asanaConfig);
            setSelectedTool('asana');
            setPlatformConfig(config);
            setIsConfigured(true);
            addLog("info", "Connected to Asana");
            return;
          } catch (e) {
            console.error('Error parsing Asana config:', e);
          }
        }

        // Check cookies for legacy config
        const apiKey = Cookies.get("apiKey");
        const cookiePlatform = Cookies.get("platform") as ProjectTool;
        
        if (cookiePlatform) {
          if (cookiePlatform === "trello") {
            const token = Cookies.get("token");
            const boardId = Cookies.get("boardId");
            if (apiKey && token && boardId) {
              setSelectedTool("trello");
              setIsConfigured(true);
              setPlatformConfig({ apiKey, token, boardId });
              addLog("info", "Connected to Trello");
              return;
            }
          } else if (cookiePlatform === "linear") {
            const workspaceId = Cookies.get("workspaceId");
            if (apiKey && workspaceId) {
              setSelectedTool("linear");
              setIsConfigured(true);
              setPlatformConfig({ apiKey, workspaceId });
              addLog("info", "Connected to Linear");
              return;
            }
          } else if (cookiePlatform === "asana") {
            const personalAccessToken = Cookies.get("personalAccessToken");
            const projectId = Cookies.get("projectId");
            if (personalAccessToken && projectId) {
              setSelectedTool("asana");
              setIsConfigured(true);
              setPlatformConfig({ personalAccessToken, projectId });
              addLog("info", "Connected to Asana");
              return;
            }
          }
        }

        // No configuration found, show config form
        setShowConfigForm(true);
        addLog("info", "Voice Manager initialized - Please configure your platform");
      } catch (error) {
        console.error('Error checking Firebase configurations:', error);
        setShowConfigForm(true);
        addLog("info", "Voice Manager initialized - Please configure your platform");
      }
    };

    checkFirebaseConfigurations();
  }, [location, platform, navigate]);

  // Fetch Trello boards when Trello is selected and token is present
  useEffect(() => {
    const fetchBoards = async () => {
      if (selectedTool === 'trello' && platformConfig && 'token' in platformConfig && 'apiKey' in platformConfig) {
        try {
          console.log('Fetching Trello boards with:', platformConfig);
          const res = await fetch(`https://api.trello.com/1/members/me/boards?key=${platformConfig.apiKey}&token=${platformConfig.token}`);
          const boards = await res.json();
          console.log('Fetched boards:', boards);
          if (Array.isArray(boards)) {
            setTrelloBoards(boards.map((b: any) => ({ id: b.id, name: b.name })));
            setTrelloBoardError(null);
          } else if (boards.message) {
            setTrelloBoards([]);
            setTrelloBoardError(boards.message);
          } else {
            setTrelloBoards([]);
            setTrelloBoardError('Unknown error fetching boards');
          }
        } catch (e: any) {
          setTrelloBoards([]);
          setTrelloBoardError(e.message || 'Failed to fetch Trello boards');
          console.error('Error fetching Trello boards:', e);
        }
      } else {
        setTrelloBoards([]);
        setTrelloBoardError(null);
      }
    };
    fetchBoards();
  }, [selectedTool, platformConfig]);

  // Fetch user profile from Firestore (not Supabase)
  useEffect(() => {
    const fetchProfile = async () => {
      const user = await getCurrentUser();
      if (!user) return;
      // Fetch from Firestore
      const res = await fetch(`https://pushing-1.onrender.com/api/user-profile?uid=${user.uid}`); // Updated to use backend URL
      if (res.ok) {
        const data = await res.json();
        setUserProfile(data);
      } else {
        setUserProfile({ username: user.displayName || user.email, profile_picture: user.photoURL });
      }
    };
    fetchProfile();
  }, []);

  // Profile dropdown state
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const handleProfileClick = () => setShowProfileDropdown((v) => !v);
  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // When board is selected, update config and cookies
  const handleBoardSelect = (value: string) => {
    setSelectedBoardId(value);
    if (selectedTool === 'trello') {
      // Always build Trello config from cookies/localStorage
      const apiKey = Cookies.get('apiKey') || '';
      const token = Cookies.get('token') || localStorage.getItem('trello_token') || '';
      setPlatformConfig({ apiKey, token, boardId: value });
      Cookies.set('boardId', value, { expires: 365 * 50 });
    }
  };

  const addLog = (
    type: LogEntry["type"],
    message: string,
    options?: { details?: LogEntry["details"] }
  ) => {
    const newLog: LogEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      ...(options?.details ? { details: options.details } : {}),
    };
    
    setLogs((prev) => {
      const updatedLogs = [newLog, ...prev].slice(0, 50);
      return updatedLogs.sort((a, b) => {
        const timeA = new Date(`1970-01-01 ${a.timestamp}`).getTime();
        const timeB = new Date(`1970-01-01 ${b.timestamp}`).getTime();
        return timeB - timeA;
      });
    });
  };

  const startRecording = async () => {
    try {
      await audioRecorder.current.startRecording();
      setRecordingStatus("recording");
      setRecordingTime(0);
      addLog("info", `Listening...`);

      recordingInterval.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      addLog("error", "Failed to start recording: " + (error as Error).message);
    }
  };

  // Fetch Trello cards for the selected board
  const fetchTrelloCards = async (boardId: string) => {
    if (!platformConfig || !('apiKey' in platformConfig) || !('token' in platformConfig)) return;
    try {
      const res = await fetch(`https://api.trello.com/1/boards/${boardId}/cards?key=${platformConfig.apiKey}&token=${platformConfig.token}`);
      const cards = await res.json();
      // setTrelloCards(Array.isArray(cards) ? cards : []); // Removed Trello cards state
    } catch (e) {
      // setTrelloCards([]); // Removed Trello cards state
    }
  };

  // Fetch cards when board changes
  useEffect(() => {
    if (selectedTool === 'trello' && selectedBoardId) {
      fetchTrelloCards(selectedBoardId);
    }
  }, [selectedTool, selectedBoardId, platformConfig]);

  const stopRecording = async () => {
    try {
      const audioBlob = await audioRecorder.current.stopRecording();
      setRecordingStatus("idle");
      addLog("success", `Processing...`);

      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
        recordingInterval.current = null;
      }
      setRecordingTime(0);

      addLog("voice", "Voice received", {});

      // Send audio to backend with platform context
      try {
        let configToSend = platformConfig;
        
        // For Linear and Asana, use the Firebase configuration
        if (selectedTool === 'linear' || selectedTool === 'asana') {
          configToSend = platformConfig;
          console.log("About to send audio. Platform config:", configToSend);
        } else if (selectedTool === 'trello') {
          // Always build Trello config from cookies/localStorage before sending
          const apiKey = Cookies.get('apiKey') || '';
          const token = Cookies.get('token') || localStorage.getItem('trello_token') || '';
          const boardId = Cookies.get('boardId') || (platformConfig && 'boardId' in platformConfig ? (platformConfig as any).boardId : '');
          configToSend = { apiKey, token, boardId };
          console.log("About to send audio. Robust Trello config:", configToSend);
        }
        
        const res = await sendAudioToBackend(audioBlob, selectedTool, configToSend);
        let data = (res as any).data;
        
        if (data.transcript) {
          addLog("transcribed", `Transcribed: ${data.transcript}`);
          setLatestResponse(data.transcript);
        }
        
        if (Array.isArray(data.results)) {
          data.results.forEach((result) => {
            if (result.success) {
              addLog(
                "task",
                `Task ${result.operation === "create" ? "created" : result.operation}` + (result.task ? `: ${result.task}` : ""),
                { details: { taskName: result.task, taskStatus: result.operation } }
              );
            } else {
              addLog(
                "error",
                `Task operation failed${result.task ? ` for: ${result.task}` : ""}${result.error ? ` - ${result.error}` : ""}`
              );
            }
          });
        }
        // If Trello and a card was created, refetch cards and highlight
        if (selectedTool === 'trello' && selectedBoardId) {
          await fetchTrelloCards(selectedBoardId);
          // Try to find the new card by name in the transcript
          if (data && data.results && Array.isArray(data.results)) {
            const created = data.results.find((r: any) => r.success && r.operation === 'create' && r.task);
            if (created && created.task) {
              // Find the card by name
              // const newCard = trelloCards.find(card => card.name === created.task); // Removed Trello cards state
              // if (newCard) {
              //   setHighlightedCardId(newCard.id);
              //   setTimeout(() => setHighlightedCardId(null), 3000);
              // }
            }
          }
        }
      } catch (error) {
        addLog("error", "Failed to send audio: " + (error as Error).message);
      }
    } catch (error) {
      addLog("error", "Failed to stop recording: " + (error as Error).message);
      setRecordingStatus("idle");
    }
  };

  const handleToolChange = async (value: ProjectTool) => {
    setSelectedTool(value);
    
    try {
      const user = await getCurrentUser();
      if (!user) {
        setShowConfigForm(true);
        setIsConfigured(false);
        addLog('info', `Selected ${value.charAt(0).toUpperCase() + value.slice(1)}`);
        return;
      }

      // Check Firebase configuration first
      if (value === 'linear') {
        const linearConfig = await getLinearConfig(user.uid);
        if (linearConfig?.isConfigured && linearConfig.apiKey && linearConfig.workspaceId) {
          setPlatformConfig({
            apiKey: linearConfig.apiKey,
            workspaceId: linearConfig.workspaceId
          });
          setIsConfigured(true);
          setShowConfigForm(false);
          addLog('info', 'Loaded Linear config from Firebase');
          return;
        }
      } else if (value === 'asana') {
        const asanaConfig = await getAsanaConfig(user.uid);
        if (asanaConfig?.isConfigured && asanaConfig.personalAccessToken && asanaConfig.projectId) {
          setPlatformConfig({
            personalAccessToken: asanaConfig.personalAccessToken,
            projectId: asanaConfig.projectId
          });
          setIsConfigured(true);
          setShowConfigForm(false);
          addLog('info', 'Loaded Asana config from Firebase');
          return;
        }
      } else if (value === 'trello') {
        const trelloConfig = await getTrelloConfig(user.uid);
        if (trelloConfig?.isAuthorized && trelloConfig.token) {
          setPlatformConfig({
            apiKey: import.meta.env.VITE_TRELLO_APP_KEY || '',
            token: trelloConfig.token,
            boardId: trelloConfig.boardId || ''
          });
          setIsConfigured(true);
          setShowConfigForm(false);
          addLog('info', 'Loaded Trello config from Firebase');
          return;
        }
      }

      // Fallback to localStorage/cookies for legacy config
      if (value === 'linear') {
        const linearConfig = localStorage.getItem('linear_config');
        if (linearConfig) {
          setPlatformConfig(JSON.parse(linearConfig));
          setIsConfigured(true);
          setShowConfigForm(false);
          addLog('info', 'Loaded Linear config from localStorage');
          return;
        }
      } else if (value === 'asana') {
        const asanaConfig = localStorage.getItem('asana_config');
        if (asanaConfig) {
          setPlatformConfig(JSON.parse(asanaConfig));
          setIsConfigured(true);
          setShowConfigForm(false);
          addLog('info', 'Loaded Asana config from localStorage');
          return;
        }
      } else if (value === 'trello') {
        const apiKey = Cookies.get('apiKey');
        const token = Cookies.get('token');
        const boardId = Cookies.get('boardId');
        if (apiKey && token && boardId) {
          setPlatformConfig({ apiKey, token, boardId });
          setIsConfigured(true);
          setShowConfigForm(false);
          addLog('info', 'Loaded Trello config from cookies');
          return;
        }
      }
    } catch (error) {
      console.error('Error checking Firebase configuration:', error);
    }
    
    setShowConfigForm(true);
    setIsConfigured(false);
    addLog('info', `Selected ${value.charAt(0).toUpperCase() + value.slice(1)}`);
  };

  const handleConfigSave = async (config: PlatformConfig) => {
    try {
      console.log("Starting to save configuration:", { selectedTool, config });
      
      const user = await getCurrentUser();
      if (!user) {
        console.error("No user found");
        addLog("error", "You must be logged in to save configuration");
        return;
      }

      console.log("User found:", user.uid);

      // Save to Firebase
      if (selectedTool === 'linear') {
        const linearConfig = {
          apiKey: (config as LinearConfig).apiKey,
          workspaceId: (config as LinearConfig).workspaceId,
          isConfigured: true
        };
        console.log("Saving Linear config to Firebase:", linearConfig);
        await saveLinearConfig(user.uid, linearConfig);
        console.log("Linear config saved to Firebase successfully");
      } else if (selectedTool === 'asana') {
        const asanaConfig = {
          personalAccessToken: (config as AsanaConfig).personalAccessToken,
          projectId: (config as AsanaConfig).projectId,
          isConfigured: true
        };
        console.log("Saving Asana config to Firebase:", asanaConfig);
        await saveAsanaConfig(user.uid, asanaConfig);
        console.log("Asana config saved to Firebase successfully");
      }

      setPlatformConfig(config);
      setIsConfigured(true);
      setShowConfigForm(false);
      
      // Also save to localStorage for backward compatibility
      if (selectedTool === 'linear' || selectedTool === 'asana') {
        localStorage.setItem(`${selectedTool}_config`, JSON.stringify(config));
        console.log(`Config also saved to localStorage: ${selectedTool}_config`);
      }
      
      addLog("success", `${selectedTool?.charAt(0).toUpperCase() + selectedTool?.slice(1)} configuration saved successfully`);
      console.log("Configuration save completed successfully");
    } catch (error) {
      console.error('Error saving configuration:', error);
      addLog("error", "Failed to save configuration: " + (error as Error).message);
    }
  };

  const handleConfigCancel = () => {
    setShowConfigForm(false);
    if (!isConfigured) {
      setSelectedTool(null);
    }
  };

  const handleSwitchApp = () => {
    setShowSwitchConfirm(true);
  };

  const confirmSwitchApp = () => {
    // Only clear in-memory state and cookies, NOT localStorage configs
    Cookies.remove('apiKey');
    Cookies.remove('token');
    Cookies.remove('boardId');
    Cookies.remove('workspaceId');
    Cookies.remove('personalAccessToken');
    Cookies.remove('projectId');
    Cookies.remove('platform');
    
    setSelectedTool(null);
    setIsConfigured(false);
    setPlatformConfig(null);
    setShowSwitchConfirm(false);
    
    addLog("info", "Switched to different app");
    navigate('/select-app');
  };

  const cancelSwitchApp = () => {
    setShowSwitchConfirm(false);
  };

  const getStatusColor = () => {
    switch (recordingStatus) {
      case 'recording': return 'text-green-600';
      case 'processing': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getLogIcon = (type: LogEntry["type"]) => {
    switch (type) {
      case 'info': return <Info className="w-5 h-5 text-blue-500" />;
      case 'success': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'voice': return <Mic className="w-5 h-5 text-primary" />;
      case 'transcribed': return <MessageCircle className="w-5 h-5 text-accent" />;
      case 'task': return <CheckCircle className="w-5 h-5 text-primary" />;
      case 'due-date': return <Info className="w-5 h-5 text-blue-400" />;
      default: return <Info className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <>
      {/* Navbar/Header */}
      <div className="w-full bg-white/90 backdrop-blur border-b border-gray-200 shadow-sm mb-8 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={agilowLogo} alt="Agilow Logo" className="h-10 w-10 rounded-full shadow" />
            <span className="text-2xl font-bold text-blue-900">Agilow</span>
          </div>
          <div className="relative">
            <button onClick={handleProfileClick} className="focus:outline-none">
              <img
                src={userProfile?.profile_picture || 'https://ui-avatars.com/api/?name=User'}
                alt="Profile"
                className="h-10 w-10 rounded-full border-2 border-blue-200 shadow"
              />
            </button>
            {showProfileDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-50">
                <div className="px-4 py-3 border-b">
                  <div className="font-semibold">{userProfile?.username || 'User'}</div>
                </div>
                <button className="w-full text-left px-4 py-2 hover:bg-gray-100" onClick={() => { setShowProfileDropdown(false); alert('Profile page coming soon!'); }}>View Profile</button>
                <button className="w-full text-left px-4 py-2 hover:bg-gray-100 text-red-600" onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Main Content */}
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left: Controls */}
          <div className="col-span-1 space-y-8">
            {/* Workspace Card */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
              <h2 className="text-xl font-bold mb-2">Workspace</h2>
              {/* Board selection for Trello */}
              {selectedTool === 'trello' && isConfigured && trelloBoards.length > 0 && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Trello Board</label>
                  <Select value={selectedBoardId || ''} onValueChange={handleBoardSelect}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a board" />
                    </SelectTrigger>
                    <SelectContent>
                      {trelloBoards.map((board) => (
                        <SelectItem key={board.id} value={board.id}>{board.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {trelloBoardError && (
                    <div className="mt-2 text-sm text-red-500">{trelloBoardError}</div>
                  )}
                </div>
              )}
              {selectedTool === 'trello' && isConfigured && trelloBoards.length === 0 && (
                <div className="mt-4 text-sm text-gray-500">
                  No Trello boards found or unable to fetch boards.
                  {trelloBoardError && (
                    <div className="mt-2 text-sm text-red-500">{trelloBoardError}</div>
                  )}
                </div>
              )}
              {/* Debug info for Trello cards */}
              {selectedTool === 'trello' && (
                <div className="mt-2 text-xs text-gray-500">
                  Debug: selectedBoardId = {String(selectedBoardId)}, trelloCards.length = {/* Removed Trello cards state */}
                </div>
              )}
              {/* Render Trello cards if Trello is selected and a board is selected */}
              {selectedTool === 'trello' && selectedBoardId && (
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
                  <h2 className="text-xl font-bold mb-2">Trello Cards</h2>
                  {/* Removed Trello cards state */}
                  <div className="text-gray-500">No cards found for this board.</div>
                </div>
              )}
            </div>
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-blue-900">Recording Mode</h2>
                <Button variant="ghost" size="sm" onClick={handleSwitchApp} className="text-blue-900 font-semibold">
                  <RefreshCw className="w-5 h-5 mr-2" /> Switch App
                </Button>
              </div>
              
              {/* Platform Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
                <div className="flex items-center gap-2 py-2 px-3 bg-gray-100 rounded text-gray-700 font-medium">
                  {selectedTool === 'trello' && <Trello className="inline w-4 h-4 mr-2" />} 
                  {selectedTool === 'linear' && <img src={linearLogo} alt="Linear" className="inline w-4 h-4 mr-2" />} 
                  {selectedTool === 'asana' && <Notebook className="inline w-4 h-4 mr-2" />} 
                  {selectedTool ? selectedTool.charAt(0).toUpperCase() + selectedTool.slice(1) : 'None'}
                </div>
                {/* Edit Config button for Linear and Asana */}
                {selectedTool && isConfigured && (selectedTool === 'linear' || selectedTool === 'asana') && (
                  <Button
                    className="mt-2 w-full bg-blue-600 hover:bg-blue-700"
                    onClick={() => setShowConfigForm(true)}
                  >
                    Edit Config
                  </Button>
                )}
              </div>

              <div className="flex gap-4 mb-6">
                <Button
                  variant={recordingMode === 'batch' ? 'default' : 'outline'}
                  className={recordingMode === 'batch' ? 'bg-blue-900 text-white' : ''}
                  onClick={() => setRecordingMode('batch')}
                  disabled={recordingStatus === 'recording'}
                >
                  Batch
                </Button>
                <Button
                  variant={recordingMode === 'continuous' ? 'default' : 'outline'}
                  className={recordingMode === 'continuous' ? 'bg-blue-900 text-white' : ''}
                  onClick={() => setRecordingMode('continuous')}
                  disabled={recordingStatus === 'recording'}
                >
                  Continuous
                </Button>
              </div>
              
              <div className="mb-6">
                <Button
                  onClick={recordingStatus === 'idle' ? startRecording : stopRecording}
                  className={recordingStatus === 'idle' ? 'bg-blue-400 text-white w-full py-4 text-lg' : 'bg-red-500 text-white w-full py-4 text-lg'}
                  disabled={!isConfigured}
                >
                  {recordingStatus === 'idle' ? (
                    <><Mic className="w-6 h-6 inline-block mr-2" /> Start Recording</>
                  ) : (
                    <><Square className="w-6 h-6 inline-block mr-2" /> Stop Recording</>
                  )}
                </Button>
                {!isConfigured && (
                  <div className="mt-4 p-3 bg-yellow-100 text-yellow-800 rounded-lg text-center text-sm">
                    Please configure your project tool before recording.
                  </div>
                )}
              </div>
              
              <div className="space-y-2 text-blue-900 text-base">
                <div>Mode: <span className="font-semibold">{recordingMode.charAt(0).toUpperCase() + recordingMode.slice(1)}</span></div>
                <div>Tool: <span className="font-semibold">{selectedTool ? selectedTool.charAt(0).toUpperCase() + selectedTool.slice(1) : 'None'}</span></div>
                <div>Status: <span className={`font-semibold ${getStatusColor()}`}>{recordingStatus.charAt(0).toUpperCase() + recordingStatus.slice(1)}</span></div>
                <div>Configured: <span className="font-semibold">{isConfigured ? 'Yes' : 'No'}</span></div>
                {recordingStatus === 'recording' && (
                  <div>Recording Time: <span className="font-mono">{formatTime(recordingTime)}</span></div>
                )}
              </div>
            </div>
          </div>
          
          {/* Center: Voice Interface */}
          <div className="col-span-1 space-y-8">
            <div className="bg-white rounded-2xl shadow-lg p-6 h-full flex flex-col">
              <h2 className="text-2xl font-bold text-blue-900 mb-4">Voice Interface</h2>
              <div className="flex-1 flex flex-col justify-center items-center">
                {recordingStatus === 'idle' && <Info className="w-8 h-8 text-blue-400 mb-2" />}
                {recordingStatus === 'recording' && <Mic className="w-8 h-8 text-green-600 animate-pulse mb-2" />}
                {recordingStatus === 'processing' && <RefreshCw className="w-8 h-8 text-yellow-600 animate-spin mb-2" />}
                <div className="text-lg text-blue-900 font-semibold mb-2">
                  {recordingStatus === 'idle' && 'Ready to record'}
                  {recordingStatus === 'recording' && 'Recording...'}
                  {recordingStatus === 'processing' && 'Processing...'}
                </div>
                <div className="text-sm text-gray-600 text-center max-w-xs">
                  {latestResponse}
                </div>
              </div>
            </div>
          </div>
          
          {/* Right: Recent Actions */}
          <div className="col-span-1 space-y-8">
            <div className="bg-white rounded-2xl shadow-lg p-6 h-full">
              <h2 className="text-2xl font-bold text-blue-900 mb-4">Recent Actions</h2>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {logs.length === 0 && <div className="text-gray-400">No actions yet.</div>}
                {logs.map(log => (
                  <div key={log.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5">
                      {getLogIcon(log.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-500">{log.timestamp}</span>
                        {log.type === 'task' && log.details?.taskStatus && (
                          <Badge variant="outline" className="text-xs">
                            {log.details.taskStatus}
                          </Badge>
                        )}
                      </div>
                      <span className="text-gray-900">{log.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Configuration Modal */}
        {showConfigForm && selectedTool && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Configure {selectedTool.charAt(0).toUpperCase() + selectedTool.slice(1)}</h3>
                <Button variant="ghost" size="sm" onClick={handleConfigCancel}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <ConfigurationForm
                selectedTool={selectedTool}
                onConfigSave={handleConfigSave}
                onCancel={handleConfigCancel}
              />
            </div>
          </div>
        )}

        {/* Switch App Confirmation Modal */}
        {showSwitchConfirm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full text-center">
              <h3 className="text-xl font-bold mb-4">Switch App?</h3>
              <p className="mb-6">Are you sure you want to switch to a different app? Your current session will be cleared.</p>
              <div className="flex gap-4 justify-center">
                <Button onClick={confirmSwitchApp} className="bg-blue-900 text-white">Yes, Switch</Button>
                <Button onClick={cancelSwitchApp} variant="outline">Cancel</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UnifiedDashboard; 
