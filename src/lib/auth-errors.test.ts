import { describe, expect, it, vi } from "vitest";
import { authErrorCode, authErrorMessage, GENERIC_AUTH_ERROR } from "@/lib/auth-errors";

describe("authErrorCode", () => {
  it("maps the hosted project's lower-case rate limit by its code", () => {
    expect(authErrorCode({ message: "email rate limit exceeded", code: "over_email_send_rate_limit" })).toBe(
      "email_rate_limit",
    );
  });

  it("maps the message case-insensitively when there is no code", () => {
    expect(authErrorCode({ message: "Email rate limit exceeded" })).toBe("email_rate_limit");
    expect(authErrorCode({ message: "email rate limit exceeded" })).toBe("email_rate_limit");
  });

  it("keeps the resend cooldown apart from the hourly limit that shares its code", () => {
    expect(
      authErrorCode({
        message: "For security purposes, you can only request this after 42 seconds.",
        code: "over_email_send_rate_limit",
      }),
    ).toBe("resend_too_soon");
  });

  it("reports a failed confirmation email instead of the generic message", () => {
    expect(authErrorCode({ message: "Error sending confirmation email", code: "unexpected_failure" })).toBe(
      "email_send_failed",
    );
    expect(authErrorCode({ message: "Email address not authorized", code: "email_address_not_authorized" })).toBe(
      "email_send_failed",
    );
  });

  it("maps sign-in and sign-up errors by code", () => {
    expect(authErrorCode({ message: "Invalid login credentials", code: "invalid_credentials" })).toBe(
      "invalid_credentials",
    );
    expect(authErrorCode({ message: "Email not confirmed", code: "email_not_confirmed" })).toBe("email_not_confirmed");
    expect(authErrorCode({ message: "User already registered", code: "user_already_exists" })).toBe("user_exists");
    expect(authErrorCode({ message: "Password should contain at least one character", code: "weak_password" })).toBe(
      "weak_password",
    );
  });

  it("turns an unmapped error into unknown and the generic message", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(authErrorCode({ message: "Something new", code: "brand_new_code" })).toBe("unknown");
    expect(authErrorMessage("unknown")).toBe(GENERIC_AUTH_ERROR);
    log.mockRestore();
  });
});
