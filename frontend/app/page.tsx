import AppShell from "./components/layout/AppShell";
import ChatView from "./components/chat/ChatView";

export default function Home() {
  return (
    <AppShell>
      <ChatView />
    </AppShell>
  );
}
