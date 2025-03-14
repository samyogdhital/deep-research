'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function ReportChat() {
  const [messages, setMessages] = useState([
    { sender: 'system', text: 'Welcome! Ask me anything about the report.' },
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (input.trim()) {
      setMessages([...messages, { sender: 'user', text: input }]);
      setInput('');
      // Here you would typically call an API to get the response
      setMessages((prev) => [
        ...prev,
        { sender: 'system', text: 'This is a placeholder response.' },
      ]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className='fixed bottom-0 left-0 right-0 bg-[#111111] text-white'>
      <div className='max-w-4xl mx-auto'>
        <div className='min-h-[300px] max-h-[500px] overflow-y-auto p-6'>
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`mb-4 flex ${
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`px-4 py-2 rounded-2xl max-w-[80%] ${
                  msg.sender === 'user' ? 'bg-blue-600' : 'bg-[#2a2a2a]'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>
        <div className='p-4 border-t border-[#2a2a2a]'>
          <div className='flex gap-2'>
            <input
              type='text'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              className='flex-grow bg-[#2a2a2a] text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500'
              placeholder='Ask follow-up'
            />
            <Button
              onClick={handleSend}
              className='bg-blue-600 hover:bg-blue-700 text-white px-6'
            >
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
