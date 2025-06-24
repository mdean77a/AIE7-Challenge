'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, RotateCcw, Settings, MessageSquare } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

interface ChatInterfaceProps {
  apiKey: string
  onApiKeyReset: () => void
}

export default function ChatInterface({ apiKey, onApiKeyReset }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [developerMessage, setDeveloperMessage] = useState('You are a helpful AI assistant.')
  const [showSettings, setShowSettings] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Focus input when component mounts (when user enters chat interface)
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isStreaming) return

    const userMessage = inputMessage.trim()
    setInputMessage('')
    setIsStreaming(true)

    // Add user message to chat
    const newUserMessage: Message = { role: 'user', content: userMessage }
    setMessages(prev => [...prev, newUserMessage])

    // Create AI message placeholder for streaming
    const aiMessage: Message = { role: 'assistant', content: '', isStreaming: true }
    setMessages(prev => [...prev, aiMessage])

    try {
      abortControllerRef.current = new AbortController()
      
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          developer_message: developerMessage,
          user_message: userMessage,
          api_key: apiKey,
          model: 'gpt-4.1-nano'
        }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No reader available')
      }



      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        
        // Only update if we have actual content
        if (chunk.length > 0) {
          // Update the streaming message by appending each token/chunk
          setMessages(prev => 
            prev.map((msg, index) => 
              index === prev.length - 1 
                ? { ...msg, content: msg.content + chunk }
                : msg
            )
          )
        }
      }

      // Mark streaming as complete
      setMessages(prev => 
        prev.map((msg, index) => 
          index === prev.length - 1 
            ? { ...msg, isStreaming: false }
            : msg
        )
      )

      // Return focus to input after streaming completes
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)

    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Stream was cancelled
        setMessages(prev => 
          prev.map((msg, index) => 
            index === prev.length - 1 
              ? { ...msg, content: msg.content + ' [Cancelled]', isStreaming: false }
              : msg
          )
        )
      } else {
        console.error('Error:', error)
        setMessages(prev => 
          prev.map((msg, index) => 
            index === prev.length - 1 
              ? { ...msg, content: 'Error: Failed to get response. Please try again.', isStreaming: false }
              : msg
          )
        )
      }
    } finally {
      setIsStreaming(false)
      abortControllerRef.current = null
      
      // Always return focus to input when streaming ends
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const handleClearChat = () => {
    setMessages([])
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-border-light px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <MessageSquare className="w-8 h-8 text-primary" />
            <h1 className="text-xl font-semibold text-text-primary">Streaming Chat</h1>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-text-secondary hover:text-text-primary hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={handleClearChat}
              className="p-2 text-text-secondary hover:text-text-primary hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <button
              onClick={onApiKeyReset}
              className="px-3 py-2 text-sm text-text-secondary hover:text-text-primary border border-border-light hover:border-gray-300 rounded-lg transition-colors"
            >
              Change API Key
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <label className="block text-sm font-medium text-text-primary mb-2">
              System Message (Developer Message)
            </label>
            <textarea
              value={developerMessage}
              onChange={(e) => setDeveloperMessage(e.target.value)}
              className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"
              rows={3}
              placeholder="Enter system instructions for the AI..."
            />
          </div>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="text-center text-text-secondary mt-20">
            <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
            <p>Type a message below to begin chatting with AI</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-3xl px-4 py-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-text-primary'
                }`}
              >
                <div className="message-content whitespace-pre-wrap">
                  {message.content}
                  {message.isStreaming && (
                    <span className="streaming-cursor ml-1"></span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="input-container">
        <div className="max-w-4xl mx-auto">
          <div className="flex space-x-4">
            <div className="flex-1">
                             <textarea
                 ref={inputRef}
                 value={inputMessage}
                 onChange={(e) => setInputMessage(e.target.value)}
                 onKeyPress={handleKeyPress}
                 placeholder="Type your message here..."
                 className="w-full px-4 py-3 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"
                 rows={1}
                 style={{ minHeight: '52px', maxHeight: '120px' }}
                 disabled={isStreaming}
               />
            </div>
            <div className="flex flex-col space-y-2">
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isStreaming}
                className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span>Send</span>
              </button>
              {isStreaming && (
                <button
                  onClick={handleStopStreaming}
                  className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
                >
                  Stop
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 