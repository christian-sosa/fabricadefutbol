export function ensureTargetBucket(targetClient: {
  storage: {
    createBucket(name: string, options: { public: boolean; fileSizeLimit: number; allowedMimeTypes: string[] }): Promise<{ error: { message: string } | null }>;
    updateBucket(name: string, options: { public: boolean; fileSizeLimit: number; allowedMimeTypes: string[] }): Promise<{ error: { message: string } | null }>;
  };
}, bucketName: string): Promise<void>;
