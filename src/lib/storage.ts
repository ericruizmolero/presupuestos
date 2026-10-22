import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from './firebase'

export async function uploadFont(
  companyId: string,
  file: File
): Promise<{ url: string; format: 'ttf' | 'otf' | 'woff2' }> {
  const ext = file.name.split('.').pop()?.toLowerCase() as 'ttf' | 'otf' | 'woff2'
  const path = `companies/${companyId}/fonts/${Date.now()}-${file.name}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  const url = await getDownloadURL(storageRef)
  return { url, format: ext }
}

export async function uploadLogo(companyId: string, file: File): Promise<string> {
  const path = `companies/${companyId}/logo/${Date.now()}-${file.name}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

export async function deleteFile(url: string) {
  try {
    const fileRef = ref(storage, url)
    await deleteObject(fileRef)
  } catch {
    // file may not exist
  }
}

/** Reduce una imagen en el navegador (lado mayor ≤ maxSide) antes de subirla */
async function downscale(file: File, maxSide = 1600): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size < 1_500_000) return file
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/webp', 0.85))
}

/** Sube una imagen pegada o adjuntada en una tarea del tablón y devuelve su URL */
export async function uploadTaskImage(companyId: string, file: File): Promise<string> {
  const blob = await downscale(file)
  const ext = blob.type === 'image/webp' ? 'webp' : (file.name.split('.').pop() || 'png')
  const path = `companies/${companyId}/tasks/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, blob, { contentType: blob.type || file.type })
  return getDownloadURL(storageRef)
}
