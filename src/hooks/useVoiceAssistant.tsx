import React, { useRef, useState, useEffect, useContext, createContext } from 'react';
import { AudioRecorder, sendAudioToBackend } from '@/utils/audioRecorder';
import Cookies from 'js-cookie';

const VoiceAssistantContext = createContext(null);

export function VoiceAssistantProvider({ children }) {
  const [selectedTool, setSelectedTool] = useState(null);
  const [platformConfig, setPlatformConfig] = useState(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState('Welcome! Start by speaking a command.');
  const [latestResponse, setLatestResponse] = useState('How can I help you today?');
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [recordingMode, setRecordingMode] = useState('batch');

  const recordingInterval = useRef(null);
  const audioRecorder = useRef(new AudioRecorder());

  const BASE_URL = "https://pushing-1.onrender.com";

  // Add a log entry
  const addLog = (type, message, options) => {
    let fullMessage = message;
    if (options?.errorDetails) {
      fullMessage += `\nDetails: ${options.errorDetails}`;
    }
    const newLog = {
      id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message: fullMessage,
      ...(options?.details ? { details: options.details } : {}),
    };
    setLogs(prev => [newLog, ...prev].slice(0, 50));
    // Update summary and latest response
    if (type === 'task') {
      setSummary(`Task: ${fullMessage}`);
      setLatestResponse(`Task ${fullMessage}`);
    } else if (type === 'success') {
      setSummary(fullMessage);
      setLatestResponse(fullMessage);
    } else if (type === 'error') {
      setSummary('There was an error: ' + fullMessage);
      setLatestResponse('Sorry, there was an error. ' + fullMessage);
    } else if (type === 'transcribed') {
      setLatestResponse(`You said: "${fullMessage}"`);
    }
  };

  // Start recording
  const startRecording = async () => {
    try {
      await audioRecorder.current.startRecording();
      setRecordingStatus('recording');
      setRecordingTime(0);
      addLog('info', 'Listening...', {});
      recordingInterval.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      addLog('error', 'Failed to start recording: ' + error.message, {});
    }
  };

  // Stop recording and process
  const stopRecording = async () => {
    try {
      const audioBlob = await audioRecorder.current.stopRecording();
      setRecordingStatus('idle');
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
        recordingInterval.current = null;
      }
      setRecordingTime(0);
      addLog('voice', 'Voice received', {});
      
      // Validate configuration before sending
      if (!platformConfig) {
        addLog('error', 'No platform configuration found. Please configure your credentials first.', {});
        return;
      }
      
      // Validate platform-specific credentials
      const platform = platformConfig?.platform || selectedTool;
      if (platform === 'trello') {
        if (!platformConfig.apiKey || platformConfig.apiKey === 'undefined') {
          addLog('error', 'Trello API key is missing. Please configure your Trello credentials.', {});
          return;
        }
        if (!platformConfig.boardId || platformConfig.boardId === 'undefined') {
          addLog('error', 'Trello board ID is missing. Please configure your Trello board ID.', {});
          return;
        }
        if (!platformConfig.token || platformConfig.token === 'undefined') {
          addLog('error', 'Trello token is missing. Please configure your Trello token.', {});
          return;
        }
      } else if (platform === 'linear') {
        if (!platformConfig.apiKey || platformConfig.apiKey === 'undefined') {
          addLog('error', 'Linear API key is missing. Please configure your Linear credentials.', {});
          return;
        }
        if (!platformConfig.workspaceId || platformConfig.workspaceId === 'undefined') {
          addLog('error', 'Linear workspace ID is missing. Please configure your Linear workspace ID.', {});
          return;
        }
      }
      
      // Send audio to backend
      try {
        const platform = platformConfig?.platform || selectedTool;
        console.log("🎯 Sending audio with config:", {
          platform,
          platformConfig,
          selectedTool,
          configKeys: platformConfig ? Object.keys(platformConfig) : [],
          configValues: platformConfig ? Object.values(platformConfig) : []
        });
        const res = await sendAudioToBackend(audioBlob, platform, platformConfig);
        let data;
        try {
          data = await res.json();
        } catch (e) {
          addLog('error', 'Failed to parse backend response as JSON', { errorDetails: e.message });
          return;
        }
        
        // Check if the response indicates an error
        if (data.success === false) {
          addLog('error', data.error || 'Backend returned an error', {});
          return;
        }
        
        if (data.transcript) {
          addLog('transcribed', data.transcript, {});
        }
        if (Array.isArray(data.results)) {
          data.results.forEach((result) => {
            if (result.success) {
              addLog('task', `${result.operation === 'create' ? 'created' : result.operation}` + (result.task ? `: ${result.task}` : ''), { details: { taskName: result.task, taskStatus: result.operation } });
            } else {
              addLog('error', `Task operation failed${result.task ? ` for: ${result.task}` : ''}`, { errorDetails: result.error });
            }
          });
        }
      } catch (error) {
        addLog('error', 'Failed to send audio', { errorDetails: error.message });
      }
    } catch (error) {
      addLog('error', 'Failed to stop recording', { errorDetails: error.message });
      setRecordingStatus('idle');
    }
  };

  // Process segment (for continuous mode)
  const processSegment = async () => {
    try {
      setRecordingStatus('processing');
      addLog('info', 'Processing audio segment...', {});
      const segmentBlob = await audioRecorder.current.processSegment();
      
      // Validate configuration before sending
      if (!platformConfig) {
        addLog('error', 'No platform configuration found. Please configure your credentials first.', {});
        return;
      }
      
      // Validate platform-specific credentials
      const platform = platformConfig?.platform || selectedTool;
      if (platform === 'trello') {
        if (!platformConfig.apiKey || platformConfig.apiKey === 'undefined') {
          addLog('error', 'Trello API key is missing. Please configure your Trello credentials.', {});
          return;
        }
        if (!platformConfig.boardId || platformConfig.boardId === 'undefined') {
          addLog('error', 'Trello board ID is missing. Please configure your Trello board ID.', {});
          return;
        }
        if (!platformConfig.token || platformConfig.token === 'undefined') {
          addLog('error', 'Trello token is missing. Please configure your Trello token.', {});
          return;
        }
      } else if (platform === 'linear') {
        if (!platformConfig.apiKey || platformConfig.apiKey === 'undefined') {
          addLog('error', 'Linear API key is missing. Please configure your Linear credentials.', {});
          return;
        }
        if (!platformConfig.workspaceId || platformConfig.workspaceId === 'undefined') {
          addLog('error', 'Linear workspace ID is missing. Please configure your Linear workspace ID.', {});
          return;
        }
      }
      
      // Send segment to backend
      try {
        console.log("🎯 Sending segment with config:", {
          platform,
          platformConfig,
          selectedTool,
          configKeys: platformConfig ? Object.keys(platformConfig) : [],
          configValues: platformConfig ? Object.values(platformConfig) : []
        });
        const res = await sendAudioToBackend(segmentBlob, platform, platformConfig, BASE_URL);
        let data;
        try {
          data = await res.json();
        } catch (e) {
          addLog('error', 'Failed to parse', { errorDetails: e.message });
          return;
        }
        
        // Check if the response indicates an error
        if (data.success === false) {
          addLog('error', data.error || 'Backend returned an error', {});
          return;
        }
        
        if (data.transcript) {
          addLog('transcribed', data.transcript, {});
        }
        if (Array.isArray(data.results)) {
          data.results.forEach((result) => {
            if (result.success) {
              addLog('task', `${result.operation === 'create' ? 'created' : result.operation}` + (result.task ? `: ${result.task}` : ''), { details: { taskName: result.task, taskStatus: result.operation } });
            } else {
              addLog('error', `Task operation failed${result.task ? ` for: ${result.task}` : ''}`, { errorDetails: result.error });
            }
          });
        }
      } catch (error) {
        addLog('error', 'Failed to send segment', { errorDetails: error.message });
      }
      setRecordingStatus('recording');
    } catch (error) {
      addLog('error', 'Failed to process segment', { errorDetails: error.message });
      setRecordingStatus('recording');
    }
  };

  // Tool/config management
  const handleConfigSave = (config) => {
    // Ensure platform is set in the config
    const configWithPlatform = {
      ...config,
      platform: config?.platform || selectedTool
    };
    setPlatformConfig(configWithPlatform);
    setIsConfigured(true);
    setShowConfigForm(false);
    const platformName = (configWithPlatform?.platform || selectedTool || '').toString();
    addLog('success', `${platformName.charAt(0).toUpperCase() + platformName.slice(1)} configuration saved successfully`, {});
  };
  const handleConfigCancel = () => {
    setShowConfigForm(false);
    if (!isConfigured) setSelectedTool(null);
  };

  // On mount, check for saved credentials
  useEffect(() => {
    const apiKey = Cookies.get('apiKey');
    const platform = Cookies.get('platform');
    
    // Clear invalid cookies
    if (apiKey === "undefined" || apiKey === "") {
      Cookies.remove('apiKey');
    }
    if (platform === "undefined" || platform === "") {
      Cookies.remove('platform');
    }
    
    if (apiKey && platform && apiKey !== "undefined") {
      if (platform === 'trello') {
        const token = Cookies.get('token');
        const boardId = Cookies.get('boardId');
        
        // Clear invalid Trello cookies
        if (token === "undefined" || token === "") {
          Cookies.remove('token');
        }
        if (boardId === "undefined" || boardId === "") {
          Cookies.remove('boardId');
        }
        
        if (token && boardId && token !== "undefined" && boardId !== "undefined") {
          setSelectedTool('trello');
          setIsConfigured(true);
          setPlatformConfig({ apiKey, token, boardId, platform: 'trello' });
          setShowConfigForm(false);
        } else {
          // Invalid Trello credentials, clear all Trello cookies
          Cookies.remove('apiKey');
          Cookies.remove('token');
          Cookies.remove('boardId');
          Cookies.remove('platform');
          setShowConfigForm(true);
        }
      } else if (platform === 'linear') {
        const workspaceId = Cookies.get('workspaceId');
        
        // Clear invalid Linear cookies
        if (workspaceId === "undefined" || workspaceId === "") {
          Cookies.remove('workspaceId');
        }
        
        if (workspaceId && workspaceId !== "undefined") {
          setSelectedTool('linear');
          setIsConfigured(true);
          setPlatformConfig({ apiKey, workspaceId, platform: 'linear' });
          setShowConfigForm(false);
        } else {
          // Invalid Linear credentials, clear all Linear cookies
          Cookies.remove('apiKey');
          Cookies.remove('workspaceId');
          Cookies.remove('platform');
          setShowConfigForm(true);
        }
      }
    } else {
      setShowConfigForm(true);
    }
    return () => {
      if (recordingInterval.current) clearInterval(recordingInterval.current);
    };
  }, []);

  return (
    <VoiceAssistantContext.Provider value={{
      selectedTool,
      setSelectedTool,
      platformConfig,
      setPlatformConfig,
      isConfigured,
      setIsConfigured,
      recordingStatus,
      recordingTime,
      logs,
      summary,
      latestResponse,
      showConfigForm,
      setShowConfigForm,
      recordingMode,
      setRecordingMode,
      startRecording,
      stopRecording,
      processSegment,
      handleConfigSave,
      handleConfigCancel,
    }}>
      {children}
    </VoiceAssistantContext.Provider>
  );
}

export function useVoiceAssistant() {
  return useContext(VoiceAssistantContext);
} 
