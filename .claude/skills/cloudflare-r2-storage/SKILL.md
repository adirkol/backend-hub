---
name: cloudflare-r2-storage
description: |
  Cloudflare R2 storage patterns with signed URLs.
  Use when implementing file uploads, generating signed URLs, or managing cloud storage.
---

# Cloudflare R2 Storage Skill

Expertise in Cloudflare R2 for S3-compatible object storage with signed URLs.

## Configuration

### S3 Client Setup
```typescript
// lib/storage.ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export const BUCKET_NAME = R2_BUCKET_NAME;
```

## Upload Operations

### Direct Upload
```typescript
export async function uploadToR2(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await r2Client.send(command);

  // Return public URL (if using custom domain)
  return `https://cdn.photomania.ai/${key}`;
  
  // Or return R2 URL
  // return `https://${BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
}
```

### Presigned Upload URL (Client-side uploads)
```typescript
export async function getUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600 // 1 hour
): Promise<{ uploadUrl: string; key: string }> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn });

  return { uploadUrl, key };
}

// API Route
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { filename, contentType } = await req.json();
  
  // Validate content type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(contentType)) {
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
  }

  // Generate unique key
  const ext = filename.split('.').pop();
  const key = `uploads/${session.user.id}/${crypto.randomUUID()}.${ext}`;

  const { uploadUrl } = await getUploadUrl(key, contentType);

  return NextResponse.json({ uploadUrl, key });
}
```

### Client-Side Upload
```typescript
// hooks/use-upload.ts
export function useUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const upload = async (file: File): Promise<string> => {
    setIsUploading(true);
    setProgress(0);

    try {
      // Get presigned URL
      const { uploadUrl, key } = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
        }),
      }).then(res => res.json());

      // Upload directly to R2
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        });
        
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.response);
          } else {
            reject(new Error('Upload failed'));
          }
        });
        
        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      return key;
    } finally {
      setIsUploading(false);
    }
  };

  return { upload, isUploading, progress };
}
```

## Download Operations

### Presigned Download URL
```typescript
export async function getDownloadUrl(
  key: string,
  expiresIn = 3600 // 1 hour
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(r2Client, command, { expiresIn });
}

// API Route
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const effect = await prisma.userEffect.findFirst({
    where: {
      id: params.id,
      userId: session.user.id,
    },
  });

  if (!effect) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Extract key from URL
  const key = effect.resultUrl.replace('https://cdn.photomania.ai/', '');
  const downloadUrl = await getDownloadUrl(key);

  return NextResponse.json({ downloadUrl });
}
```

### Stream Download (for large files)
```typescript
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key!,
  });

  const response = await r2Client.send(command);
  
  return new NextResponse(response.Body as ReadableStream, {
    headers: {
      'Content-Type': response.ContentType || 'application/octet-stream',
      'Content-Length': String(response.ContentLength),
      'Content-Disposition': `attachment; filename="${key!.split('/').pop()}"`,
    },
  });
}
```

## Delete Operations

```typescript
export async function deleteFromR2(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await r2Client.send(command);
}

// Bulk delete
import { DeleteObjectsCommand } from '@aws-sdk/client-s3';

export async function deleteMultipleFromR2(keys: string[]): Promise<void> {
  const command = new DeleteObjectsCommand({
    Bucket: BUCKET_NAME,
    Delete: {
      Objects: keys.map(key => ({ Key: key })),
    },
  });

  await r2Client.send(command);
}
```

## Folder Structure

```
photomania-bucket/
├── uploads/                    # User uploads (originals)
│   └── {userId}/
│       └── {uuid}.{ext}
├── effects/                    # Processed results
│   └── {userEffectId}.{ext}
├── thumbnails/                 # Generated thumbnails
│   └── {size}/
│       └── {key}
└── public/                     # Public assets (effect previews)
    └── effects/
        └── {effectSlug}.jpg
```

## Helper Functions

```typescript
// Generate unique key
export function generateKey(userId: string, filename: string, folder = 'uploads'): string {
  const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
  const uuid = crypto.randomUUID();
  return `${folder}/${userId}/${uuid}.${ext}`;
}

// Get public URL
export function getPublicUrl(key: string): string {
  return `https://cdn.photomania.ai/${key}`;
}

// Parse key from URL
export function getKeyFromUrl(url: string): string {
  return url.replace('https://cdn.photomania.ai/', '');
}

// Validate file type
export function isValidImageType(contentType: string): boolean {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(contentType);
}

// Validate file size
export function isValidFileSize(size: number, maxMB = 10): boolean {
  return size <= maxMB * 1024 * 1024;
}
```

## Image Processing Pipeline

```typescript
// Complete upload and process flow
export async function uploadAndProcessImage(
  userId: string,
  file: Buffer,
  filename: string,
  effectId: string
): Promise<{ sourceKey: string; jobId: string }> {
  // 1. Upload original
  const sourceKey = generateKey(userId, filename, 'uploads');
  await uploadToR2(file, sourceKey, 'image/jpeg');

  // 2. Create effect record
  const userEffect = await prisma.userEffect.create({
    data: {
      userId,
      effectId,
      sourceUrl: getPublicUrl(sourceKey),
      resultUrl: '',
      status: 'PENDING',
    },
  });

  // 3. Queue processing job
  await effectQueue.add('process-effect', {
    userEffectId: userEffect.id,
    sourceKey,
    effectId,
    userId,
  });

  return { sourceKey, jobId: userEffect.id };
}

// In worker: after processing
async function saveProcessedImage(
  userEffectId: string,
  resultBuffer: Buffer
): Promise<string> {
  const resultKey = `effects/${userEffectId}.jpg`;
  await uploadToR2(resultBuffer, resultKey, 'image/jpeg');
  
  const resultUrl = getPublicUrl(resultKey);
  
  await prisma.userEffect.update({
    where: { id: userEffectId },
    data: {
      resultUrl,
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  });

  return resultUrl;
}
```

## CORS Configuration

```json
// R2 bucket CORS rules (via Cloudflare dashboard or API)
[
  {
    "AllowedOrigins": ["https://photomania.ai", "http://localhost:3000"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```






