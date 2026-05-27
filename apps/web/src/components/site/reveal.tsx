"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

type RevealProps = React.ComponentProps<typeof motion.div> & {
  delay?: number;
};

export function Reveal({ className, delay = 0, ...props }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(className)}
      {...props}
    />
  );
}