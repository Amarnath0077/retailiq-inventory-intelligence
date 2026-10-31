import app from '../server.ts';

export default function handler(req: any, res: any) {
  // Normalize req.url if Vercel serverless rewrite strips or alters /api prefix
  if (req && req.url && !req.url.startsWith('/api') && !req.url.startsWith('/_')) {
    req.url = '/api' + (req.url.startsWith('/') ? '' : '/') + req.url;
  }
  return app(req, res);
}

