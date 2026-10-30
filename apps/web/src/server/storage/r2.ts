import 'server-only';

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@/lib/env';

let cachedR2Client: S3Client | null = null;

export function isR2Configured(): boolean {
  return Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY);
}

export function getR2Client(): S3Client {
  if (!isR2Configured()) {
    throw new Error('Cloudflare R2 is not configured in environment variables');
  }

  if (!cachedR2Client) {
    cachedR2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }

  return cachedR2Client;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
  isMock?: boolean;
}

/**
 * Generates a presigned PUT URL for direct client-side upload to Cloudflare R2,
 * plus the corresponding public/GET URL for viewing.
 */
export async function getPresignedUploadUrl(
  filename: string,
  contentType: string,
  folder = 'copilot'
): Promise<PresignedUploadResult> {
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileKey = `${folder}/${Date.now()}-${safeFilename}`;

  // Fallback if R2 credentials are not set (e.g. offline local development / CI tests)
  if (!isR2Configured()) {
    console.info(
      `[storage:r2] R2 credentials not configured, returning mock presigned URL for ${fileKey}`
    );
    return {
      uploadUrl: `/api/copilot/upload?key=${encodeURIComponent(fileKey)}`,
      fileKey,
      publicUrl: `/mock-storage/${fileKey}`,
      isMock: true,
    };
  }

  const client = getR2Client();
  const bucket = env.R2_BUCKET_NAME;

  // 1. Presigned PUT for client upload (valid 1 hour)
  const putCommand = new PutObjectCommand({
    Bucket: bucket,
    Key: fileKey,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(client, putCommand, { expiresIn: 3600 });

  // 2. Public URL or Presigned GET for reading
  let publicUrl: string;
  if (env.R2_PUBLIC_URL) {
    publicUrl = `${env.R2_PUBLIC_URL.replace(/\/$/, '')}/${fileKey}`;
  } else {
    // 7-day presigned GET fallback
    const getCommand = new GetObjectCommand({
      Bucket: bucket,
      Key: fileKey,
    });
    publicUrl = await getSignedUrl(client, getCommand, { expiresIn: 604800 });
  }

  console.info(`[storage:r2] Generated presigned upload URL for key: ${fileKey}`);
  return {
    uploadUrl,
    fileKey,
    publicUrl,
  };
}

/**
 * Generates a presigned GET URL for a private R2 object.
 */
export async function getPresignedDownloadUrl(
  fileKey: string,
  expiresInSeconds = 86400
): Promise<string> {
  if (!isR2Configured()) {
    return `/mock-storage/${fileKey}`;
  }

  const client = getR2Client();
  const getCommand = new GetObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: fileKey,
  });

  return getSignedUrl(client, getCommand, { expiresIn: expiresInSeconds });
}

/**
 * Directly uploads a buffer/data to Cloudflare R2 from server-side.
 */
export async function uploadBufferToR2(
  fileKey: string,
  buffer: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  if (!isR2Configured()) {
    console.info(`[storage:r2] Direct upload mock for ${fileKey}`);
    return `/mock-storage/${fileKey}`;
  }

  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: fileKey,
    Body: buffer,
    ContentType: contentType,
  });

  await client.send(command);
  return resolveMediaUrl(fileKey);
}

/**
 * Readable URL for a stored object: public bucket URL when set, else a fresh presigned GET (1 day).
 * Call it again when a saved session is reopened, so links never expire for the user.
 */
export async function resolveMediaUrl(fileKey: string): Promise<string> {
  if (env.R2_PUBLIC_URL) {
    return `${env.R2_PUBLIC_URL.replace(/\/$/, '')}/${fileKey}`;
  }
  return getPresignedDownloadUrl(fileKey);
}
