'use strict';
const https = require('https');
const fs = require('fs');
const { URL } = require('url');

const UPLOAD_INIT_URL = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';
const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MiB — matches the resumable-upload chunking YouTube expects

function tryParse(data) { try { return JSON.parse(data); } catch { return data; } }

function requestJson(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(u, { method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data ? tryParse(data) : null }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

class YouTubeUploadClient {
  // getAccessToken: () => Promise<string>, from YouTubeAuth
  constructor(getAccessToken) {
    this.getAccessToken = getAccessToken;
  }

  // metadata: { title, description, tags: string[], privacyStatus: 'private'|'unlisted'|'public' }
  // onProgress({ phase, phaseWarn, uploadedBytes, totalBytes })
  // Returns the created video resource (has .id) on success.
  async upload(filePath, metadata, onProgress) {
    const token = await this.getAccessToken();
    const size = fs.statSync(filePath).size;

    onProgress({ phase: 'Creating upload session…' });
    const initBody = JSON.stringify({
      snippet: { title: metadata.title, description: metadata.description, tags: metadata.tags },
      status: { privacyStatus: metadata.privacyStatus },
    });
    const init = await requestJson('POST', UPLOAD_INIT_URL, {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'video/mp4',
      'X-Upload-Content-Length': String(size),
      'Content-Length': Buffer.byteLength(initBody),
    }, initBody);

    const uploadUrl = init.headers.location;
    if (!uploadUrl) throw new Error(`Could not start upload session (HTTP ${init.status}): ${JSON.stringify(init.body)}`);

    const fd = fs.openSync(filePath, 'r');
    try {
      let offset = 0;
      while (offset < size) {
        const end = Math.min(offset + CHUNK_SIZE, size);
        const buf = Buffer.alloc(end - offset);
        fs.readSync(fd, buf, 0, buf.length, offset);

        onProgress({
          phase: `Uploading chunk ${Math.floor(offset / CHUNK_SIZE) + 1} of ${Math.ceil(size / CHUNK_SIZE)} · 8 MiB chunks`,
          uploadedBytes: offset,
          totalBytes: size,
        });

        let result;
        try {
          result = await this.putChunk(uploadUrl, buf, offset, end, size);
        } catch {
          onProgress({ phase: 'Connection dropped — asking the session where it got to…', phaseWarn: true, uploadedBytes: offset, totalBytes: size });
          offset = await this.queryResumeOffset(uploadUrl, size);
          onProgress({ phase: `Resumed from ${(offset / 1e6).toFixed(1)} MB — YouTube confirmed the offset`, uploadedBytes: offset, totalBytes: size });
          continue;
        }

        if (result.status === 200 || result.status === 201) {
          onProgress({ phase: 'Processing on YouTube…', uploadedBytes: size, totalBytes: size });
          return result.body;
        }
        if (result.status === 308) {
          offset = end;
          continue;
        }
        throw new Error(`Upload failed (HTTP ${result.status}): ${JSON.stringify(result.body)}`);
      }
    } finally {
      fs.closeSync(fd);
    }
    throw new Error('Upload session ended without a completed video');
  }

  putChunk(uploadUrl, buf, start, end, total) {
    return new Promise((resolve, reject) => {
      const u = new URL(uploadUrl);
      const req = https.request(u, {
        method: 'PUT',
        headers: { 'Content-Length': buf.length, 'Content-Range': `bytes ${start}-${end - 1}/${total}` },
      }, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data ? tryParse(data) : null }));
      });
      req.on('error', reject);
      req.write(buf);
      req.end();
    });
  }

  // Per YouTube's resumable-upload protocol: an empty PUT with Content-Range: bytes */total
  // returns 308 with a Range header telling us how many bytes it actually has, so we can
  // resume from there instead of re-uploading the whole file after a dropped connection.
  queryResumeOffset(uploadUrl, total) {
    return new Promise((resolve, reject) => {
      const u = new URL(uploadUrl);
      const req = https.request(u, {
        method: 'PUT',
        headers: { 'Content-Length': 0, 'Content-Range': `bytes */${total}` },
      }, (res) => {
        res.resume();
        if (res.statusCode === 308 && res.headers.range) {
          const match = /bytes=0-(\d+)/.exec(res.headers.range);
          resolve(match ? Number(match[1]) + 1 : 0);
        } else {
          resolve(0);
        }
      });
      req.on('error', reject);
      req.end();
    });
  }

  async setThumbnail(videoId, imagePath) {
    const token = await this.getAccessToken();
    const buf = fs.readFileSync(imagePath);
    const ext = imagePath.split('.').pop().toLowerCase();
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
    return requestJson('POST', `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}`, {
      Authorization: `Bearer ${token}`,
      'Content-Type': mime,
      'Content-Length': buf.length,
    }, buf);
  }
}

module.exports = { YouTubeUploadClient };
