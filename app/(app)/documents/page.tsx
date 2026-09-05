import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { listDocumentsForUser } from "@/lib/documents";
import { DocumentList } from "@/components/DocumentList";

export default async function DocumentsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const { owned, shared } = await listDocumentsForUser(userId);
  return <DocumentList owned={owned} shared={shared} />;
}
