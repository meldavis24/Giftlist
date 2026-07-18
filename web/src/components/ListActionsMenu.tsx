"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { deleteList } from "@/app/lists/[id]/actions";

export default function ListActionsMenu({
  listId,
  listName,
  isOwner,
  shareSection,
}: {
  listId: string;
  listName: string;
  isOwner: boolean;
  shareSection: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [isDeleting, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleDelete() {
    if (!confirm(`Delete "${listName}"? This removes every item and claim on it. This can't be undone.`)) {
      return;
    }
    setMenuOpen(false);
    startTransition(() => {
      deleteList(listId);
    });
  }

  return (
    <div>
      <div ref={menuRef} className="relative inline-block">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="List actions"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <circle cx="5" cy="12" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="19" cy="12" r="1.8" />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-9 z-10 w-48 rounded-xl border border-card-border bg-card py-1 shadow-md">
            <button
              onClick={() => {
                setShareOpen((v) => !v);
                setMenuOpen(false);
              }}
              className="block w-full px-4 py-2 text-left text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            >
              {shareOpen ? "Hide share options" : "Share list"}
            </button>
            {isOwner && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-black/[0.04] disabled:opacity-50 dark:hover:bg-white/[0.06]"
              >
                {isDeleting ? "Deleting..." : "Delete list"}
              </button>
            )}
          </div>
        )}
      </div>

      <div className={shareOpen ? "mt-6" : "hidden"}>{shareSection}</div>
    </div>
  );
}
