import { registerUser, loginUser, saveSession, getSession, clearSession, roleRedirect } from "@/lib/api";
import { AuthUser } from "@/lib/api";

describe("Auth Flow", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("register user without email/phone → save token → redirect", async () => {
    const payload = {
      username: "petani_test",
      password: "pass123",
      role: "PETANI" as const,
    };

    // Mock fetch
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          id: 1,
          username: "petani_test",
          role: "PETANI",
          token: "mock_jwt_token_xyz",
        } as AuthUser),
      } as Response)
    );

    const user = await registerUser(payload);
    expect(user.username).toBe("petani_test");
    expect(user.token).toBe("mock_jwt_token_xyz");

    saveSession(user);
    const session = getSession();
    expect(session?.username).toBe("petani_test");
    expect(session?.token).toBe("mock_jwt_token_xyz");

    const redirect = roleRedirect(user.role);
    expect(redirect).toBe("/farmer/input");
  });

  test("login user → save session → correct redirect per role", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          id: 2,
          username: "umkm_test",
          role: "UMKM",
          token: "mock_token_umkm",
        } as AuthUser),
      } as Response)
    );

    const user = await loginUser({ identifier: "umkm_test", password: "pass123" });
    saveSession(user);

    expect(roleRedirect(user.role)).toBe("/dashboard/procurement");
  });

  test("logout → clear session", () => {
    const user: AuthUser = { id: 1, username: "test", role: "PETANI", token: "abc" };
    saveSession(user);
    expect(getSession()).not.toBeNull();

    clearSession();
    expect(getSession()).toBeNull();
  });

  test("all roles redirect correctly", () => {
    expect(roleRedirect("PETANI")).toBe("/farmer/input");
    expect(roleRedirect("UMKM")).toBe("/dashboard/procurement");
    expect(roleRedirect("SUPERADMIN")).toBe("/dashboard/superadmin");
  });
});
