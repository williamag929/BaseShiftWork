// Upload service stub. Replace with real S3 upload or API endpoint when available.
// Returns a URL string to be used as photoUrl on ShiftEventDto.

export async function uploadPhoto(localUri: string): Promise<string> {
  // TODO: Implement real upload using presigned URLs or backend API
  // For now, we return the localUri so events still include a reference for dev/testing.
  return Promise.resolve(localUri);
}

export const uploadService = { uploadPhoto };
