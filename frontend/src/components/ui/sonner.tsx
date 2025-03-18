"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:backdrop-blur-sm",
          title: "group-[.toast]:text-foreground font-semibold tracking-tight",
          description: "group-[.toast]:text-muted-foreground text-sm",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton:
            "group-[.toast]:bg-transparent group-[.toast]:border-border group-[.toast]:text-foreground",
          success:
            "group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-green-500/30",
          error:
            "group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-red-500/30",
          info: "group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-blue-500/30",
          warning:
            "group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-yellow-500/30",
        },
        duration: 5000,
      }}
      style={
        {
          "--normal-bg": "var(--background)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "var(--background)",
          "--success-border": "var(--green-500-alpha)",
          "--success-text": "var(--foreground)",
          "--error-bg": "var(--background)",
          "--error-border": "var(--red-500-alpha)",
          "--error-text": "var(--foreground)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
