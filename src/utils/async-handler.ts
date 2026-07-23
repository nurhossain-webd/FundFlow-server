import type { RequestHandler } from "express";

type AsyncRequestHandler = (
  ...parameters: Parameters<RequestHandler>
) => Promise<unknown> | unknown;

export const asyncHandler =
  (handler: AsyncRequestHandler): RequestHandler =>
  (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
