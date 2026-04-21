import { useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader,
} from "lucide-react";
import { projectId, publicAnonKey } from "/utils/supabase/info";

interface InvoiceUploadProps {
  accessToken: string;
  clients: any[];
}

interface InvoicePolling {
  invoiceId: string;
  fileName: string;
}

interface UploadStatus {
  fileName: string;
  status: "uploading" | "processing" | "success" | "error";
  message?: string;
  pages?: number;
  estimatedTime?: string;
}

export function InvoiceUpload({ accessToken, clients }: InvoiceUploadProps) {
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [uploads, setUploads] = useState<UploadStatus[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = async (acceptedFiles: File[]) => {
    if (!selectedClient) {
      alert("Please select a client first");
      return;
    }

    setIsUploading(true);

    for (const file of acceptedFiles) {
      // Estimate pages (rough estimate based on file size)
      const estimatedPages =
        file.type === "application/pdf"
          ? Math.max(1, Math.ceil(file.size / 50000)) // ~50KB per page
          : 1;

      const estimatedTimeSeconds = estimatedPages * 3; // ~3 seconds per page
      const estimatedTime =
        estimatedTimeSeconds > 60
          ? `${Math.ceil(estimatedTimeSeconds / 60)} min`
          : `${estimatedTimeSeconds} sec`;

      setUploads((prev) => [
        ...prev,
        {
          fileName: file.name,
          status: "uploading",
          message: "Uploading file...",
          pages: estimatedPages,
          estimatedTime,
        },
      ]);

      try {
        console.log(
          "Starting upload for:",
          file.name,
          "to client:",
          selectedClient,
        );

        const formData = new FormData();
        formData.append("file", file);
        formData.append("clientId", selectedClient);

        console.log("Calling upload endpoint...");

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-97c553b8/admin/upload`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${publicAnonKey}`,
            },
            body: formData,
          },
        );

        console.log("Upload response status:", response.status);

        if (response.ok) {
          const data = await response.json();
          console.log("Upload successful:", data);

          // Show processing status
          setUploads((prev) =>
            prev.map((u) =>
              u.fileName === file.name
                ? {
                    ...u,
                    status: "processing",
                    message: `Processing ${estimatedPages} page${estimatedPages > 1 ? "s" : ""} with OCR... (Check "View Invoices" tab for results)`,
                    pages: estimatedPages,
                    estimatedTime,
                  }
                : u,
            ),
          );

          // Mark as success after a short delay
          setTimeout(() => {
            setUploads((prev) =>
              prev.map((u) =>
                u.fileName === file.name
                  ? {
                      ...u,
                      status: "success",
                      message: `✓ Uploaded! Processing in background. Go to "View Invoices" tab to see extracted data.`,
                    }
                  : u,
              ),
            );
          }, 3000);
        } else {
          const errorText = await response.text();
          console.error(
            "Upload failed. Status:",
            response.status,
            "Response:",
            errorText,
          );
          let errorMessage = "Upload failed";
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage =
              errorJson.error || errorJson.message || "Upload failed";
          } catch {
            errorMessage = errorText || "Upload failed";
          }
          setUploads((prev) =>
            prev.map((u) =>
              u.fileName === file.name
                ? { ...u, status: "error", message: `✗ ${errorMessage}` }
                : u,
            ),
          );
        }
      } catch (error: any) {
        console.error("Upload exception:", error);
        setUploads((prev) =>
          prev.map((u) =>
            u.fileName === file.name
              ? { ...u, status: "error", message: `✗ ${error.message}` }
              : u,
          ),
        );
      }
    }

    setIsUploading(false);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg", ".tiff"],
    },
    disabled: !selectedClient || isUploading,
  });

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          Upload Invoices
        </h2>
        <p className="text-sm text-gray-600">
          Upload single or multi-page invoices (PDF or images). Our system will
          automatically extract data.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="mb-4">
          <label
            htmlFor="clientSelect"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Select Client
          </label>
          <select
            id="clientSelect"
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">-- Choose a client --</option>
            {clients.map((client, index) => (
              <option
                key={client.id ?? `${client.name}-${index}`}
                value={client.id}
              >
                {client.name} {client.vatRegistered ? "(VAT Reg)" : "(No VAT)"}
              </option>
            ))}
          </select>
        </div>

        {selectedClient && (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
              isDragActive
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:border-gray-400 bg-gray-50"
            } ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <input {...getInputProps()} />
            <Upload
              className={`w-12 h-12 mx-auto mb-4 ${isDragActive ? "text-blue-500" : "text-gray-400"}`}
            />
            {isDragActive ? (
              <p className="text-blue-600 font-medium">
                Drop the files here...
              </p>
            ) : (
              <div>
                <p className="text-gray-900 font-medium mb-1">
                  Drop invoice files here, or click to browse
                </p>
                <p className="text-sm text-gray-600">
                  Supports PDF, PNG, JPG, JPEG, TIFF (up to 200 pages per
                  document)
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {uploads.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Upload Status</h3>
            {uploads.some((u) => u.status === "success") && (
              <button
                onClick={() =>
                  setUploads(uploads.filter((u) => u.status !== "success"))
                }
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Clear completed
              </button>
            )}
          </div>
          <div className="space-y-3">
            {uploads.map((upload, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border-2 ${
                  upload.status === "success"
                    ? "bg-green-50 border-green-200"
                    : upload.status === "error"
                      ? "bg-red-50 border-red-200"
                      : upload.status === "processing"
                        ? "bg-blue-50 border-blue-200"
                        : "bg-gray-50 border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <FileText
                      className={`w-5 h-5 mt-0.5 ${
                        upload.status === "success"
                          ? "text-green-600"
                          : upload.status === "error"
                            ? "text-red-600"
                            : upload.status === "processing"
                              ? "text-blue-600"
                              : "text-gray-400"
                      }`}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {upload.fileName}
                      </p>
                      {upload.message && (
                        <p
                          className={`text-sm mb-2 ${
                            upload.status === "success"
                              ? "text-green-700"
                              : upload.status === "error"
                                ? "text-red-700"
                                : upload.status === "processing"
                                  ? "text-blue-700"
                                  : "text-gray-600"
                          }`}
                        >
                          {upload.message}
                        </p>
                      )}
                      {(upload.status === "uploading" ||
                        upload.status === "processing") &&
                        upload.pages && (
                          <div className="flex gap-4 text-xs text-gray-600">
                            <span>
                              📄 {upload.pages} page
                              {upload.pages > 1 ? "s" : ""}
                            </span>
                            <span>⏱️ Est. {upload.estimatedTime}</span>
                          </div>
                        )}
                      {upload.status === "processing" && (
                        <div className="mt-2">
                          <div className="w-full bg-blue-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full animate-pulse"
                              style={{ width: "70%" }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="ml-3">
                    {upload.status === "uploading" && (
                      <Loader className="w-5 h-5 text-blue-600 animate-spin" />
                    )}
                    {upload.status === "processing" && (
                      <Loader className="w-5 h-5 text-blue-600 animate-spin" />
                    )}
                    {upload.status === "success" && (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    )}
                    {upload.status === "error" && (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <div className="flex gap-4">
                {uploads.filter((u) => u.status === "success").length > 0 && (
                  <span className="text-green-700">
                    ✓ {uploads.filter((u) => u.status === "success").length}{" "}
                    completed
                  </span>
                )}
                {uploads.filter(
                  (u) => u.status === "processing" || u.status === "uploading",
                ).length > 0 && (
                  <span className="text-blue-700">
                    ⏳{" "}
                    {
                      uploads.filter(
                        (u) =>
                          u.status === "processing" || u.status === "uploading",
                      ).length
                    }{" "}
                    processing
                  </span>
                )}
                {uploads.filter((u) => u.status === "error").length > 0 && (
                  <span className="text-red-700">
                    ✗ {uploads.filter((u) => u.status === "error").length}{" "}
                    failed
                  </span>
                )}
              </div>
              <span className="text-gray-600">
                Total: {uploads.length} file{uploads.length > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
