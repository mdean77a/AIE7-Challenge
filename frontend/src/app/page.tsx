'use client'

import { useState } from 'react'
import ChatInterface from '@/components/ChatInterface'
import ApiKeySetup from '@/components/ApiKeySetup'

export default function Home() {
  const [apiKey, setApiKey] = useState<string>('')

  const handleApiKeySubmit = (key: string) => {
    setApiKey(key)
  }

  const handleApiKeyReset = () => {
    setApiKey('')
  }

  return (
    <main className="min-h-screen bg-secondary">
      {!apiKey ? (
        <ApiKeySetup onApiKeySubmit={handleApiKeySubmit} />
      ) : (
        <ChatInterface 
          apiKey={apiKey} 
          onApiKeyReset={handleApiKeyReset}
        />
      )}
    </main>
  )
} 