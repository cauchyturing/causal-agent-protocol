// src/security/rate-limiter.ts
//
// In-memory sliding-window rate limiter.
// Production deployments should replace with Redis-backed implementation.

const WINDOW_MS = 60 * 60 * 1000; // 1 hour

interface ClientBucket {
  timestamps: number[];
}

export class RateLimiter {
  private buckets = new Map<string, ClientBucket>();

  private prune(bucket: ClientBucket, now: number): void {
    const cutoff = now - WINDOW_MS;
    bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);
  }

  private getBucket(clientId: string): ClientBucket {
    let bucket = this.buckets.get(clientId);
    if (!bucket) {
      bucket = { timestamps: [] };
      this.buckets.set(clientId, bucket);
    }
    return bucket;
  }

  /** Check if the client is within the rate limit. */
  check(clientId: string, limit: number): boolean {
    const bucket = this.getBucket(clientId);
    this.prune(bucket, Date.now());
    return bucket.timestamps.length < limit;
  }

  /** Record a request for the client. */
  record(clientId: string): void {
    const bucket = this.getBucket(clientId);
    bucket.timestamps.push(Date.now());
  }

  /** Get remaining requests for the client. */
  remaining(clientId: string, limit: number): number {
    const bucket = this.getBucket(clientId);
    this.prune(bucket, Date.now());
    return Math.max(0, limit - bucket.timestamps.length);
  }
}
