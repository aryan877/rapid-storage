import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UploadRequest {
  fileName: string;
  fileType: string;
  fileSize: number;
  folderId?: string;
}

// AWS S3 Client using Web API
class S3Client {
  private accessKeyId: string;
  private secretAccessKey: string;
  private region: string;
  private bucket: string;

  constructor(accessKeyId: string, secretAccessKey: string, region: string, bucket: string) {
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.region = region;
    this.bucket = bucket;
  }

  async createPresignedPost(params: {
    Key: string;
    ContentType: string;
    ContentLengthRange: [number, number];
    Expires: number;
  }) {
    const { Key, ContentType, ContentLengthRange, Expires } = params;

    const date = new Date();
    const dateString = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateShort = dateString.slice(0, 8);

    const credential = `${this.accessKeyId}/${dateShort}/${this.region}/s3/aws4_request`;
    const expiration = new Date(Date.now() + Expires * 1000).toISOString();

    const policy = {
      expiration,
      conditions: [
        { bucket: this.bucket },
        { key: Key },
        { 'Content-Type': ContentType },
        ['content-length-range', ContentLengthRange[0], ContentLengthRange[1]],
        { 'x-amz-algorithm': 'AWS4-HMAC-SHA256' },
        { 'x-amz-credential': credential },
        { 'x-amz-date': dateString },
      ],
    };

    const policyBase64 = btoa(JSON.stringify(policy));

    // Create signing key
    const kDate = await this.hmac(`AWS4${this.secretAccessKey}`, dateShort);
    const kRegion = await this.hmac(kDate, this.region);
    const kService = await this.hmac(kRegion, 's3');
    const kSigning = await this.hmac(kService, 'aws4_request');

    // Sign the policy
    const signature = await this.hmac(kSigning, policyBase64);
    const signatureHex = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return {
      url: `https://${this.bucket}.s3.${this.region}.amazonaws.com/`,
      fields: {
        key: Key,
        'Content-Type': ContentType,
        'x-amz-algorithm': 'AWS4-HMAC-SHA256',
        'x-amz-credential': credential,
        'x-amz-date': dateString,
        policy: policyBase64,
        'x-amz-signature': signatureHex,
      },
    };
  }

  private async hmac(key: string | ArrayBuffer, data: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      typeof key === 'string' ? new TextEncoder().encode(key) : key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    return await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST') {
      const { fileName, fileType, fileSize, folderId }: UploadRequest = await req.json();

      // Max file size: 5GB
      const maxFileSize = 5 * 1024 * 1024 * 1024;

      if (fileSize > maxFileSize) {
        return new Response(
          JSON.stringify({
            error: 'File size exceeds 5GB limit.',
          }),
          { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 15);
      const s3Key = `${user.id}/${timestamp}-${randomSuffix}-${fileName}`;

      const region = Deno.env.get('AWS_REGION') ?? 'us-east-1';
      const bucket = Deno.env.get('AWS_S3_BUCKET') ?? '';
      const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID') ?? '';
      const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY') ?? '';

      if (!bucket || !accessKeyId || !secretAccessKey) {
        return new Response(JSON.stringify({ error: 'AWS configuration missing' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create S3 client
      const s3Client = new S3Client(accessKeyId, secretAccessKey, region, bucket);

      // Generate presigned POST
      const presignedPost = await s3Client.createPresignedPost({
        Key: s3Key,
        ContentType: fileType,
        ContentLengthRange: [0, maxFileSize],
        Expires: 3600, // 1 hour
      });

      // Insert file record
      const { data: fileRecord, error: dbError } = await supabaseClient
        .from('files')
        .insert({
          name: fileName,
          original_name: fileName,
          mime_type: fileType,
          size_bytes: fileSize,
          folder_id: folderId || null,
          user_id: user.id,
          s3_key: s3Key,
          s3_url: `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`,
        })
        .select()
        .single();

      if (dbError) {
        return new Response(
          JSON.stringify({ error: 'Failed to create file record', details: dbError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          uploadUrl: presignedPost.url,
          fileId: fileRecord.id,
          formData: presignedPost.fields,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
