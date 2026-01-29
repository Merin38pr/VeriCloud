from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from pathlib import Path
from typing import List
import json
from datetime import datetime

app = FastAPI(title="Vericloud API")

# Configure CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create upload directory if it doesn't exist
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Create metadata directory
METADATA_DIR = Path("metadata")
METADATA_DIR.mkdir(exist_ok=True)

# Maximum file size (10MB)
MAX_FILE_SIZE = 10 * 1024 * 1024

@app.get("/")
async def root():
    return {"message": "Vericloud API is running", "status": "active"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload a single file and store metadata
    """
    try:
        # Read file contents
        contents = await file.read()
        
        # Check file size
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413, 
                detail="File too large. Max size is 10MB"
            )
        
        # Generate unique filename to avoid conflicts
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{timestamp}_{file.filename}"
        file_path = UPLOAD_DIR / filename
        
        # Save file
        with open(file_path, "wb") as f:
            f.write(contents)
        
        # Create metadata
        metadata = {
            "id": timestamp,
            "original_filename": file.filename,
            "stored_filename": filename,
            "size": len(contents),
            "content_type": file.content_type,
            "upload_time": datetime.now().isoformat(),
            "path": str(file_path)
        }
        
        # Save metadata
        metadata_path = METADATA_DIR / f"{timestamp}.json"
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "File uploaded successfully",
                "data": metadata
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Upload failed: {str(e)}"
        )

@app.post("/api/upload-multiple")
async def upload_multiple_files(files: List[UploadFile] = File(...)):
    """
    Upload multiple files at once
    """
    uploaded_files = []
    errors = []
    
    for file in files:
        try:
            contents = await file.read()
            
            if len(contents) > MAX_FILE_SIZE:
                errors.append({
                    "filename": file.filename,
                    "error": "File too large"
                })
                continue
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
            filename = f"{timestamp}_{file.filename}"
            file_path = UPLOAD_DIR / filename
            
            with open(file_path, "wb") as f:
                f.write(contents)
            
            metadata = {
                "id": timestamp,
                "original_filename": file.filename,
                "stored_filename": filename,
                "size": len(contents),
                "content_type": file.content_type,
                "upload_time": datetime.now().isoformat(),
                "path": str(file_path)
            }
            
            metadata_path = METADATA_DIR / f"{timestamp}.json"
            with open(metadata_path, "w") as f:
                json.dump(metadata, f, indent=2)
            
            uploaded_files.append(metadata)
            
        except Exception as e:
            errors.append({
                "filename": file.filename,
                "error": str(e)
            })
    
    return JSONResponse(
        status_code=200,
        content={
            "success": True,
            "message": f"Uploaded {len(uploaded_files)} file(s)",
            "data": uploaded_files,
            "errors": errors
        }
    )

@app.get("/api/files")
async def list_files():
    """
    List all uploaded files with their metadata
    """
    try:
        files = []
        for metadata_file in METADATA_DIR.glob("*.json"):
            with open(metadata_file, "r") as f:
                metadata = json.load(f)
                files.append(metadata)
        
        # Sort by upload time (newest first)
        files.sort(key=lambda x: x["upload_time"], reverse=True)
        
        return {
            "success": True,
            "data": files,
            "count": len(files)
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error listing files: {str(e)}"
        )

@app.get("/api/files/{file_id}")
async def get_file(file_id: str):
    """
    Get metadata for a specific file
    """
    metadata_path = METADATA_DIR / f"{file_id}.json"
    
    if not metadata_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    with open(metadata_path, "r") as f:
        metadata = json.load(f)
    
    return {"success": True, "data": metadata}

@app.get("/api/files/{file_id}/content")
async def get_file_content(file_id: str):
    """
    Get the content of a specific file
    """
    metadata_path = METADATA_DIR / f"{file_id}.json"
    
    if not metadata_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    with open(metadata_path, "r") as f:
        metadata = json.load(f)
    
    file_path = Path(metadata["path"])
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    try:
        # Try to read as text first
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {
            "success": True,
            "data": {
                "content": content,
                "filename": metadata["original_filename"],
                "size": metadata["size"]
            }
        }
    except UnicodeDecodeError:
        # If not text, return error
        raise HTTPException(
            status_code=400, 
            detail="File is not a text file and cannot be read as content"
        )

@app.get("/api/download/{file_id}")
async def download_file(file_id: str):
    """
    Download a specific file
    """
    metadata_path = METADATA_DIR / f"{file_id}.json"
    
    if not metadata_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    with open(metadata_path, "r") as f:
        metadata = json.load(f)
    
    file_path = Path(metadata["path"])
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    return FileResponse(
        path=file_path,
        filename=metadata["original_filename"],
        media_type=metadata.get("content_type", "application/octet-stream")
    )

@app.delete("/api/files/{file_id}")
async def delete_file(file_id: str):
    """
    Delete a specific file and its metadata
    """
    metadata_path = METADATA_DIR / f"{file_id}.json"
    
    if not metadata_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        # Load metadata
        with open(metadata_path, "r") as f:
            metadata = json.load(f)
        
        # Delete file
        file_path = Path(metadata["path"])
        if file_path.exists():
            os.remove(file_path)
        
        # Delete metadata
        os.remove(metadata_path)
        
        return {
            "success": True,
            "message": f"File '{metadata['original_filename']}' deleted successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error deleting file: {str(e)}"
        )

@app.put("/api/files/{file_id}")
async def update_file(file_id: str, file: UploadFile = File(...)):
    """
    Update/replace an existing file
    """
    metadata_path = METADATA_DIR / f"{file_id}.json"
    
    if not metadata_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        # Read new file contents
        contents = await file.read()
        
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="File too large")
        
        # Load existing metadata
        with open(metadata_path, "r") as f:
            metadata = json.load(f)
        
        # Update file
        file_path = Path(metadata["path"])
        with open(file_path, "wb") as f:
            f.write(contents)
        
        # Update metadata
        metadata["size"] = len(contents)
        metadata["last_modified"] = datetime.now().isoformat()
        metadata["content_type"] = file.content_type
        
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)
        
        return {
            "success": True,
            "message": "File updated successfully",
            "data": metadata
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error updating file: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)