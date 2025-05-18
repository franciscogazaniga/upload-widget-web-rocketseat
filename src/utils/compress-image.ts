interface CompressImageParams {
  file: File
  maxWidth?: number
  maxHeight?: number
  quality?: number
}

function convertToWebp(filename: string) {
  const fileParts = filename.split(".")
  const baseName = fileParts.join(".")

  return `${baseName}.webp`
}

export function compressImage({
  file,
  maxWidth = Number.POSITIVE_INFINITY,
  maxHeight = Number.POSITIVE_INFINITY,
  quality = 1,
}: CompressImageParams) {
  const allowedFileTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

  if (!allowedFileTypes.includes(file.type)) {
    throw new Error("Unsupported image format.");
  }

  return new Promise<File>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (event) => {
      const compressedImage = new Image()
  
      compressedImage.onload = () => {
        const canvas = document.createElement("canvas")
  
        let width = compressedImage.width
        let height = compressedImage.height
  
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height
            height = maxHeight
          }
        }
  
        canvas.width = width
        canvas.height = height
  
        const context = canvas.getContext("2d")
  
        if (!context) {
          reject(new Error("Failed to get canvas context."))
          return
        }
  
        context.drawImage(compressedImage, 0, 0, width, height)
  
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Failed to compress image."))
            return
          }
  
          const compressedFile = new File(
            [blob],
            convertToWebp(file.name),
            {
              type: "image/webp",
              lastModified: Date.now(),
            }
          )
  
          resolve(compressedFile)
        }, "image/webp", quality)
      }
  
      compressedImage.src = event.target?.result as string
    }

    reader.readAsDataURL(file)
  })
}