# Import required FastAPI components for building the API
from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
# Import Pydantic for data validation and settings management
from pydantic import BaseModel
# Import OpenAI client for interacting with OpenAI's API
from openai import OpenAI, AsyncOpenAI
import os
import sys
from typing import Optional, Dict, List
import tempfile
import PyPDF2
import asyncio
import numpy as np

# Add parent directory to path to import aimakerspace
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import aimakerspace components for RAG functionality
from aimakerspace.vectordatabase import VectorDatabase
from aimakerspace.text_utils import CharacterTextSplitter

# Custom EmbeddingModel that accepts API key as parameter
class CustomEmbeddingModel:
    """Custom embedding model that accepts API key as a parameter instead of reading from env."""
    def __init__(self, api_key: str, embeddings_model_name: str = "text-embedding-3-small"):
        self.api_key = api_key
        self.async_client = AsyncOpenAI(api_key=api_key)
        self.client = OpenAI(api_key=api_key)
        self.embeddings_model_name = embeddings_model_name

    async def async_get_embeddings(self, list_of_text: List[str]) -> List[List[float]]:
        """Get embeddings for a list of texts asynchronously."""
        batch_size = 1024
        batches = [list_of_text[i:i + batch_size] for i in range(0, len(list_of_text), batch_size)]
        
        async def process_batch(batch):
            embedding_response = await self.async_client.embeddings.create(
                input=batch, model=self.embeddings_model_name
            )
            return [embeddings.embedding for embeddings in embedding_response.data]
        
        # Use asyncio.gather to process all batches concurrently
        results = await asyncio.gather(*[process_batch(batch) for batch in batches])
        
        # Flatten the results
        return [embedding for batch_result in results for embedding in batch_result]

    def get_embedding(self, text: str) -> List[float]:
        """Get embedding for a single text."""
        embedding = self.client.embeddings.create(
            input=text, model=self.embeddings_model_name
        )
        return embedding.data[0].embedding

# Initialize FastAPI application with a title
app = FastAPI(title="OpenAI Chat API with RAG")

# Configure CORS (Cross-Origin Resource Sharing) middleware
# This allows the API to be accessed from different domains/origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows requests from any origin
    allow_credentials=True,  # Allows cookies to be included in requests
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers in requests
)

# Global storage for vector databases per session
# In production, use proper session management or database
vector_dbs: Dict[str, VectorDatabase] = {}
pdf_filenames: Dict[str, str] = {}

# Define the data model for chat requests using Pydantic
# This ensures incoming request data is properly validated
class ChatRequest(BaseModel):
    developer_message: str  # Message from the developer/system
    user_message: str      # Message from the user
    model: Optional[str] = "gpt-4o-mini"  # Optional model selection with default
    api_key: str          # OpenAI API key for authentication
    session_id: Optional[str] = "default"  # Session ID for maintaining PDF context

def extract_text_from_pdf(pdf_file) -> str:
    """Extract text content from uploaded PDF file."""
    pdf_reader = PyPDF2.PdfReader(pdf_file)
    text = ""
    for page_num in range(len(pdf_reader.pages)):
        page = pdf_reader.pages[page_num]
        text += page.extract_text()
    return text

async def create_rag_system(text: str, api_key: str) -> VectorDatabase:
    """Create a RAG system from the extracted PDF text."""
    # Initialize the text splitter with reasonable chunk sizes
    text_splitter = CharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200
    )
    
    # Split the text into chunks
    chunks = text_splitter.split(text)
    
    # Initialize custom embedding model with the provided API key
    embedding_model = CustomEmbeddingModel(api_key=api_key)
    
    # Create vector database and build from chunks
    vector_db = VectorDatabase(embedding_model=embedding_model)
    await vector_db.abuild_from_list(chunks)
    
    return vector_db

# Define PDF upload endpoint
@app.post("/api/upload-pdf")
async def upload_pdf(
    file: UploadFile = File(...),
    api_key: str = Form(...),
    session_id: str = Form("default")
):
    """Handle PDF upload and create vector database for RAG."""
    try:
        # Validate file type
        if not file.filename.endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_file.seek(0)
            
            # Extract text from PDF
            text = extract_text_from_pdf(tmp_file)
            
        # Remove temporary file
        os.unlink(tmp_file.name)
        
        # Create RAG system
        vector_db = await create_rag_system(text, api_key)
        
        # Store vector database and filename for this session
        vector_dbs[session_id] = vector_db
        pdf_filenames[session_id] = file.filename
        
        return {
            "message": "PDF uploaded and indexed successfully",
            "filename": file.filename,
            "session_id": session_id,
            "chunks_created": len(vector_db.vectors)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

# Define the main chat endpoint that handles POST requests
@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        # Initialize OpenAI client with the provided API key
        client = OpenAI(api_key=request.api_key)
        
        # Check if we have a vector database for this session
        has_pdf = request.session_id in vector_dbs
        
        # Create an async generator function for streaming responses
        async def generate():
            messages = [
                {"role": "developer", "content": request.developer_message},
            ]
            
            # If we have a PDF indexed, use RAG to enhance the response
            if has_pdf:
                vector_db = vector_dbs[request.session_id]
                
                # Search for relevant context from the PDF
                relevant_chunks = vector_db.search_by_text(
                    request.user_message,
                    k=3,  # Return top 3 most relevant chunks
                    return_as_text=True
                )
                
                # Create context from relevant chunks
                context = "\n\n".join(relevant_chunks)
                
                # Create enhanced user message with context
                enhanced_message = f"""Context from PDF '{pdf_filenames[request.session_id]}':
{context}

User Question: {request.user_message}

Please answer the user's question based on the provided context from the PDF. If the context doesn't contain relevant information, let the user know."""
                
                messages.append({"role": "user", "content": enhanced_message})
            else:
                # No PDF context, use original message
                messages.append({"role": "user", "content": request.user_message})
            
            # Create a streaming chat completion request
            stream = client.chat.completions.create(
                model=request.model,
                messages=messages,
                stream=True  # Enable streaming response
            )
            
            # Yield each chunk of the response as it becomes available
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content

        # Return a streaming response to the client with proper headers
        return StreamingResponse(
            generate(), 
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"  # Disable nginx buffering if present
            }
        )
    
    except Exception as e:
        # Handle any errors that occur during processing
        raise HTTPException(status_code=500, detail=str(e))

# Endpoint to check if a PDF is loaded for a session
@app.get("/api/pdf-status/{session_id}")
async def pdf_status(session_id: str):
    """Check if a PDF is loaded for the given session."""
    has_pdf = session_id in vector_dbs
    return {
        "has_pdf": has_pdf,
        "filename": pdf_filenames.get(session_id, None),
        "chunks": len(vector_dbs[session_id].vectors) if has_pdf else 0
    }

# Endpoint to clear PDF from a session
@app.delete("/api/clear-pdf/{session_id}")
async def clear_pdf(session_id: str):
    """Clear the PDF vector database for a session."""
    if session_id in vector_dbs:
        del vector_dbs[session_id]
        del pdf_filenames[session_id]
        return {"message": "PDF cleared successfully"}
    else:
        raise HTTPException(status_code=404, detail="No PDF found for this session")

# Define a health check endpoint to verify API status
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "features": ["chat", "pdf-upload", "rag"]}

# Entry point for running the application directly
if __name__ == "__main__":
    import uvicorn
    # Start the server on all network interfaces (0.0.0.0) on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)