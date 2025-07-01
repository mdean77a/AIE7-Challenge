'use client'

interface SettingsPanelProps {
  developerMessage: string
  setDeveloperMessage: (message: string) => void
  chunkSize: number
  setChunkSize: (size: number) => void
  chunkOverlap: number
  setChunkOverlap: (overlap: number) => void
  numChunksToRetrieve: number
  setNumChunksToRetrieve: (num: number) => void
}

export default function SettingsPanel({
  developerMessage,
  setDeveloperMessage,
  chunkSize,
  setChunkSize,
  chunkOverlap,
  setChunkOverlap,
  numChunksToRetrieve,
  setNumChunksToRetrieve
}: SettingsPanelProps) {
  return (
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
  )
}