"use client";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";

const styles: Record<Variant, string> = {
  primary: "bg-violet-600 text-white hover:bg-violet-700 active:bg-violet-800 disabled:bg-violet-300",
  secondary: "bg-white text-violet-700 border-2 border-violet-200 hover:border-violet-400 disabled:opacity-50",
  ghost: "text-gray-600 hover:bg-gray-100 disabled:opacity-40",
  danger: "bg-rose-500 text-white hover:bg-rose-600 disabled:bg-rose-300",
  success: "bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-emerald-300",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`min-h-12 rounded-2xl px-5 font-semibold transition-colors disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 ${className}`}>{children}</div>;
}

export function Badge({ children, color = "violet" }: { children: ReactNode; color?: "violet" | "amber" | "emerald" | "gray" | "rose" }) {
  const c = {
    violet: "bg-violet-100 text-violet-700",
    amber: "bg-amber-100 text-amber-800",
    emerald: "bg-emerald-100 text-emerald-700",
    gray: "bg-gray-100 text-gray-600",
    rose: "bg-rose-100 text-rose-700",
  }[color];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${c}`}>{children}</span>;
}

export function Modal({ open, onClose, title, children, wide = false }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" onClick={onClose}>
      <div
        className={`flex max-h-[94vh] w-full flex-col overflow-hidden rounded-3xl bg-white shadow-xl ${wide ? "max-w-6xl" : "max-w-xl"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="h-11 w-11 rounded-full text-2xl text-gray-500 hover:bg-gray-100" aria-label="닫기">×</button>
        </div>
        <div className="overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}
