import { apiClient } from './api-client';
import * as FileSystem from 'expo-file-system';
// Firebase auth is DISABLED — token is read from SecureStore instead.
// import { auth } from '@/config/firebase';
import { getToken } from '@/utils/storage.utils';
import { logger } from '@/utils/logger';

/**
 * Upload service for photos to S3 via backend API
 * Matches the Angular implementation using /api/s3/file/{bucketName}
 */

interface S3UploadResponse {
  url?: string;
  message?: string;
}

export async function uploadPhoto(localUri: string, bucketName: string = 'shiftwork-photos'): Promise<string> {
  try {
    // Create form data for multipart upload
    const filename = localUri.split('/').pop() || `photo_${Date.now()}.jpg`;
    const formData = new FormData();
    
    // For React Native/Expo, we need to append the file with proper format
    formData.append('file', {
      uri: localUri,
      name: filename,
      type: 'image/jpeg',
    } as any);

    // Get the base URL from the API client
    const baseURL = await apiClient.getBaseURL();
    
    // Get stored API token for authorization
    const token = await getToken();
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Upload to backend S3 endpoint
    logger.log(`[Upload] Uploading to: ${baseURL}/api/s3/file/${bucketName}`);
    const response = await fetch(`${baseURL}/api/s3/file/${bucketName}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    logger.log('[Upload] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[Upload] Failed response:', errorText);
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }

    const responseText = await response.text();
    logger.log('[Upload] Response body:', responseText);
    
    const result: S3UploadResponse = JSON.parse(responseText);
    const photoUrl = result.url || result.message;
    
    if (!photoUrl) {
      throw new Error('No URL returned from upload');
    }

    logger.log('[Upload] Photo uploaded successfully to S3:', photoUrl);
    return photoUrl;
  } catch (error: any) {
    logger.error('[Upload] Error uploading photo:', error);
    throw new Error(`Failed to upload photo: ${error.message || 'Unknown error'}`);
  }
}

export const uploadService = { uploadPhoto };
