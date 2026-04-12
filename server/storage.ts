// Cloudinary storage integration for file uploads
import { v2 as cloudinary } from "cloudinary";
import { ENV } from "./_core/env";

function getCloudinaryConfig() {
  const cloudName = ENV.cloudinaryCloudName;
  const apiKey = ENV.cloudinaryApiKey;
  const apiSecret = ENV.cloudinaryApiSecret;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary credentials missing: set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET"
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });

  return { cloudName, apiKey, apiSecret };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  getCloudinaryConfig();

  // Convert data to buffer if needed
  let buffer: Buffer;
  if (typeof data === "string") {
    buffer = Buffer.from(data);
  } else if (data instanceof Uint8Array) {
    buffer = Buffer.from(data);
  } else {
    buffer = data;
  }

  // Extract filename from relKey
  const fileName = relKey.split("/").pop() || "file";
  const publicId = `gis-mapper/${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: "auto",
        folder: "gis-mapper",
      },
      (error, result) => {
        if (error) {
          reject(
            new Error(
              `Cloudinary upload failed: ${error.message}`
            )
          );
        } else if (result) {
          resolve({
            key: publicId,
            url: result.secure_url,
          });
        }
      }
    );

    uploadStream.end(buffer);
  });
}

export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  getCloudinaryConfig();

  // For Cloudinary, we can construct the URL directly
  // since files are already publicly accessible
  const { cloudName } = getCloudinaryConfig();
  const url = `https://res.cloudinary.com/${cloudName}/image/upload/${relKey}`;

  return {
    key: relKey,
    url,
  };
}
