import { S3Client } from 'jsr:@bradenmacdonald/s3-lite-client@0.9.2';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
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

    const body = await req.json();
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

    const s3Client = new S3Client({
      endPoint: `https://s3.${region}.amazonaws.com`,
      region,
      accessKey: accessKeyId,
      secretKey: secretAccessKey,
      bucket,
    });

    // Mode 1: Get Presigned URL for upload
    if (body.action === 'get-presigned-url') {
      const { fileName, fileType, fileSize } = body;
      const maxFileSize = 5 * 1024 * 1024 * 1024; // 5GB

      if (fileSize > maxFileSize) {
        return new Response(JSON.stringify({ error: 'File size exceeds 5GB limit.' }), {
          status: 413,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 15);
      const s3Key = `${user.id}/${timestamp}-${randomSuffix}-${fileName}`;

      const { url, fields } = await s3Client.presignedPostObject(s3Key, {
        expirySeconds: 3600, // 1 hour
        fields: {
          'Content-Type': fileType,
        },
        conditions: [['content-length-range', 0, maxFileSize]],
      });

      return new Response(
        JSON.stringify({
          uploadUrl: url,
          s3Key,
          formData: fields,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mode 2: Create File Record
    if (body.action === 'create-file-record') {
      const { s3Key, fileName, fileType, fileSize, folderId } = body;

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
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(JSON.stringify({ fileRecord }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mode 3: Get Signed URL for download/preview
    if (body.action === 'get-signed-url') {
      const { s3Key } = body;
      if (!s3Key) {
        return new Response(JSON.stringify({ error: 's3Key is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const signedUrl = await s3Client.presignedGetObject(s3Key, {
        expirySeconds: 3600, // Expires in 1 hour
      });

      return new Response(JSON.stringify({ signedUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mode 4: Delete File from S3
    if (body.action === 'delete-file') {
      const { s3Key } = body;
      if (!s3Key) {
        return new Response(JSON.stringify({ error: 's3Key is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        await s3Client.deleteObject(s3Key);
        return new Response(JSON.stringify({ success: true, message: 'File deleted from S3' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (s3Error) {
        console.error('S3 Deletion Error:', s3Error);
        return new Response(
          JSON.stringify({
            error: 'Failed to delete file from S3',
            details: (s3Error as Error).message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
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
