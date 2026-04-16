// Validated env + safety guards. Imported by server-only code.
// Throws on boot if prod-DB guard is violated.

const symUrl = process.env.SYM_DATABASE_URL ?? "";
const allowNonStaging = process.env.ALLOW_NON_STAGING === "true";

if (!symUrl) {
  throw new Error("SYM_DATABASE_URL is required");
}

const looksLikeStaging = symUrl.includes("staging");
if (!looksLikeStaging && !allowNonStaging) {
  throw new Error(
    `SYM_DATABASE_URL host does not contain "staging". ` +
      `Refusing to start. Set ALLOW_NON_STAGING=true to override (NOT for production).`,
  );
}

export const env = {
  SYM_DATABASE_URL: symUrl,
  AUDIT_DATABASE_URL: process.env.AUDIT_DATABASE_URL ?? "",
  READ_ONLY: process.env.READ_ONLY === "true",
};
