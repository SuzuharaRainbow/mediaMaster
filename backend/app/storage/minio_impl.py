import boto3
from botocore.client import Config
from .base import StorageService
from ..deps import settings

def _publicize(url: str) -> str:
    # 把 minio 内网端点替换成浏览器可访问的端点（本地用 localhost，线上用 CDN/外网域名）
    return url.replace(settings.S3_ENDPOINT, settings.PUBLIC_S3_ENDPOINT) if settings.PUBLIC_S3_ENDPOINT else url

class MinioStorage(StorageService):
    def __init__(self):
        self.bucket = settings.S3_BUCKET
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            config=Config(signature_version="s3v4", s3={"addressing_style": "path" if settings.S3_PATH_STYLE else "virtual"}),
            region_name=settings.S3_REGION,
        )
    def presign_put(self, key, content_type, ttl):
        url = self.client.generate_presigned_url(
            "put_object",
            Params={"Bucket": self.bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=ttl,
        )
        return _publicize(url)

    def presign_get(self, key, ttl):
        url = self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=ttl,
        )
        return _publicize(url)

    def delete(self, key):
        self.client.delete_object(Bucket=self.bucket, Key=key)