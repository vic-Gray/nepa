import { Request, Response } from 'express';
import { FileStorageService } from '../FileStorageService';
import { upload } from '../upload';
import { AuthenticatedRequest } from '../types';

const fileStorageService = new FileStorageService();

// Single file upload with progress tracking
export const uploadSingleFile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    if (!req.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const options = {
      maxSize: req.body.maxSize ? parseInt(req.body.maxSize) : undefined,
      allowedTypes: req.body.allowedTypes ? JSON.parse(req.body.allowedTypes) : [],
      allowedExtensions: req.body.allowedExtensions ? JSON.parse(req.body.allowedExtensions) : []
    };

    const result = await fileStorageService.uploadFile(
      req.file,
      req.user.id,
      req.body.provider || 'S3',
      options,
      (progress) => {
        // Emit progress via WebSocket if available
        if (req.app.get('io')) {
          req.app.get('io').to(req.user.id).emit('upload-progress', progress);
        }
      }
    );

    res.json({
      success: true,
      document: result.document,
      fileId: result.fileId
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Upload failed' 
    });
  }
};

// Multiple file upload (batch)
export const uploadMultipleFiles = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    if (!req.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const options = {
      maxSize: req.body.maxSize ? parseInt(req.body.maxSize) : undefined,
      allowedTypes: req.body.allowedTypes ? JSON.parse(req.body.allowedTypes) : [],
      allowedExtensions: req.body.allowedExtensions ? JSON.parse(req.body.allowedExtensions) : []
    };

    const results = await fileStorageService.uploadBatch(
      req.files,
      req.user.id,
      options,
      (progress) => {
        // Emit progress via WebSocket if available
        if (req.app.get('io')) {
          req.app.get('io').to(req.user.id).emit('upload-progress', progress);
        }
      }
    );

    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Batch upload error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Batch upload failed' 
    });
  }
};

// Get upload progress
export const getUploadProgress = (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fileId } = req.params;
    const progress = fileStorageService.getUploadProgress(fileId);

    if (!progress) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    res.json(progress);
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ error: 'Failed to get upload progress' });
  }
};

// Pause upload
export const pauseUpload = (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fileId } = req.params;
    fileStorageService.pauseUpload(fileId);
    res.json({ success: true, message: 'Upload paused' });
  } catch (error) {
    console.error('Pause upload error:', error);
    res.status(500).json({ error: 'Failed to pause upload' });
  }
};

// Resume upload
export const resumeUpload = (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fileId } = req.params;
    fileStorageService.resumeUpload(fileId);
    res.json({ success: true, message: 'Upload resumed' });
  } catch (error) {
    console.error('Resume upload error:', error);
    res.status(500).json({ error: 'Failed to resume upload' });
  }
};

// Get user uploads
export const getUserUploads = (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const uploads = fileStorageService.getUserUploads(req.user.id);
    res.json(uploads);
  } catch (error) {
    console.error('Get user uploads error:', error);
    res.status(500).json({ error: 'Failed to get user uploads' });
  }
};

// Delete file
export const deleteFile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { documentId } = req.params;

    if (!req.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    await fileStorageService.deleteFile(documentId, req.user.id);
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to delete file' 
    });
  }
};

// Middleware for single file upload
export const uploadSingle = upload.single('file');

// Middleware for multiple file upload
export const uploadMultiple = upload.array('files', 10); // Max 10 files
