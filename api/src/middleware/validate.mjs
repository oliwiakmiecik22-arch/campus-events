const validationError = (source, issues) => ({
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    details: issues.map((issue) => ({
      field: issue.path.join('.') || source,
      message: issue.message
    }))
  }
});

export function validate(schemas) {
  return (req, res, next) => {
    req.validated = {};

    for (const [source, schema] of Object.entries(schemas)) {
      const result = schema.safeParse(req[source]);
      if (!result.success) {
        return res.status(400).json(validationError(source, result.error.issues));
      }
      req.validated[source] = result.data;
    }

    next();
  };
}
