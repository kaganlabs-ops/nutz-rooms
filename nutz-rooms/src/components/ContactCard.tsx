'use client';

interface ContactCardProps {
  agentId: string;
  agentName: string;
  domain: string;
  reason?: string;
  onChat: (agentId: string) => void;
  onDismiss: () => void;
}

const AGENT_AVATARS: Record<string, string> = {
  mike: '/mike-avatar.jpg',
  sarah: '/sarah-avatar.jpg',
  kagan: '/kagan-avatar.jpg',
};

const AGENT_TAGLINES: Record<string, string> = {
  mike: "Kagan's trainer - strength & nutrition",
  sarah: "Mindfulness coach - stress & mental wellness",
  kagan: "Founder of Gorillas - startups & building",
};

export function ContactCard({ agentId, agentName, domain, reason, onChat, onDismiss }: ContactCardProps) {
  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-4 border border-white/10 shadow-xl max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-full bg-gray-700 overflow-hidden">
          <img
            src={AGENT_AVATARS[agentId] || '/default-avatar.jpg'}
            alt={agentName}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/default-avatar.jpg';
            }}
          />
        </div>
        <div>
          <h3 className="text-white font-semibold text-lg">{agentName}</h3>
          <p className="text-white/60 text-sm">{AGENT_TAGLINES[agentId] || domain}</p>
        </div>
      </div>

      {/* Reason */}
      {reason && (
        <p className="text-white/70 text-sm mb-4 italic">"{reason}"</p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onChat(agentId)}
          className="flex-1 bg-white text-black font-medium py-2.5 px-4 rounded-xl hover:bg-white/90 transition-colors"
        >
          Chat with {agentName}
        </button>
        <button
          onClick={onDismiss}
          className="px-3 py-2.5 rounded-xl border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-colors"
        >
          Later
        </button>
      </div>
    </div>
  );
}
