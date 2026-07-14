function extractVideoId(url) {
  if (!url) return null;
  const m = url.match(/(?:v=|\/embed\/|youtu\.be\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  const bare = url.match(/^[A-Za-z0-9_-]{11}$/);
  return bare ? bare[0] : null;
}

console.log("extractVideoId('https://youtu.be/gDCDhJTx0iI') =>", extractVideoId('https://youtu.be/gDCDhJTx0iI'));
