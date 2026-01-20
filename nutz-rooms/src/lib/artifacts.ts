export interface Artifact {
  type: 'one-pager' | 'mvp-scope' | 'validation-plan' | 'action-items';
  title: string;
  content: string;
}

export interface ParsedResponse {
  text: string;
  artifact: Artifact | null;
}

export function parseArtifact(response: string): ParsedResponse {
  const artifactRegex = /\[ARTIFACT_START\]\s*type:\s*(\S+)\s*title:\s*(.+?)\n([\s\S]*?)\[ARTIFACT_END\]/;
  const match = response.match(artifactRegex);

  if (match) {
    const text = response.replace(artifactRegex, '').trim();
    return {
      text,
      artifact: {
        type: match[1] as Artifact['type'],
        title: match[2].trim(),
        content: match[3].trim()
      }
    };
  }

  return { text: response, artifact: null };
}
