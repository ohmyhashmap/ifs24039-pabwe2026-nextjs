"use client";

import { ReactNode, useEffect, useId } from "react";
import { HiXMark } from "react-icons/hi2";

interface ModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly children: ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <dialog
        open
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative m-0 w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-0 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 id={titleId} className="text-lg font-semibold text-slate-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="text-slate-400 hover:text-slate-200 transition rounded-lg p-1"
          >
            <HiXMark aria-hidden="true" className="text-xl" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </dialog>
    </div>
  );
}
