'use client'

import { useState } from 'react'
import { Eye, EyeOff, Key } from 'lucide-react'

interface ApiKeySetupProps {
  onApiKeySubmit: (apiKey: string) => void
}

export default function ApiKeySetup({ onApiKeySubmit }: ApiKeySetupProps) {
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!apiKey.trim()) {
      setError('Please enter your OpenAI API key')
      return
    }
    
    if (!apiKey.startsWith('sk-')) {
      setError('API key should start with "sk-"')
      return
    }
    
    setError('')
    onApiKeySubmit(apiKey.trim())
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Key className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">
              Welcome to Streaming Chat
            </h1>
            <p className="text-text-secondary">
              Enter your OpenAI API key to start chatting with AI in real-time
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label 
                htmlFor="apiKey" 
                className="block text-sm font-medium text-text-primary mb-2"
              >
                OpenAI API Key
              </label>
              <div className="relative">
                <input
                  id="apiKey"
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-4 py-3 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
                >
                  {showApiKey ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {error && (
                <p className="mt-2 text-sm text-red-600">{error}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-primary text-white py-3 px-4 rounded-lg hover:bg-primary/90 focus:ring-2 focus:ring-primary focus:ring-offset-2 outline-none transition-colors font-medium"
            >
              Start Chatting
            </button>
          </form>

          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> Your API key is stored only in memory during this session. 
              It will not be saved when you close this browser tab.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 