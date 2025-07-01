'use client'

import { useState } from 'react'
import { Upload, FileText, X, Loader2 } from 'lucide-react'

interface PdfUploadProps {
  apiKey: string
  sessionId: string
  onUploadSuccess: (filename: string, chunks: number) => void
  onClearPdf: () => void
}

export default function PdfUpload({ apiKey, sessionId, onUploadSuccess, onClearPdf }: PdfUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [pdfName, setPdfName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [chunks, setChunks] = useState<number>(0)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.name.endsWith('.pdf')) {
      setError('Please upload a PDF file')
      return
    }

    setIsUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('api_key', apiKey)
    formData.append('session_id', sessionId)

    try {
      const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to upload PDF')
      }

      const data = await response.json()
      setPdfName(data.filename)
      setChunks(data.chunks_created)
      onUploadSuccess(data.filename, data.chunks_created)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload PDF')
    } finally {
      setIsUploading(false)
    }
  }

  const handleClearPdf = async () => {
    try {
      const response = await fetch(`/api/clear-pdf/${sessionId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setPdfName(null)
        setChunks(0)
        onClearPdf()
      }
    } catch (err) {
      setError('Failed to clear PDF')
    }
  }

  return (
    <div className="w-full">
      {!pdfName ? (
        <div className="relative">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
            id="pdf-upload"
          />
          <label
            htmlFor="pdf-upload"
            className={`
              flex items-center justify-center gap-3 w-full p-4 border-2 border-dashed 
              rounded-lg cursor-pointer transition-all
              ${isUploading 
                ? 'border-gray-300 bg-gray-50 cursor-not-allowed' 
                : 'border-primary/30 hover:border-primary hover:bg-primary/5'
              }
            `}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-text-secondary">Uploading and indexing PDF...</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 text-primary" />
                <span className="text-text-primary font-medium">Upload PDF to chat with</span>
              </>
            )}
          </label>
        </div>
      ) : (
        <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-text-primary">{pdfName}</p>
              <p className="text-xs text-text-secondary">{chunks} chunks indexed</p>
            </div>
          </div>
          <button
            onClick={handleClearPdf}
            className="p-2 hover:bg-red-50 rounded-full transition-colors group"
            title="Remove PDF"
          >
            <X className="w-4 h-4 text-gray-500 group-hover:text-red-600" />
          </button>
        </div>
      )}
      
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}