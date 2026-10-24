"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEME_KEY } from "./theme-script";

export type ThemeChoice = "light" | "dark" | "system";

const KEY = THEME_KEY;
const EVENT = "cotizalo-theme-change";

const read = (): ThemeChoice => {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
};

const prefersDark = () => matchMedia("(prefers-color-scheme: dark)").matches;

function apply(choice: ThemeChoice) {
  document.documentElement.classList.toggle("dark", choice === "dark" || (choice === "system" && prefersDark()));
}

function subscribe(onChange: () => void) {
  const media = matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    if (read() === "system") apply("system");
    onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  media.addEventListener("change", onSystem);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
    media.removeEventListener("change", onSystem);
  };
}

export function setTheme(choice: ThemeChoice) {
  try {
    localStorage.setItem(KEY, choice);
  } catch {}
  apply(choice);
  window.dispatchEvent(new Event(EVENT));
}

/** Preferencia elegida y tema efectivo. En el servidor siempre es "system"/"light". */
export function useTheme() {
  const choice = useSyncExternalStore(subscribe, read, () => "system" as ThemeChoice);
  const resolved = useSyncExternalStore<"light" | "dark">(
    subscribe,
    () => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
    () => "light"
  );
  return { choice, resolved };
}

const OPTIONS: { value: ThemeChoice; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Claro", icon: <Sun /> },
  { value: "dark", label: "Oscuro", icon: <Moon /> },
  { value: "system", label: "Sistema", icon: <Monitor /> },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { choice } = useTheme();
  return (
    <div role="group" aria-label="Tema" className={cn("inline-flex rounded-lg border bg-background p-0.5", className)}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={choice === o.value}
          aria-label={`Tema ${o.label.toLowerCase()}`}
          title={o.label}
          onClick={() => setTheme(o.value)}
          className={cn(
            "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors [&_svg]:size-3.5",
            "hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            choice === o.value && "bg-secondary text-foreground"
          )}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
