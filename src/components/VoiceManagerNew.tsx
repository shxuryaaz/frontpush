import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Play, CircleStop, Mic, Loader2 } from "lucide-react";
import { AudioRecorder, sendAudioToBackend } from "../utils/audioRecorder";
import { getCurrentUser } from "@/lib/firebaseAuth";
import { getTrelloConfig } from "@/lib/firebaseUserConfig";

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

interface VoiceManagerProps {
  platform?: string;
  selectedBoard?: string;
  boards?: any[];
  onTaskCreated?: (taskName: string) => void;
  onLog?: (type: string, message: string, options?: { details?: any }) => void;
}

const VoiceManagerNew = ({ platform, selectedBoard, boards, onTaskCreated, onLog }: VoiceManagerProps) => {
  const [recordingMode, setRecordingMode] = useState<RecordingMode>("batch");
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>("idle");
  const [recordingTime, setRecordingTime] = useState(0);

  const recordingInterval = useRef<NodeJS.Timeout | null>(null);
  const audioRecorder = useRef<AudioRecorder>(new AudioRecorder());

  const startRecording = async () => {
    try {
      await audioRecorder.current.startRecording();
      setRecordingStatus("recording");
      setRecordingTime(0);
      onLog && onLog("info", "User has started recording");

      recordingInterval.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      onLog && onLog("error", "Failed to start recording: " + (error as Error).message);
    }
  };

  const stopRecording = async () => {
    try {
      const audioBlob = await audioRecorder.current.stopRecording();
      setRecordingStatus("idle");
      onLog && onLog("info", "Voice is received");
      onLog && onLog("success", `Processing...`);

      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
        recordingInterval.current = null;
      }
      setRecordingTime(0);

      // Send audio to backend with platform context
      try {
        console.log("Starting audio processing...");
        let platformConfig = null;
        if (platform === 'trello') {
          console.log("Processing Trello platform...");
          const user = await getCurrentUser();
          if (!user) {
            onLog && onLog("error", "You must be logged in to use Trello voice commands.");
            return;
          }
          const trelloConfig = await getTrelloConfig(user.uid);
          console.log("Trello config:", trelloConfig);
          if (!trelloConfig || !trelloConfig.token) {
            onLog && onLog("error", "Trello credentials not found. Please re-authorize Trello.");
            return;
          }
          
          // Use selectedBoard from props if available, otherwise use boardId from config
          const boardIdToUse = selectedBoard || trelloConfig.boardId;
          console.log("Selected board ID:", boardIdToUse);
          
          if (!boardIdToUse) {
            onLog && onLog("error", "No Trello board selected. Please select a board first.");
            return;
          }
          
          platformConfig = {
            platform: 'trello',
            apiKey: import.meta.env.VITE_TRELLO_APP_KEY,
            boardId: boardIdToUse,
            token: trelloConfig.token
          };
          console.log("Platform config:", platformConfig);
        }

        const typedPlatform = platform as "trello" | "linear" | "asana" | "notion";
        console.log("Sending audio to backend with platform:", typedPlatform);
        const res = await sendAudioToBackend(audioBlob, typedPlatform, platformConfig);
        console.log("Backend response:", res);
        
        let data = (res as any).data as any;
        console.log("Backend response data:", data);
        
        if (data.transcript) {
          onLog && onLog("info", "Voice is transcribed");
          onLog && onLog("info", "User sees the transcription");
          onLog && onLog("transcribed", `Transcribed: ${data.transcript}`);
        }
        
        if (Array.isArray(data.results)) {
          // Count the operations by type
          const operationCounts = data.results.reduce((acc: any, result) => {
            const op = result.operation || 'unknown';
            acc[op] = (acc[op] || 0) + 1;
            return acc;
          }, {});

          // Create a descriptive message about what operations will be performed
          const operationDescriptions = Object.entries(operationCounts).map(([op, count]) => {
            const operationName = op === 'create' ? 'create' : 
                                 op === 'update' ? 'update' : 
                                 op === 'delete' ? 'delete' : 
                                 op === 'move' ? 'move' : op;
            return `${count} ${operationName}${(count as number) > 1 ? 's' : ''}`;
          });

          const operationsText = operationDescriptions.join(', ');
          onLog && onLog("info", `Will perform: ${operationsText}`);
          
          data.results.forEach((result) => {
            if (result.success) {
              onLog && onLog(
                "task",
                `Task ${result.operation === "create" ? "created" : result.operation}` + (result.task ? `: ${result.task}` : ""),
                { details: { taskName: result.task, taskStatus: result.operation } }
              );
              // Call onTaskCreated for Trello card creation
              if (platform === 'trello' && result.operation === 'create' && typeof onTaskCreated === 'function' && result.task) {
                onTaskCreated(result.task);
              }
            } else {
              onLog && onLog(
                "error",
                `Task operation failed${result.task ? ` for: ${result.task}` : ""}${result.error ? ` - ${result.error}` : ""}`
              );
            }
          });
        }
      } catch (error) {
        console.error("Error in audio processing:", error);
        onLog && onLog("error", "Failed to send audio: " + (error as Error).message);
      }
    } catch (error) {
      console.error("Error stopping recording:", error);
      onLog && onLog("error", "Failed to stop recording: " + (error as Error).message);
      setRecordingStatus("idle");
    }
  };

  const getStatusColor = () => {
    switch (recordingStatus) {
      case "recording":
        return "bg-red-500";
      case "processing":
        return "bg-yellow-500";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusText = () => {
    switch (recordingStatus) {
      case "recording":
        return "Recording...";
      case "processing":
        return "Processing...";
      default:
        return "Ready";
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getLogIcon = (type: LogEntry["type"]) => {
    switch (type) {
      case "voice":
        return "🎤";
      case "transcribed":
        return "💬";
      case "task":
        return "✅";
      case "error":
        return "❌";
      case "success":
        return "✅";
      case "warning":
        return "⚠️";
      default:
        return "ℹ️";
    }
  };

  const getLogColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "error":
        return "text-red-600";
      case "success":
        return "text-green-600";
      case "warning":
        return "text-yellow-600";
      case "voice":
        return "text-blue-600";
      case "transcribed":
        return "text-purple-600";
      case "task":
        return "text-green-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="space-y-6">
      {/* Platform Info */}
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-gray-900">
            Voice Commands
          </CardTitle>
          <p className="text-gray-600">
            Connected to {platform?.charAt(0).toUpperCase() + platform?.slice(1)}
            {platform === 'trello' && selectedBoard && (
              <span className="ml-2 text-sm text-blue-600">
                • Board: {boards?.find(b => b.id === selectedBoard)?.name || selectedBoard}
              </span>
            )}
          </p>
        </CardHeader>
      </Card>

      {/* Recording Controls */}
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className={`w-4 h-4 rounded-full ${getStatusColor()} animate-pulse`}></div>
              <span className="text-sm font-medium text-gray-700">{getStatusText()}</span>
              {recordingStatus === "recording" && (
                <span className="text-sm text-gray-500">{formatTime(recordingTime)}</span>
              )}
            </div>
            
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRecordingMode(recordingMode === "batch" ? "continuous" : "batch")}
                className="text-xs"
              >
                {recordingMode === "batch" ? "Batch Mode" : "Continuous Mode"}
              </Button>
            </div>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={recordingStatus === "idle" ? startRecording : stopRecording}
              disabled={recordingStatus === "processing"}
              className={`w-20 h-20 rounded-full ${
                recordingStatus === "recording"
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-blue-600 hover:bg-blue-700"
              } text-white shadow-lg hover:shadow-xl transition-all duration-300`}
            >
              {recordingStatus === "processing" ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : recordingStatus === "recording" ? (
                <CircleStop className="w-8 h-8" />
              ) : (
                <Mic className="w-8 h-8" />
              )}
            </Button>
          </div>

          <div className="text-center mt-4">
            <p className="text-sm text-gray-600">
              {recordingStatus === "idle"
                ? "Click to start recording"
                : recordingStatus === "recording"
                ? "Click to stop recording"
                : "Processing your voice command..."}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VoiceManagerNew; 