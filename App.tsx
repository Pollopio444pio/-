import React from 'react';
import { ChatProvider, useChat } from './context/ChatContext';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import CallScreen from './components/CallScreen';

const Shell: React.FC = () => {
  const { activeChatId, selectChat, activeCall } = useChat();

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#f0f2f5] dark:bg-[#0b141a]">
      <Sidebar className={`w-full md:w-[380px] md:shrink-0 ${activeChatId ? 'hidden md:flex' : 'flex'}`} />
      <div className={`flex-1 min-w-0 ${activeChatId ? 'flex' : 'hidden md:flex'}`}>
        <ChatWindow onBack={() => selectChat(null)} />
      </div>
      {activeCall && <CallScreen />}
    </div>
  );
};

const App: React.FC = () => (
  <ChatProvider>
    <Shell />
  </ChatProvider>
);

export default App;
