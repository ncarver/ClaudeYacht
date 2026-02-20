import { NextRequest } from "next/server";
import { getResearchStatus, subscribeToJob } from "@/lib/research";
import { parseListingId } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await parseListingId(params);
  if (result.error) return result.error;
  const { listingId } = result;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send current status immediately
      const current = getResearchStatus(listingId);
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(current)}\n\n`)
      );

      // If already terminal, close
      if (current.status === "complete" || current.status === "failed") {
        controller.close();
        return;
      }

      // Subscribe to future updates
      const listener = (status: typeof current) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(status)}\n\n`)
          );
          if (status.status === "complete" || status.status === "failed") {
            controller.close();
          }
        } catch {
          // Stream already closed
        }
      };

      const unsubscribe = subscribeToJob(listingId, listener);

      // Clean up on client disconnect
      request.signal.addEventListener("abort", () => {
        unsubscribe();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
