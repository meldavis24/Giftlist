"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteList } from "@/app/lists/[id]/actions";

export default function DashboardListMenu({
  listId,
  listName,
  isOwner,
}: {
  listId: string;
  listName: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
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

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${listName}"? This removes every item and claim on it. This can't be undone.`)) {
      return;
    }
    setMenuOpen(false);
    startTransition(() => {
      deleteList(listId);
    });
  }

  return (
    <div
      ref={menuRef}
      className="absolute right-3 top-3 z-10"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenuOpen((v) => !v);
        }}
        aria-label="List actions"
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-card/80 text-muted backdrop-blur hover:bg-black/[0.06] hover:text-foreground dark:hover:bg-white/[0.08]"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-9 w-48 rounded-xl border border-card-border bg-card py-1 shadow-md">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen(false);
              router.push(`/lists/${listId}?share=1`);
            }}
            className="block w-full px-4 py-2 text-left text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          >
            Share list
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
  );
}
