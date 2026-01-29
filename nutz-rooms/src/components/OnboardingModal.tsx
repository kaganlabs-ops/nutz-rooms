"use client";

import { useState, useRef, useCallback } from "react";

type OnboardingStep = "upload" | "processing" | "preview" | "complete";

interface UploadedSource {
  id: string;
  type: "chat" | "audio" | "document" | "youtube" | "twitter";
  name: string;
  file?: File;
  url?: string;
  status: "pending" | "processing" | "done" | "error";
  extractedContent?: string;
}

interface GeneratedConfig {
  name: string;
  personality: string;
  voiceTone: string;
  keyStories: string[];
  philosophy: string[];
  vocabulary: string[];
  expertise: string[];
}

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (config: GeneratedConfig) => void;
}

export function OnboardingModal({ isOpen, onClose, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState<OnboardingStep>("upload");
  const [sources, setSources] = useState<UploadedSource[]>([]);
  const [creatorName, setCreatorName] = useState("");
  const [generatedConfig, setGeneratedConfig] = useState<GeneratedConfig | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [testMessages, setTestMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [testInput, setTestInput] = useState("");
  const [isTesting, setIsTesting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Handle file uploads
  const handleFileUpload = useCallback((files: FileList | null, type: "chat" | "audio" | "document") => {
    if (!files) return;

    const newSources: UploadedSource[] = Array.from(files).map((file) => ({
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      name: file.name,
      file,
      status: "pending" as const,
    }));

    setSources((prev) => [...prev, ...newSources]);
  }, []);

  // Handle URL inputs (YouTube, Twitter)
  const handleUrlAdd = useCallback((url: string, type: "youtube" | "twitter") => {
    if (!url.trim()) return;

    const source: UploadedSource = {
      id: `${type}-${Date.now()}`,
      type,
      name: url,
      url,
      status: "pending",
    };

    setSources((prev) => [...prev, source]);
  }, []);

  // Remove a source
  const removeSource = useCallback((id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Process all sources and generate config
  const processAndGenerate = async () => {
    if (sources.length === 0 || !creatorName.trim()) {
      setError("Please add at least one source and enter a name");
      return;
    }

    setStep("processing");
    setError(null);
    setProcessingProgress(0);

    try {
      // Upload and process each source
      const formData = new FormData();
      formData.append("creatorName", creatorName);

      for (const source of sources) {
        if (source.file) {
          formData.append("files", source.file);
          formData.append("fileTypes", source.type);
        } else if (source.url) {
          formData.append("urls", source.url);
          formData.append("urlTypes", source.type);
        }
      }

      // Start processing
      const response = await fetch("/api/onboarding", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to process sources");
      }

      // Stream progress updates
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let result = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          result += decoder.decode(value, { stream: true });

          // Parse progress updates
          const lines = result.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.progress) {
                  setProcessingProgress(data.progress);
                }
                if (data.config) {
                  setGeneratedConfig(data.config);
                }
              } catch {
                // Ignore parse errors for partial data
              }
            }
          }
        }
      }

      // If we don't have streaming, try to get the result directly
      if (!generatedConfig) {
        const data = await response.json();
        if (data.config) {
          setGeneratedConfig(data.config);
        }
      }

      setStep("preview");
    } catch (err) {
      console.error("Processing error:", err);
      setError(err instanceof Error ? err.message : "Processing failed");
      setStep("upload");
    }
  };

  // Test chat with generated agent
  const sendTestMessage = async () => {
    if (!testInput.trim() || !generatedConfig || isTesting) return;

    const userMessage = testInput.trim();
    setTestInput("");
    setTestMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsTesting(true);

    try {
      const response = await fetch("/api/onboarding/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          personality: generatedConfig.personality,
          history: testMessages,
        }),
      });

      const data = await response.json();
      setTestMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
    } catch (err) {
      console.error("Test chat error:", err);
      setTestMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong." }]);
    } finally {
      setIsTesting(false);
    }
  };

  // Save and complete
  const handleComplete = () => {
    if (generatedConfig) {
      onComplete(generatedConfig);
      setStep("complete");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Create Your Agent</h2>
            <p className="text-white/50 text-sm mt-1">
              {step === "upload" && "Upload sources to capture your personality"}
              {step === "processing" && "Extracting your personality..."}
              {step === "preview" && "Test and refine your agent"}
              {step === "complete" && "Your agent is live!"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/70 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Upload Step */}
          {step === "upload" && (
            <div className="space-y-6">
              {/* Creator Name */}
              <div>
                <label className="block text-white/60 text-sm mb-2">Agent Name</label>
                <input
                  type="text"
                  value={creatorName}
                  onChange={(e) => setCreatorName(e.target.value)}
                  placeholder="e.g., Alex, Coach Mike, Dr. Sarah"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                />
              </div>

              {/* Upload Sections */}
              <div className="grid gap-4">
                {/* Chat Exports */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-white font-medium">Chat Exports</h3>
                      <p className="text-white/40 text-sm">WhatsApp, iMessage, Telegram</p>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.json,.zip"
                    multiple
                    onChange={(e) => handleFileUpload(e.target.files, "chat")}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2.5 rounded-lg border border-dashed border-white/20 text-white/60 text-sm hover:bg-white/5 transition-colors"
                  >
                    + Add chat exports
                  </button>
                </div>

                {/* Audio/Voice Memos */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-white font-medium">Voice Memos & Audio</h3>
                      <p className="text-white/40 text-sm">MP3, M4A, WAV files</p>
                    </div>
                  </div>
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/*"
                    multiple
                    onChange={(e) => handleFileUpload(e.target.files, "audio")}
                    className="hidden"
                  />
                  <button
                    onClick={() => audioInputRef.current?.click()}
                    className="w-full py-2.5 rounded-lg border border-dashed border-white/20 text-white/60 text-sm hover:bg-white/5 transition-colors"
                  >
                    + Add audio files
                  </button>
                </div>

                {/* Documents */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-white font-medium">Documents</h3>
                      <p className="text-white/40 text-sm">PDFs, notes, writings</p>
                    </div>
                  </div>
                  <input
                    ref={docInputRef}
                    type="file"
                    accept=".pdf,.txt,.md,.doc,.docx"
                    multiple
                    onChange={(e) => handleFileUpload(e.target.files, "document")}
                    className="hidden"
                  />
                  <button
                    onClick={() => docInputRef.current?.click()}
                    className="w-full py-2.5 rounded-lg border border-dashed border-white/20 text-white/60 text-sm hover:bg-white/5 transition-colors"
                  >
                    + Add documents
                  </button>
                </div>

                {/* YouTube Links */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-white font-medium">YouTube</h3>
                      <p className="text-white/40 text-sm">Interviews, podcasts, talks</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="Paste YouTube URL"
                      className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/20"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleUrlAdd((e.target as HTMLInputElement).value, "youtube");
                          (e.target as HTMLInputElement).value = "";
                        }
                      }}
                    />
                    <button
                      onClick={(e) => {
                        const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                        handleUrlAdd(input.value, "youtube");
                        input.value = "";
                      }}
                      className="px-3 py-2 rounded-lg bg-white/10 text-white/60 text-sm hover:bg-white/20 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Twitter/X Profile */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-white font-medium">Twitter / X</h3>
                      <p className="text-white/40 text-sm">Profile link to analyze tweets</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://x.com/username"
                      className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/20"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleUrlAdd((e.target as HTMLInputElement).value, "twitter");
                          (e.target as HTMLInputElement).value = "";
                        }
                      }}
                    />
                    <button
                      onClick={(e) => {
                        const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                        handleUrlAdd(input.value, "twitter");
                        input.value = "";
                      }}
                      className="px-3 py-2 rounded-lg bg-white/10 text-white/60 text-sm hover:bg-white/20 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Uploaded Sources List */}
              {sources.length > 0 && (
                <div>
                  <h3 className="text-white/60 text-sm mb-3">Added Sources ({sources.length})</h3>
                  <div className="space-y-2">
                    {sources.map((source) => (
                      <div
                        key={source.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10"
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          source.type === "chat" ? "bg-green-500/20 text-green-400" :
                          source.type === "audio" ? "bg-purple-500/20 text-purple-400" :
                          source.type === "document" ? "bg-blue-500/20 text-blue-400" :
                          source.type === "youtube" ? "bg-red-500/20 text-red-400" :
                          "bg-white/10 text-white"
                        }`}>
                          {source.type === "chat" && "💬"}
                          {source.type === "audio" && "🎙️"}
                          {source.type === "document" && "📄"}
                          {source.type === "youtube" && "▶️"}
                          {source.type === "twitter" && "𝕏"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm truncate">{source.name}</p>
                          <p className="text-white/40 text-xs capitalize">{source.type}</p>
                        </div>
                        <button
                          onClick={() => removeSource(source.id)}
                          className="text-white/40 hover:text-red-400 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Processing Step */}
          {step === "processing" && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 animate-pulse mb-6" />
              <h3 className="text-white text-lg font-medium mb-2">Extracting your personality...</h3>
              <p className="text-white/50 text-sm mb-6">This may take a minute</p>
              <div className="w-full max-w-xs">
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
                    style={{ width: `${processingProgress}%` }}
                  />
                </div>
                <p className="text-white/40 text-xs text-center mt-2">{processingProgress}% complete</p>
              </div>
            </div>
          )}

          {/* Preview Step */}
          {step === "preview" && generatedConfig && (
            <div className="space-y-6">
              {/* Generated Config Summary */}
              <div className="grid gap-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h3 className="text-white/60 text-xs uppercase tracking-wider mb-2">Voice & Tone</h3>
                  <p className="text-white text-sm">{generatedConfig.voiceTone}</p>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h3 className="text-white/60 text-xs uppercase tracking-wider mb-2">Key Stories</h3>
                  <ul className="space-y-1">
                    {generatedConfig.keyStories.slice(0, 3).map((story, i) => (
                      <li key={i} className="text-white text-sm flex items-start gap-2">
                        <span className="text-white/40">•</span>
                        <span>{story}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h3 className="text-white/60 text-xs uppercase tracking-wider mb-2">Areas of Expertise</h3>
                  <div className="flex flex-wrap gap-2">
                    {generatedConfig.expertise.map((area, i) => (
                      <span key={i} className="px-2 py-1 rounded-lg bg-white/10 text-white text-xs">
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Test Chat */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <h3 className="text-white/60 text-xs uppercase tracking-wider mb-3">Test Your Agent</h3>

                {/* Chat Messages */}
                <div className="h-48 overflow-y-auto mb-3 space-y-2">
                  {testMessages.length === 0 ? (
                    <p className="text-white/30 text-sm text-center py-8">
                      Send a message to test your agent
                    </p>
                  ) : (
                    testMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                            msg.role === "user"
                              ? "bg-blue-500/30 text-white"
                              : "bg-white/10 text-white/90"
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))
                  )}
                  {isTesting && (
                    <div className="flex justify-start">
                      <div className="bg-white/10 px-3 py-2 rounded-lg">
                        <span className="animate-pulse text-white/50">...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Chat Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendTestMessage()}
                    placeholder="Type a message to test..."
                    className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/20"
                  />
                  <button
                    onClick={sendTestMessage}
                    disabled={isTesting}
                    className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 transition-colors disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Complete Step */}
          {step === "complete" && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-white text-xl font-medium mb-2">Your Agent is Live!</h3>
              <p className="text-white/50 text-sm mb-6">
                {creatorName} is ready to chat. Share your agent with others or start a conversation.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/10 flex justify-between">
          {step === "upload" && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg text-white/60 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={processAndGenerate}
                disabled={sources.length === 0 || !creatorName.trim()}
                className="px-6 py-2.5 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generate Agent
              </button>
            </>
          )}

          {step === "preview" && (
            <>
              <button
                onClick={() => setStep("upload")}
                className="px-4 py-2.5 rounded-lg text-white/60 hover:text-white transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleComplete}
                className="px-6 py-2.5 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600 transition-colors"
              >
                Save & Go Live
              </button>
            </>
          )}

          {step === "complete" && (
            <button
              onClick={onClose}
              className="w-full py-3 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
