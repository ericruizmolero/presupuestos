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
