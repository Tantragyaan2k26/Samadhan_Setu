export interface SignedUploadUrlResult {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
  expiresInSeconds: number;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf', 'audio/webm', 'audio/mp4'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB per §7.3

export function generateSignedUploadUrl(
  fileName: string,
  mimeType: string,
  fileSize: number
): { success: boolean; result?: SignedUploadUrlResult; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return {
      success: false,
      error: `अनुमति रहित फाइल प्रकार (Disallowed file type: ${mimeType}). Only JPG, PNG, PDF, WEBM allowed.`
    };
  }

  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return {
      success: false,
      error: `फाइल का आकार 5MB से कम होना चाहिए (File size exceeds 5MB limit).`
    };
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileKey = `attachments/${Date.now()}_${safeName}`;

  // In production, generate AWS S3 or Cloudflare R2 signed PUT url
  const uploadUrl = `https://storage.samadhan.uk.gov.in/upload?key=${encodeURIComponent(fileKey)}`;
  const publicUrl = `https://cdn.samadhan.uk.gov.in/${fileKey}`;

  return {
    success: true,
    result: {
      uploadUrl,
      fileKey,
      publicUrl,
      expiresInSeconds: 300
    }
  };
}
