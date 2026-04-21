import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const app = new Hono();

// Enable logger
app.use("*", logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Initialize Supabase Storage buckets
const initStorage = async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  );

  const bucketName = "make-97c553b8-invoices";
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some((bucket) => bucket.name === bucketName);

  if (!bucketExists) {
    await supabase.storage.createBucket(bucketName, { public: false });
    console.log(`Created bucket: ${bucketName}`);
  }
};

initStorage();

// Helper to get authenticated user
const getAuthUser = async (authHeader: string | null) => {
  if (!authHeader) return null;

  try {
    const accessToken = authHeader.split(" ")[1];

    // Decode JWT to get user ID (simple base64 decode of payload)
    const parts = accessToken.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    const userId = payload.sub;

    if (!userId) return null;

    // Return user object with ID
    return { id: userId, email: payload.email };
  } catch (error) {
    console.log(`Auth decode error: ${error.message}`);
    return null;
  }
};

// Health check endpoint
app.get("/make-server-97c553b8/health", (c) => {
  return c.json({ status: "ok" });
});

// Temporary admin endpoint to manually add client (no auth required)
app.post("/make-server-97c553b8/admin/add-client", async (c) => {
  try {
    const { name, vatRegistered, userId } = await c.req.json();
    const clientId = crypto.randomUUID();
    const uploadToken = crypto.randomUUID();

    const client = {
      id: clientId,
      name,
      vatRegistered: vatRegistered || false,
      createdBy: userId || "admin",
      createdAt: new Date().toISOString(),
      uploadToken,
    };

    await kv.set(`client:${clientId}`, client);

    // Add to user's client list
    const userClients = (await kv.get(`user:${userId}:clients`)) || [];
    userClients.push(clientId);
    await kv.set(`user:${userId}:clients`, userClients);

    return c.json({ success: true, client });
  } catch (error) {
    console.log(`Admin add client error: ${error.message}`);
    return c.json({ error: error.message }, 500);
  }
});

// Temporary admin endpoint to list all clients (no auth required)
app.get("/make-server-97c553b8/admin/list-clients", async (c) => {
  try {
    const allClients = await kv.getByPrefix("client:");
    return c.json({ clients: allClients });
  } catch (error) {
    console.log(`Admin list clients error: ${error.message}`);
    return c.json({ error: error.message }, 500);
  }
});

// Temporary admin endpoint to list all invoices (no auth required)
app.get("/make-server-97c553b8/admin/list-invoices", async (c) => {
  try {
    const allInvoiceIds = await kv.getByPrefix("invoice:");
    const allInvoices = [];

    for (const invoice of allInvoiceIds) {
      const client = await kv.get(`client:${invoice.clientId}`);
      allInvoices.push({ ...invoice, clientName: client?.name || "Unknown" });
    }

    return c.json({ invoices: allInvoices });
  } catch (error) {
    console.log(`Admin list invoices error: ${error.message}`);
    return c.json({ error: error.message }, 500);
  }
});

// Get invoice status by ID (no auth required)
app.get("/make-server-97c553b8/admin/invoice/:id", async (c) => {
  try {
    const invoiceId = c.req.param("id");
    const invoice = await kv.get(`invoice:${invoiceId}`);

    if (!invoice) {
      return c.json({ error: "Invoice not found" }, 404);
    }

    const client = await kv.get(`client:${invoice.clientId}`);
    return c.json({ invoice: { ...invoice, clientName: client?.name } });
  } catch (error) {
    console.log(`Get invoice status error: ${error.message}`);
    return c.json({ error: error.message }, 500);
  }
});

// ========== AUTH ENDPOINTS ==========

// Sign up endpoint
app.post("/make-server-97c553b8/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true,
    });

    if (error) {
      console.log(`Signup error for ${email}: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }

    // Store user in KV
    await kv.set(`user:${data.user.id}`, {
      id: data.user.id,
      email,
      name,
      role: "accountant",
      createdAt: new Date().toISOString(),
    });

    return c.json({ success: true, userId: data.user.id });
  } catch (error) {
    console.log(`Signup system error: ${error.message}`);
    return c.json({ error: error.message }, 500);
  }
});

// ========== CLIENT ENDPOINTS ==========

// Create client
app.post("/make-server-97c553b8/clients", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { name, vatRegistered } = await c.req.json();
    const clientId = crypto.randomUUID();
    const uploadToken = crypto.randomUUID();

    const client = {
      id: clientId,
      name,
      vatRegistered: vatRegistered || false,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      uploadToken,
    };

    await kv.set(`client:${clientId}`, client);

    // Add to user's client list
    const userClients = (await kv.get(`user:${user.id}:clients`)) || [];
    userClients.push(clientId);
    await kv.set(`user:${user.id}:clients`, userClients);

    return c.json({ success: true, client });
  } catch (error) {
    console.log(`Create client error: ${error.message}`);
    return c.json({ error: error.message }, 500);
  }
});

// Get all clients for user
app.get("/make-server-97c553b8/clients", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const clientIds = (await kv.get(`user:${user.id}:clients`)) || [];
    const clients = [];

    for (const clientId of clientIds) {
      const client = await kv.get(`client:${clientId}`);
      if (client) clients.push(client);
    }

    return c.json({ clients });
  } catch (error) {
    console.log(`Get clients error: ${error.message}`);
    return c.json({ error: error.message }, 500);
  }
});

// Get client by ID
app.get("/make-server-97c553b8/clients/:id", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const clientId = c.req.param("id");
    const client = await kv.get(`client:${clientId}`);

    if (!client) {
      return c.json({ error: "Client not found" }, 404);
    }

    return c.json({ client });
  } catch (error) {
    console.log(`Get client error: ${error.message}`);
    return c.json({ error: error.message }, 500);
  }
});

// ========== INVOICE ENDPOINTS ==========

// Validate upload token (public endpoint for client portal)
app.get("/make-server-97c553b8/validate-token/:token", async (c) => {
  try {
    const uploadToken = c.req.param("token");

    // Find client by upload token
    const clientIds = await kv.getByPrefix("client:");
    const client = clientIds.find((c: any) => c.uploadToken === uploadToken);

    if (!client) {
      return c.json({ error: "Invalid upload token" }, 404);
    }

    // Return client info without sensitive data
    return c.json({
      client: {
        id: client.id,
        name: client.name,
        vatRegistered: client.vatRegistered,
      },
    });
  } catch (error) {
    console.log(`Validate token error: ${error.message}`);
    return c.json({ error: error.message }, 500);
  }
});

// Admin upload invoice (temporary - no auth required)
app.post("/make-server-97c553b8/admin/upload", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File;
    const clientId = formData.get("clientId") as string;

    const client = await kv.get(`client:${clientId}`);
    if (!client) {
      return c.json({ error: "Client not found" }, 404);
    }

    // Upload to Supabase Storage
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const fileBuffer = await file.arrayBuffer();
    const fileName = `${clientId}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("make-97c553b8-invoices")
      .upload(fileName, fileBuffer, {
        contentType: file.type,
      });

    if (uploadError) {
      console.log(`File upload error for ${fileName}: ${uploadError.message}`);
      return c.json({ error: uploadError.message }, 500);
    }

    // Create invoice record
    const invoiceId = crypto.randomUUID();
    const invoice = {
      id: invoiceId,
      clientId,
      fileName: file.name,
      storagePath: fileName,
      uploadedBy: "admin",
      uploadedAt: new Date().toISOString(),
      status: "processing",
      extractedData: null,
    };

    await kv.set(`invoice:${invoiceId}`, invoice);

    // Add to client's invoice list
    const clientInvoices = (await kv.get(`client:${clientId}:invoices`)) || [];
    clientInvoices.push(invoiceId);
    await kv.set(`client:${clientId}:invoices`, clientInvoices);

    // Check if Mindee API key is configured
    const mindeeApiKey = Deno.env.get("MINDEE_API_KEY");

    if (!mindeeApiKey) {
      // Use mock OCR data for demo purposes
      console.log(
        `Using mock OCR data for invoice ${invoiceId} (MINDEE_API_KEY not configured)`,
      );

      setTimeout(async () => {
        const mockData = {
          date: new Date().toISOString().split("T")[0],
          supplier: "Demo Supplier Ltd",
          totalAmount: Math.floor(Math.random() * 50000) + 1000,
          vatAmount: Math.floor(Math.random() * 7500) + 150,
          hasVat: client.vatRegistered,
          invoiceNumber: `INV-${Math.floor(Math.random() * 100000)}`,
          currency: "ZAR",
        };

        const invoiceToUpdate = await kv.get(`invoice:${invoiceId}`);
        invoiceToUpdate.status = "completed";
        invoiceToUpdate.extractedData = mockData;
        await kv.set(`invoice:${invoiceId}`, invoiceToUpdate);
        console.log(`Mock OCR completed for invoice ${invoiceId}`);
      }, 2000); // 2 second delay to simulate processing
    } else {
      // Process with real OCR (async - don't wait)
      processInvoiceOCR(invoiceId, fileName);
    }

    return c.json({ success: true, invoiceId, status: "processing" });
  } catch (error) {
    console.log(`Admin upload error: ${error.message}`);
    return c.json({ error: error.message }, 500);
  }
});

// Upload invoice (accountant or client via token)
app.post("/make-server-97c553b8/invoices/upload", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File;
    const clientId = formData.get("clientId") as string;
    const uploadToken = formData.get("uploadToken") as string;

    let uploadedBy = "client";
    let user = null;

    // Check if authenticated user or client token
    if (!uploadToken) {
      user = await getAuthUser(c.req.header("Authorization"));
      if (!user) {
        return c.json(
          { error: "Unauthorized - no token or auth provided" },
          401,
        );
      }
      uploadedBy = user.id;
    } else {
      // Validate upload token
      const client = await kv.get(`client:${clientId}`);
      if (!client || client.uploadToken !== uploadToken) {
        return c.json({ error: "Invalid upload token" }, 401);
      }
    }

    const client = await kv.get(`client:${clientId}`);
    if (!client) {
      return c.json({ error: "Client not found" }, 404);
    }

    // Upload to Supabase Storage
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const fileBuffer = await file.arrayBuffer();
    const fileName = `${clientId}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("make-97c553b8-invoices")
      .upload(fileName, fileBuffer, {
        contentType: file.type,
      });

    if (uploadError) {
      console.log(`File upload error for ${fileName}: ${uploadError.message}`);
      return c.json({ error: uploadError.message }, 500);
    }

    // Create invoice record
    const invoiceId = crypto.randomUUID();
    const invoice = {
      id: invoiceId,
      clientId,
      fileName: file.name,
      storagePath: fileName,
      uploadedBy,
      uploadedAt: new Date().toISOString(),
      status: "processing",
      extractedData: null,
    };

    await kv.set(`invoice:${invoiceId}`, invoice);

    // Add to client's invoice list
    const clientInvoices = (await kv.get(`client:${clientId}:invoices`)) || [];
    clientInvoices.push(invoiceId);
    await kv.set(`client:${clientId}:invoices`, clientInvoices);

    // Process with OCR (async - don't wait)
    processInvoiceOCR(invoiceId, fileName);

    return c.json({ success: true, invoiceId, status: "processing" });
  } catch (error) {
    console.log(`Invoice upload system error: ${error.message}`);
    return c.json({ error: error.message }, 500);
  }
});

// Extract structured data from a Mindee prediction object
function extractMindeeData(prediction: any): object {
  return {
    date: prediction.date?.value || null,
    supplier:
      prediction.supplier_name?.value || prediction.supplier?.value || null,
    totalAmount:
      prediction.total_amount?.value ?? prediction.total_incl?.value ?? null,
    vatAmount:
      prediction.total_tax?.value ?? prediction.total_vat?.value ?? null,
    hasVat: !!(prediction.total_tax?.value || prediction.total_vat?.value),
    invoiceNumber: prediction.invoice_number?.value || null,
    currency: prediction.locale?.currency || "ZAR",
    lineItems: (prediction.line_items ?? []).map((item: any) => ({
      description: item.description || null,
      quantity: item.quantity || null,
      unitPrice: item.unit_price || null,
      totalAmount: item.total_amount || null,
      taxRate: item.tax_rate || null,
    })),
  };
}

// Poll Mindee async job until complete, then return the document result
async function pollMindeeJob(
  jobId: string,
  mindeeApiKey: string,
  maxWaitMs = 120_000,
): Promise<any> {
  const pollUrl = `https://api.mindee.net/v1/products/mindee/invoices/v4/documents/queue/${jobId}`;
  const pollIntervalMs = 3_000;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));

    const res = await fetch(pollUrl, {
      headers: { Authorization: `Token ${mindeeApiKey}` },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Mindee poll error: ${res.status} - ${errorText}`);
    }

    const body = await res.json();
    const status: string =
      body.job?.status ?? body.document?.inference?.status ?? "";

    if (status === "completed" || body.document?.inference?.prediction) {
      return body;
    }

    if (status === "failed") {
      throw new Error(`Mindee async job ${jobId} failed`);
    }

    console.log(`Mindee job ${jobId} status: ${status} — waiting...`);
  }

  throw new Error(
    `Mindee async job ${jobId} timed out after ${maxWaitMs / 1000}s`,
  );
}

// Process invoice with OCR — uses async Mindee endpoint for PDFs (no page limit)
// and sync endpoint for single-page image files.
async function processInvoiceOCR(invoiceId: string, storagePath: string) {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const mindeeApiKey = Deno.env.get("MINDEE_API_KEY");

    if (!mindeeApiKey) {
      console.log(
        `OCR processing skipped for invoice ${invoiceId}: MINDEE_API_KEY not configured`,
      );
      const invoice = await kv.get(`invoice:${invoiceId}`);
      invoice.status = "manual_review";
      invoice.error = "OCR API key not configured";
      await kv.set(`invoice:${invoiceId}`, invoice);
      return;
    }

    // Download file from Supabase Storage
    const { data: fileData } = await supabase.storage
      .from("make-97c553b8-invoices")
      .download(storagePath);

    if (!fileData) {
      throw new Error("Failed to download file for OCR");
    }

    const fileBuffer = await fileData.arrayBuffer();

    // Determine file type from storage path extension
    const ext = storagePath.split(".").pop()?.toLowerCase() ?? "";
    const isPdf = ext === "pdf";

    // Build multipart form — always name the blob so Mindee detects the type
    const blobName = isPdf ? "invoice.pdf" : `invoice.${ext || "jpg"}`;
    const formData = new FormData();
    formData.append("document", new Blob([fileBuffer]), blobName);

    let prediction: any;

    if (isPdf) {
      // ── Async path (handles unlimited pages) ──────────────────────────────
      console.log(
        `Using Mindee async endpoint for multi-page PDF: invoice ${invoiceId}`,
      );

      const enqueueRes = await fetch(
        "https://api.mindee.net/v1/products/mindee/invoices/v4/predict_async",
        {
          method: "POST",
          headers: { Authorization: `Token ${mindeeApiKey}` },
          body: formData,
        },
      );

      if (!enqueueRes.ok) {
        const errorText = await enqueueRes.text();
        throw new Error(
          `Mindee async enqueue error: ${enqueueRes.status} - ${errorText}`,
        );
      }

      const enqueueData = await enqueueRes.json();
      const jobId: string = enqueueData.job?.id;

      if (!jobId) {
        throw new Error("Mindee async response did not include a job ID");
      }

      console.log(`Mindee job ${jobId} queued for invoice ${invoiceId}`);

      const pollResult = await pollMindeeJob(jobId, mindeeApiKey);
      prediction = pollResult.document?.inference?.prediction;
    } else {
      // ── Sync path (single-page images) ───────────────────────────────────
      console.log(`Using Mindee sync endpoint for image: invoice ${invoiceId}`);

      const syncRes = await fetch(
        "https://api.mindee.net/v1/products/mindee/invoices/v4/predict",
        {
          method: "POST",
          headers: { Authorization: `Token ${mindeeApiKey}` },
          body: formData,
        },
      );

      if (!syncRes.ok) {
        const errorText = await syncRes.text();
        throw new Error(
          `Mindee sync API error: ${syncRes.status} - ${errorText}`,
        );
      }

      const result = await syncRes.json();
      prediction = result.document?.inference?.prediction;
    }

    if (!prediction) {
      throw new Error("No prediction data returned from Mindee API");
    }

    const extractedData = extractMindeeData(prediction);

    const invoice = await kv.get(`invoice:${invoiceId}`);
    invoice.status = "completed";
    invoice.extractedData = extractedData;
    await kv.set(`invoice:${invoiceId}`, invoice);

    console.log(`Successfully processed invoice ${invoiceId} with OCR`);
  } catch (error) {
    console.log(
      `OCR processing error for invoice ${invoiceId}: ${error.message}`,
    );

    const invoice = await kv.get(`invoice:${invoiceId}`);
    if (invoice) {
      invoice.status = "error";
      invoice.error = error.message;
      await kv.set(`invoice:${invoiceId}`, invoice);
    }
  }
}

// Get invoices for a client
app.get("/make-server-97c553b8/invoices/client/:clientId", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const clientId = c.req.param("clientId");
    const invoiceIds = (await kv.get(`client:${clientId}:invoices`)) || [];
    const invoices = [];

    for (const invoiceId of invoiceIds) {
      const invoice = await kv.get(`invoice:${invoiceId}`);
      if (invoice) invoices.push(invoice);
    }

    return c.json({ invoices });
  } catch (error) {
    console.log(`Get invoices error: ${error.message}`);
    return c.json({ error: error.message }, 500);
  }
});

// Get all invoices for all clients (for accountant dashboard)
app.get("/make-server-97c553b8/invoices", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const clientIds = (await kv.get(`user:${user.id}:clients`)) || [];
    const allInvoices = [];

    for (const clientId of clientIds) {
      const invoiceIds = (await kv.get(`client:${clientId}:invoices`)) || [];
      for (const invoiceId of invoiceIds) {
        const invoice = await kv.get(`invoice:${invoiceId}`);
        if (invoice) {
          const client = await kv.get(`client:${clientId}`);
          allInvoices.push({ ...invoice, clientName: client?.name });
        }
      }
    }

    return c.json({ invoices: allInvoices });
  } catch (error) {
    console.log(`Get all invoices error: ${error.message}`);
    return c.json({ error: error.message }, 500);
  }
});

// Get invoice file
app.get("/make-server-97c553b8/invoices/:id/file", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const invoiceId = c.req.param("id");
    const invoice = await kv.get(`invoice:${invoiceId}`);

    if (!invoice) {
      return c.json({ error: "Invoice not found" }, 404);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data } = await supabase.storage
      .from("make-97c553b8-invoices")
      .createSignedUrl(invoice.storagePath, 3600);

    return c.json({ url: data?.signedUrl });
  } catch (error) {
    console.log(`Get invoice file error: ${error.message}`);
    return c.json({ error: error.message }, 500);
  }
});

Deno.serve(app.fetch);
