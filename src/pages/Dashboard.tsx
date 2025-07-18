import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useLocation, useNavigate } from 'react-router-dom';
import { Trello, Loader2, Mic, Settings, LogOut, User, Calendar, Tag, CheckCircle, Info, AlertTriangle, Sparkles } from 'lucide-react';
import VoiceManagerNew from '@/components/VoiceManagerNew';
import { Label } from '@/components/ui/label';
import UnifiedDashboard from '@/components/UnifiedDashboard';
import { getCurrentUser, logout } from '@/lib/firebaseAuth';
import { 
  getTrelloConfig, 
  getLinearConfig, 
  getAsanaConfig,
  getUserProfile,
  saveUserAuthState
} from '@/lib/firebaseUserConfig';
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import agilowLogo from '@/assets/agilow-logo.jpeg';
import AsanaDashboard from './AsanaDashboard';

interface TrelloBoard {
  id: string;
  name: string;
  url: string;
  lists: TrelloList[];
}

interface TrelloList {
  id: string;
  name: string;
  cards: TrelloCard[];
}

interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  due: string | null;
  labels: any[];
  shortUrl?: string; // Added for direct link
  shortLink?: string; // Added for direct link
  idList: string; // Add this property for the list/column id
}

const Dashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [platform, setPlatform] = useState<string>('');
  const [boards, setBoards] = useState<TrelloBoard[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [trelloBoardError, setTrelloBoardError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  // Add Trello cards state
  const [trelloCards, setTrelloCards] = useState<TrelloCard[]>([]);
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);
  // Add a log state for activity log entries
  const [activityLog, setActivityLog] = useState<any[]>([]);
  // Add state for Trello lists and expanded lists
  const [trelloLists, setTrelloLists] = useState<any[]>([]);
  const [expandedLists, setExpandedLists] = useState<{ [listId: string]: boolean }>({});
  // Add state for card preview modal
  const [previewCard, setPreviewCard] = useState<any | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          navigate('/login');
          return;
        }
        setUser(currentUser);

        // Save authentication state
        await saveUserAuthState(currentUser.uid, true);

        // Get user profile
        const profile = await getUserProfile(currentUser.uid);
        setUserProfile(profile);

        // Check platform from location state or determine from configurations
        const platformFromState = location.state?.platform;
        if (platformFromState) {
          setPlatform(platformFromState);
          if (platformFromState === 'trello') {
            await loadTrelloConfiguration(currentUser.uid);
          } else {
            setIsLoading(false);
          }
        } else {
          // No platform specified, check existing configurations
          await checkExistingConfigurations(currentUser.uid);
        }
      } catch (error) {
        console.error('Dashboard initialization error:', error);
        setError('Failed to initialize dashboard');
        setIsLoading(false);
      }
    };

    initializeDashboard();
  }, [location, navigate]);

  const checkExistingConfigurations = async (uid: string) => {
    try {
      // Check which platforms are configured
      const trelloConfig = await getTrelloConfig(uid);
      const linearConfig = await getLinearConfig(uid);
      const asanaConfig = await getAsanaConfig(uid);

      if (trelloConfig?.isAuthorized) {
        setPlatform('trello');
        await loadTrelloConfiguration(uid);
      } else if (linearConfig?.isConfigured) {
        setPlatform('linear');
        setIsLoading(false);
      } else if (asanaConfig?.isConfigured) {
        setPlatform('asana');
        setIsLoading(false);
      } else {
        // No configuration found, redirect to app selection
        navigate('/select-app');
      }
    } catch (error) {
      console.error('Error checking configurations:', error);
      setError('Failed to load configurations');
      setIsLoading(false);
    }
  };

  const loadTrelloConfiguration = async (uid: string) => {
    try {
      const trelloConfig = await getTrelloConfig(uid);
      if (trelloConfig?.isAuthorized && trelloConfig.token) {
        await fetchTrelloBoards(trelloConfig.token);
      } else {
        setError('Trello configuration not found. Please re-authorize.');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error loading Trello configuration:', error);
      setError('Failed to load Trello configuration');
      setIsLoading(false);
    }
  };

  const fetchTrelloBoards = async (token: string) => {
    try {
      setIsLoading(true);
      setError('');
      setTrelloBoardError(null);
      const apiKey = import.meta.env.VITE_TRELLO_APP_KEY;
      
      if (!apiKey || !token) {
        setTrelloBoardError('Missing Trello API key or token. Please re-authorize.');
        setBoards([]);
        return;
      }
      
      console.log('Fetching Trello boards with:', { apiKey, token });
      const response = await fetch(`https://api.trello.com/1/members/me/boards?key=${apiKey}&token=${token}&lists=open`);
      const boardsData = await response.json();
      console.log('Fetched boards:', boardsData);
      
      if (!response.ok) {
        setTrelloBoardError(boardsData.message || 'Failed to fetch Trello boards');
        throw new Error(boardsData.message || 'Failed to fetch Trello boards');
      }
      
      // Transform the data to match our interface
      const transformedBoards: TrelloBoard[] = boardsData.map((board: any) => ({
        id: board.id,
        name: board.name,
        url: board.url,
        lists: board.lists || []
      }));
      
      setBoards(transformedBoards);
      if (transformedBoards.length > 0) {
        setSelectedBoard(transformedBoards[0].id);
      }
    } catch (err: any) {
      setError('Failed to load your Trello boards. Please try again.');
      setTrelloBoardError(err.message || 'Failed to fetch Trello boards');
      console.error('Error fetching Trello boards:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Trello cards for the selected board
  const fetchTrelloCards = async (boardId: string) => {
    try {
      const trelloConfig = await getTrelloConfig(user?.uid);
      if (!trelloConfig || !trelloConfig.token) return;
      const apiKey = import.meta.env.VITE_TRELLO_APP_KEY;
      const res = await fetch(`https://api.trello.com/1/boards/${boardId}/cards?key=${apiKey}&token=${trelloConfig.token}`);
      const cards = await res.json();
      setTrelloCards(Array.isArray(cards) ? cards : []);
    } catch (e) {
      setTrelloCards([]);
    }
  };

  // Fetch cards when board changes
  useEffect(() => {
    if (platform === 'trello' && selectedBoard) {
      fetchTrelloCards(selectedBoard);
    }
    // eslint-disable-next-line
  }, [platform, selectedBoard, user]);

  // Fetch Trello lists and group cards by list when selectedBoard or trelloCards change
  useEffect(() => {
    const fetchListsAndGroupCards = async () => {
      if (!selectedBoard || !user) return;
      const trelloConfig = await getTrelloConfig(user.uid);
      if (!trelloConfig || !trelloConfig.token) return;
      const apiKey = import.meta.env.VITE_TRELLO_APP_KEY;
      // Fetch lists
      const listsRes = await fetch(`https://api.trello.com/1/boards/${selectedBoard}/lists?key=${apiKey}&token=${trelloConfig.token}`);
      const lists = await listsRes.json();
      // Group cards by list
      const grouped = lists.map((list: any) => ({
        ...list,
        cards: trelloCards.filter(card => card.idList === list.id)
      }));
      setTrelloLists(grouped);
    };
    fetchListsAndGroupCards();
  }, [selectedBoard, trelloCards, user]);

  // Handler to toggle list expansion
  const toggleList = (listId: string) => {
    setExpandedLists(prev => ({ ...prev, [listId]: !prev[listId] }));
  };

  // Helper to highlight a card by name (call after a create operation)
  const highlightCardByName = (cardName: string) => {
    const newCard = trelloCards.find(card => card.name === cardName);
    if (newCard) {
      setHighlightedCardId(newCard.id);
      setTimeout(() => setHighlightedCardId(null), 3000);
    }
  };

  // Helper to add a log entry, optionally with a Trello card
  const addActivityLog = (type: string, message: string, card?: TrelloCard) => {
    setActivityLog(prev => [
      {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        type,
        message,
        card,
      },
      ...prev
    ].slice(0, 50));
  };

  // Example: After a successful Trello card creation, find the card and log it
  const handleTaskCreated = async (taskName: string) => {
    const card = trelloCards.find(card => card.name === taskName);
    addActivityLog('card-created', `Card created: ${taskName}`, card);
    if (card) {
      toast.success('Card Created', {
        description: `"${card.name}" was created successfully!`,
        icon: <CheckCircle className="text-green-500" />
      });
    } else {
      toast.success('Task Created', {
        description: `"${taskName}" was created successfully!`,
        icon: <CheckCircle className="text-green-500" />
      });
    }
    // Real-time update: refetch cards
    if (selectedBoard) await fetchTrelloCards(selectedBoard);
  };

  const handleLogout = async () => {
    try {
      if (user) {
        await saveUserAuthState(user.uid, false);
      }
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      // Still redirect even if logout fails
      navigate('/');
    }
  };

  const handleBoardChange = (boardId: string) => {
    setSelectedBoard(boardId);
  };

  const handleSwitchApp = () => {
    navigate('/select-app');
  };

  // Add a new addLog function in Dashboard:
  const logTypeMap = {
    'card-created': { icon: <CheckCircle className="w-4 h-4 text-green-500" />, label: 'Card Created' },
    'task': { icon: <Sparkles className="w-4 h-4 text-blue-500" />, label: 'AI Task' },
    'transcribed': { icon: <Info className="w-4 h-4 text-purple-500" />, label: 'Transcription' },
    'info': { icon: <Info className="w-4 h-4 text-blue-400" />, label: 'Info' },
    'error': { icon: <AlertTriangle className="w-4 h-4 text-red-500" />, label: 'Error' },
    'success': { icon: <CheckCircle className="w-4 h-4 text-green-500" />, label: 'Success' },
    'warning': { icon: <AlertTriangle className="w-4 h-4 text-yellow-500" />, label: 'Warning' },
  };
  const addLog = (type: string, message: string, options?: { details?: any }) => {
    let detailedMessage = message;
    if (type === 'info' && message.startsWith('Will perform:')) {
      // If there are details about the operations, add them
      if (options && options.details && options.details.operations) {
        const opDetails = options.details.operations.map((op: any) => `${op.operation}: ${op.task || ''}`).join(', ');
        detailedMessage = `${message} (${opDetails})`;
      }
    }
    // Filter out 'User sees the transcription' log
    if (type === 'info' && message === 'User sees the transcription') return;
    setActivityLog(prev => [
      {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        type,
        message: detailedMessage,
        ...options,
      },
      ...prev
    ].slice(0, 50));
    if (type === 'error') {
      toast.error('Error', {
        description: message,
        icon: <AlertTriangle className="text-red-500" />
      });
    }
  };

  // 3. Add edit & resend transcription feature
  const [editTranscript, setEditTranscript] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleEditTranscription = (transcript: string) => {
    setEditTranscript(transcript);
    setIsEditModalOpen(true);
  };

  const handleResendTranscription = async () => {
    if (!editTranscript) return;
    setIsSending(true);
    setIsEditModalOpen(false); // Close modal immediately
    // Add log for updated transcription and processing
    addLog('transcribed', `Transcription updated: ${editTranscript}`);
    addLog('info', 'Processing updated transcription...');
    try {
      let payload: any = { transcript: editTranscript, platform, boardId: selectedBoard };
      if (platform === 'trello') {
        const user = await getCurrentUser();
        if (!user) throw new Error('User not logged in');
        const trelloConfig = await getTrelloConfig(user.uid);
        if (!trelloConfig || !trelloConfig.token) throw new Error('Trello credentials not found');
        const apiKey = import.meta.env.VITE_TRELLO_APP_KEY;
        payload.apiKey = apiKey;
        payload.token = trelloConfig.token;
        payload.boardId = selectedBoard || trelloConfig.boardId;
      }
      console.log("Sending to /send-transcript:", payload);
      const res = await fetch('http://localhost:8000/send-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Transcription Processed', {
          description: 'Transcription resent and processed!',
          icon: <Sparkles className="text-blue-500" />
        });
        // Add logs for backend response, similar to voice commands
        if (data.transcript) {
          addLog('transcribed', `Transcribed: ${data.transcript}`);
        }
        if (Array.isArray(data.results)) {
          data.results.forEach((result) => {
            if (result.success) {
              addLog(
                'task',
                `Task ${result.operation === 'create' ? 'created' : result.operation}` + (result.task ? `: ${result.task}` : ''),
                { details: { taskName: result.task, taskStatus: result.operation } }
              );
            } else {
              addLog(
                'error',
                `Task operation failed${result.task ? ` for: ${result.task}` : ''}${result.error ? ` - ${result.error}` : ''}`
              );
            }
          });
        }
        if (selectedBoard) await fetchTrelloCards(selectedBoard);
      } else {
        addLog('error', data.error || 'Failed to process transcription');
        toast.error('Transcription Error', {
          description: data.error || 'Failed to process transcription',
          icon: <AlertTriangle className="text-red-500" />
        });
      }
    } catch (e: any) {
      addLog('error', e.message || 'Failed to send transcription');
      toast.error('Network Error', {
        description: e.message || 'Failed to send transcription',
        icon: <AlertTriangle className="text-red-500" />
      });
    }
    setIsSending(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-6">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Loading Your Workspace
            </h2>
            <p className="text-gray-600">
              {platform === 'trello' ? 'Fetching your Trello boards...' : 'Setting up your workspace...'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-6">
        <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Connection Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="space-y-3">
              <Button onClick={() => navigate('/select-app')} className="bg-blue-600 hover:bg-blue-700">
                Reconnect Account
              </Button>
              <Button onClick={handleLogout} variant="outline" className="text-gray-600">
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (platform === 'asana') {
    return (
      <AsanaDashboard />
    );
  }

  if (platform !== 'trello') {
    return (
      <UnifiedDashboard platform={platform} />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white shadow border border-gray-200 overflow-hidden">
                <img src={agilowLogo} alt="Agilow Logo" className="w-9 h-9 object-contain" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Agilow Dashboard</h1>
                <p className="text-sm text-gray-500">Connected to Trello</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {userProfile && (
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                  <span className="text-sm text-gray-700">{userProfile.username || user?.email}</span>
                </div>
              )}
              <Button
                variant="outline"
                onClick={handleSwitchApp}
                className="text-gray-600"
              >
                Switch App
              </Button>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="text-gray-600"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Board Selection */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Trello className="w-5 h-5" />
                  <span>Select Board</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {trelloBoardError ? (
                  <div className="text-red-600 text-sm mb-4">{trelloBoardError}</div>
                ) : (
                  <div className="space-y-3">
                    <Label htmlFor="board-select">Choose a board to work with:</Label>
                    <Select value={selectedBoard} onValueChange={handleBoardChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a board" />
                      </SelectTrigger>
                      <SelectContent>
                        {boards.map((board) => (
                          <SelectItem key={board.id} value={board.id}>
                            {board.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>
            {platform === 'trello' && trelloLists.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6 mb-4 mt-4">
                <h2 className="text-xl font-bold mb-2">Trello Board Columns</h2>
                <ul className="space-y-2">
                  {trelloLists.map(list => (
                    <li key={list.id}>
                      <button
                        className="w-full text-left font-semibold text-blue-800 hover:underline focus:outline-none flex items-center justify-between"
                        onClick={() => toggleList(list.id)}
                      >
                        {list.name}
                        <span className="ml-2">{expandedLists[list.id] ? '▲' : '▼'}</span>
                      </button>
                      {expandedLists[list.id] && (
                        <ul className="pl-4 mt-2 space-y-2">
                          {list.cards.length === 0 ? (
                            <li className="text-gray-400">No cards in this column.</li>
                          ) : (
                            list.cards.map((card: any) => (
                              <li key={card.id} className="p-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition flex flex-col gap-2 relative">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-900 text-base">{card.name}</span>
                                  {card.labels && card.labels.length > 0 && (
                                    <span className="flex gap-1">
                                      {card.labels.map((label: any) => (
                                        <span key={label.id} className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `#${label.color || 'e2e8f0'}`, color: '#fff' }}>{label.name || <Tag className="w-3 h-3" />}</span>
                                      ))}
                                    </span>
                                  )}
                                </div>
                                {card.desc && <div className="text-sm text-gray-600 line-clamp-2">{card.desc}</div>}
                                {card.due && <div className="flex items-center gap-1 text-xs text-blue-600"><Calendar className="w-3 h-3" /> {new Date(card.due).toLocaleString()}</div>}
                                <div className="flex gap-2 mt-1">
                                  <a
                                    href={card.shortUrl || `https://trello.com/c/${card.shortLink}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:underline text-xs"
                                  >
                                    View in Trello
                                  </a>
                                  <button
                                    className="text-xs text-white bg-blue-600 hover:bg-blue-700 rounded px-2 py-1"
                                    onClick={() => { setPreviewCard(card); setIsPreviewOpen(true); }}
                                  >
                                    Show Card
                                  </button>
                                </div>
                              </li>
                            ))
                          )}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
                {/* Card Preview Modal */}
                <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                  <DialogContent className="max-w-lg p-0 overflow-hidden">
                    <DialogTitle>Card Preview</DialogTitle>
                    <DialogDescription>Preview details of your Trello card.</DialogDescription>
                    {previewCard && (
                      <>
                        <div className="bg-blue-600 px-6 py-4 text-white flex items-center gap-2">
                          <Trello className="w-5 h-5" />
                          <span className="font-bold text-lg">{previewCard.name}</span>
                        </div>
                        <div className="p-6">
                          {previewCard.labels && previewCard.labels.length > 0 && (
                            <div className="mb-2 flex gap-2 flex-wrap">
                              {previewCard.labels.map((label: any) => (
                                <span key={label.id} className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `#${label.color || 'e2e8f0'}`, color: '#fff' }}>{label.name || <Tag className="w-3 h-3" />}</span>
                              ))}
                            </div>
                          )}
                          {previewCard.desc && <div className="mb-2 text-gray-700 text-sm">{previewCard.desc}</div>}
                          {previewCard.due && <div className="flex items-center gap-1 text-xs text-blue-600 mb-2"><Calendar className="w-3 h-3" /> {new Date(previewCard.due).toLocaleString()}</div>}
                          <a
                            href={previewCard.shortUrl || `https://trello.com/c/${previewCard.shortLink}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline text-xs mt-1 inline-block"
                          >
                            View in Trello
                          </a>
                        </div>
                        <DialogFooter className="bg-gray-50 px-6 py-3 flex justify-end">
                          <button
                            className="text-xs text-gray-600 bg-gray-200 hover:bg-gray-300 rounded px-3 py-1"
                            onClick={() => setIsPreviewOpen(false)}
                          >
                            Close
                          </button>
                        </DialogFooter>
                      </>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>

          {/* Voice Manager */}
          <div className="lg:col-span-2">
            <VoiceManagerNew 
              platform={platform} 
              selectedBoard={selectedBoard} 
              boards={boards}
              onTaskCreated={handleTaskCreated}
              onLog={addLog}
            />
            {/* Activity Log UI moved here */}
            <div className="bg-white rounded-2xl shadow-lg p-6 h-full mt-6">
              <h2 className="text-2xl font-bold text-blue-900 mb-4">Activity Log</h2>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {activityLog.length === 0 && <div className="text-gray-400">No actions yet.</div>}
                {activityLog.map((log, idx) => {
                  const logType = logTypeMap[log.type] || { icon: <Info className="w-4 h-4 text-gray-400" />, label: 'Activity' };
                  const isLastTranscription = log.type === 'transcribed' && idx === activityLog.findIndex(l => l.type === 'transcribed');
                  return (
                    <div key={log.id} className="flex flex-col gap-1 text-sm border-b pb-2 last:border-b-0">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5">{logType.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-gray-500">{log.timestamp}</span>
                            <span className="font-semibold text-blue-800">{logType.label}</span>
                            {/* Edit & Resend button for last transcription */}
                            {isLastTranscription && (
                              <button
                                className="ml-2 text-xs text-blue-600 hover:underline"
                                onClick={() => handleEditTranscription(log.message.replace('Transcribed: ', ''))}
                              >
                                Edit & Resend
                              </button>
                            )}
                          </div>
                          <span className="text-gray-900">{log.message}</span>
                          {/* Show details if present */}
                          {log.details && (
                            <div className="mt-1 text-xs text-gray-500">
                              {log.details.transcription && (
                                <p><span className="font-medium">Transcription:</span> {log.details.transcription}</p>
                              )}
                              {log.details.taskName && (
                                <p><span className="font-medium">Task:</span> {log.details.taskName}</p>
                              )}
                              {log.details.taskStatus && (
                                <p><span className="font-medium">Status:</span> {log.details.taskStatus}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Mini card preview if card is attached */}
                      {log.card && (
                        <div className="ml-8 mt-1 p-3 bg-blue-50 border border-blue-200 rounded-lg shadow-sm">
                          <div className="font-semibold text-gray-900">{log.card.name}</div>
                          {log.card.desc && <div className="text-sm text-gray-600">{log.card.desc}</div>}
                          {log.card.due && <div className="flex items-center gap-1 text-xs text-blue-600"><Calendar className="w-3 h-3" /> {new Date(log.card.due).toLocaleString()}</div>}
                          <a
                            href={log.card.shortUrl || `https://trello.com/c/${log.card.shortLink}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline text-xs mt-1 inline-block"
                          >
                            View in Trello
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Add the edit modal JSX at the end of the file */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden shadow-2xl rounded-2xl border border-gray-200">
          <div className="bg-gradient-to-r from-blue-600 to-blue-400 px-6 py-5 text-white flex items-center gap-2 rounded-t-2xl">
            <span className="font-bold text-xl tracking-wide">Edit & Resend Transcription</span>
          </div>
          <div className="p-8 bg-white">
            <DialogDescription className="mb-4 text-gray-600 text-base">You can edit the transcript and resend it for processing.</DialogDescription>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-4 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm resize-vertical min-h-[100px] bg-gray-50"
              rows={4}
              value={editTranscript || ''}
              onChange={e => setEditTranscript(e.target.value)}
              disabled={isSending}
              placeholder="Edit your transcription here..."
              style={{ minHeight: 100, fontFamily: 'inherit' }}
            />
          </div>
          <DialogFooter className="bg-gray-50 px-8 py-4 flex justify-end gap-2 rounded-b-2xl border-t border-gray-200">
            <button
              className="text-sm text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg px-4 py-2 font-medium transition"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSending}
            >
              Cancel
            </button>
            <button
              className="text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2 font-semibold shadow-md transition"
              onClick={handleResendTranscription}
              disabled={isSending}
            >
              {isSending ? 'Resending...' : 'Resend'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard; 