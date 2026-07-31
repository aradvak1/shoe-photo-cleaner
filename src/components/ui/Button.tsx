"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const MotionLink = motion.create(Link);

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-hover))] text-[#1c1108] hover:shadow-card disabled:opacity-50",
  secondary:
    "bg-card text-ink border border-border hover:bg-surface-raised hover:border-border-strong disabled:opacity-50",
  ghost: "bg-transparent text-ink hover:bg-card disabled:opacity-50",
  danger: "bg-danger text-white hover:opacity-90 disabled:opacity-50",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs rounded-sm",
  md: "px-4 py-2 text-sm rounded-md",
  lg: "px-5 py-2.5 text-base rounded-md",
};

interface BaseProps {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
}

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  // motion.button redefines these event handlers with its own gesture types
  "className" | "children" | "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"
>;

interface ButtonAsButton extends BaseProps, NativeButtonProps {
  href?: undefined;
}

interface ButtonAsLink extends BaseProps {
  href: string;
  disabled?: boolean;
  download?: boolean;
}

type Props = ButtonAsButton | ButtonAsLink;

export function Button(props: Props) {
  const { variant = "primary", size = "md", children, className = "" } = props;
  const classes = `inline-flex items-center justify-center gap-2 font-medium transition-[background-color,box-shadow,border-color] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  if ("href" in props && props.href) {
    return (
      <MotionLink
        href={props.href}
        className={classes}
        aria-disabled={props.disabled}
        download={props.download}
        whileHover={{ scale: 1.015, y: -1 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      >
        {children}
      </MotionLink>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { href, variant: _variant, size: _size, className: _className, ...rest } =
    props as ButtonAsButton;
  return (
    <motion.button
      className={classes}
      whileHover={{ scale: 1.015, y: -1 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
