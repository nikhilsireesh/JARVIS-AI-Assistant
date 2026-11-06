'use client';

import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  hoverEffect?: boolean;
  delay?: number;
}

export default function GlassCard({
  children,
  className = '',
  glow = false,
  hoverEffect = true,
  delay = 0
}: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`
        glass-panel relative rounded-xl overflow-hidden p-6
        ${hoverEffect ? 'glass-panel-hover' : ''}
        ${glow ? 'glow-border' : ''}
        ${className}
      `}
    >
      {/* Decorative corner lines - Stark HUD style */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-jarvis-blue/40" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-jarvis-blue/40" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-jarvis-blue/40" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-jarvis-blue/40" />

      {/* Internal glow line gradient */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-jarvis-blue/20 to-transparent" />
      
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
