"use client";

import { useState, useTransition } from "react";
import { checkPriceNow } from "@/app/lists/[id]/actions";

export default function CheckPriceButton({ listId, itemId }: { listId: string; itemId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isChecking, startTransition] = useTransition();

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const result = await checkPriceNow(listId, itemId);
      if (result.status === "not_found") {
        setMessage("No price found on this page");
      } else if (result.status === "unchanged") {
        setMessage(`Still $${result.price}`);
      } else {
        setMessage(
          result.notified ? `Dropped to $${result.price} — notified!` : `Updated to $${result.price}`
        );
      }
      setTimeout(() => setMessage(null), 5000);
    });
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        onClick={handleClick}
        disabled={isChecking}
        className="text-xs text-muted hover:text-foreground disabled:opacity-50"
      >
        {isChecking ? "Checking..." : "Check price"}
      </button>
      {message && <span className="text-xs text-accent">{message}</span>}
    </div>
  );
}
