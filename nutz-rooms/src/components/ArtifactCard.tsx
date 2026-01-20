"use client";

import type { Artifact } from "@/lib/artifacts";

interface ArtifactCardProps {
  artifact: Artifact;
}

export default function ArtifactCard({ artifact }: ArtifactCardProps) {
  const handleDownload = () => {
    const blob = new Blob([artifact.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.title.toLowerCase().replace(/\s+/g, "-")}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "one-pager":
        return "One Pager";
      case "mvp-scope":
        return "MVP Scope";
      case "validation-plan":
        return "Validation Plan";
      case "action-items":
        return "Action Items";
      default:
        return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "one-pager":
        return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      case "mvp-scope":
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "validation-plan":
        return "bg-green-500/20 text-green-300 border-green-500/30";
      case "action-items":
        return "bg-orange-500/20 text-orange-300 border-orange-500/30";
      default:
        return "bg-white/10 text-white/70 border-white/20";
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden mt-3">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-1 rounded-full border ${getTypeColor(artifact.type)}`}>
            {getTypeLabel(artifact.type)}
          </span>
          <h3 className="font-medium text-white">{artifact.title}</h3>
        </div>
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm text-white/80"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </button>
      </div>

      {/* Content */}
      <div className="px-4 py-3 text-sm text-white/80 whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
        {artifact.content}
      </div>
    </div>
  );
}
