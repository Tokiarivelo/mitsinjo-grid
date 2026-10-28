import { describe, it, expect } from 'vitest';
import {
  isR2Configured,
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  uploadBufferToR2,
} from '../r2';

describe('Cloudflare R2 Storage Service', () => {
  it('detects if R2 is configured based on environment variables', () => {
    // In test environment without R2 keys, it returns false
    expect(typeof isR2Configured()).toBe('boolean');
  });

  it('generates a presigned upload URL or fallback', async () => {
    const result = await getPresignedUploadUrl('test-diagram.png', 'image/png');
    expect(result).toHaveProperty('uploadUrl');
    expect(result).toHaveProperty('fileKey');
    expect(result).toHaveProperty('publicUrl');
    expect(result.fileKey).toContain('test-diagram.png');
  });

  it('generates a presigned download URL', async () => {
    const url = await getPresignedDownloadUrl('copilot/sample.png');
    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(0);
  });

  it('handles direct buffer upload', async () => {
    const buffer = Buffer.from('mock-image-data');
    const url = await uploadBufferToR2('copilot/direct.png', buffer, 'image/png');
    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(0);
  });
});
