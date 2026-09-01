import { UploadedDocument } from "../types";
import { fetchApi } from "./client";

export async function uploadDocument(file: File, sessionId: string): Promise<UploadedDocument> {
  const formData = new FormData();
  formData.append("file", file);
  
  const response = await fetchApi(`documents/upload?session_id=${sessionId}`, {
    method: "POST",
    body: formData,
  });

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
  const res = await fetchApi(`documents?session_id=${sessionId}`);
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
  await fetchApi(`documents/${documentId}`, {
    method: "DELETE",
  });
}

export async function reassignDocumentSession(documentId: string, sessionId: string): Promise<void> {
  await fetchApi(`documents/${documentId}/session?session_id=${sessionId}`, {
    method: "PATCH",
  });
}
