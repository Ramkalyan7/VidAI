import { redirect } from "next/navigation";
import ChatClient from "./chat-client";

export default async function ChatProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }> | { projectId: string };
}) {
  const { projectId } = await Promise.resolve(params);
  if (!projectId) {
    redirect("/projects");
  }

  return <ChatClient projectId={projectId} />;
}
