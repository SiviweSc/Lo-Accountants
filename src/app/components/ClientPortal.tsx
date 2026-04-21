import { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

interface ClientPortalProps {
  uploadToken: string;
}

interface UploadStatus {
  fileName: string;
  status: 'uploading' | 'success' | 'error';
  message?: string;
}

export function ClientPortal({ uploadToken }: ClientPortalProps) {
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploads, setUploads] = useState<UploadStatus[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    validateToken();
  }, [uploadToken]);

  const validateToken = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-97c553b8/validate-token/${uploadToken}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setClient(data.client);
      } else {
        setError('Invalid upload link. Please contact LO Accountants.');
      }
    } catch (err) {
      setError('Unable to validate upload link');
    } finally {
      setLoading(false);
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    setIsUploading(true);

    for (const file of acceptedFiles) {
      setUploads(prev => [...prev, { fileName: file.name, status: 'uploading' }]);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('clientId', client.id);
        formData.append('uploadToken', uploadToken);

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-97c553b8/invoices/upload`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`
            },
            body: formData
          }
        );

        if (response.ok) {
          setUploads(prev =>
            prev.map(u =>
              u.fileName === file.name
                ? { ...u, status: 'success', message: 'Successfully uploaded!' }
                : u
            )
          );
        } else {
          const errorData = await response.json();
          setUploads(prev =>
            prev.map(u =>
              u.fileName === file.name
                ? { ...u, status: 'error', message: errorData.error || 'Upload failed' }
                : u
            )
          );
        }
      } catch (err: any) {
        setUploads(prev =>
          prev.map(u =>
            u.fileName === file.name
              ? { ...u, status: 'error', message: err.message }
              : u
          )
        );
      }
    }

    setIsUploading(false);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.tiff']
    },
    disabled: isUploading || !client
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid Link</h2>
          <p className="text-gray-600">{error || 'This upload link is not valid.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-3xl mx-auto pt-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">LO Accountants</h1>
          <p className="text-gray-700 text-lg">Invoice Upload Portal</p>
          <p className="text-gray-600 mt-2">Client: <span className="font-semibold">{client.name}</span></p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Your Invoices</h2>
          <p className="text-gray-600 mb-6">
            Drag and drop your invoice files below, or click to browse. We accept PDF files and images.
            Multi-page documents (up to 200 pages) are supported.
          </p>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400 bg-gray-50'
            } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input {...getInputProps()} />
            <Upload className={`w-16 h-16 mx-auto mb-4 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`} />
            {isDragActive ? (
              <p className="text-blue-600 font-medium text-lg">Drop the files here...</p>
            ) : (
              <div>
                <p className="text-gray-900 font-medium text-lg mb-2">
                  Drop invoice files here, or click to browse
                </p>
                <p className="text-sm text-gray-600">
                  Supports PDF, PNG, JPG, JPEG, TIFF
                </p>
              </div>
            )}
          </div>
        </div>

        {uploads.length > 0 && (
          <div className="bg-white rounded-lg shadow-xl p-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Status</h3>
            <div className="space-y-3">
              {uploads.map((upload, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{upload.fileName}</p>
                      {upload.message && (
                        <p className="text-xs text-gray-600">{upload.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    {upload.status === 'uploading' && (
                      <Loader className="w-5 h-5 text-blue-600 animate-spin" />
                    )}
                    {upload.status === 'success' && (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    )}
                    {upload.status === 'error' && (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center mt-8 text-sm text-gray-600">
          <p>Powered by LO Accountants Invoice Capture System</p>
          <p className="mt-1">Your invoices will be processed automatically</p>
        </div>
      </div>
    </div>
  );
}
