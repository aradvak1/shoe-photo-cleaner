"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Fades + rises a child into view, either on mount (short delay stagger,
 * for above-the-fold grids) or the first time it scrolls into the
 * viewport (for longer lists like the photo gallery).
 */
export function Reveal({
  children,
  index = 0,
  className,
}: {
  children: ReactNode;
  index?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.05, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
