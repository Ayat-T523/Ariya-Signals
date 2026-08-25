"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg";
}

// InForm — Clean Clinical adaptation of Kokonut UI's Loader
// (src/components/kokonutui/loader.tsx original). Rings recolored from
// hardcoded black/white to var(--indigo-600); dark-mode ring variants
// dropped since this app has no dark theme (confirmed: no prefers-color-scheme
// or data-theme usage anywhere in src/). Reserved for full-page blocking
// waits where a content skeleton has no shape to draw yet — route code-split
// Suspense fallback and the Supabase auth gate (App.tsx's PageLoader) — never
// for content-shaped loading (e.g. War Room's worklist keeps its row skeleton).
export default function Loader({
  title = "Loading Ariya Signals...",
  subtitle = "Pulling in your latest signals",
  size = "md",
  className,
  ...props
}: LoaderProps) {
  const sizeConfig = {
    sm: {
      container: "size-20",
      titleClass: "text-sm/tight font-medium",
      subtitleClass: "text-xs/relaxed",
      spacing: "space-y-2",
      maxWidth: "max-w-48",
    },
    md: {
      container: "size-32",
      titleClass: "text-base/snug font-medium",
      subtitleClass: "text-sm/relaxed",
      spacing: "space-y-3",
      maxWidth: "max-w-56",
    },
    lg: {
      container: "size-40",
      titleClass: "text-lg/tight font-semibold",
      subtitleClass: "text-base/relaxed",
      spacing: "space-y-4",
      maxWidth: "max-w-64",
    },
  };

  const config = sizeConfig[size];

  return (
    <div
      role="status"
      aria-label={title}
      className={cn(
        "flex flex-col items-center justify-center gap-8 p-8",
        className
      )}
      {...props}
    >
      <motion.div
        animate={{ scale: [1, 1.02, 1] }}
        className={cn("relative", config.container)}
        transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: [0.4, 0, 0.6, 1] }}
      >
        {/* Outer ring */}
        <motion.div
          animate={{ rotate: [0, 360] }}
          className="absolute inset-0 rounded-full"
          style={{
            background: "conic-gradient(from 0deg, transparent 0deg, var(--indigo-600) 90deg, transparent 180deg)",
            mask: "radial-gradient(circle at 50% 50%, transparent 35%, black 37%, black 39%, transparent 41%)",
            WebkitMask: "radial-gradient(circle at 50% 50%, transparent 35%, black 37%, black 39%, transparent 41%)",
            opacity: 0.8,
          }}
          transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
        />

        {/* Primary ring */}
        <motion.div
          animate={{ rotate: [0, 360] }}
          className="absolute inset-0 rounded-full"
          style={{
            background: "conic-gradient(from 0deg, transparent 0deg, var(--indigo-600) 120deg, rgba(37,99,235,0.5) 240deg, transparent 360deg)",
            mask: "radial-gradient(circle at 50% 50%, transparent 42%, black 44%, black 48%, transparent 50%)",
            WebkitMask: "radial-gradient(circle at 50% 50%, transparent 42%, black 44%, black 48%, transparent 50%)",
            opacity: 0.9,
          }}
          transition={{ duration: 2.5, repeat: Number.POSITIVE_INFINITY, ease: [0.4, 0, 0.6, 1] }}
        />

        {/* Counter-rotating ring */}
        <motion.div
          animate={{ rotate: [0, -360] }}
          className="absolute inset-0 rounded-full"
          style={{
            background: "conic-gradient(from 180deg, transparent 0deg, rgba(37,99,235,0.6) 45deg, transparent 90deg)",
            mask: "radial-gradient(circle at 50% 50%, transparent 52%, black 54%, black 56%, transparent 58%)",
            WebkitMask: "radial-gradient(circle at 50% 50%, transparent 52%, black 54%, black 56%, transparent 58%)",
            opacity: 0.35,
          }}
          transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: [0.4, 0, 0.6, 1] }}
        />

        {/* Inner accent ring */}
        <motion.div
          animate={{ rotate: [0, 360] }}
          className="absolute inset-0 rounded-full"
          style={{
            background: "conic-gradient(from 270deg, transparent 0deg, rgba(37,99,235,0.4) 20deg, transparent 40deg)",
            mask: "radial-gradient(circle at 50% 50%, transparent 61%, black 62%, black 63%, transparent 64%)",
            WebkitMask: "radial-gradient(circle at 50% 50%, transparent 61%, black 62%, black 63%, transparent 64%)",
            opacity: 0.5,
          }}
          transition={{ duration: 3.5, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
        />
      </motion.div>

      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className={cn("text-center", config.spacing, config.maxWidth)}
        initial={{ opacity: 0, y: 12 }}
        transition={{ delay: 0.4, duration: 1, ease: [0.4, 0, 0.2, 1] }}
      >
        <motion.h1
          animate={{ opacity: 1, y: 0 }}
          className={cn(config.titleClass, "leading-[1.15] tracking-[-0.02em] antialiased")}
          style={{ fontFamily: 'var(--font-display)', color: 'var(--neutral-900)' }}
          initial={{ opacity: 0, y: 12 }}
          transition={{ delay: 0.6, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        >
          <motion.span
            animate={{ opacity: [0.9, 0.7, 0.9] }}
            transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: [0.4, 0, 0.6, 1] }}
          >
            {title}
          </motion.span>
        </motion.h1>

        <motion.p
          animate={{ opacity: 1, y: 0 }}
          className={cn(config.subtitleClass, "leading-[1.45] tracking-[-0.01em] antialiased")}
          style={{ fontFamily: 'var(--font-ui)', color: 'var(--neutral-600)' }}
          initial={{ opacity: 0, y: 8 }}
          transition={{ delay: 0.8, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        >
          <motion.span
            animate={{ opacity: [0.6, 0.4, 0.6] }}
            transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: [0.4, 0, 0.6, 1] }}
          >
            {subtitle}
          </motion.span>
        </motion.p>
      </motion.div>
    </div>
  );
}
