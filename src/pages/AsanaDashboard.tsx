import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { getCurrentUser, logout } from '@/lib/firebaseAuth';
import { getAsanaConfig, updateAsanaConfig } from '@/lib/firebaseUserConfig';
import { Loader2, AlertTriangle, FolderOpen, Mic, User, LogOut, Settings, Sparkles, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import VoiceManagerNew from '@/components/VoiceManagerNew';
import agilowLogo from '@/assets/agilow-logo.jpeg';

interface AsanaSection {
  name: string;
  tasks: string[];
}

interface AsanaProject {
  gid: string;
  name: string;
}

interface ActivityLogEntry {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

const AsanaDashboard = () => {
  const navigate = useNavigate();
  const [sections, setSections] = useState<AsanaSection[]>([]);
  const [projects, setProjects] = useState<AsanaProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [showProjectSelection, setShowProjectSelection] = useState(false);
  const [selectingProject, setSelectingProject] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [asanaToken, setAsanaToken] = useState<string>('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Add polling interval for live updates
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  const addActivityLog = useCallback((type: string, message: string) => {
    const newLog: ActivityLogEntry = {
      id: Date.now().toString(),
      type,
      message,
      timestamp: new Date().toLocaleTimeString(),
    };
    setActivityLog(prev => [newLog, ...prev.slice(0, 19)]); // Keep last 20 logs
  }, []);

  // Function to refresh project data
  const refreshProjectData = useCallback(async () => {
    if (!asanaToken || !selectedProject) return;
    
    try {
      setRefreshing(true);
      await loadProjectData(asanaToken, selectedProject);
      setLastRefresh(new Date());
      addActivityLog('refresh', 'Project data refreshed');
    } catch (error) {
      console.error('Error refreshing project data:', error);
      addActivityLog('error', 'Failed to refresh project data');
    } finally {
      setRefreshing(false);
    }
  }, [asanaToken, selectedProject, addActivityLog]);

  // Handle voice command completion
  const handleVoiceCommandComplete = useCallback(async () => {
    // Refresh data after voice command
    setTimeout(() => {
      refreshProjectData();
    }, 1000); // Small delay to ensure backend has processed the command
  }, [refreshProjectData]);

  // Handle voice command logs
  const handleVoiceLog = useCallback((type: string, message: string, options?: { details?: any }) => {
    addActivityLog(type, message);
    
    // If a task was created/updated/deleted, refresh the data
    if (type === 'task' || type === 'success') {
      handleVoiceCommandComplete();
    }
  }, [addActivityLog, handleVoiceCommandComplete]);

  // Handle task creation
  const handleTaskCreated = useCallback((taskName: string) => {
    addActivityLog('task_created', `Created task: ${taskName}`);
    handleVoiceCommandComplete();
  }, [addActivityLog, handleVoiceCommandComplete]);

  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          navigate('/login');
          return;
        }
        setUser(currentUser);

        const asanaConfig = await getAsanaConfig(currentUser.uid);
        console.log('Asana config from Firebase:', asanaConfig);
        
        if (!asanaConfig || !asanaConfig.personalAccessToken || !asanaConfig.isConfigured) {
          setError('Asana not configured. Please connect your Asana account.');
          setLoading(false);
          return;
        }

        setAsanaToken(asanaConfig.personalAccessToken);

        // Fetch projects
        await fetchProjects(asanaConfig.personalAccessToken);
        
        // If no project selected, show project selection
        if (!asanaConfig.projectId) {
          setShowProjectSelection(true);
          setLoading(false);
          return;
        }

        // Set selected project and load data
        setSelectedProject(asanaConfig.projectId);
        await loadProjectData(asanaConfig.personalAccessToken, asanaConfig.projectId);
        setLastRefresh(new Date());
      } catch (error) {
        console.error('Dashboard initialization error:', error);
        setError('Failed to initialize dashboard');
        setLoading(false);
      }
    };

    initializeDashboard();
  }, [navigate]);

  // Set up polling for live updates when project is selected
  useEffect(() => {
    if (selectedProject && asanaToken) {
      // Clear existing interval
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }

      // Set up new polling interval (refresh every 30 seconds)
      const interval = setInterval(() => {
        refreshProjectData();
      }, 30000);

      setPollingInterval(interval);

      // Cleanup on unmount or when dependencies change
      return () => {
        if (interval) {
          clearInterval(interval);
        }
      };
    }
  }, [selectedProject, asanaToken, refreshProjectData]);

  const fetchProjects = async (token: string) => {
    try {
      const user = await getCurrentUser();
      const params = new URLSearchParams({ 
        asanaToken: token,
        user_id: user?.uid || ''
      });
      const url = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/asana/projects?${params}`;
      console.log('Fetching Asana projects from URL:', url);
      const res = await fetch(url);
      console.log('Asana projects response status:', res.status);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Asana projects error response:', errorText);
        throw new Error(`Failed to fetch Asana projects: ${res.status} ${errorText}`);
      }
      const data = await res.json();
      console.log('Asana projects response data:', data);
      setProjects(data.projects || []);
    } catch (err: any) {
      console.error('Error fetching Asana projects:', err);
      setError('Failed to fetch Asana projects: ' + err.message);
    }
  };

  const loadProjectData = async (token: string, projectId: string) => {
    try {
      const params = new URLSearchParams({
        asanaToken: token,
        asanaProjectId: projectId,
      });
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/asana/project-data?${params}`);
      if (!res.ok) throw new Error('Failed to fetch Asana project data');
      const data = await res.json();
      
      // Group tasks by section
      const sectionMap: Record<string, string[]> = {};
      (data.sections || []).forEach((section: string) => {
        sectionMap[section] = [];
      });
      (data.tasks || []).forEach((task: string) => {
        // For demo, just put all tasks in the first section if sections exist
        const sectionName = data.sections && data.sections.length > 0 ? data.sections[0] : 'Tasks';
        if (!sectionMap[sectionName]) sectionMap[sectionName] = [];
        sectionMap[sectionName].push(task);
      });
      setSections(Object.entries(sectionMap).map(([name, tasks]) => ({ name, tasks })));
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load project data');
      setLoading(false);
    }
  };

  const handleProjectChange = async (projectId: string) => {
    try {
      console.log('Project selected:', projectId);
      setSelectingProject(true);
      const user = await getCurrentUser();
      if (!user) {
        setError('Not logged in');
        setSelectingProject(false);
        return;
      }
      const asanaConfig = await getAsanaConfig(user.uid);
      if (!asanaConfig) {
        setError('Asana config not found');
        setSelectingProject(false);
        return;
      }
      
      console.log('Saving project to Firebase:', projectId);
      // Save selected project to Firebase
      await updateAsanaConfig(user.uid, { projectId });
      setSelectedProject(projectId);
      
      console.log('Loading project data for:', projectId);
      // Load project data
      await loadProjectData(asanaConfig.personalAccessToken, projectId);
      setLastRefresh(new Date());
      addActivityLog('project_change', `Switched to project: ${projects.find(p => p.gid === projectId)?.name}`);
      console.log('Project change completed successfully');
      setShowProjectSelection(false);
    } catch (err: any) {
      console.error('Error changing project:', err);
      setError('Failed to change project: ' + err.message);
      setSelectingProject(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleSwitchApp = () => {
    navigate('/select-app');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-orange-100">
        <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 mx-auto bg-orange-100 rounded-full flex items-center justify-center mb-6">
              <Loader2 className="w-10 h-10 text-orange-600 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Loading Your Asana Project
            </h2>
            <p className="text-gray-600">
              Fetching your Asana sections and tasks...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showProjectSelection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-orange-100">
        <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 mx-auto bg-orange-100 rounded-full flex items-center justify-center mb-6">
              <FolderOpen className="w-10 h-10 text-orange-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Select Asana Project
            </h2>
            <p className="text-gray-600 mb-6">
              Choose which Asana project you'd like to view:
            </p>
            {projects.length === 0 ? (
              <div className="text-gray-500 mb-4">No projects found.</div>
            ) : (
              <div className="space-y-3 mb-4">
                {projects.map((project) => (
                  <Button
                    key={project.gid}
                    onClick={() => handleProjectChange(project.gid)}
                    className="w-full justify-start"
                    variant="outline"
                    disabled={selectingProject}
                  >
                    {selectingProject ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {project.name}
                  </Button>
                ))}
              </div>
            )}
            <Button 
              onClick={() => setShowProjectSelection(false)}
              variant="ghost"
              className="w-full"
            >
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-orange-100">
        <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Connection Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="space-y-3">
              <AlertTriangle className="w-8 h-8 text-orange-600 mx-auto" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <img src={agilowLogo} alt="Agilow" className="h-8 w-8 rounded" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Agilow Dashboard</h1>
                <p className="text-sm text-gray-600">Connected to Asana</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-700">{user?.displayName || user?.email}</span>
              </div>
              <Button onClick={handleSwitchApp} variant="outline" size="sm">
                Switch App
              </Button>
              <Button onClick={handleLogout} variant="outline" size="sm">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Project Selection and Sections */}
          <div className="lg:col-span-2 space-y-6">
            {/* Project Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FolderOpen className="h-5 w-5" />
                  <span>Select Project</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">Choose a project to work with:</p>
                <div className="flex items-center space-x-4">
                  <Select value={selectedProject} onValueChange={handleProjectChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.gid} value={project.gid}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Asana Sections */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Asana Sections</CardTitle>
                  <div className="flex items-center gap-3">
                    {lastRefresh && (
                      <span className="text-xs text-gray-500">
                        Last updated: {lastRefresh.toLocaleTimeString()}
                      </span>
                    )}
                    <Button
                      onClick={refreshProjectData}
                      disabled={refreshing}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      {refreshing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Refresh
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {refreshing && (
                  <div className="flex items-center justify-center py-4 mb-4">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    <span className="text-sm text-gray-600">Refreshing data...</span>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {sections.map((section) => (
                    <div key={section.name} className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-medium text-gray-900 mb-3">{section.name}</h3>
                      {section.tasks.length === 0 ? (
                        <p className="text-gray-400 text-sm">No tasks in this section.</p>
                      ) : (
                        <div className="space-y-2">
                          {section.tasks.map((task, idx) => (
                            <div key={idx} className="bg-white rounded p-3 text-sm text-gray-900 shadow-sm">
                              {task}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Voice Commands and Activity Log */}
          <div className="space-y-6">
            {/* Voice Commands */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Mic className="h-5 w-5" />
                  <span>Voice Commands</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-4">
                    Connected to Asana • Project: {projects.find(p => p.gid === selectedProject)?.name || 'None'}
                  </p>
                  <div className="flex items-center justify-center space-x-2 mb-4">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">Ready</span>
                  </div>
                  <VoiceManagerNew 
                    platform="asana"
                    onTaskCreated={handleTaskCreated}
                    onLog={handleVoiceLog}
                    onProcessingComplete={handleVoiceCommandComplete}
                  />
                  <div className="mt-4">
                    <Button variant="outline" size="sm">
                      Batch Mode
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Activity Log */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <Sparkles className="h-5 w-5" />
                    <span>Activity Log</span>
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {activityLog.length} entries
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {activityLog.length === 0 ? (
                  <p className="text-gray-500 text-sm">No actions yet.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {activityLog.map((log) => (
                      <div key={log.id} className="text-sm border-l-2 border-gray-200 pl-3 py-1">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-xs font-mono">{log.timestamp}</span>
                          {log.type === 'task' && (
                            <Badge variant="outline" className="text-xs">
                              Task
                            </Badge>
                          )}
                          {log.type === 'error' && (
                            <Badge variant="destructive" className="text-xs">
                              Error
                            </Badge>
                          )}
                          {log.type === 'success' && (
                            <Badge variant="default" className="text-xs bg-green-500">
                              Success
                            </Badge>
                          )}
                        </div>
                        <span className="text-gray-900 block mt-1">{log.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AsanaDashboard; 