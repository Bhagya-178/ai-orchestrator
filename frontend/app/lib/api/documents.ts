import { UploadedDocument } from "../types";

export async function uploadDocument(file: File, sessionId: string): Promise<UploadedDocument> {
  const formData = new FormData();
  formData.append("file", file);
  
  const response = await fetch(`http://localhost:8000/documents/upload?session_id=${sessionId}`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to upload document");
  }

  const data = await response.json();
  
  return {
    id: data.document_id || data.id,
    filename: data.filename,
    fileSize: data.file_size || file.size,
    contentType: data.content_type || file.type,
    status: "ready", // backend returns after processing is done
  };
}

export async function listDocuments(sessionId: string): Promise<UploadedDocument[]> {
  const res = await fetch(`http://localhost:8000/documents?session_id=${sessionId}`, {
    cache: 'no-store'
  });
  if (!res.ok) return [];
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.documents || []).map((doc: any) => ({
    id: doc.id,
    filename: doc.filename,
    fileSize: doc.file_size,
    contentType: doc.content_type,
    status: "ready",
  }));
}

export async function deleteDocument(documentId: string): Promise<void> {
  const res = await fetch(`http://localhost:8000/documents/${documentId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("Failed to delete document");
  }
}

export async function reassignDocumentSession(documentId: string, sessionId: string): Promise<void> {
  const res = await fetch(`http://localhost:8000/documents/${documentId}/session?session_id=${sessionId}`, {
    method: "PATCH",
  });
  if (!res.ok) {
    console.error("Failed to reassign document session");
  }
}
