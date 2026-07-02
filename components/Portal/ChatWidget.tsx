import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface ChatMessage {
  sender: string;
  recipient: string;
  message: string;
  timestamp: string;
}

interface Props {
  mac: string;
}

const ChatWidget: React.FC<Props> = ({ mac }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mac) return;
    
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join_chat', { id: mac });
      newSocket.emit('fetch_messages', { user_id: mac });
    });

    newSocket.on('chat_history', (data: ChatMessage[]) => {
      setMessages(data);
    });

    newSocket.on('receive_message', (data: ChatMessage) => {
      setMessages(prev => [...prev, data]);
      if (!isOpen) {
        setUnreadCount(prev => prev + 1);
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [mac]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !newMessage.trim()) return;

    const msgData = {
      sender: mac,
      recipient: 'admin',
      message: newMessage
    };

    socket.emit('send_message', msgData);
    setNewMessage('');
  };

  if (!mac) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-105"
      >
        {isOpen ? (
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
        ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
        )}
        
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full animate-pulse border-2 border-white">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Chat Modal */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl z-50 flex flex-col border border-gray-200 overflow-hidden h-96 animate-in slide-in-from-bottom-5 duration-300">
          <div className="p-4 bg-indigo-600 text-white flex justify-between items-center shadow-md z-10">
            <h3 className="font-bold flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
              </svg>
              <span>Support Chat</span>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse ml-1"></div>
            </h3>
            <button onClick={() => setIsOpen(false)} className="hover:bg-indigo-700 p-1 rounded transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {messages.length === 0 && (
                <div className="text-center text-gray-400 text-sm mt-10 px-6">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                    </div>
                    <p>Welcome to our support chat! Feel free to ask any questions.</p>
                </div>
            )}
            {messages.map((msg, idx) => {
              const isMe = msg.sender === mac;
              const isBroadcast = msg.recipient === 'broadcast';
              return (
                <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    isMe 
                      ? 'bg-indigo-600 text-white rounded-br-none' 
                      : isBroadcast
                        ? 'bg-amber-100 text-amber-900 border border-amber-200'
                        : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                  }`}>
                    {isBroadcast && <div className="text-[10px] font-bold mb-1 text-amber-700 uppercase flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                        </svg>
                        Announcement
                    </div>}
                    <div className="break-words leading-relaxed">{msg.message}</div>
                    <div className={`text-[10px] mt-1 text-right ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
                      {(() => {
                        try {
                          // Handle potential SQLite timestamp format incompatibility on some browsers
                          const dateStr = msg.timestamp.includes('T') ? msg.timestamp : msg.timestamp.replace(' ', 'T');
                          return new Date(dateStr).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                        } catch (e) {
                          return '';
                        }
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-white border-t border-gray-200">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
              <button 
                type="submit"
                disabled={!newMessage.trim()}
                className="bg-indigo-600 text-white rounded-full p-2 hover:bg-indigo-700 disabled:opacity-50 transition-colors w-9 h-9 flex items-center justify-center shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transform rotate-90" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatWidget;