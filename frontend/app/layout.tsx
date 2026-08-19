import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NavigationProvider } from "./lib/context/NavigationContext";
import { ChatProvider } from "./lib/context/ChatContext";

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
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        <NavigationProvider>
          <ChatProvider>
            {children}
          </ChatProvider>
        </NavigationProvider>
      </body>
    </html>
  );
}
