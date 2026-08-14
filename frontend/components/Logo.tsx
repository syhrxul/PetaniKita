import React from "react";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "light" | "dark";
}

const HEIGHTS = { sm: "h-6", md: "h-8", lg: "h-10" } as const;

export default function Logo({
  className = "",
  size = "md",
}: LogoProps) {
  return (
    <div className={`flex items-center ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/petani kita logo.svg"
        alt="PetaniKita"
        className={`w-auto ${HEIGHTS[size]}`}
      />
    </div>
  );
}