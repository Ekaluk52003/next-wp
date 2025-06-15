"use client";

import dynamic from 'next/dynamic';

// Use dynamic import with ssr: false for client-only component
const ReadArticleButton = dynamic(() => import('./ReadArticleButton'), {
  ssr: false,
});

export default function ReadArticleButtonWrapper({ content }: { content: string }) {
  return <ReadArticleButton content={content} />;
}
