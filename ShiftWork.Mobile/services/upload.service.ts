import { apiClient } from './api-client';
import * as FileSystem from 'expo-file-system';
import { auth } from '@/config/firebase';

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
    // Read the file as base64
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (!fileInfo.exists) {
      throw new Error('Photo file does not exist');
    }

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
    
    // Get Firebase auth token for authorization
    const user = auth.currentUser;
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    
    if (user) {
      const token = await user.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Upload to backend S3 endpoint
    const response = await fetch(`${baseURL}/api/s3/file/${bucketName}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }

    const result: S3UploadResponse = await response.json();
    const photoUrl = result.url || result.message;
    
    if (!photoUrl) {
      throw new Error('No URL returned from upload');
    }

    console.log('Photo uploaded successfully:', photoUrl);
    return photoUrl;
  } catch (error: any) {
    console.error('Error uploading photo:', error);
    // Fallback to local URI if upload fails (offline scenario)
    console.warn('Using local URI as fallback:', localUri);
    return localUri;
  }
}

export const uploadService = { uploadPhoto };
