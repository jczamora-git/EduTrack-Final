/**
 * Supabase Client Configuration
 * 
 * This module provides the Supabase client for file storage operations.
 * Since there's no official PHP SDK for Supabase, we handle file uploads
 * directly from the frontend using the Supabase JavaScript SDK.
 * 
 * Environment Variables Required:
 * - VITE_SUPABASE_URL: Your Supabase project URL
 * - VITE_SUPABASE_ANON_KEY: Your Supabase anonymous/public key
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase configuration from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Validate configuration
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase configuration missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

// Create Supabase client
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // We're using our own auth system (LavaLust sessions)
    autoRefreshToken: false,
  },
});

// Storage bucket name for message attachments
export const STORAGE_BUCKET = 'uploads';

// Storage path prefix for messages
export const MESSAGES_PATH = 'messages';

/**
 * Attachment metadata interface
 */
export interface AttachmentMetadata {
  name: string;
  url: string;
  path: string;
  size: number;
  type: string;
  uploadedAt: string;
}

/**
 * Upload result interface
 */
export interface UploadResult {
  success: boolean;
  data?: AttachmentMetadata;
  error?: string;
}

/**
 * Generate a unique filename to avoid collisions
 * @param originalName Original file name
 * @returns Unique filename with timestamp and random suffix
 */
function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const extension = originalName.includes('.') 
    ? originalName.substring(originalName.lastIndexOf('.')) 
    : '';
  const baseName = originalName.includes('.')
    ? originalName.substring(0, originalName.lastIndexOf('.'))
    : originalName;
  
  // Sanitize basename (remove special characters)
  const sanitizedBaseName = baseName
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 50); // Limit length
  
  return `${sanitizedBaseName}_${timestamp}_${randomSuffix}${extension}`;
}

/**
 * Upload a file to Supabase Storage for message attachments
 * 
 * @param file The file to upload
 * @param userId The user ID (used in the path: messages/{userId}/{filename})
 * @returns Upload result with file metadata or error
 * 
 * @example
 * const result = await uploadMessageAttachment(file, userId);
 * if (result.success) {
 *   console.log('Uploaded:', result.data.url);
 * } else {
 *   console.error('Upload failed:', result.error);
 * }
 */
export async function uploadMessageAttachment(
  file: File,
  userId: string | number
): Promise<UploadResult> {
  try {
    // Validate file
    if (!file) {
      return { success: false, error: 'No file provided' };
    }

    // Validate file size (max 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      return { success: false, error: 'File size exceeds 10MB limit' };
    }

    // Validate file type (allow common document and image types)
    const ALLOWED_TYPES = [
      // Images
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // Text
      'text/plain',
      'text/csv',
      // Archives
      'application/zip',
      'application/x-rar-compressed',
    ];

    if (!ALLOWED_TYPES.includes(file.type)) {
      return { 
        success: false, 
        error: `File type not allowed: ${file.type}. Allowed types: images, PDFs, documents, spreadsheets, text files, and archives.` 
      };
    }

    // Generate unique filename and path
    const uniqueFilename = generateUniqueFilename(file.name);
    const filePath = `${MESSAGES_PATH}/${userId}/${uniqueFilename}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false, // Don't overwrite existing files
        contentType: file.type,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return { success: false, error: error.message };
    }

    // Get public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    const publicUrl = urlData?.publicUrl || '';

    // Return success with metadata
    const metadata: AttachmentMetadata = {
      name: file.name,
      url: publicUrl,
      path: filePath,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString(),
    };

    return { success: true, data: metadata };
  } catch (err: any) {
    console.error('Upload error:', err);
    return { success: false, error: err?.message || 'Unknown upload error' };
  }
}

/**
 * Upload multiple files to Supabase Storage
 * 
 * @param files Array of files to upload
 * @param userId The user ID
 * @returns Array of upload results
 */
export async function uploadMultipleAttachments(
  files: File[],
  userId: string | number
): Promise<UploadResult[]> {
  const results = await Promise.all(
    files.map((file) => uploadMessageAttachment(file, userId))
  );
  return results;
}

/**
 * Delete a file from Supabase Storage
 * 
 * @param filePath The full path of the file in storage
 * @returns Success status
 */
export async function deleteMessageAttachment(filePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error('Supabase delete error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Delete error:', err);
    return { success: false, error: err?.message || 'Unknown delete error' };
  }
}

/**
 * Get a signed URL for a private file (if bucket is private)
 * 
 * @param filePath The full path of the file in storage
 * @param expiresIn Expiration time in seconds (default: 1 hour)
 * @returns Signed URL or error
 */
export async function getSignedUrl(
  filePath: string,
  expiresIn: number = 3600
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error('Supabase signed URL error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, url: data?.signedUrl };
  } catch (err: any) {
    console.error('Signed URL error:', err);
    return { success: false, error: err?.message || 'Unknown error' };
  }
}

/**
 * List all files in a user's message attachments folder
 * 
 * @param userId The user ID
 * @returns List of files or error
 */
export async function listUserAttachments(
  userId: string | number
): Promise<{ success: boolean; files?: any[]; error?: string }> {
  try {
    const folderPath = `${MESSAGES_PATH}/${userId}`;
    
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(folderPath, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      console.error('Supabase list error:', error);
      return { success: false, error: error.message };
    }

    // Add public URLs to each file
    const filesWithUrls = (data || []).map((file) => {
      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(`${folderPath}/${file.name}`);
      
      return {
        ...file,
        url: urlData?.publicUrl || '',
        path: `${folderPath}/${file.name}`,
      };
    });

    return { success: true, files: filesWithUrls };
  } catch (err: any) {
    console.error('List error:', err);
    return { success: false, error: err?.message || 'Unknown error' };
  }
}

/**
 * Format file size for display
 * 
 * @param bytes File size in bytes
 * @returns Human-readable file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get file extension from filename
 * 
 * @param filename The filename
 * @returns File extension (lowercase, without dot)
 */
export function getFileExtension(filename: string): string {
  return filename.includes('.') 
    ? filename.substring(filename.lastIndexOf('.') + 1).toLowerCase() 
    : '';
}

/**
 * Check if a file is an image
 * 
 * @param filename The filename or MIME type
 * @returns True if the file is an image
 */
export function isImageFile(filenameOrType: string): boolean {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  const imageMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  
  if (filenameOrType.includes('/')) {
    return imageMimeTypes.includes(filenameOrType);
  }
  
  const ext = getFileExtension(filenameOrType);
  return imageExtensions.includes(ext);
}

export default supabase;
