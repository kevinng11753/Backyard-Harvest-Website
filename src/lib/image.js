// Phone photos are often 4–8 MB. Shrink them to a 1200px JPEG
// (usually under 300 KB) before uploading, so posting is fast on
// mobile data and storage stays inside the free tier.
export async function compressImage(file, maxSize = 1200, quality = 0.8) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not read that photo. Try a JPG or PNG.'))),
      'image/jpeg',
      quality
    )
  })
}

// Turn a Blob into a data: URL (used by demo mode to keep photos in the browser).
export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
