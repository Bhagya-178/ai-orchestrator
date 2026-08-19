import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NavigationProvider } from "./lib/context/NavigationContext";
import { ChatProvider } from "./lib/context/ChatContext";

import { ThemeProvider } from "./lib/context/ThemeContext";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "AI Orchestrator",
  description: "Your local AI workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="antialiased text-[var(--foreground)] bg-[var(--background)] transition-colors duration-200">
        <ThemeProvider>
          <NavigationProvider>
            <ChatProvider>
              {children}
            </ChatProvider>
          </NavigationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
