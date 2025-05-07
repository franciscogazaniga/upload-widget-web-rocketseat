import { create } from "zustand";
import { enableMapSet } from "immer";
import { immer } from "zustand/middleware/immer";
import { uploadFileToStorage } from "../http/upload-file-to-storage";

export type Upload = {
  name: string
  file: File
  abortController: AbortController
  status: 'progress' | 'success' | 'error' | 'cancelled'
}

type UploadState = {
  uploads: Map<string, Upload>
  addUploads: (files: File[]) => void
  cancelUpload: (uploadId: string) => void
}

enableMapSet() // Enable Map and Set support in immer

export const useUploads = create<UploadState, [['zustand/immer', never]]>(
  immer((set, get) => {
    async function processUpload(uploadId: string) {
      const upload = get().uploads.get(uploadId)

      if (!upload) {
        return
      }

      try {
        await uploadFileToStorage(
          { file: upload.file }, 
          {signal: upload.abortController.signal}
        )
  
        set(state => {
          state.uploads.set(uploadId, {
            ...upload,
            status: 'success',
          })
        })
      } catch {
        set(state => {
          state.uploads.set(uploadId, {
            ...upload,
            status: 'error',
          })
        })
      }
    }

    function cancelUpload(uploadId: string) {
      set(state => {
        const upload = state.uploads.get(uploadId)

        if (!upload) {
          return
        }

        upload.abortController.abort()

        upload.status = 'cancelled'
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