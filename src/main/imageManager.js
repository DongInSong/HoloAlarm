const fs = require('fs');
const path = require('path');
const https = require('https');
const { app } = require('electron');

function getCacheDir() {
  const dir = path.join(app.getPath('userData'), 'icon-cache');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getCachedIconPath(channelId) {
  // Use a consistent extension, as the downloaded file will be piped regardless of original type.
  return path.join(getCacheDir(), `${channelId}.png`);
}

function downloadAndCacheImage(url, channelId, callback) {
  if (!url) {
    return callback(null);
  }

  // Ensure URL has a protocol
  let fullUrl = url;
  if (fullUrl.startsWith('//')) {
    fullUrl = 'https:' + fullUrl;
  }
  // Sanitize URL to a known working size to prevent 404s
  fullUrl = fullUrl.replace(/=s\d+-c-k-c0x00ffffff-no-rj/, "=s88-c-k-c0x00ffffff-no-rj");


  const cachePath = getCachedIconPath(channelId);

  if (fs.existsSync(cachePath)) {
    callback(cachePath);
    return;
  }

  const file = fs.createWriteStream(cachePath);
  https.get(fullUrl, (response) => {
    // Check for non-200 responses
    if (response.statusCode !== 200) {
      console.error(`Image download failed: Status code ${response.statusCode} for URL ${fullUrl}`);
      file.close();
      fs.unlink(cachePath, () => {}); // Clean up empty file
      callback(null);
      return;
    }

    response.pipe(file);
    file.on('finish', () => {
      file.close(() => callback(cachePath));
    });
  }).on('error', (err) => {
    console.error("Image download failed:", err);
    fs.unlink(cachePath, () => {}); // Clean up failed download
    callback(null);
  });
}

module.exports = {
  downloadAndCacheImage,
};
