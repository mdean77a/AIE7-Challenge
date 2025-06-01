import { useState, useEffect, useRef } from 'react'
import styled, { keyframes } from 'styled-components'
import MatrixRain from './components/MatrixRain'

const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`

const MatrixContainer = styled.div`
  background-color: #000;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 20px;
  font-family: 'Courier New', monospace;
  color: #0f0;
  overflow: hidden;
`

const Terminal = styled.div`
  background-color: rgba(0, 0, 0, 0.8);
  border: 1px solid #0f0;
  border-radius: 5px;
  padding: 20px;
  margin: 20px;
  box-shadow: 0 0 10px #0f0;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  animation: ${fadeIn} 1s ease-in;
`

const TerminalHeader = styled.div`
  border-bottom: 1px solid #0f0;
  padding-bottom: 10px;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const TerminalTitle = styled.h1`
  color: #0f0;
  margin: 0;
  font-size: 1.2em;
`

const TerminalContent = styled.div`
  flex-grow: 1;
  overflow-y: auto;
  white-space: pre-wrap;
  line-height: 1.5;
`

const TerminalInput = styled.div`
  display: flex;
  align-items: center;
  margin-top: 10px;
`

const Prompt = styled.span`
  color: #0f0;
  margin-right: 10px;
`

const Input = styled.input`
  background: transparent;
  border: none;
  color: #0f0;
  font-family: 'Courier New', monospace;
  font-size: 1em;
  flex-grow: 1;
  outline: none;
  caret-color: #0f0;

  &::placeholder {
    color: rgba(0, 255, 0, 0.5);
  }
`

function App() {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

  const handleCommand = async (command: string) => {
    const newHistory = [...history, `> ${command}`]
    setHistory(newHistory)
    setInput('')
    setIsLoading(true)

    try {
      // First check API health
      const healthResponse = await fetch(`${API_URL}/api/health`)
      if (!healthResponse.ok) {
        throw new Error('API is not available')
      }

      // Prepare the chat request
      const chatRequest = {
        developer_message: "You are a helpful AI assistant in a Matrix-style terminal interface.",
        user_message: command,
        model: "gpt-4.1-mini",
        api_key: import.meta.env.VITE_OPENAI_API_KEY || ''
      }

      // Make the API call
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(chatRequest)
      })

      if (!response.ok) {
        throw new Error('Failed to get response from API')
      }

      // Handle streaming response
      if (!response.body) {
        throw new Error('No response stream available')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let responseText = ''

      // Add initial response line
      setHistory(prev => [...prev, 'Response: '])

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          break
        }

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const content = line.slice(6)
            responseText += content
            
            // Update the last line of history with accumulated text
            setHistory(prev => {
              const newHistory = [...prev]
              const lastIndex = newHistory.length - 1
              if (lastIndex >= 0) {
                newHistory[lastIndex] = `Response: ${responseText}`
              }
              return newHistory
            })
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
      setHistory(prev => [...prev, `Error: ${errorMessage}`])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim() && !isLoading) {
      handleCommand(input.trim())
    }
  }

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [history])

  return (
    <MatrixContainer>
      <MatrixRain />
      <Terminal>
        <TerminalHeader>
          <TerminalTitle>Mike Dean's Terminal Application</TerminalTitle>
        </TerminalHeader>
        <TerminalContent ref={contentRef}>
          {history.map((line, index) => (
            <div key={index}>{line}</div>
          ))}
          {isLoading && <div>Processing...</div>}
        </TerminalContent>
        <TerminalInput>
          <Prompt>{'>'}</Prompt>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isLoading ? "Processing..." : "Enter command..."}
            disabled={isLoading}
          />
        </TerminalInput>
      </Terminal>
    </MatrixContainer>
  )
}

export default App 