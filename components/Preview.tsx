"use client";
import { useEffect, useMemo, useRef } from "react";
import { previewDoc } from "@/lib/prompts";

/**
 * 학생 앱 미리보기. sandbox에 allow-same-origin이 없으므로
 * 앱 코드는 VELO 화면·쿠키에 접근할 수 없음. 앱의 오류는 onError로 전달됨.
 */
export default function Preview({
  html,
  reloadKey = 0,
  onError,
  className = "",
}: {
  html: string;
  reloadKey?: number;
  onError?: (message: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const doc = useMemo(() => previewDoc(html), [html]);

  useEffect(() => {
    if (!onError) return;
    function onMsg(e: MessageEvent) {
      if (e.source !== ref.current?.contentWindow) return;
      if (e.data && e.data.__velo === "error") onError?.(String(e.data.message));
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onError]);

  return (
    <iframe
      ref={ref}
      key={reloadKey}
      srcDoc={doc}
      sandbox="allow-scripts allow-modals allow-forms allow-popups"
      className={`h-full w-full border-0 bg-white ${className}`}
      title="앱 미리보기"
    />
  );
}
