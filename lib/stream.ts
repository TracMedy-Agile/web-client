import { StreamVideoClient, type User } from "@stream-io/video-react-sdk";

let streamClient: StreamVideoClient | null = null;
let connectedStreamUserId: string | null = null;
let connectStreamUserPromise: Promise<StreamVideoClient> | null = null;

function getStreamApiKey() {
  const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY?.trim();
  if (!apiKey) throw new Error("NEXT_PUBLIC_STREAM_API_KEY is not configured.");
  return apiKey;
}

export function getStreamClient() {
  if (!streamClient) {
    streamClient = new StreamVideoClient(getStreamApiKey());
  }

  return streamClient;
}

export async function connectStreamUser(userId: string, name: string, token: string) {
  if (!userId.trim()) throw new Error("A Stream user ID is required.");
  if (!token.trim()) throw new Error("A Stream user token is required.");

  if (connectStreamUserPromise) return connectStreamUserPromise;

  connectStreamUserPromise = (async () => {
    const client = getStreamClient();
    const normalizedUserId = userId.trim();

    if (connectedStreamUserId && connectedStreamUserId !== normalizedUserId) {
      await client.disconnectUser();
      connectedStreamUserId = null;
    }

    if (!connectedStreamUserId) {
      const user: User = {
        id: normalizedUserId,
        name: name.trim() || normalizedUserId,
        type: "authenticated",
      };

      await client.connectUser(user, token.trim());
      connectedStreamUserId = normalizedUserId;
    }

    return client;
  })();

  try {
    return await connectStreamUserPromise;
  } finally {
    connectStreamUserPromise = null;
  }
}