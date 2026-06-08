# 与 minio_impl 基本相同，只是 endpoint/鉴权来自 .env.prod
from .minio_impl import MinioStorage as S3Storage