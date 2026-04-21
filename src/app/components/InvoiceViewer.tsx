import { useState, useEffect, useCallback } from "react";
import { Download, Filter, RefreshCw, FileText, Loader } from "lucide-react";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import * as XLSX from "xlsx";

interface InvoiceViewerProps {
  accessToken: string;
  clients: any[];
}

export function InvoiceViewer({ accessToken, clients }: InvoiceViewerProps) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState<string>("");
  const [filterVat, setFilterVat] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const hasProcessingInvoices = invoices.some(
    (invoice) => invoice.status === "processing",
  );

  const loadInvoices = useCallback(async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
    }
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-97c553b8/admin/list-invoices`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        },
      );

      const data = await response.json();
      console.log("Invoices loaded:", data);
      if (response.ok) {
        setInvoices(data.invoices || []);
      } else {
        console.error("Failed to load invoices:", data);
      }
    } catch (error) {
      console.error("Error loading invoices:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices(true);
  }, [loadInvoices]);

  useEffect(() => {
    // Auto-refresh only while there are invoices still processing.
    if (!hasProcessingInvoices) {
      return;
    }

    const interval = setInterval(() => {
      loadInvoices(false);
    }, 3000);

    return () => clearInterval(interval);
  }, [hasProcessingInvoices, loadInvoices]);

  const filteredInvoices = invoices.filter((invoice) => {
    if (filterClient && invoice.clientId !== filterClient) return false;

    if (filterVat !== "all") {
      const client = clients.find((c) => c.id === invoice.clientId);
      if (filterVat === "vat" && !client?.vatRegistered) return false;
      if (filterVat === "no-vat" && client?.vatRegistered) return false;
    }

    if (filterStatus !== "all" && invoice.status !== filterStatus) return false;

    return true;
  });

  const exportToExcel = () => {
    const exportData = filteredInvoices.map((invoice) => ({
      Client: invoice.clientName || "Unknown",
      "Invoice Number": invoice.extractedData?.invoiceNumber || "N/A",
      Date: invoice.extractedData?.date || "N/A",
      Supplier: invoice.extractedData?.supplier || "N/A",
      "Total Amount": invoice.extractedData?.totalAmount
        ? `${invoice.extractedData.currency || "ZAR"} ${invoice.extractedData.totalAmount.toFixed(2)}`
        : "N/A",
      "VAT Amount": invoice.extractedData?.vatAmount
        ? `${invoice.extractedData.currency || "ZAR"} ${invoice.extractedData.vatAmount.toFixed(2)}`
        : "N/A",
      "Has VAT": invoice.extractedData?.hasVat ? "Yes" : "No",
      Status: invoice.status,
      Uploaded: new Date(invoice.uploadedAt).toLocaleString(),
      "File Name": invoice.fileName,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoices");

    const fileName = `invoices_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">
            Invoice Data
          </h2>
          <p className="text-sm text-gray-600">
            View and export captured invoice data
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => loadInvoices(true)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={exportToExcel}
            disabled={filteredInvoices.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export to Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-600" />
          <h3 className="text-sm font-medium text-gray-900">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="filterClient"
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              Client
            </label>
            <select
              id="filterClient"
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Clients</option>
              {clients.map((client, index) => (
                <option
                  key={client.id ?? `${client.name}-${index}`}
                  value={client.id}
                >
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filterVat"
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              VAT Status
            </label>
            <select
              id="filterVat"
              value={filterVat}
              onChange={(e) => setFilterVat(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All</option>
              <option value="vat">VAT Registered Only</option>
              <option value="no-vat">No VAT Only</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="filterStatus"
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              Status
            </label>
            <select
              id="filterStatus"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="error">Error</option>
              <option value="manual_review">Manual Review</option>
            </select>
          </div>
        </div>
      </div>

      {/* Invoice Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <Loader className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-gray-600">Loading invoices...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              No invoices found
            </h3>
            <p className="text-gray-600 text-sm">
              Upload some invoices to see them here
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Client
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Supplier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    VAT
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Uploaded
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                      {invoice.clientName || "Unknown"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {invoice.extractedData?.date || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {invoice.extractedData?.supplier || "-"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                      {invoice.extractedData?.totalAmount
                        ? `${invoice.extractedData.currency || "ZAR"} ${invoice.extractedData.totalAmount.toFixed(2)}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          invoice.extractedData?.hasVat
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {invoice.extractedData?.hasVat ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          invoice.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : invoice.status === "processing"
                              ? "bg-blue-100 text-blue-800"
                              : invoice.status === "error"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 text-xs">
                      {new Date(invoice.uploadedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 text-sm text-gray-600">
        Showing {filteredInvoices.length} of {invoices.length} invoices
      </div>
    </div>
  );
}
