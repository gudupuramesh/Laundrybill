import React from 'react';

/**
 * Lightweight stub of the owner app's HelpButton for ported screens. The Team
 * app doesn't ship the tutorial-videos surface, so this renders nothing (no
 * spacer — a spacer left dead space that pushed header actions off the edge).
 * TutorialVideosSheet is a no-op. Keeps the shared screen imports satisfied.
 */
export function HelpButton(_props: { pageId?: string }) {
  return null;
}

export function TutorialVideosSheet(_props: { visible?: boolean; onClose?: () => void; allMode?: boolean }) {
  return null;
}
