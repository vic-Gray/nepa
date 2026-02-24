import { Request, Response, NextFunction } from 'express';
import { brotliCompressSync, constants, gzipSync } from 'zlib';

const isCompressibleType = (contentType: string | number | string[] | undefined): boolean => {
  if (typeof contentType !== 'string') {
    return true;
  }

  return (
    contentType.includes('application/json') ||
    contentType.includes('text/') ||
    contentType.includes('application/javascript') ||
    contentType.includes('application/xml')
  );
};

export const responseCompression = (thresholdBytes = 1024) => {
  return (_req: Request, res: Response, next: NextFunction) => {
    const acceptEncoding = `${res.req.headers['accept-encoding'] || ''}`;
    const supportsBrotli = acceptEncoding.includes('br');
    const supportsGzip = acceptEncoding.includes('gzip');

    if (!supportsBrotli && !supportsGzip) {
      next();
      return;
    }

    const encoding = supportsBrotli ? 'br' : 'gzip';

    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    const chunks: Buffer[] = [];

    (res.write as unknown) = ((chunk: any, ...args: any[]) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      if (args.length > 0 && typeof args[0] === 'function') {
        args[0]();
      } else if (args.length > 1 && typeof args[1] === 'function') {
        args[1]();
      }

      return true;
    }) as Response['write'];

    (res.end as unknown) = ((chunk?: any, ...args: any[]) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const payload = Buffer.concat(chunks);
      const contentType = res.getHeader('content-type');

      if (payload.length < thresholdBytes || !isCompressibleType(contentType)) {
        return originalEnd(payload, ...args);
      }

      const compressedPayload = encoding === 'br'
        ? brotliCompressSync(payload, {
          params: {
            [constants.BROTLI_PARAM_QUALITY]: 4,
          },
        })
        : gzipSync(payload, { level: 6 });

      res.setHeader('content-encoding', encoding);
      res.setHeader('vary', 'Accept-Encoding');
      res.removeHeader('content-length');

      return originalEnd(compressedPayload, ...args);
    }) as Response['end'];

    next();
  };
};
