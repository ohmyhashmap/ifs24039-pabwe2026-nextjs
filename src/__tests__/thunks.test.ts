import { configureStore } from "@reduxjs/toolkit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import authReducer, {
  fetchMe,
  loginUser,
  registerUser,
} from "@/features/auth/states/authSlice";
import postReducer, {
  createPost,
  deletePost,
  fetchPostDetail,
  fetchPosts,
  updatePost,
} from "@/features/posts/states/postSlice";
import { authApi } from "@/features/auth/api/authApi";
import { postApi } from "@/features/posts/api/postApi";
import { ApiError, getToken, removeToken } from "@/helpers/apiHelper";

vi.mock("@/features/auth/api/authApi", () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    getMe: vi.fn(),
    getMeLegacy: vi.fn(),
  },
}));
vi.mock("@/features/posts/api/postApi", () => ({
  postApi: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    updateCover: vi.fn(),
  },
}));

const testUser = { id: 3, name: "Ari", email: "ari@example.test" };
const rawPost = {
  id: 11,
  title: "A post",
  content: "Text",
  user_id: 3,
  created_at: "2026-01-01",
};

beforeEach(() => {
  vi.resetAllMocks();
  removeToken();
});

describe("auth async thunks", () => {
  it("logs in and persists the token, rejecting malformed or failed responses", async () => {
    const store = configureStore({ reducer: authReducer });
    vi.mocked(authApi.login).mockResolvedValueOnce({ data: { token: "signed", user: testUser } });
    const success = await store.dispatch(loginUser({ email: "ari@example.test", password: "pw" }));
    expect(loginUser.fulfilled.match(success)).toBe(true);
    expect(store.getState()).toMatchObject({ token: "signed", user: testUser });
    expect(getToken()).toBe("signed");

    vi.mocked(authApi.login).mockResolvedValueOnce({ token: "without-user" });
    const noUser = await store.dispatch(loginUser({ email: "ari@example.test", password: "pw" }));
    expect(loginUser.fulfilled.match(noUser)).toBe(true);
    expect(store.getState().user).toBeNull();

    vi.mocked(authApi.login).mockResolvedValueOnce({ user: testUser });
    const malformed = await store.dispatch(loginUser({ email: "ari@example.test", password: "pw" }));
    expect(loginUser.rejected.match(malformed)).toBe(true);
    if (loginUser.rejected.match(malformed)) {
      expect(malformed.payload).toBe("Token tidak ditemukan pada respons server");
    }

    vi.mocked(authApi.login).mockRejectedValueOnce(new Error("Login unavailable"));
    const failed = await store.dispatch(loginUser({ email: "ari@example.test", password: "pw" }));
    expect(loginUser.rejected.match(failed)).toBe(true);
  });

  it("registers both with and without returned tokens and reports errors", async () => {
    const store = configureStore({ reducer: authReducer });
    vi.mocked(authApi.register).mockResolvedValueOnce({ data: { token: "registered", user: testUser } });
    const registered = await store.dispatch(registerUser({ name: "Ari" }));
    expect(registerUser.fulfilled.match(registered)).toBe(true);
    expect(getToken()).toBe("registered");
    expect(store.getState()).toMatchObject({ token: "registered", user: testUser });

    vi.mocked(authApi.register).mockResolvedValueOnce({ success: true });
    const tokenless = await store.dispatch(registerUser({ name: "Ari" }));
    expect(registerUser.fulfilled.match(tokenless)).toBe(true);
    expect(store.getState()).toMatchObject({ token: "registered", user: testUser });

    vi.mocked(authApi.register).mockRejectedValueOnce(new Error("Register failed"));
    const failed = await store.dispatch(registerUser({ name: "Ari" }));
    expect(registerUser.rejected.match(failed)).toBe(true);
  });

  it("fetches the current user, retries legacy endpoints, and handles authorization errors", async () => {
    const store = configureStore({ reducer: authReducer });
    vi.mocked(authApi.getMe).mockResolvedValueOnce({ data: { user: testUser } });
    const direct = await store.dispatch(fetchMe());
    expect(fetchMe.fulfilled.match(direct)).toBe(true);
    expect(store.getState().user).toEqual(testUser);

    vi.mocked(authApi.getMe).mockRejectedValueOnce(new ApiError("Not found", 404));
    vi.mocked(authApi.getMeLegacy).mockResolvedValueOnce({ user: testUser });
    expect(fetchMe.fulfilled.match(await store.dispatch(fetchMe()))).toBe(true);

    vi.mocked(authApi.getMe).mockRejectedValueOnce(new ApiError("Unauthorized", 401));
    await store.dispatch(fetchMe());
    expect(getToken()).toBeNull();

    vi.mocked(authApi.getMe).mockRejectedValueOnce(new ApiError("Unavailable", 503));
    const failed = await store.dispatch(fetchMe());
    expect(fetchMe.rejected.match(failed)).toBe(true);

    vi.mocked(authApi.getMe).mockRejectedValueOnce(new ApiError("Forbidden", 405));
    vi.mocked(authApi.getMeLegacy).mockRejectedValueOnce(new Error("Legacy failed"));
    expect(fetchMe.rejected.match(await store.dispatch(fetchMe()))).toBe(true);
  });
});

describe("post async thunks", () => {
  it("fetches post lists in both supported API shapes and reports errors", async () => {
    const store = configureStore({ reducer: postReducer });
    vi.mocked(postApi.getAll).mockResolvedValueOnce({ data: [rawPost] });
    const list = await store.dispatch(fetchPosts());
    expect(fetchPosts.fulfilled.match(list)).toBe(true);
    expect(store.getState().posts[0]).toMatchObject({ id: 11, title: "A post" });

    vi.mocked(postApi.getAll).mockResolvedValueOnce({ posts: [rawPost] });
    expect(fetchPosts.fulfilled.match(await store.dispatch(fetchPosts()))).toBe(true);

    vi.mocked(postApi.getAll).mockResolvedValueOnce({ data: {} });
    const empty = await store.dispatch(fetchPosts());
    expect(fetchPosts.fulfilled.match(empty)).toBe(true);
    if (fetchPosts.fulfilled.match(empty)) expect(empty.payload).toEqual([]);

    vi.mocked(postApi.getAll).mockRejectedValueOnce(new Error("List failed"));
    const failed = await store.dispatch(fetchPosts());
    expect(fetchPosts.rejected.match(failed)).toBe(true);
  });

  it("loads details, creates, updates, deletes posts and propagates failures", async () => {
    const store = configureStore({ reducer: postReducer });
    vi.mocked(postApi.getById).mockResolvedValueOnce({ data: { post: rawPost } });
    expect(fetchPostDetail.fulfilled.match(await store.dispatch(fetchPostDetail(11)))).toBe(true);
    expect(store.getState().selectedPost).toMatchObject({ id: 11, title: "A post" });

    vi.mocked(postApi.create).mockResolvedValueOnce({ post: rawPost });
    expect(createPost.fulfilled.match(await store.dispatch(createPost({ title: "A post", content: "Text" })))).toBe(true);

    vi.mocked(postApi.update).mockResolvedValueOnce({ data: { post: { ...rawPost, title: "Updated" } } });
    expect(updatePost.fulfilled.match(await store.dispatch(updatePost({
      id: 11,
      title: "Updated",
      content: "Text",
    })))).toBe(true);
    expect(store.getState().posts[0].title).toBe("Updated");

    vi.mocked(postApi.delete).mockResolvedValueOnce(undefined);
    expect(deletePost.fulfilled.match(await store.dispatch(deletePost(11)))).toBe(true);
    expect(store.getState().posts).toEqual([]);

    vi.mocked(postApi.getById).mockRejectedValueOnce(new Error("Detail failed"));
    expect(fetchPostDetail.rejected.match(await store.dispatch(fetchPostDetail(11)))).toBe(true);
    vi.mocked(postApi.create).mockRejectedValueOnce(new Error("Create failed"));
    expect(createPost.rejected.match(await store.dispatch(createPost({ title: "x", content: "y" })))).toBe(true);
    vi.mocked(postApi.update).mockRejectedValueOnce(new Error("Update failed"));
    expect(updatePost.rejected.match(await store.dispatch(updatePost({ id: 11, title: "x", content: "y" })))).toBe(true);
    vi.mocked(postApi.delete).mockRejectedValueOnce(new Error("Delete failed"));
    expect(deletePost.rejected.match(await store.dispatch(deletePost(11)))).toBe(true);
  });
});
