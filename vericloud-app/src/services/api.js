// src/services/api.js

const API_BASE_URL = 'http://127.0.0.1:8000';

class ApiService {
  /**
   * Upload a single file
   */
  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Upload failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  }

  /**
   * Upload multiple files
   */
  async uploadMultipleFiles(files) {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/upload-multiple`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Upload failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  }

  /**
   * Get all files
   */
  async getFiles() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/files`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }

      return await response.json();
    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }
  }

  /**
   * Get a specific file by ID
   */
  async getFile(fileId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/files/${fileId}`);
      
      if (!response.ok) {
        throw new Error('File not found');
      }

      return await response.json();
    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }
  }

  /**
   * Get file content
   */
  async getFileContent(fileId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/files/${fileId}/content`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch file content');
      }

      return await response.json();
    } catch (error) {
      console.error('Fetch content error:', error);
      throw error;
    }
  }

  /**
   * Download a file
   */
  getDownloadUrl(fileId) {
    return `${API_BASE_URL}/api/download/${fileId}`;
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/files/${fileId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Delete failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Delete error:', error);
      throw error;
    }
  }

  /**
   * Update a file
   */
  async updateFile(fileId, file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/api/files/${fileId}`, {
        method: 'PUT',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Update failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Update error:', error);
      throw error;
    }
  }

  /**
   * Check API health
   */
  async healthCheck() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      return { status: 'offline' };
    }
  }
}

export default new ApiService();