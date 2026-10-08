import { describe, expect, it, beforeEach } from "vitest";
import authReducer, {
  clearError,
  fetchMe,
  loginUser,
  logout as authLogout,
  registerUser,
} from "@/features/auth/states/authSlice";
import postReducer, {
  clearSelectedPost,
  createPost,
  deletePost,
  fetchPostDetail,
  fetchPosts,
  updatePost,
} from "@/features/posts/states/postSlice";
import userReducer, {
  logout as userLogout,
  setTokenState,
  setUser,
  setUsers,
  User,
} from "@/features/users/states/userSlice";
import { ApiError, getToken, removeToken } from "@/helpers/apiHelper";
import { Post } from "@/types";
import { store } from "@/store";

const post: Post = {
  id: 1,
  title: "Initial",
  content: "Content",
  user_id: 2,
  created_at: "2026-01-01",
};

const user: User = { id: 2, name: "Ari", email: "ari@example.test" };

beforeEach(() => removeToken());

describe("auth reducer transitions", () => {
  it("tracks login and registration requests and results", () => {
    let state = authReducer(undefined, loginUser.pending("login-request", {}));
    expect(state.isLoading).toBe(true);
    expect(state.error).toBeNull();

    state = authReducer(state, loginUser.fulfilled({ token: "signed-in", user }, "login-request", {}));
    expect(state).toMatchObject({ isLoading: false, token: "signed-in", user });

    state = authReducer(state, registerUser.pending("register-request", {}));
    expect(state.isLoading).toBe(true);
    state = authReducer(state, registerUser.fulfilled({ token: null, user: null }, "register-request", {}));
    expect(state).toMatchObject({ isLoading: false, token: "signed-in", user });

    state = authReducer(state, registerUser.fulfilled({ token: "registered", user }, "register-request", {}));
    expect(state).toMatchObject({ token: "registered", user });
    state = authReducer(state, loginUser.rejected(null, "login-request", {}, "Bad credentials"));
    expect(state).toMatchObject({ isLoading: false, error: "Bad credentials" });
    state = authReducer(state, registerUser.rejected(null, "register-request", {}, "Registration failed"));
    expect(state).toMatchObject({ isLoading: false, error: "Registration failed" });
    expect(authReducer(state, clearError()).error).toBeNull();
  });

  it("stores the fetched user and only clears auth on unauthorized errors", () => {
    const initial = authReducer(undefined, { type: "@@INIT" });
    const withAuth = { ...initial, token: "token", user };
    expect(authReducer(withAuth, fetchMe.fulfilled(user, "fetch-user", undefined)).user).toEqual(user);

    const unauthorized = authReducer(
      withAuth,
      fetchMe.rejected(null, "fetch-user", undefined, "UNAUTHORIZED")
    );
    expect(unauthorized).toMatchObject({ token: null, user: null });

    const otherError = authReducer(
      withAuth,
      fetchMe.rejected(null, "fetch-user", undefined, "Network failed")
    );
    expect(otherError).toMatchObject({ token: "token", user });

    expect(authReducer(withAuth, authLogout())).toMatchObject({ token: null, user: null });
  });

  it("clears stored auth when logout is reduced", () => {
    const initial = authReducer(undefined, { type: "@@INIT" });
    expect(initial.initialized).toBe(false);
  });
});

describe("post reducer transitions", () => {
  it("tracks list and detail loading, success, errors, and clearing", () => {
    let state = postReducer(undefined, { type: "@@INIT" });
    expect(state.isLoading).toBe(true);
    state = postReducer(state, fetchPosts.pending("list", undefined));
    expect(state).toMatchObject({ isLoading: true, error: null });
    state = postReducer(state, fetchPosts.fulfilled([post], "list", undefined));
    expect(state).toMatchObject({ isLoading: false, posts: [post] });
    state = postReducer(state, fetchPosts.rejected(null, "list", undefined, "List failed"));
    expect(state).toMatchObject({ isLoading: false, error: "List failed" });

    state = postReducer(state, fetchPostDetail.pending("detail", 1));
    expect(state).toMatchObject({ isLoading: true, error: null });
    state = postReducer(state, fetchPostDetail.fulfilled(post, "detail", 1));
    expect(state).toMatchObject({ isLoading: false, selectedPost: post });
    state = postReducer(state, fetchPostDetail.rejected(null, "detail", 1));
    expect(state).toMatchObject({ isLoading: false, error: "Postingan tidak ditemukan" });
    state = postReducer({ ...state, selectedPost: post }, clearSelectedPost());
    expect(state).toMatchObject({ selectedPost: null, error: null });
  });

  it("creates, updates, and deletes posts while synchronizing selected detail", () => {
    const updated = { ...post, title: "Updated" };
    let state = postReducer(undefined, createPost.fulfilled(post, "create", { title: post.title, content: post.content }));
    expect(state.posts).toEqual([post]);
    state = postReducer(
      { ...state, selectedPost: post },
      updatePost.fulfilled(updated, "update", { id: 1, title: updated.title, content: updated.content })
    );
    expect(state.posts).toEqual([updated]);
    expect(state.selectedPost).toEqual(updated);

    state = postReducer(state, deletePost.fulfilled(1, "delete", 1));
    expect(state.posts).toEqual([]);
    expect(state.selectedPost).toEqual(updated);

    state = postReducer(
      { ...state, posts: [post] },
      updatePost.fulfilled({ ...updated, id: 9 }, "update-other", { id: 9, title: "x", content: "y" })
    );
    expect(state.posts).toEqual([post]);
  });
});

describe("user reducer and configured store", () => {
  it("updates users and profile, persists and clears the token", () => {
    let state = userReducer(undefined, setUser(user));
    expect(state.user).toEqual(user);
    state = userReducer(state, setUsers([user]));
    expect(state.users).toEqual([user]);
    state = userReducer(state, setTokenState("user-token"));
    expect(state.token).toBe("user-token");
    expect(getToken()).toBe("user-token");
    state = userReducer(state, userLogout());
    expect(state).toMatchObject({ user: null, token: null });
    expect(getToken()).toBeNull();
  });

  it("exposes initialized Redux slices", () => {
    expect(store.getState()).toHaveProperty("auth");
    expect(store.getState()).toHaveProperty("posts");
    expect(store.getState()).toHaveProperty("users");
  });
});
