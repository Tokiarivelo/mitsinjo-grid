import 'server-only';

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  uploadBufferToR2,
  isR2Configured,
} from '@/server/storage/r2';

const PresignRequestSchema = z.object({
  action: z.literal('presign').default('presign'),
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100),
  folder: z.string().max(50).optional(),
});

const UploadDataUrlSchema = z.object({
  action: z.literal('upload_data_url'),
  dataUrl: z.string().min(1),
  filename: z.string().max(255).optional(),
});

const RequestBodySchema = z.union([PresignRequestSchema, UploadDataUrlSchema]);

export async function POST(req: NextRequest) {
  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const parsed = RequestBodySchema.safeParse(bodyJson);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: 'Invalid upload request schema',
        details: parsed.error.issues,
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const data = parsed.data;

    // Action 1: Generate Presigned Upload URL
    if (data.action === 'presign') {
      const presigned = await getPresignedUploadUrl(
        data.filename,
        data.contentType,
        data.folder || 'copilot'
      );
      return new Response(
        JSON.stringify({
          ...presigned,
          configured: isR2Configured(),
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Action 2: Direct Base64 Data URL Upload (e.g. from Canvas sketch)
    if (data.action === 'upload_data_url') {
      const match = data.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match || !match[1] || !match[2]) {
        // If not a data URL, return as-is
        return new Response(
          JSON.stringify({
            publicUrl: data.dataUrl,
            fileKey: 'direct-url',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      const contentType = match[1];
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = data.filename || `sketch-${Date.now()}.png`;
      const fileKey = `copilot/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      if (isR2Configured()) {
        const publicUrl = await uploadBufferToR2(fileKey, buffer, contentType);
        return new Response(
          JSON.stringify({
            publicUrl,
            fileKey,
            configured: true,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      } else {
        // Fallback: return the data URL directly so client can display it without R2
        return new Response(
          JSON.stringify({
            publicUrl: data.dataUrl,
            fileKey,
            configured: false,
            fallback: true,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    return new Response(JSON.stringify({ error: 'Unsupported action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[api:storage:upload] Error processing upload request:', err);
    return new Response(
      JSON.stringify({
        error: 'Failed to process storage request',
        message: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');

  if (!key) {
    return new Response(JSON.stringify({ error: 'Missing object key parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const downloadUrl = await getPresignedDownloadUrl(key);
    return new Response(JSON.stringify({ url: downloadUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: 'Failed to generate download URL',
        message: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
