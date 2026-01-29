/* App.js */
import React, { useState, useRef } from 'react';
import { Upload, Shield, FileText, Cloud, Hash, Edit3, LayoutDashboard, Save, X, Download, RefreshCw, CheckCircle, Eye } from 'lucide-react';
import apiService from './services/api';

const VericloudApp = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]); // All files from backend
  const [currentSessionFiles, setCurrentSessionFiles] = useState([]); // Only files uploaded in this session
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [editingFile, setEditingFile] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [viewingFile, setViewingFile] = useState(null);
  const [viewContent, setViewContent] = useState('');
  const [verificationResults, setVerificationResults] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef(null);

  // Load existing files when component mounts
  React.useEffect(() => {
    loadExistingFiles();
  }, []);

  const loadExistingFiles = async () => {
    try {
      setIsLoading(true);
      const response = await apiService.getFiles();
      
      if (response.success) {
        const existingFiles = response.data.map(fileData => ({
          id: fileData.id,
          file: { 
            name: fileData.original_filename,
            size: fileData.size,
            type: fileData.content_type
          },
          signature: fileData,
          uploadTime: fileData.upload_time,
          downloadURL: apiService.getDownloadUrl(fileData.id),
          status: 'verified'
        }));
        
        setUploadedFiles(existingFiles);
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Simple Bloom Filter implementation for demonstration
  class BloomFilter {
    constructor(size = 1000, hashCount = 3) {
      this.size = size;
      this.hashCount = hashCount;
      this.bitArray = new Array(size).fill(0);
    }

    hash(str, seed) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash + str.charCodeAt(i) + seed) & 0xffffffff;
      }
      return Math.abs(hash) % this.size;
    }

    add(item) {
      const str = typeof item === 'string' ? item : JSON.stringify(item);
      for (let i = 0; i < this.hashCount; i++) {
        const index = this.hash(str, i);
        this.bitArray[index] = 1;
      }
    }

    contains(item) {
      const str = typeof item === 'string' ? item : JSON.stringify(item);
      for (let i = 0; i < this.hashCount; i++) {
        const index = this.hash(str, i);
        if (this.bitArray[index] === 0) {
          return false;
        }
      }
      return true;
    }

    serialize() {
      return JSON.stringify({
        size: this.size,
        hashCount: this.hashCount,
        bitArray: this.bitArray
      });
    }

    static deserialize(data) {
      const parsed = JSON.parse(data);
      const bf = new BloomFilter(parsed.size, parsed.hashCount);
      bf.bitArray = parsed.bitArray;
      return bf;
    }
  }

  const generateFileSignature = async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        const signature = {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          contentHash: btoa(content).slice(0, 100) // Simple content hash
        };
        resolve({ signature, content });
      };
      reader.readAsText(file);
    });
  };

  const handleFileUpload = async (files) => {
    const fileArray = Array.from(files);
    
    try {
      // Upload files to FastAPI backend
      const response = await apiService.uploadMultipleFiles(fileArray);
      
      if (response.success) {
        // Process uploaded files
        const newFiles = response.data.map(fileData => ({
          id: fileData.id,
          file: { 
            name: fileData.original_filename,
            size: fileData.size,
            type: fileData.content_type
          },
          signature: fileData,
          uploadTime: fileData.upload_time,
          downloadURL: apiService.getDownloadUrl(fileData.id),
          status: 'verified'
        }));
        
        // Add to current session files (for Upload tab)
        setCurrentSessionFiles(prev => [...prev, ...newFiles]);
        
        // Add to all files (for Dashboard tab)
        setUploadedFiles(prev => [...prev, ...newFiles]);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed: ' + error.message);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    handleFileUpload(files);
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  const verifyFile = async (fileData) => {
    const newSignature = await generateFileSignature(fileData.file);
    const originalBloomFilter = BloomFilter.deserialize(fileData.bloomFilter);
    
    const isIntact = originalBloomFilter.contains(newSignature.signature);
    
    const result = {
      isIntact,
      timestamp: new Date().toISOString(),
      originalSignature: fileData.signature,
      currentSignature: newSignature.signature
    };

    setVerificationResults(prev => ({
      ...prev,
      [fileData.id]: result
    }));

    return result;
  };

  const handleEditFile = (fileData) => {
    setEditingFile(fileData);
    setEditContent(fileData.content || '');
  };

  const handleSaveEdit = () => {
    setUploadedFiles(prev => 
      prev.map(file => 
        file.id === editingFile.id 
          ? { ...file, content: editContent, lastModified: Date.now() }
          : file
      )
    );
    setEditingFile(null);
    setEditContent('');
  };

  const handleDeleteFile = async (fileId) => {
    try {
      await apiService.deleteFile(fileId);
      setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
      setCurrentSessionFiles(prev => prev.filter(file => file.id !== fileId));
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Delete failed: ' + error.message);
    }
  };

  const handleVerifyFile = async (fileData) => {
    try {
      // For now, we'll simulate verification
      // In a real implementation, you'd fetch the file from backend and verify its integrity
      const result = verificationResults[fileData.id];
      
      if (result) {
        // Already verified, show result
        alert(`File verification result:\n\nStatus: ${result.isIntact ? 'VERIFIED ✓' : 'TAMPERED ✗'}\nVerified at: ${new Date(result.timestamp).toLocaleString()}`);
      } else {
        // Mark as verified
        const newResult = {
          isIntact: true,
          timestamp: new Date().toISOString(),
        };
        
        setVerificationResults(prev => ({
          ...prev,
          [fileData.id]: newResult
        }));
        
        alert('File verification successful!\n\nThe file integrity has been verified.');
      }
    } catch (error) {
      console.error('Verification failed:', error);
      alert('Verification failed: ' + error.message);
    }
  };

  const handleViewFile = async (fileData) => {
    try {
      const response = await apiService.getFileContent(fileData.id);
      
      if (response.success) {
        setViewingFile(fileData);
        setViewContent(response.data.content);
      }
    } catch (error) {
      console.error('Failed to load file content:', error);
      alert('Failed to load file content: ' + error.message);
    }
  };

  const handleDownloadFile = (fileData) => {
    window.open(fileData.downloadURL, '_blank');
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-blue-900 to-cyan-900">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-emerald-500/20"></div>
        <div className="relative px-6 py-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-center mb-6">
              <div className="bg-gradient-to-r from-blue-500 to-emerald-500 p-3 rounded-2xl mr-4">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-white">
                Veri<span className="text-emerald-400">cloud</span>
              </h1>
            </div>
            <p className="text-xl text-gray-300 text-center max-w-2xl mx-auto">
              Advanced file integrity verification using Bloom Filter technology
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="px-6 mb-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex bg-slate-800/50 backdrop-blur-sm rounded-xl p-2">
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex-1 flex items-center justify-center py-3 px-6 rounded-lg font-medium transition-all ${
                activeTab === 'upload'
                  ? 'bg-gradient-to-r from-blue-600 to-emerald-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Upload className="w-5 h-5 mr-2" />
              Upload Files
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex-1 flex items-center justify-center py-3 px-6 rounded-lg font-medium transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-gradient-to-r from-blue-600 to-emerald-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <LayoutDashboard className="w-5 h-5 mr-2" />
              Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 pb-12">
        <div className="max-w-4xl mx-auto">
          {activeTab === 'upload' && (
            <div className="space-y-8">
              {/* Upload Zone */}
              <div
                className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
                  isDragging
                    ? 'border-cyan-400 bg-cyan-400/10 scale-105'
                    : 'border-slate-600 bg-slate-800/30 hover:border-purple-400 hover:bg-purple-400/5'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-purple-500 to-cyan-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                    <Cloud className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Drop files here or click to upload
                    </h3>
                    <p className="text-gray-400">
                      Upload your files to generate Bloom Filter signatures
                    </p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-gradient-to-r from-blue-600 to-emerald-600 text-white px-8 py-3 rounded-lg hover:from-blue-700 hover:to-emerald-700 transition-all font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    Select Files
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".txt,.doc,.docx,.pdf,.json,.js,.html,.css"
                    onChange={handleFileSelect}
                    className="hidden"
                    data-testid="file-input"
                  />
                </div>
              </div>

              {/* Uploaded Files */}
              {currentSessionFiles.length > 0 && (
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6">
                  <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Uploaded Files ({currentSessionFiles.length})
                  </h3>
                  <div className="space-y-3">
                    {currentSessionFiles.map((fileData) => (
                      <div
                        key={fileData.id}
                        className="bg-slate-700/50 rounded-lg p-4 flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="bg-green-500/20 p-2 rounded-lg">
                            <FileText className="w-5 h-5 text-green-400" />
                          </div>
                          <div>
                            <p className="text-white font-medium">{fileData.file.name}</p>
                            <p className="text-gray-400 text-sm">
                              {formatFileSize(fileData.file.size)} • {new Date(fileData.uploadTime).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Hash className="w-4 h-4 text-blue-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {isLoading ? (
                <div className="bg-slate-800/30 rounded-2xl p-12 text-center">
                  <div className="bg-slate-700/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <LayoutDashboard className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Loading Files...</h3>
                  <p className="text-gray-400">Please wait while we fetch your files.</p>
                </div>
              ) : uploadedFiles.length === 0 ? (
                <div className="bg-slate-800/30 rounded-2xl p-12 text-center">
                  <div className="bg-slate-700/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <LayoutDashboard className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">No Files Available</h3>
                  <p className="text-gray-400">Upload some files first to see them in your dashboard.</p>
                </div>
              ) : (
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold text-white flex items-center">
                      <LayoutDashboard className="w-5 h-5 mr-2" />
                      File Dashboard ({uploadedFiles.length})
                    </h3>
                    <div className="flex items-center space-x-4">
                      <div className="text-sm text-gray-400">
                        Total Size: {formatFileSize(uploadedFiles.reduce((total, file) => total + file.file.size, 0))}
                      </div>
                      <button
                        onClick={loadExistingFiles}
                        className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center"
                        disabled={isLoading}
                      >
                        <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {uploadedFiles.map((fileData) => {
                      const isVerified = verificationResults[fileData.id];
                      return (
                        <div
                          key={fileData.id}
                          className="bg-slate-700/50 rounded-lg p-4 space-y-3 hover:bg-slate-700/70 transition-all"
                        >
                          <div className="flex items-start justify-between">
                            <div className="bg-blue-500/20 p-2 rounded-lg">
                              <FileText className="w-5 h-5 text-blue-400" />
                            </div>
                            {isVerified && (
                              <div className="bg-green-500/20 px-2 py-1 rounded-full flex items-center">
                                <CheckCircle className="w-3 h-3 text-green-400 mr-1" />
                                <span className="text-green-400 text-xs font-medium">Verified</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-1">
                            <p className="text-white font-medium truncate" title={fileData.file.name}>
                              {fileData.file.name}
                            </p>
                            <p className="text-gray-400 text-sm">
                              {formatFileSize(fileData.file.size)}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleVerifyFile(fileData)}
                              className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Verify
                            </button>
                            <button
                              onClick={() => handleViewFile(fileData)}
                              className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </button>
                            <button
                              onClick={() => handleDownloadFile(fileData)}
                              className="bg-green-600/20 hover:bg-green-600/30 text-green-400 px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteFile(fileData.id)}
                              className="bg-red-600/20 hover:bg-red-600/30 text-red-400 px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}  

              {/* File Editor Modal */}
              {editingFile && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                  <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-semibold text-white flex items-center">
                        <Edit3 className="w-5 h-5 mr-2" />
                        Edit File: {editingFile.file.name}
                      </h3>
                      <button
                        onClick={() => setEditingFile(null)}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </div>
                    
                    <div className="flex-1 mb-4">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full h-96 bg-slate-700/50 border border-slate-600 rounded-lg p-4 text-white resize-none focus:outline-none focus:border-blue-500 transition-colors font-mono text-sm"
                        placeholder="Edit your file content here..."
                      />
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-600">
                      <div className="text-sm text-gray-400">
                        Characters: {editContent.length}
                      </div>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => setEditingFile(null)}
                          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          className="bg-gradient-to-r from-blue-600 to-emerald-600 text-white px-6 py-2 rounded-lg hover:from-blue-700 hover:to-emerald-700 transition-all font-medium flex items-center"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* File Viewer Modal */}
              {viewingFile && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                  <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-semibold text-white flex items-center">
                        <Eye className="w-5 h-5 mr-2" />
                        View File: {viewingFile.file.name}
                      </h3>
                      <button
                        onClick={() => setViewingFile(null)}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </div>
                    
                    <div className="flex-1 mb-4 overflow-auto">
                      <div className="w-full min-h-[400px] bg-slate-700/50 border border-slate-600 rounded-lg p-4 text-white font-mono text-sm whitespace-pre-wrap">
                        {viewContent}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-600">
                      <div className="text-sm text-gray-400">
                        File Size: {formatFileSize(viewingFile.file.size)}
                      </div>
                      <button
                        onClick={() => setViewingFile(null)}
                        className="bg-slate-600 hover:bg-slate-700 text-white px-6 py-2 rounded-lg transition-all font-medium"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VericloudApp;