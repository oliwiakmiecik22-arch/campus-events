export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function eventNotFound(id) {
  return new AppError(404, 'NOT_FOUND', `Event with id ${id} not found`);
}

export function conflict(message) {
  return new AppError(409, 'CONFLICT', message);
}
