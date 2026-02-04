import { logActivity } from "../utils/activityLogger";


async function errorHandler(err, req, res, next) {
  await logActivity({
    req,
    action: "OTHER",
    success: false,
    statusCode: err.status || 500,
    errorMessage: err.message,
    description: "Unhandled error",
  });

  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
}

export default errorHandler;
