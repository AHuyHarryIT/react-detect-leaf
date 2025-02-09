import React, { useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import axios from "axios";

const API_KEY = import.meta.env.VITE_API_KEY;
const API_URL = import.meta.env.VITE_API_URL;

const videoConstraints = {
  width: 1280,
  height: 720,
  facingMode: "environment", // Use the back camera on mobile devices
};

interface ProcessedImage {
  id: string;
  originalImageUrl: string;
  processedImageUrl?: string;
  status: "uploading" | "done" | "error";
  source: "file" | "webcam";
  details?: {
    upload_message: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    predictions: any;
  };
}

const Camera: React.FC = () => {
  // Camera is off by default.
  const [cameraOn, setCameraOn] = useState<boolean>(false);
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([]);
  // Loading state for the capture button.
  const [loading, setLoading] = useState<boolean>(false);
  // Separate loading state for file uploads.
  const [uploadLoading, setUploadLoading] = useState<boolean>(false);
  // Track the cumulative number of files selected.
  const [selectedFileCount, setSelectedFileCount] = useState<number>(0);
  const [selectedImage, setSelectedImage] = useState<ProcessedImage | null>(
    null,
  );

  // Compute counts.
  const uploadedCount = processedImages.filter(
    (img) => img.status === "done",
  ).length;
  const errorCount = processedImages.filter(
    (img) => img.status === "error",
  ).length;

  // Function to send an image to the API and update its status.
  const processImage = async (imageDataUrl: string, id: string) => {
    try {
      const response = await axios.post(
        API_URL,
        {
          api_key: API_KEY,
          inputs: { image: { type: "url", value: imageDataUrl } },
        },
        { headers: { "Content-Type": "application/json" } },
      );
      const processedBase64 = response.data.outputs?.[0]?.output_image?.value;
      const details = response.data.outputs?.[0];
      if (processedBase64 && details) {
        const processedImageUrl = `data:image/jpeg;base64,${processedBase64}`;
        setProcessedImages((prev) =>
          prev.map((img) =>
            img.id === id
              ? {
                  ...img,
                  processedImageUrl,
                  status: "done",
                  details: {
                    upload_message: details.upload_message,
                    predictions: details.predictions,
                  },
                }
              : img,
          ),
        );
      } else {
        setProcessedImages((prev) =>
          prev.map((img) =>
            img.id === id ? { ...img, status: "error" } : img,
          ),
        );
      }
    } catch (error) {
      console.error("Error processing image:", error);
      setProcessedImages((prev) =>
        prev.map((img) => (img.id === id ? { ...img, status: "error" } : img)),
      );
    }
  };

  // Handle a new image (from webcam capture or file upload) and insert it at the beginning.
  const handleNewImage = async (
    imageDataUrl: string,
    source: "file" | "webcam" = "file",
  ) => {
    const id =
      Date.now().toString() + Math.random().toString(36).substring(2, 5);
    setProcessedImages((prev) => [
      { id, originalImageUrl: imageDataUrl, status: "uploading", source },
      ...prev,
    ]);
    await processImage(imageDataUrl, id);
  };

  // Capture an image from the webcam and process it.
  const capture = useCallback(async () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setLoading(true);
        await handleNewImage(imageSrc, "webcam");
        setLoading(false);
      }
    }
  }, []);

  // Handle file input change for multiple uploads.
  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (files) {
      setSelectedFileCount((prev) => prev + files.length);
      const filesArray = Array.from(files);
      setUploadLoading(true);
      for (const file of filesArray) {
        await new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const imageDataUrl = reader.result as string;
            await handleNewImage(imageDataUrl, "file");
            resolve();
          };
          reader.readAsDataURL(file);
        });
      }
      setUploadLoading(false);
    }
  };

  // Allow drag-and-drop for file uploads.
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const files = event.dataTransfer.files;
    if (files) {
      setSelectedFileCount((prev) => prev + files.length);
      const filesArray = Array.from(files);
      setUploadLoading(true);
      for (const file of filesArray) {
        await new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const imageDataUrl = reader.result as string;
            await handleNewImage(imageDataUrl, "file");
            resolve();
          };
          reader.readAsDataURL(file);
        });
      }
      setUploadLoading(false);
    }
  };

  // Re-upload handler for images with errors.
  const handleReupload = async (id: string) => {
    setProcessedImages((prev) =>
      prev.map((img) =>
        img.id === id ? { ...img, status: "uploading" } : img,
      ),
    );
    const image = processedImages.find((img) => img.id === id);
    if (image) {
      await processImage(image.originalImageUrl, id);
    }
  };

  return (
    <div className="flex flex-col items-center p-4">
      {/* Camera Toggle Button */}
      <div className="mb-4">
        <button
          onClick={() => setCameraOn((prev) => !prev)}
          className="rounded bg-purple-500 px-4 py-2 text-white hover:bg-purple-600 focus:outline-none"
        >
          {cameraOn ? "Turn Camera Off" : "Turn Camera On"}
        </button>
      </div>

      {/* Webcam Section */}
      {cameraOn ? (
        <div className="mb-4">
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            className="rounded-lg shadow-md"
          />
        </div>
      ) : (
        <div className="mb-4 rounded border p-4 text-gray-600">
          Camera is off. Press the button above to turn it on.
        </div>
      )}

      {/* Capture Button */}
      {cameraOn && (
        <div className="mb-4 flex space-x-4">
          <button
            onClick={capture}
            className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:outline-none"
            disabled={loading}
          >
            {loading ? "Processing..." : "Capture & Process"}
          </button>
        </div>
      )}

      {/* Custom File Upload Box */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="mt-4 w-full max-w-3xl cursor-pointer rounded-lg border-2 border-dashed border-gray-400 p-8 text-center hover:border-blue-500"
      >
        <p className="text-gray-600">
          {uploadLoading
            ? "Processing Uploads..."
            : "Click here or drag and drop files to upload images"}
        </p>
        <input
          type="file"
          accept="image/*"
          multiple
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Display Cumulative Selected File Count */}
      {selectedFileCount > 0 && (
        <div className="mt-2 text-sm text-gray-600">
          Files Selected: {selectedFileCount}
        </div>
      )}

      {/* Display Uploaded Count */}
      <div className="mt-1 text-sm text-gray-600">
        Images Uploaded: {uploadedCount}
      </div>

      {/* Main Processed Images List */}
      {processedImages.length > 0 && (
        <div className="mt-8 w-full max-w-3xl">
          <h3 className="mb-4 text-xl font-semibold">Processed Images:</h3>
          <div className="flex max-h-64 flex-wrap gap-4 overflow-y-scroll rounded border p-2">
            {processedImages.map((img) => (
              <div
                key={img.id}
                className="relative cursor-pointer rounded border p-1 hover:shadow-lg"
                onClick={() => setSelectedImage(img)}
              >
                <img
                  src={img.processedImageUrl || img.originalImageUrl}
                  alt="Processed result"
                  className="h-24 w-24 object-cover"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {img.status === "uploading" && (
                    <span className="bg-opacity-75 rounded bg-gray-700 px-1 text-xs text-white">
                      Uploading...
                    </span>
                  )}
                  {img.status === "error" && (
                    <>
                      <span className="bg-opacity-75 rounded bg-red-700 px-1 text-xs text-white">
                        Error
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReupload(img.id);
                        }}
                        className="mt-1 text-xs text-blue-300 underline"
                      >
                        Re-upload
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Separate List of Upload Errors (optional) */}
      {errorCount > 0 && (
        <div className="mt-8 w-full max-w-3xl">
          <h3 className="mb-4 text-xl font-semibold">Upload Errors:</h3>
          <div className="flex max-h-64 flex-wrap gap-4 overflow-y-scroll rounded border p-2">
            {processedImages
              .filter((img) => img.status === "error")
              .map((img) => (
                <div
                  key={img.id}
                  className="relative cursor-pointer rounded border p-1 hover:shadow-lg"
                >
                  <img
                    src={img.originalImageUrl}
                    alt="Error result"
                    className="h-24 w-24 object-cover"
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="bg-opacity-75 rounded bg-red-700 px-1 text-xs text-white">
                      Error
                    </span>
                    <button
                      onClick={() => handleReupload(img.id)}
                      className="mt-1 text-xs text-blue-300 underline"
                    >
                      Re-upload
                    </button>
                  </div>
                </div>
              ))}
          </div>
          <div className="mt-1 text-sm text-gray-600">
            Total Upload Errors: {errorCount}
          </div>
        </div>
      )}

      {/* Detail View for Selected Processed Image */}
      {selectedImage && (
        <div className="mt-8 w-full max-w-md rounded bg-white p-4 shadow-md">
          <button
            className="mb-4 text-blue-500 underline"
            onClick={() => setSelectedImage(null)}
          >
            Back to list
          </button>
          <h3 className="mb-2 text-lg font-semibold">
            Processed Image Details:
          </h3>
          <img
            src={
              selectedImage.processedImageUrl || selectedImage.originalImageUrl
            }
            alt="Detail"
            className="mb-4 rounded-lg shadow-md"
          />
          {selectedImage.status === "uploading" && (
            <p className="mb-2 text-sm text-gray-600">
              Image is still uploading...
            </p>
          )}
          {selectedImage.status === "error" && (
            <p className="mb-2 text-sm text-red-600">Failed to upload image.</p>
          )}
          {selectedImage.status === "done" && selectedImage.details && (
            <>
              <p className="mb-2 text-sm text-gray-600">
                {selectedImage.details.upload_message}
              </p>
              <div>
                <h4 className="font-semibold">Predictions:</h4>
                <pre className="overflow-x-auto text-sm">
                  {JSON.stringify(selectedImage.details.predictions, null, 2)}
                </pre>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Camera;
