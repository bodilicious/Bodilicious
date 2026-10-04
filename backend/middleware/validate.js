export const validate =
  (schema) => (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      // Zod 4 exposes the list as `issues` (`errors` no longer exists), so the old
      // `errors: err.errors` sent `undefined` — and with no `message`, the client
      // could only show a generic failure for any invalid field.
      const issues = err?.issues || err?.errors || [];
      const first = issues[0];
      const message = first
        ? `${first.path?.length ? `${first.path.join(".")}: ` : ""}${first.message}`
        : "Invalid request";
      return res.status(400).json({
        success: false,
        message,
        errors: issues,
      });
    }
  };
