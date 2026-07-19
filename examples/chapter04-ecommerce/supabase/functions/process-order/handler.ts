import { OrderValidationError, prepareOrder } from "./order.ts";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
};

function jsonResponse(
  body: unknown,
  status: number,
  additionalHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...jsonHeaders, ...additionalHeaders },
  });
}

export async function handleRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse(
      { error: "method_not_allowed" },
      405,
      { allow: "POST" },
    );
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  try {
    const order = prepareOrder(input);
    return jsonResponse(
      {
        status: "validated",
        ...order,
        persistence: "not_performed",
      },
      200,
    );
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return jsonResponse(
        { error: "invalid_order", message: error.message },
        422,
      );
    }
    console.error("Unexpected process-order failure", error);
    return jsonResponse({ error: "internal_error" }, 500);
  }
}
