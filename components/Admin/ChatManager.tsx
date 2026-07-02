import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface ChatMessage {
  id: number;
  sender: string;
  recipient: string;
  message: string;
  timestamp: string;
  is_read: number;
}

interface ChatUser {
  mac: string;
  last_message: string;
  name?: string; // Optional if we resolve hostname
}

const ChatManager: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [showBroadcast, setShowBroadcast] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join_chat', { id: 'admin' });
      newSocket.emit('fetch_chat_users');
    });

    newSocket.on('chat_users', (data: ChatUser[]) => {
      setUsers(data);
    });

    newSocket.on('chat_history', (data: ChatMessage[]) => {
      setMessages(data);
    });

    newSocket.on('receive_message', (data: ChatMessage) => {
      // Refresh users list to show latest activity
      newSocket.emit('fetch_chat_users');
      
      // If we are looking at this conversation, or it's a broadcast that should appear in current view
      // Note: Broadcasts appear in all individual chats in this design for context
      // But we need to check if we should update the CURRENT view
      
      // We'll rely on fetch_messages triggered by effect if we want full sync, 
      // or we can append if it matches.
      // Simpler to just re-fetch if it matches the current user context
      
      // Actually, let's just use the state updater to append if it matches
      setMessages(prev => {
         // If incoming is broadcast, always show? Or only if we are in a chat?
         // If we are in a chat with User A, and Admin sends Broadcast, we should see it.
         // If User B sends message, we shouldn't see it in User A's chat.
         
         // Accessing selectedUser inside this callback might be stale if not careful, 
         // but we are using the setMessages functional update which doesn't help with selectedUser state.
         // However, the effect hook for selectedUser handles the initial load.
         // Real-time updates:
         
         // Best approach: Re-fetch history if the message is relevant
         // But that's heavy.
         
         // Let's rely on the effect below that depends on [selectedUser]
         // But that only runs when selectedUser changes.
         
         // We need to know the CURRENT selectedUser here.
         // Let's use a ref for selectedUser to access it in the socket callback
         return prev; 
      });
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Ref to track selected user for socket callbacks
  const selectedUserRef = useRef<string | null>(null);
  useEffect(() => {
    selectedUserRef.current = selectedUser;
    if (selectedUser && socket) {
      socket.emit('fetch_messages', { user_id: selectedUser });
    }
  }, [selectedUser, socket]);

  // Listen for messages specifically for updating the view
  useEffect(() => {
      if (!socket) return;
      
      const handleMsg = (data: ChatMessage) => {
          const current = selectedUserRef.current;
          if (current && (
              data.sender === current || 
              data.recipient === current || 
              data.recipient === 'broadcast'
          )) {
              setMessages(prev => [...prev, data]);
          }
      };
      
      socket.on('receive_message', handleMsg);
      return () => {
          socket.off('receive_message', handleMsg);
      };
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !selectedUser || !newMessage.trim()) return;

    const msgData = {
      sender: 'admin',
      recipient: selectedUser,
      message: newMessage
    };

    socket.emit('send_message', msgData);
    setNewMessage('');
  };

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !broadcastMsg.trim()) return;

    socket.emit('send_message', {
      sender: 'admin',
      recipient: 'broadcast',
      message: broadcastMsg
    });
    
    setBroadcastMsg('');
    setShowBroadcast(false);
  };

  return (
    <div className="flex h-[calc(100vh-100px)] bg-gray-100 rounded-lg overflow-hidden shadow-lg">
      {/* Sidebar - Users List */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h2 className="font-bold text-gray-700">Conversations</h2>
          <button 
            onClick={() => setShowBroadcast(true)}
            className="px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Broadcast
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {users.length === 0 ? (
            <div className="p-8 text-center text-gray-400 flex flex-col items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
                <span>No chats yet</span>
            </div>
          ) : (
            users.map(user => (
              <div 
                key={user.mac}
                onClick={() => setSelectedUser(user.mac)}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors group ${selectedUser === user.mac ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : 'border-l-4 border-l-transparent'}`}
              >
                <div className={`font-medium ${selectedUser === user.mac ? 'text-indigo-700' : 'text-gray-800'}`}>{user.mac}</div>
                <div className="flex justify-between items-center mt-1">
                     <span className="text-xs text-gray-500 group-hover:text-gray-600">
                      {new Date(user.last_message).toLocaleString()}
                    </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="w-2/3 flex flex-col bg-gray-50">
        {selectedUser ? (
          <>
            <div className="p-4 bg-white border-b border-gray-200 shadow-sm flex justify-between items-center">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                Chat with <span className="font-mono text-indigo-600">{selectedUser}</span>
              </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {messages.map((msg, idx) => {
                const isAdmin = msg.sender === 'admin';
                const isBroadcast = msg.recipient === 'broadcast';
                return (
                  <div key={idx} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm text-sm ${
                      isAdmin 
                        ? 'bg-indigo-600 text-white rounded-br-none' 
                        : isBroadcast
                          ? 'bg-amber-100 text-amber-900 border border-amber-200 rounded-2xl'
                          : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                    }`}>
                      {isBroadcast && <div className="text-[10px] font-bold mb-1 text-amber-700 uppercase tracking-wide flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                        </svg>
                        Broadcast
                      </div>}
                      <div className="break-words leading-relaxed">{msg.message}</div>
                      <div className={`text-[10px] mt-1 text-right ${isAdmin ? 'text-indigo-200' : 'text-gray-400'}`}>
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

            <div className="p-4 bg-white border-t border-gray-200">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                <button 
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="bg-indigo-600 text-white rounded-full p-2 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all w-10 h-10 flex items-center justify-center shadow-md"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform rotate-90" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 flex-col bg-gray-50">
            <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
            </div>
            <p className="font-medium">Select a user to start chatting</p>
          </div>
        )}
      </div>

      {/* Broadcast Modal */}
      {showBroadcast && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 transform transition-all scale-100">
            <div className="flex items-center gap-3 mb-4 text-indigo-600">
                <div className="p-2 bg-indigo-100 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                    </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-800">Send Broadcast</h3>
            </div>
            
            <p className="text-gray-600 mb-4 text-sm bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                This message will be sent to <strong>ALL connected devices</strong> and will appear in their chat window.
            </p>
            
            <form onSubmit={handleBroadcast}>
              <textarea
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
                placeholder="Type your announcement here..."
                className="w-full border border-gray-300 rounded-lg p-3 h-32 mb-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none text-sm"
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowBroadcast(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!broadcastMsg.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors shadow-md"
                >
                  Send Broadcast
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatManager;