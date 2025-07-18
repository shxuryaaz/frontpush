import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Play, CircleStop, Trello, Notebook, Zap, List, Mic } from "lucide-react";
import ConfigurationForm from "./ConfigurationForm";
import { AudioRecorder, sendAudioToBackend } from "../utils/audioRecorder";
import logo from "../assets/agilow-logo.jpeg";
import linearLogo from "../assets/linear-logo.svg";
import { supabase } from '../lib/supabase';

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

const VoiceManager = () => {
  const [selectedTool, setSelectedTool] = useState<ProjectTool | null>(null);
  const [recordingMode, setRecordingMode] = useState<RecordingMode>("batch");
  const [recordingStatus, setRecordingStatus] =
    useState<RecordingStatus>("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig | null>(null);

  const recordingInterval = useRef<NodeJS.Timeout | null>(null);
  const audioRecorder = useRef<AudioRecorder>(new AudioRecorder());

  const addLog = (
    type: LogEntry["type"],
    message: string,
    options?: { details?: LogEntry["details"] }
  ) => {
    const newLog: LogEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9), // More unique ID
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      ...(options?.details ? { details: options.details } : {}),
    };
    setLogs((prev) => {
      const updatedLogs = [newLog, ...prev].slice(0, 50);
      // Ensure logs are always sorted by timestamp descending (newest first)
      return updatedLogs.sort((a, b) => {
        const timeA = new Date(`1970-01-01 ${a.timestamp}`).getTime();
        const timeB = new Date(`1970-01-01 ${b.timestamp}`).getTime();
        return timeB - timeA; // Descending order
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

  const stopRecording = async () => {
    try {
      const audioBlob = await audioRecorder.current.stopRecording();
      setRecordingStatus("idle");
      addLog(
        "success",
        `Processing...`
      );

      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
        recordingInterval.current = null;
      }
      setRecordingTime(0);

      // Add log: Voice received
      addLog("voice", "Voice received", {});

      // Send audio to backend
      try {
        const res = await sendAudioToBackend(audioBlob, selectedTool, platformConfig);
        let data;
        try {
          data = await res.json();
        } catch (e) {
          addLog("error", "Failed to parse backend response as JSON");
          return;
        }
        // Add log: Transcription
        if (data.transcript) {
          addLog("transcribed", `Transcribed: ${data.transcript}`);
        }
        // Add logs for each result
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
      } catch (error) {
        addLog("error", "Failed to send audio: " + (error as Error).message);
      }
    } catch (error) {
      addLog("error", "Failed to stop recording: " + (error as Error).message);
      setRecordingStatus("idle");
    }
  };

  const processSegment = async () => {
    try {
      setRecordingStatus("processing");
      
      // Get recording stats before processing
      const statsBefore = audioRecorder.current.getRecordingStats();
      addLog("info", `Processing audio segment... (${statsBefore.unprocessedChunks} new chunks)`);

      const segmentBlob = await audioRecorder.current.processSegment();

      // Send segment to backend
      try {
        const res = await sendAudioToBackend(segmentBlob, selectedTool, platformConfig);
        let data;
        try {
          data = await res.json();
        } catch (e) {
          addLog("error", "Failed to parse");
          return;
        }
        if (data.transcript) {
          // Get recording stats after processing
          const statsAfter = audioRecorder.current.getRecordingStats();
          addLog("transcribed", `Transcribed (segment): ${data.transcript}`);
          addLog("info", `Stats: ${statsAfter.totalChunks} total chunks, ${statsAfter.processedChunks} processed`);
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
      } catch (error) {
        addLog("error", "Failed to send segment: " + (error as Error).message);
      }

      setRecordingStatus("recording");
    } catch (error) {
      addLog("error", "Failed to process segment: " + (error as Error).message);
      setRecordingStatus("recording");
    }
  };

  const handleToolChange = (value: ProjectTool) => {
    setSelectedTool(value);
    setShowConfigForm(true);
    setIsConfigured(false);
    addLog(
      "info",
      `Selected ${value.charAt(0).toUpperCase() + value.slice(1)}`
    );
  };

  const handleConfigSave = (config: PlatformConfig) => {
    setPlatformConfig(config);
    setIsConfigured(true);
    setShowConfigForm(false);
    addLog("success", `${selectedTool?.charAt(0).toUpperCase() + selectedTool?.slice(1)} configuration saved successfully`);
  };

  const handleConfigCancel = () => {
    setShowConfigForm(false);
    if (!isConfigured) {
      setSelectedTool(null);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  useEffect(() => {
    // Fetch credentials from Supabase for the current user and selected tool
    const fetchCredentials = async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        setShowConfigForm(true);
        return;
      }
      // Try Trello
      let { data } = await supabase.from('api_credentials').select('api_key').eq('user_id', user.id).eq('provider', 'trello').single();
      if (data && data.api_key) {
        setSelectedTool('trello');
        setIsConfigured(true);
        setPlatformConfig({ apiKey: data.api_key });
        setShowConfigForm(false);
        return;
      }
      // Try Linear
      data = (await supabase.from('api_credentials').select('api_key').eq('user_id', user.id).eq('provider', 'linear').single()).data;
      if (data && data.api_key) {
        setSelectedTool('linear');
        setIsConfigured(true);
        setPlatformConfig({ apiKey: data.api_key });
        setShowConfigForm(false);
        return;
      }
      // Try Asana
      data = (await supabase.from('api_credentials').select('api_key').eq('user_id', user.id).eq('provider', 'asana').single()).data;
      if (data && data.api_key) {
        setSelectedTool('asana');
        setIsConfigured(true);
        setPlatformConfig({ personalAccessToken: data.api_key });
        setShowConfigForm(false);
        return;
      }
      setShowConfigForm(true);
    };
    fetchCredentials();

    addLog("info", "Voice Manager initialized");
    return () => {
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    };
  }, []);

  const getStatusColor = () => {
    switch (recordingStatus) {
      case "recording":
        return "bg-custom-red";
      case "processing":
        return "bg-custom-blue";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = () => {
    switch (recordingStatus) {
      case "recording":
        return "Recording";
      case "processing":
        return "Processing";
      default:
        return "Idle";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-4 md:px-6 py-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0">
              <div>
                <img src={logo} alt="Agilow Logo" style={{ width: "5rem", height: "auto" }} />
                <h1 className="text-2xl md:text-3xl font-bold text-primary">
                  AI powered management comapnion
                </h1>
              </div>
              <div className="flex items-center space-x-4">
                <Badge className={`${getStatusColor()} text-white px-3 py-1`}>
                  {getStatusText()}
                </Badge>
                {recordingStatus === "recording" && (
                  <div className="text-primary font-mono text-lg">
                    {formatTime(recordingTime)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <div className="lg:col-span-1 space-y-6">
            {showConfigForm && selectedTool ? (
              <ConfigurationForm
                selectedTool={selectedTool}
                onConfigSave={handleConfigSave}
                onCancel={handleConfigCancel}
              />
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-primary">Project Tool</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select value={selectedTool || ''} onValueChange={handleToolChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Tool" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trello">
                          <Trello className="inline w-4 h-4 mr-2" />
                          Trello
                        </SelectItem>
                        <SelectItem value="linear">
                          <img src={linearLogo} alt="Linear" className="inline w-4 h-4 mr-2" />
                          Linear
                        </SelectItem>
                        <SelectItem value="asana">
                          <Zap className="inline w-4 h-4 mr-2" />
                          Asana
                        </SelectItem>
                        <SelectItem value="notion">
                          <Notebook className="inline w-4 h-4 mr-2" />
                          Notion
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                {isConfigured && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-primary">Configuration</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Status:</span>
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            Configured
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Platform:</span>
                          <span className="text-sm text-muted-foreground">
                            {selectedTool?.charAt(0).toUpperCase() + selectedTool?.slice(1)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-primary">Recording Mode</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Button
                        variant={recordingMode === 'batch' ? 'default' : 'outline'}
                        className="w-full"
                        onClick={() => setRecordingMode('batch')}
                      >
                        <List className="w-4 h-4 mr-2" />
                        Batch Mode
                      </Button>
                      <Button
                        variant={recordingMode === 'continuous' ? 'default' : 'outline'}
                        className="w-full"
                        onClick={() => setRecordingMode('continuous')}
                      >
                        <Mic className="w-4 h-4 mr-2" />
                        Continuous Mode
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Main Recording Area */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-primary">Voice Commands</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center space-y-4">
                  <div className="flex items-center space-x-4">
                    <Button
                      onClick={startRecording}
                      disabled={recordingStatus !== "idle" || !isConfigured}
                      className="bg-custom-red hover:bg-custom-red/90 text-white"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Start Recording
                    </Button>
                    <Button
                      onClick={stopRecording}
                      disabled={recordingStatus !== "recording"}
                      variant="outline"
                    >
                      <CircleStop className="w-4 h-4 mr-2" />
                      Stop Recording
                    </Button>
                    {recordingMode === "continuous" && (
                      <Button
                        onClick={processSegment}
                        disabled={recordingStatus !== "recording"}
                        variant="outline"
                      >
                        <Mic className="w-4 h-4 mr-2" />
                        Process Segment
                      </Button>
                    )}
                  </div>
                  
                  {recordingStatus === "recording" && (
                    <div className="text-center">
                      <div className="text-2xl font-mono text-primary">
                        {formatTime(recordingTime)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Recording in progress...
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Logs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-primary">Activity Log</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {logs.map((log) => (
                      <div key={log.id} className="flex items-start space-x-2 p-2 rounded bg-gray-50">
                        <div className="flex-shrink-0 w-2 h-2 rounded-full mt-2 bg-gray-400"></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-muted-foreground">{log.timestamp}</span>
                            <Badge variant="outline" className="text-xs">
                              {log.type}
                            </Badge>
                          </div>
                          <div className="text-sm mt-1">{log.message}</div>
                        </div>
                      </div>
                    ))}
                    {logs.length === 0 && (
                      <div className="text-center text-muted-foreground py-8">
                        No activity yet. Start recording to see logs.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceManager;
