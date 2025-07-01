'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, RotateCcw, Settings, MessageSquare, FileText, Key, Eye, EyeOff } from 'lucide-react'
import PdfUpload from './PdfUpload'

interface Message {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

export default function ChatInterface() {
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [developerMessage, setDeveloperMessage] = useState('You are a helpful AI assistant.')
  const [showSettings, setShowSettings] = useState(false)
  const [sessionId] = useState(() => `session-${Date.now()}`) // Generate unique session ID
  const [pdfInfo, setPdfInfo] = useState<{ filename: string; chunks: number } | null>(null)
  // RAG settings
  const [chunkSize, setChunkSize] = useState(1000)
  const [chunkOverlap, setChunkOverlap] = useState(200)
  const [numChunksToRetrieve, setNumChunksToRetrieve] = useState(3)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Additional effect to ensure focus after streaming completes
  useEffect(() => {
    if (!isStreaming && inputRef.current) {
      const timer = setTimeout(() => {
        if (inputRef.current && !isStreaming) {
          inputRef.current.focus()
        }
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isStreaming])

  const handlePdfUploadSuccess = (filename: string, chunks: number) => {
    setPdfInfo({ filename, chunks })
    // Add a system message indicating PDF is loaded
    const systemMessage: Message = {
      role: 'assistant',
      content: `📄 PDF "${filename}" loaded successfully! I've indexed ${chunks} chunks from the document. You can now ask me questions about its content.`
    }
    setMessages(prev => [...prev, systemMessage])
  }

  const handleClearPdf = () => {
    setPdfInfo(null)
    // Add a system message indicating PDF is cleared
    const systemMessage: Message = {
      role: 'assistant',
      content: '📄 PDF cleared. I\'m now in general chat mode.'
    }
    setMessages(prev => [...prev, systemMessage])
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isStreaming || !apiKey) return

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
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          developer_message: developerMessage,
          user_message: userMessage,
          api_key: apiKey,
          model: 'gpt-4o-mini',
          session_id: sessionId, // Include session ID for PDF context
          num_chunks_to_retrieve: numChunksToRetrieve // Include number of chunks setting
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
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      })

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
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (inputRef.current) {
            inputRef.current.focus()
            inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          }
        })
      })
    }
  }

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const handleClearChat = async () => {
    setMessages([])
    // Clear conversation history on the backend
    try {
      await fetch(`/api/clear-conversation/${sessionId}`, {
        method: 'DELETE',
      })
    } catch (error) {
      console.error('Failed to clear conversation history:', error)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleInputClick = () => {
    // Ensure focus when user clicks on input area
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-border-light px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <MessageSquare className="w-8 h-8 text-primary" />
              <h1 className="text-xl font-semibold text-text-primary">
                {pdfInfo ? 'PDF Chat' : 'AI Chat with RAG'}
              </h1>
              {pdfInfo && (
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <FileText className="w-4 h-4" />
                  <span>{pdfInfo.filename}</span>
                </div>
              )}
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
            </div>
          </div>

          {/* Main Setup Area - Always Visible */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* API Key Input */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-text-primary mb-2">
                <Key className="w-4 h-4 inline mr-1" />
                OpenAI API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-4 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
                >
                  {showApiKey ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {!apiKey && (
                <p className="mt-1 text-xs text-amber-600">API key required to start chatting</p>
              )}
            </div>

            {/* PDF Upload Section */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-text-primary mb-2">
                <FileText className="w-4 h-4 inline mr-1" />
                PDF Document (Optional)
              </label>
              <PdfUpload
                apiKey={apiKey}
                sessionId={sessionId}
                chunkSize={chunkSize}
                chunkOverlap={chunkOverlap}
                onUploadSuccess={handlePdfUploadSuccess}
                onClearPdf={handleClearPdf}
              />
              {!apiKey && (
                <p className="mt-1 text-xs text-amber-600">Enter API key first to upload PDF</p>
              )}
            </div>
          </div>

          {/* Settings Panel - Collapsible */}
          {showSettings && (
            <div className="mt-4 space-y-4">
              {/* System Message */}
              <div className="p-4 bg-gray-50 rounded-lg">
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

              {/* RAG Settings */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-text-primary mb-4">RAG Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Chunk Size */}
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      Chunk Size
                    </label>
                    <input
                      type="number"
                      value={chunkSize}
                      onChange={(e) => setChunkSize(Math.max(100, parseInt(e.target.value) || 100))}
                      min="100"
                      max="4000"
                      step="100"
                      className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                    />
                    <p className="text-xs text-text-secondary mt-1">Characters per chunk (100-4000)</p>
                  </div>

                  {/* Chunk Overlap */}
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      Chunk Overlap
                    </label>
                    <input
                      type="number"
                      value={chunkOverlap}
                      onChange={(e) => setChunkOverlap(Math.max(0, Math.min(chunkSize - 50, parseInt(e.target.value) || 0)))}
                      min="0"
                      max={chunkSize - 50}
                      step="50"
                      className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                    />
                    <p className="text-xs text-text-secondary mt-1">Overlap between chunks</p>
                  </div>

                  {/* Number of Chunks to Retrieve */}
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      Chunks to Retrieve
                    </label>
                    <input
                      type="number"
                      value={numChunksToRetrieve}
                      onChange={(e) => setNumChunksToRetrieve(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                      min="1"
                      max="10"
                      step="1"
                      className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                    />
                    <p className="text-xs text-text-secondary mt-1">Context chunks for answers (1-10)</p>
                  </div>
                </div>
                <p className="text-xs text-amber-600 mt-3">
                  Note: Chunk settings only apply to new PDF uploads. Re-upload your PDF to apply changes.
                </p>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 ? (
            <div className="text-center text-text-secondary mt-20">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Ready to chat!</h3>
              <p>Enter your OpenAI API key above to start</p>
              {apiKey && !pdfInfo && (
                <p className="text-sm mt-2">Upload a PDF to chat about its content, or just start typing</p>
              )}
              {apiKey && pdfInfo && (
                <p className="text-sm mt-2 text-primary">PDF loaded! Ask me anything about it</p>
              )}
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
      </div>

      {/* Input */}
      <div className="border-t border-border-light bg-white px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex space-x-4">
            <div className="flex-1">
              <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                onClick={handleInputClick}
                onFocus={() => {
                  // Ensure textarea stays focused in production
                  if (inputRef.current) {
                    inputRef.current.focus()
                  }
                }}
                placeholder={
                  !apiKey 
                    ? "Enter your API key above to start chatting..." 
                    : pdfInfo 
                      ? "Ask a question about the PDF..." 
                      : "Type your message here..."
                }
                className="w-full px-4 py-3 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none disabled:bg-gray-50 disabled:text-gray-400"
                rows={1}
                style={{ minHeight: '52px', maxHeight: '120px' }}
                disabled={isStreaming || !apiKey}
                autoFocus={!isStreaming && apiKey ? true : false}
              />
            </div>
            <div className="flex flex-col space-y-2">
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isStreaming || !apiKey}
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