"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { UnlockAgentsModal } from "@/components/UnlockAgentsModal";

interface AppCategory {
  [key: string]: string[];
}

const APP_ICONS: Record<string, string> = {
  gmail: "📧",
  outlook: "📬",
  googlecalendar: "📅",
  outlookcalendar: "🗓️",
  calendly: "📆",
  slack: "💬",
  discord: "🎮",
  notion: "📝",
  todoist: "✅",
  asana: "📋",
  linear: "🔲",
  trello: "📌",
  googledrive: "📁",
  dropbox: "📦",
  twitter: "🐦",
  linkedin: "💼",
  github: "🐙",
  stripe: "💳",
  figma: "🎨",
};

const APP_NAMES: Record<string, string> = {
  gmail: "Gmail",
  outlook: "Outlook",
  googlecalendar: "Google Calendar",
  outlookcalendar: "Outlook Calendar",
  calendly: "Calendly",
  slack: "Slack",
  discord: "Discord",
  notion: "Notion",
  todoist: "Todoist",
  asana: "Asana",
  linear: "Linear",
  trello: "Trello",
  googledrive: "Google Drive",
  dropbox: "Dropbox",
  twitter: "Twitter/X",
  linkedin: "LinkedIn",
  github: "GitHub",
  stripe: "Stripe",
  figma: "Figma",
};

// Priority apps to show
const priorityApps = ["gmail", "googlecalendar", "notion", "twitter", "github", "slack"];

function ConnectionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoggedIn } = useAuth();
  const [userId, setUserId] = useState<string | null>(null);
  const [connected, setConnected] = useState<string[]>([]);
  const [available, setAvailable] = useState<AppCategory>({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [pendingApp, setPendingApp] = useState<string | null>(null);

  // Get userId - prefer Supabase if logged in
  useEffect(() => {
    if (isLoggedIn && user) {
      setUserId(user.id);
    } else {
      const storedUserId = localStorage.getItem("nutz-user-id");
      if (storedUserId) {
        setUserId(storedUserId);
      } else {
        const newUserId = `anon-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem("nutz-user-id", newUserId);
        setUserId(newUserId);
      }
    }
  }, [isLoggedIn, user]);

  // Check URL params for success/error
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success) {
      setToast({ type: "success", message: "App connected successfully!" });
      router.replace("/settings/connections");
    } else if (error) {
      setToast({ type: "error", message: `Connection failed: ${error}` });
      router.replace("/settings/connections");
    }
  }, [searchParams, router]);

  // Clear toast after 3s
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Fetch connections
  useEffect(() => {
    if (!userId) return;

    async function fetchConnections() {
      try {
        const res = await fetch(`/api/connections?userId=${userId}`);
        const data = await res.json();
        setConnected(data.connected || []);
        setAvailable(data.available || {});
      } catch (err) {
        console.error("Failed to fetch connections:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchConnections();
  }, [userId]);

  const handleConnect = async (appName: string) => {
    if (!userId) return;

    // If not logged in, show unlock modal instead
    if (!isLoggedIn) {
      setPendingApp(appName);
      setShowUnlockModal(true);
      return;
    }

    setConnecting(appName);

    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, appName }),
      });

      const data = await res.json();

      if (data.redirectUrl) {
        // Navigate to OAuth - will redirect back after completion
        window.location.href = data.redirectUrl;
      } else {
        setToast({ type: "error", message: data.error || "Failed to start connection" });
      }
    } catch {
      setToast({ type: "error", message: "Connection failed" });
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (appName: string) => {
    if (!userId) return;

    try {
      const res = await fetch("/api/connections", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, connectionId: appName }),
      });

      if (res.ok) {
        setConnected((prev) => prev.filter((a) => a !== appName));
        setToast({ type: "success", message: "Disconnected" });
      }
    } catch {
      setToast({ type: "error", message: "Failed to disconnect" });
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 overflow-auto">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.push("/room/kagan")}
          className="text-gray-400 hover:text-white mb-6 flex items-center gap-2"
        >
          ← Back
        </button>

        <h1 className="text-2xl font-bold mb-2">Connected Apps</h1>
        <p className="text-gray-400 mb-4">
          Connect your apps to let Kagan help with emails, calendar, and more.
        </p>

        {/* Debug: Show auth status */}
        <div className="mb-4 p-3 bg-gray-800 rounded-lg text-sm">
          <span className="text-gray-400">Status: </span>
          {isLoggedIn ? (
            <span className="text-green-400">Logged in as {user?.email}</span>
          ) : (
            <span className="text-yellow-400">Anonymous ({userId?.slice(0, 15)}...)</span>
          )}
        </div>

        {/* Sign in prompt for anonymous users */}
        {!isLoggedIn && (
          <button
            onClick={() => setShowUnlockModal(true)}
            className="w-full mb-6 p-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <span>🔐</span>
            Sign in to save your connections
          </button>
        )}

        {toast && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              toast.type === "success" ? "bg-green-900/50 text-green-300" : "bg-red-900/50 text-red-300"
            }`}
          >
            {toast.message}
          </div>
        )}

        {loading ? (
          <div className="text-gray-400">Loading...</div>
        ) : (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-4 text-gray-300">Recommended</h2>
              <div className="grid gap-3">
                {priorityApps.map((appName) => {
                  const isConnected = connected.includes(appName);
                  const isConnecting = connecting === appName;

                  return (
                    <div
                      key={appName}
                      className="flex items-center justify-between p-4 bg-gray-900 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{APP_ICONS[appName] || "🔌"}</span>
                        <span className="font-medium">{APP_NAMES[appName] || appName}</span>
                      </div>

                      {isConnected ? (
                        <div className="flex items-center gap-3">
                          <span className="text-green-400 text-sm">Connected ✓</span>
                          <button
                            onClick={() => handleDisconnect(appName)}
                            className="text-sm text-gray-400 hover:text-red-400"
                          >
                            Disconnect
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleConnect(appName)}
                          disabled={isConnecting}
                          className="px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50"
                        >
                          {isConnecting ? "Connecting..." : "Connect"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {Object.entries(available).map(([category, apps]) => {
              const otherApps = (apps as string[]).filter((a) => !priorityApps.includes(a));
              if (otherApps.length === 0) return null;

              return (
                <div key={category}>
                  <h2 className="text-lg font-semibold mb-4 text-gray-300 capitalize">{category}</h2>
                  <div className="grid gap-3">
                    {otherApps.map((appName) => {
                      const isConnected = connected.includes(appName);
                      const isConnecting = connecting === appName;

                      return (
                        <div
                          key={appName}
                          className="flex items-center justify-between p-4 bg-gray-900 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{APP_ICONS[appName] || "🔌"}</span>
                            <span className="font-medium">{APP_NAMES[appName] || appName}</span>
                          </div>

                          {isConnected ? (
                            <div className="flex items-center gap-3">
                              <span className="text-green-400 text-sm">Connected ✓</span>
                              <button
                                onClick={() => handleDisconnect(appName)}
                                className="text-sm text-gray-400 hover:text-red-400"
                              >
                                Disconnect
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleConnect(appName)}
                              disabled={isConnecting}
                              className="px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50"
                            >
                              {isConnecting ? "Connecting..." : "Connect"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Unlock Modal - shown when anonymous user tries to connect */}
      <UnlockAgentsModal
        isOpen={showUnlockModal}
        onClose={() => setShowUnlockModal(false)}
        reason="oauth"
        targetApp={pendingApp || undefined}
      />
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white p-6">Loading...</div>}>
      <ConnectionsContent />
    </Suspense>
  );
}
