import { create } from "zustand";
import { enableMapSet } from "immer";
import { immer } from "zustand/middleware/immer";
import { uploadFileToStorage } from "../http/upload-file-to-storage";
import { CanceledError } from "axios";
import { useShallow } from "zustand/shallow";
import { compressImage } from "../utils/compress-image";

export type Upload = {
  name: string
  file: File
  abortController: AbortController
  status: 'progress' | 'success' | 'error' | 'cancelled'
  originalSizeInBytes: number
  compressedSizeInBytes?: number
  uploadSizeInBytes: number
  remoteUrl?: string
}

type UploadState = {
  uploads: Map<string, Upload>
  addUploads: (files: File[]) => void
  cancelUpload: (uploadId: string) => void
}

enableMapSet() // Enable Map and Set support in immer

export const useUploads = create<UploadState, [['zustand/immer', never]]>(
  immer((set, get) => {
    function updateUpload(uploadId: string, data: Partial<Upload>) {
      const upload = get().uploads.get(uploadId)

      if (!upload) {
        return
      }

      set(state => {
        state.uploads.set(uploadId, {
          ...upload,
          ...data,
        })
      })
    }
    
    async function processUpload(uploadId: string) {
      const upload = get().uploads.get(uploadId)

      if (!upload) {
        return
      }

      try {
        const compressedFile = await compressImage({
          file: upload.file,
          maxWidth: 800,
          maxHeight: 800,
          quality: 0.8,
        })

        updateUpload(uploadId, { compressedSizeInBytes: compressedFile.size })

        const { url } = await uploadFileToStorage(
          { 
            file: compressedFile,
            onProgress(sizeInBytes) {
              updateUpload(uploadId, { uploadSizeInBytes: sizeInBytes })
            }
          }, 
          {signal: upload.abortController.signal}
        )
        
        console.log('File uploaded to:', url)
        updateUpload(uploadId, { status: 'success', remoteUrl: url })
      } catch (err) {
        console.log(err)
        if (err instanceof CanceledError) {
          updateUpload(uploadId, { status: 'cancelled' })
          
          return
        }

        updateUpload(uploadId, { status: 'error' })
      }
    }

    function cancelUpload(uploadId: string) {
      set(state => {
        const upload = state.uploads.get(uploadId)

        if (!upload) {
          return
        }

        upload.abortController.abort()
      })
    }

    function addUploads(files: File[]) {
      for (const file of files) {
        const uploadId = crypto.randomUUID()
        const abortController = new AbortController()

        const upload: Upload = {
          name: file.name,
          file,
          abortController,
          status: 'progress',
          originalSizeInBytes: file.size,
          uploadSizeInBytes: 0,
        }

        set(state => {
          state.uploads.set(uploadId, upload)
        })

        processUpload(uploadId)
      }
    }

    return {
      uploads: new Map(),
      addUploads,
      cancelUpload
    }
})
)

export const usePendingUploads = () => {
  return useUploads(useShallow(store => {
      const isThereAnyPendingUploads = Array.from(store.uploads.values()).some(upload => upload.status === 'progress')

      if (!isThereAnyPendingUploads) {
        return {
          isThereAnyPendingUploads,
          globalProgress: 100,
        }
      }

      const { total, uploaded } = Array.from(store.uploads.values()).reduce((acc, upload) => {
        if (upload.compressedSizeInBytes) {
          acc.uploaded += upload.uploadSizeInBytes
        }

        acc.total += upload.compressedSizeInBytes || upload.originalSizeInBytes

        return acc
      },
        {total: 0, uploaded: 0}
      )

    const globalProgress = Math.min(100, Math.round((uploaded * 100) / total))

    return {
        isThereAnyPendingUploads,
        globalProgress,
    }
    })
  )
}