import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchApi } from "@/helpers/apiHelper";
import { authApi } from "@/features/auth/api/authApi";
import { postApi } from "@/features/posts/api/postApi";
import { getUserProfile, getUsers, updatePassword, updateProfile } from "@/features/users/api/userApi";
import { setToken, removeToken } from "@/helpers/apiHelper";

const jsonResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: vi.fn().mockResolvedValue(body),
});

afterEach(() => {
  vi.unstubAllGlobals();
  removeToken();
});

describe("API client", () => {
  it("sends JSON requests with authorization and caller headers", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    setToken("test-token");

    await expect(fetchApi("/private", {
      method: "POST",
      body: JSON.stringify({ value: 1 }),
      headers: { "X-Request-ID": "request-1", "Content-Type": "custom/type" },
    })).resolves.toEqual({ ok: true });

    const [, init] = fetch.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(fetch.mock.calls[0][0]).toContain("/private");
    expect(headers.get("authorization")).toBe("Bearer test-token");
    expect(headers.get("content-type")).toBe("custom/type");
    expect(headers.get("x-request-id")).toBe("request-1");
  });

  it("omits JSON content type for FormData and supports caller Headers", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ saved: true }));
    vi.stubGlobal("fetch", fetch);
    const body = new FormData();

    await fetchApi("/upload", { method: "POST", body, headers: new Headers({ "X-Test": "yes" }) });
    const headers = new Headers(fetch.mock.calls[0][1].headers);
    expect(headers.has("content-type")).toBe(false);
    expect(headers.get("x-test")).toBe("yes");
  });

  it("handles 204 responses and reports server errors from JSON or invalid bodies", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(null, true, 204))
      .mockResolvedValueOnce(jsonResponse({ message: "Denied" }, false, 403))
      .mockResolvedValueOnce({ ...jsonResponse(null, false, 502), json: vi.fn().mockRejectedValue(new Error("invalid JSON")) });
    vi.stubGlobal("fetch", fetch);

    await expect(fetchApi("/empty")).resolves.toBeNull();
    await expect(fetchApi("/denied")).rejects.toMatchObject({ message: "Denied", status: 403 });
    await expect(fetchApi("/gateway")).rejects.toMatchObject({
      message: "Terjadi kesalahan pada server",
      status: 502,
    });
  });

  it("propagates invalid JSON from successful non-empty responses", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ...jsonResponse(null),
      json: vi.fn().mockRejectedValue(new SyntaxError("invalid JSON")),
    });
    vi.stubGlobal("fetch", fetch);
    await expect(fetchApi("/malformed")).rejects.toThrow("invalid JSON");
  });
});

describe("API endpoint wrappers", () => {
  it("maps auth endpoint methods and bodies", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ result: true }));
    vi.stubGlobal("fetch", fetch);

    await authApi.login({ email: "a@b.test", password: "secret" });
    await authApi.register({ name: "Ari" });
    await authApi.getMe();
    await authApi.getMeLegacy();

    expect(fetch.mock.calls.map(([url, init]) => [String(url), init?.method ?? "GET"])).toEqual([
      [expect.stringContaining("/auth/login"), "POST"],
      [expect.stringContaining("/auth/register"), "POST"],
      [expect.stringContaining("/users/me"), "GET"],
      [expect.stringContaining("/auth/me"), "GET"],
    ]);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ email: "a@b.test", password: "secret" });
  });

  it("maps post endpoints and request payloads", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetch);
    await postApi.getAll();
    await postApi.getById(9);
    await postApi.create({ title: "t", content: "c" });
    await postApi.update(9, { title: "u", content: "d" });
    await postApi.delete(9);
    await postApi.updateCover(9, "https://example.test/cover.jpg");

    expect(fetch.mock.calls.map(([url, init]) => [String(url), init?.method ?? "GET"])).toEqual([
      [expect.stringContaining("/posts"), "GET"],
      [expect.stringContaining("/posts/9"), "GET"],
      [expect.stringContaining("/posts"), "POST"],
      [expect.stringContaining("/posts/9"), "PUT"],
      [expect.stringContaining("/posts/9"), "DELETE"],
      [expect.stringContaining("/posts/9/cover"), "PATCH"],
    ]);
    expect(JSON.parse(fetch.mock.calls[5][1].body)).toEqual({ cover: "https://example.test/cover.jpg" });
  });

  it("maps user endpoints and payloads", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetch);
    await getUserProfile();
    await getUsers();
    await updateProfile({ name: "Ari", bio: "Hi" });
    await updatePassword({ old_password: "old", new_password: "new" });

    expect(fetch.mock.calls.map(([url, init]) => [String(url), init?.method ?? "GET"])).toEqual([
      [expect.stringContaining("/users/me"), "GET"],
      [expect.stringContaining("/users"), "GET"],
      [expect.stringContaining("/users/me"), "PATCH"],
      [expect.stringContaining("/users/password"), "PATCH"],
    ]);
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ name: "Ari", bio: "Hi" });
    expect(JSON.parse(fetch.mock.calls[3][1].body)).toEqual({ old_password: "old", new_password: "new" });
  });
});
