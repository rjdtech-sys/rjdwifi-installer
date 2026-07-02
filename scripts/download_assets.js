const https = require('https');
const fs = require('fs');
const path = require('path');

const url = 'https://cdn.tailwindcss.com';
const dest = path.join(__dirname, '../dist/tailwind.js');

// Ensure dist exists
const distDir = path.dirname(dest);
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

console.log(`Downloading Tailwind CSS to ${dest}...`);

function download(downloadUrl, redirectsRemaining = 5) {
  https.get(downloadUrl, function(response) {
    const statusCode = response.statusCode || 0;

    if ([301, 302, 303, 307, 308].includes(statusCode)) {
      if (!response.headers.location || redirectsRemaining <= 0) {
        console.error(`Failed to download: redirect limit reached (${statusCode})`);
        process.exit(1);
      }

      const redirectUrl = new URL(response.headers.location, downloadUrl).toString();
      console.log(`Redirecting to ${redirectUrl}...`);
      response.resume();
      download(redirectUrl, redirectsRemaining - 1);
      return;
    }

    if (statusCode !== 200) {
      response.resume();
      console.error(`Failed to download: ${statusCode}`);
      process.exit(1);
    }

    const file = fs.createWriteStream(dest);
    response.pipe(file);
    file.on('finish', function() {
      file.close(() => {
        console.log('Download completed.');
        process.exit(0);
      });
    });
    file.on('error', function(err) {
      fs.unlink(dest, () => {});
      console.error('Error writing file:', err.message);
      process.exit(1);
    });
  }).on('error', function(err) {
    fs.unlink(dest, () => {});
    console.error('Error downloading file:', err.message);
    process.exit(1);
  });
}

download(url);
