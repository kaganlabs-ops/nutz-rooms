'use client'

import { useAuth } from '@/hooks/useAuth'

interface Agent {
  id: string
  name: string
  domain: string
  emoji: string
}

const AGENTS: Agent[] = [
  { id: 'mike', name: 'Mike', domain: 'Fitness & nutrition', emoji: '💪' },
  { id: 'sarah', name: 'Sarah', domain: 'Mindfulness & focus', emoji: '🧘' },
]

type UnlockReason = 'agent' | 'oauth'

interface UnlockAgentsModalProps {
  isOpen: boolean
  onClose: () => void
  reason?: UnlockReason
  targetAgentId?: string
  targetApp?: string
}

export function UnlockAgentsModal({
  isOpen,
  onClose,
  reason = 'agent',
  targetAgentId,
  targetApp,
}: UnlockAgentsModalProps) {
  const { signInWithGoogle } = useAuth()

  if (!isOpen) return null

  const handleGoogleSignIn = () => {
    // Store pending action for after auth
    if (reason === 'agent' && targetAgentId) {
      localStorage.setItem('nutz-pending-agent', targetAgentId)
      signInWithGoogle(`/room/${targetAgentId}`)
    } else if (reason === 'oauth' && targetApp) {
      localStorage.setItem('nutz-pending-oauth', targetApp)
      signInWithGoogle('/settings/connections')
    } else {
      signInWithGoogle('/room/kagan')
    }
  }

  const isOAuth = reason === 'oauth'
  const highlightedAgent = AGENTS.find(a => a.id === targetAgentId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm liquid-glass rounded-3xl p-6 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full liquid-glass flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">
            {isOAuth ? '🔗' : '🔓'}
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            {isOAuth ? 'Connect Your Apps' : 'Unlock More Agents'}
          </h2>
          <p className="text-gray-600 text-sm">
            {isOAuth
              ? `To use ${targetApp || 'connected apps'}, save your account first`
              : 'Save your chat and unlock conversations with specialized agents'
            }
          </p>
        </div>

        {/* Agents Preview (for agent unlock) */}
        {!isOAuth && (
          <div className="space-y-2 mb-6">
            {AGENTS.map((agent) => (
              <div
                key={agent.id}
                className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${
                  agent.id === targetAgentId
                    ? 'liquid-glass-warm'
                    : 'bg-white/30'
                }`}
              >
                <span className="text-2xl">{agent.emoji}</span>
                <div className="flex-1">
                  <div className="font-medium text-gray-800">{agent.name}</div>
                  <div className="text-xs text-gray-600">{agent.domain}</div>
                </div>
                {agent.id === targetAgentId && (
                  <span className="text-xs bg-white/50 px-2 py-1 rounded-full text-gray-700">
                    Selected
                  </span>
                )}
              </div>
            ))}
            <div className="text-center text-gray-500 text-xs pt-1">
              + more coming soon
            </div>
          </div>
        )}

        {/* OAuth info (for oauth unlock) */}
        {isOAuth && (
          <div className="mb-6 p-4 rounded-2xl bg-white/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center">
                <GoogleIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="font-medium text-gray-800">Google Account</div>
                <div className="text-xs text-gray-600">Gmail, Calendar, Drive</div>
              </div>
            </div>
          </div>
        )}

        {/* CTA Button */}
        <button
          onClick={handleGoogleSignIn}
          className="w-full py-4 px-6 bg-white rounded-full font-semibold text-gray-800 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
        >
          <GoogleIcon className="w-5 h-5" />
          Continue with Google
        </button>

        {/* Footer */}
        <p className="text-center text-gray-500 text-xs mt-4">
          Your chat history will be saved
        </p>
      </div>
    </div>
  )
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}
