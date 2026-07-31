"use client";

import { motion, type Variants } from "motion/react";
import { Button } from "@/components/ui/Button";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

export default function HomePage() {
  return (
    <div className="relative flex min-h-[75vh] flex-col items-center justify-center overflow-hidden text-center">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 35%, var(--color-accent-soft), transparent 70%)",
        }}
      />
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col items-center"
      >
        <motion.p
          variants={item}
          className="text-xs font-semibold tracking-[0.2em] text-accent"
        >
          PHOTOS EDITOR
        </motion.p>
        <motion.h1
          variants={item}
          className="mt-4 max-w-2xl text-4xl text-balance sm:text-5xl"
        >
          ברוכים הבאים ל-PHOTOS EDITOR
        </motion.h1>
        <motion.p
          variants={item}
          className="mt-5 max-w-md text-base text-muted text-balance"
        >
          כאן תוכלו ליצור תמונות בלי לצאת לימי צילום.
        </motion.p>
        <motion.div variants={item} className="mt-9">
          <Button href="/start" size="lg">
            התחלה
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
