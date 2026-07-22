export class RuntimeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeConfigurationError";
  }
}

export function assertLocalStorageAllowed() {
  if (process.env.NODE_ENV === "production") {
    throw new RuntimeConfigurationError(
      "DATABASE_URL must be configured in production. Local JSON storage is development-only.",
    );
  }
}
