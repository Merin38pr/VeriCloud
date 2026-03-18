import hashlib
from pybloom_live import BloomFilter

class FileBloomFilter:
    def __init__(self, error_rate=0.01, chunk_size=1024):
        self.error_rate = error_rate
        self.chunk_size = chunk_size

    def _hash_chunk(self, chunk: bytes) -> str:
        return hashlib.sha256(chunk).hexdigest()

    def create_bloom_hash(self, file_bytes: bytes) -> str:
        # Split file into chunks
        chunks = [
            file_bytes[i:i + self.chunk_size]
            for i in range(0, len(file_bytes), self.chunk_size)
        ]

        bloom = BloomFilter(
            capacity=len(chunks),
            error_rate=self.error_rate
        )

        for chunk in chunks:
            bloom.add(self._hash_chunk(chunk))

        # Hash the Bloom filter bit array
        bloom_hash = hashlib.sha256(
            bloom.bitarray.tobytes()
        ).hexdigest()

        return bloom_hash
