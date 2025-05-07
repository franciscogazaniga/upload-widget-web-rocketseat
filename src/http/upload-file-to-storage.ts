import axios from "axios";

interface uploadFileToStorageParams {
  file: File;
}

interface uploadFileToStorageOptions {
  signal?: AbortSignal;
}

export async function uploadFileToStorage({ file }: uploadFileToStorageParams, opts?: uploadFileToStorageOptions) {
  const data = new FormData();
  data.append("file", file);

  const response = await axios.post<{ url: string }>("http://localhost:3333/uploads", data, {
    headers: {
      "Content-Type": "multipart/form-data",   
    },
    signal: opts?.signal,
  });

  return { url: response.data.url };
}