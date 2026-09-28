#!/bin/sh
# Creates the media bucket and a dedicated, non-root access key for the application.
set -eu

until mc alias set local "http://minio:9000" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do
  echo "waiting for minio..."
  sleep 2
done

mc mb --ignore-existing "local/$S3_BUCKET"
# Only the public/ prefix is anonymously readable. Platforms that pull media (Instagram, Threads,
# TikTok) fetch from here; everything else stays private and is served via presigned URLs.
mc anonymous set download "local/$S3_BUCKET/public"

cat > /tmp/app-policy.json <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:ListBucket", "s3:GetBucketLocation", "s3:ListBucketMultipartUploads"],
      "Resource": ["arn:aws:s3:::$S3_BUCKET"] },
    { "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts"],
      "Resource": ["arn:aws:s3:::$S3_BUCKET/*"] }
  ]
}
POLICY
mc admin policy create local mehwar-app /tmp/app-policy.json
mc admin user add local "$S3_ACCESS_KEY" "$S3_SECRET_KEY"
mc admin policy attach local mehwar-app --user "$S3_ACCESS_KEY" || true
echo "minio ready: bucket '$S3_BUCKET'"
