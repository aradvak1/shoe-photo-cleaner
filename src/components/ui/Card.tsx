"use client";

import { motion } from "motion/react";
import type { HTMLAttributes, ReactNode } from "react";

type DivProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  // motion.div redefines these event handlers with its own gesture types
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"
>;

export function Card({
  children,
  className = "",
  interactive = false,
  ...rest
}: DivProps & {
  children: ReactNode;
  /** Set when the whole card acts as a button/link — adds hover/press feedback. */
  interactive?: boolean;
}) {
  const base = "rounded-lg border border-border bg-card";

  if (!interactive) {
    return (
      <div className={`${base} ${className}`} {...rest}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={`${base} cursor-pointer transition-[border-color,box-shadow] duration-150 hover:border-accent hover:shadow-card-hover ${className}`}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function CardHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`border-b border-border px-5 py-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}

export function CardFooter({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`border-t border-border px-5 py-4 ${className}`}>
      {children}
    </div>
  );
}
