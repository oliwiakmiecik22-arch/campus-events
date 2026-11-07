import path from 'node:path';

export function createSpaFallback(frontendDirectory) {
  const indexFile = path.join(frontendDirectory, 'index.html');

  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }
    res.sendFile(indexFile);
  };
}
