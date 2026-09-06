import { api, type MediaAsset } from "@/components/types";

type UploadProgress = (percentage: number) => void;
type LocalUpload = {
  mode: "local";
  maxBytes: number;
  acceptedTypes: readonly string[];
};
type CloudinaryUpload = {
  mode: "cloudinary";
  uploadUrl: string;
  apiKey: string;
  signature: string;
  timestamp: number;
  publicId: string;
  uploadType: string;
  overwrite: string;
  maxBytes: number;
  acceptedTypes: readonly string[];
};
type CloudinaryResponse = {
  public_id: string;
  version: number;
  signature: string;
  bytes: number;
  width: number;
  height: number;
  duration?: number;
  error?: { message?: string };
};

function postChunk(
  config: CloudinaryUpload,
  file: File,
  chunk: Blob,
  start: number,
  end: number,
  uploadId: string,
  onProgress: UploadProgress,
) {
  return new Promise<CloudinaryResponse>((resolve, reject) => {
    const form = new FormData();
    form.set("file", chunk, file.name);
    form.set("api_key", config.apiKey);
    form.set("signature", config.signature);
    form.set("timestamp", String(config.timestamp));
    form.set("public_id", config.publicId);
    form.set("type", config.uploadType);
    form.set("overwrite", config.overwrite);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", config.uploadUrl);
    if (file.size > chunk.size || start > 0) {
      xhr.setRequestHeader("X-Unique-Upload-Id", uploadId);
      xhr.setRequestHeader(
        "Content-Range",
        `bytes ${start}-${end - 1}/${file.size}`,
      );
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(
          Math.min(99, Math.round(((start + event.loaded) / file.size) * 100)),
        );
    };
    xhr.onerror = () => reject(new Error("The video upload was interrupted."));
    xhr.onload = () => {
      let response: CloudinaryResponse;
      try {
        response = JSON.parse(xhr.responseText) as CloudinaryResponse;
      } catch {
        reject(new Error("Cloudinary returned an unreadable response."));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(
          new Error(response.error?.message || "Cloudinary upload failed."),
        );
        return;
      }
      resolve(response);
    };
    xhr.send(form);
  });
}

export async function uploadVideo(
  file: File,
  altText: string,
  onProgress: UploadProgress,
) {
  const config = await api<LocalUpload | CloudinaryUpload>(
    "media/sign-upload",
    "POST",
    { filename: file.name, mimeType: file.type, bytes: file.size },
  );
  if (!config.acceptedTypes.includes(file.type))
    throw new Error("Use an MP4, MOV or WebM video.");
  if (file.size > config.maxBytes)
    throw new Error(
      config.mode === "local"
        ? "Local demo videos must be under 3 MB. Production uploads directly to Cloudinary."
        : "Use a compressed review copy under 1 GB.",
    );
  if (config.mode === "local") {
    const form = new FormData();
    form.set("file", file);
    form.set("altText", altText);
    onProgress(25);
    const asset = await api<MediaAsset>("media", "POST", form);
    onProgress(100);
    return asset;
  }
  const chunkSize = 20 * 1024 * 1024;
  const uploadId = crypto.randomUUID();
  let response: CloudinaryResponse | null = null;
  for (let start = 0; start < file.size; start += chunkSize) {
    const end = Math.min(file.size, start + chunkSize);
    response = await postChunk(
      config,
      file,
      file.slice(start, end),
      start,
      end,
      uploadId,
      onProgress,
    );
  }
  if (!response?.public_id || !response.version || !response.signature)
    throw new Error("Cloudinary did not confirm the completed video upload.");
  onProgress(99);
  const asset = await api<MediaAsset>("media/complete-video", "POST", {
    publicId: response.public_id,
    version: response.version,
    responseSignature: response.signature,
    mimeType: file.type,
    originalFilename: file.name,
    bytes: response.bytes || file.size,
    width: response.width || 0,
    height: response.height || 0,
    duration: response.duration || 0,
    altText,
  });
  onProgress(100);
  return asset;
}
