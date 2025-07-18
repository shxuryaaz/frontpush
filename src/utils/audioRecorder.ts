import Cookies from "js-cookie";

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private processedChunkCount: number = 0; // Track how many chunks have been processed
  private stream: MediaStream | null = null;

  async startRecording(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1 // Mono for better speech recognition
        }
      });
      
      // Use proper MediaRecorder configuration for speech
      const options = {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
      };
      
      // Fallback to default if the preferred format isn't supported
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.warn("Preferred audio format not supported, using default");
        this.mediaRecorder = new MediaRecorder(this.stream);
      } else {
        this.mediaRecorder = new MediaRecorder(this.stream, options);
      }
      
      this.audioChunks = [];
      this.processedChunkCount = 0; // Reset processed chunk counter

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          console.log(`Audio chunk received: ${event.data.size} bytes`);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
      };

      // Start recording with 5-second chunks for better Whisper context
      this.mediaRecorder.start(2000);
      console.log("Recording started with improved audio settings");
    } catch (error) {
      console.error("Error starting recording:", error);
      throw error;
    }
  }

  stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error("No active recording"));
        return;
      }

      this.mediaRecorder.onstop = () => {
        // Use the correct MIME type based on what MediaRecorder actually produces
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        // Only send unprocessed chunks (same logic as processSegment)
        const unprocessedChunks = this.audioChunks.slice(this.processedChunkCount);
        const audioBlob = new Blob(unprocessedChunks, { type: mimeType });
        console.log(`Recording stopped. Total size: ${audioBlob.size} bytes (${unprocessedChunks.length} unprocessed chunks), MIME type: ${mimeType}`);
        this.cleanup();
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  processSegment(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state !== "recording") {
        reject(new Error("No active recording"));
        return;
      }

      // Get only unprocessed chunks (new chunks since last processing)
      const unprocessedChunks = this.audioChunks.slice(this.processedChunkCount);
      
      // Store current MediaRecorder configuration for restart
      const currentMimeType = this.mediaRecorder.mimeType;
      const currentStream = this.stream;
      
      // Set up one-time listener for the stop event
      const handleStop = () => {
        // Create blob from unprocessed chunks
        const segmentBlob = new Blob(unprocessedChunks, { type: currentMimeType });
        
        // Update processed chunk count
        this.processedChunkCount = this.audioChunks.length;
        
        console.log(`Segment processed: ${segmentBlob.size} bytes (${unprocessedChunks.length} new chunks)`);
        console.log(`Total chunks: ${this.audioChunks.length}, Processed: ${this.processedChunkCount}`);
        
        // Restart recording with same configuration
        this.restartRecording(currentMimeType, currentStream)
          .then(() => {
            resolve(segmentBlob);
          })
          .catch((error) => {
            console.error("Error restarting recording:", error);
            reject(error);
          });
        
        // Remove the listener after use
        this.mediaRecorder?.removeEventListener('stop', handleStop);
      };

      // Add the stop listener
      this.mediaRecorder.addEventListener('stop', handleStop);
      
      // Stop the current recording to finalize the segment
      this.mediaRecorder.stop();
    });
  }

  private async restartRecording(mimeType: string, stream: MediaStream | null): Promise<void> {
    if (!stream) {
      throw new Error("No stream available for restart");
    }

    try {
      // Create new MediaRecorder with same configuration
      const options = {
        mimeType: mimeType,
        audioBitsPerSecond: 128000
      };
      
      // Use same fallback logic as startRecording
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.warn("Preferred audio format not supported during restart, using default");
        this.mediaRecorder = new MediaRecorder(stream);
      } else {
        this.mediaRecorder = new MediaRecorder(stream, options);
      }

      // Set up event handlers
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          console.log(`Audio chunk received: ${event.data.size} bytes`);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
      };

      // Start recording with 5-second chunks (same as original)
      this.mediaRecorder.start(2000);
      console.log("Recording restarted successfully");
    } catch (error) {
      console.error("Error during recording restart:", error);
      throw error;
    }
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.processedChunkCount = 0; // Reset processed chunk counter
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === "recording";
  }

  getRecordingStats(): { totalChunks: number; processedChunks: number; unprocessedChunks: number } {
    return {
      totalChunks: this.audioChunks.length,
      processedChunks: this.processedChunkCount,
      unprocessedChunks: this.audioChunks.length - this.processedChunkCount
    };
  }
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

export const sendAudioToBackend = async (
  audioBlob: Blob,
  platform?: "trello" | "linear" | "asana" | "notion",
  config?: PlatformConfig,
  //apiEndpoint: string = "https://agilow-backend-ur0h.onrender.com/send-audio"
  //apiEndpoint: string = "https://agilow-backend.vercel.app/"
  //baseUrl: string = "http://127.0.0.1:8000"
  baseUrl: string = import.meta.env.VITE_API_URL || "http://localhost:8000"
): Promise<Response> => {
  // Determine endpoint based on platform
  const apiEndpoint = platform === "linear" 
    ? `${baseUrl}/send-audio-linear`
    : `${baseUrl}/send-audio`;
  const formData = new FormData();
  
  // Use proper filename extension based on blob type
  const filename = audioBlob.type.includes('webm') ? 'recording.webm' : 'recording.wav';
  formData.append("audio", audioBlob, filename);
  
  // Add platform parameter
  if (platform) {
    formData.append("platform", platform);
  }
  
  // Add platform-specific configuration
  if (config) {
    if (platform === "trello") {
      const trelloConfig = config as TrelloConfig;
      formData.append("apiKey", trelloConfig.apiKey);
      formData.append("token", trelloConfig.token);
      formData.append("boardId", trelloConfig.boardId);
    } else if (platform === "linear") {
      const linearConfig = config as LinearConfig;
      formData.append("apiKey", linearConfig.apiKey);
      formData.append("workspaceId", linearConfig.workspaceId);
      console.log("Linear config being sent:", { apiKey: linearConfig.apiKey, workspaceId: linearConfig.workspaceId });
    } else if (platform === "asana") {
      const asanaConfig = config as AsanaConfig;
      formData.append("asanaToken", asanaConfig.personalAccessToken);
      formData.append("asanaProjectId", asanaConfig.projectId);
      console.log("Asana config being sent:", { personalAccessToken: asanaConfig.personalAccessToken, projectId: asanaConfig.projectId });
    }
  } else {
    // Fallback to cookies for backward compatibility
    formData.append("apiKey", Cookies.get("apiKey") || "");
    formData.append("token", Cookies.get("token") || "");
    formData.append("boardId", Cookies.get("boardId") || "");
    formData.append("workspaceId", Cookies.get("workspaceId") || "");
    formData.append("asanaToken", Cookies.get("personalAccessToken") || "");
    formData.append("asanaProjectId", Cookies.get("projectId") || "");
  }

  console.log("Sending audio to backend...", {
    endpoint: apiEndpoint,
    baseUrl: baseUrl,
    audioSize: audioBlob.size,
    audioType: audioBlob.type,
    platform: platform,
    config: config
  });

  try {
    console.log("Making request to:", apiEndpoint);
    console.log("Request method: POST");
    console.log("FormData contents:");
    for (let [key, value] of formData.entries()) {
      console.log(`  ${key}: ${value instanceof Blob ? `Blob(${value.size} bytes, ${value.type})` : value}`);
    }
    
    const response = await fetch(apiEndpoint, {
      method: "POST",
      body: formData,
    });

    console.log("Backend response status:", response.status, response.statusText);
    console.log("Backend response headers:", Object.fromEntries(response.headers.entries()));

    // Always log the response content for debugging
    const responseText = await response.text();
    console.log("Backend response content:", responseText);
    console.log("Response URL:", response.url);

    if (!response.ok) {
      console.error("Backend error response:", responseText);
      throw new Error(`Backend error: ${response.status} ${response.statusText} - ${responseText}`);
    }

    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse response as JSON:", e);
      console.error("Response was:", responseText);
      throw new Error("Backend returned invalid JSON");
    }

    // Create a new response with the parsed data
    const newResponse = new Response(responseText, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
    
    // Add the parsed data as a property
    (newResponse as any).data = data;
    
    return newResponse;

    console.log("Audio sent successfully");
    return response;
  } catch (error) {
    console.error("Error sending audio:", error);
    throw error;
  }
};
