import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FeedPage from "@/app/(dashboard)/page";
import PostsPage from "@/app/(dashboard)/posts/page";
import PostDetailPage from "@/app/(dashboard)/posts/[postId]/page";
import ProfilePage from "@/app/(dashboard)/profile/page";
import UsersPage from "@/app/(dashboard)/users/page";
import LoginPage from "@/app/auth/login/page";
import RegisterPage from "@/app/auth/register/page";
import { loginUser } from "@/features/auth/states/authSlice";
import { Post, User } from "@/types";

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  state: {
    auth: { token: "token" as string | null, user: null as User | null },
    posts: { posts: [] as Post[], selectedPost: null as Post | null, isLoading: false, error: null as string | null },
    users: { users: [] as User[] },
  },
  router: { push: vi.fn(), replace: vi.fn() },
  updateProfile: vi.fn(),
  updatePassword: vi.fn(),
  getUsers: vi.fn(),
  fetchApi: vi.fn(),
}));

vi.mock("@/hooks/redux", () => ({
  useAppDispatch: () => mocks.dispatch,
  useAppSelector: (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state),
}));

vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/features/users/api/userApi", () => ({
  getUsers: mocks.getUsers,
  updateProfile: mocks.updateProfile,
  updatePassword: mocks.updatePassword,
}));
vi.mock("@/helpers/apiHelper", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/helpers/apiHelper")>();
  return { ...actual, fetchApi: mocks.fetchApi };
});

const samplePost: Post = {
  id: 7,
  title: "Test post",
  content: "Post body",
  user_id: 5,
  created_at: "2026-01-01T00:00:00Z",
  cover: "cover.jpg",
};
const sampleUser: User = { id: 5, name: "Ari", email: "ari@example.test", bio: "Hello" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.auth = { token: "token", user: sampleUser };
  mocks.state.posts = { posts: [], selectedPost: null, isLoading: false, error: null };
  mocks.state.users = { users: [] };
  mocks.dispatch.mockResolvedValue({});
  mocks.updateProfile.mockResolvedValue({});
  mocks.updatePassword.mockResolvedValue({});
  mocks.getUsers.mockResolvedValue({ data: [sampleUser] });
  mocks.fetchApi.mockResolvedValue({});
  mocks.router.push.mockReset();
  mocks.router.replace.mockReset();
});

describe("dashboard pages", () => {
  it("exposes the feed at the posts route", () => {
    render(<PostsPage />);
    expect(screen.getByRole("heading", { name: "Utama & Feed" })).toBeInTheDocument();
  });

  it("renders feed loading, error, empty, and post-action states", () => {
    mocks.state.posts.isLoading = true;
    const { rerender } = render(<FeedPage />);
    expect(screen.getByText("Memuat konten...")).toBeInTheDocument();

    mocks.state.posts = { posts: [], selectedPost: null, isLoading: false, error: "Could not load" };
    rerender(<FeedPage />);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load");

    mocks.state.posts.error = null;
    rerender(<FeedPage />);
    expect(screen.getByText(/Belum ada postingan/)).toBeInTheDocument();

    mocks.state.posts.posts = [samplePost];
    rerender(<FeedPage />);
    expect(screen.getByText("Test post")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit postingan Test post" }));
    expect(screen.getByText("Test post")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Buat Post" }));

    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
    fireEvent.click(screen.getByRole("button", { name: "Hapus postingan Test post" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    vi.mocked(confirm).mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Hapus postingan Test post" }));
    expect(mocks.dispatch).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("loads and renders users, and displays API failures", async () => {
    const { rerender } = render(<UsersPage />);
    expect(screen.getByText("Memuat konten...")).toBeInTheDocument();
    await waitFor(() => expect(mocks.dispatch).toHaveBeenCalled());

    mocks.state.users.users = [sampleUser];
    rerender(<UsersPage />);
    expect(screen.getByText("Ari")).toBeInTheDocument();

    mocks.getUsers.mockRejectedValueOnce(new Error("Users failed"));
    const { unmount } = render(<UsersPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Users failed"));
    unmount();

    mocks.state.auth.token = null;
    render(<UsersPage />);
    expect(screen.getByText("Memuat konten...")).toBeInTheDocument();
  });

  it("normalizes wrapped user lists and uses fallback errors and names", async () => {
    mocks.getUsers.mockResolvedValueOnce({ data: { users: [{ ...sampleUser, name: "" }] } });
    const { rerender } = render(<UsersPage />);
    await waitFor(() => expect(mocks.dispatch).toHaveBeenCalled());
    mocks.state.users.users = [{ ...sampleUser, name: "" }];
    rerender(<UsersPage />);
    expect(screen.getByText("?")).toBeInTheDocument();

    mocks.getUsers.mockResolvedValueOnce({ data: {} });
    const emptyList = render(<UsersPage />);
    await waitFor(() => expect(mocks.dispatch).toHaveBeenCalledTimes(2));
    mocks.state.users.users = [];
    emptyList.rerender(<UsersPage />);
    expect(screen.getByText("Belum ada anggota terdaftar.")).toBeInTheDocument();
    emptyList.unmount();

    mocks.getUsers.mockRejectedValueOnce({});
    render(<UsersPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Gagal memuat daftar anggota");
  });

  it("submits profile and password forms and reports failures", async () => {
    render(<ProfilePage />);
    fireEvent.change(screen.getByLabelText("Nama"), { target: { value: "Ari Baru" } });
    fireEvent.change(screen.getByLabelText("Bio"), { target: { value: "Bio baru" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Profil" }));
    await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalledWith({ name: "Ari Baru", bio: "Bio baru" }));
    expect(await screen.findByText("Profil berhasil diperbarui!")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Kata Sandi Lama"), { target: { value: "old" } });
    fireEvent.change(screen.getByLabelText("Kata Sandi Baru"), { target: { value: "new" } });
    fireEvent.click(screen.getByRole("button", { name: "Ubah Sandi" }));
    await waitFor(() => expect(mocks.updatePassword).toHaveBeenCalledWith({ old_password: "old", new_password: "new" }));
    expect(await screen.findByText("Kata sandi berhasil diperbarui!")).toBeInTheDocument();

    mocks.updateProfile.mockRejectedValueOnce(new Error("Profile failed"));
    fireEvent.click(screen.getByRole("button", { name: "Simpan Profil" }));
    expect(await screen.findByText("Profile failed")).toBeInTheDocument();
    mocks.updatePassword.mockRejectedValueOnce(new Error("Password failed"));
    fireEvent.change(screen.getByLabelText("Kata Sandi Lama"), { target: { value: "old" } });
    fireEvent.change(screen.getByLabelText("Kata Sandi Baru"), { target: { value: "new" } });
    fireEvent.click(screen.getByRole("button", { name: "Ubah Sandi" }));
    expect(await screen.findByText("Password failed")).toBeInTheDocument();
  });

  it("covers profile initialization and fallback messages without a loaded user", async () => {
    mocks.state.auth.user = null;
    const { rerender } = render(<ProfilePage />);
    expect(screen.getByLabelText("Nama")).toHaveValue("");
    expect(screen.getByLabelText("Bio")).toHaveValue("");

    mocks.state.auth.user = { ...sampleUser, name: "", bio: null };
    rerender(<ProfilePage />);
    expect(screen.getByLabelText("Nama")).toHaveValue("");
    expect(screen.getByLabelText("Bio")).toHaveValue("");

    mocks.updateProfile.mockRejectedValueOnce({});
    fireEvent.change(screen.getByLabelText("Nama"), { target: { value: "Ari" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Profil" }));
    expect(await screen.findByText("Gagal memperbarui profil")).toBeInTheDocument();

    mocks.updatePassword.mockRejectedValueOnce({});
    fireEvent.change(screen.getByLabelText("Kata Sandi Lama"), { target: { value: "old" } });
    fireEvent.change(screen.getByLabelText("Kata Sandi Baru"), { target: { value: "new" } });
    fireEvent.click(screen.getByRole("button", { name: "Ubah Sandi" }));
    expect(await screen.findByText("Gagal memperbarui kata sandi")).toBeInTheDocument();
  });

  it("renders post detail loading, error, cover, author and fallback states", async () => {
    const params = Object.assign(Promise.resolve({ postId: "7" }), {
      status: "fulfilled",
      value: { postId: "7" },
    }) as Promise<{ postId: string }>;
    mocks.state.posts.isLoading = true;
    const page = () => <Suspense fallback={<span>Waiting for route params</span>}><PostDetailPage params={params} /></Suspense>;
    const { rerender } = render(page());
    expect(await screen.findByText("Memuat konten...")).toBeInTheDocument();

    mocks.state.posts = { posts: [], selectedPost: null, isLoading: false, error: "Missing post" };
    rerender(page());
    expect(screen.getByRole("alert")).toHaveTextContent("Missing post");

    mocks.state.posts = {
      posts: [],
      selectedPost: { ...samplePost, user: sampleUser },
      isLoading: false,
      error: null,
    };
    rerender(page());
    expect(screen.getByText("Post body")).toBeInTheDocument();
    expect(screen.getByText("Ubah Cover")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ubah Cover" }));

    const image = screen.getByRole("img", { name: "Test post" });
    fireEvent.error(image);
    expect(screen.getByText("Cover gagal dimuat, ganti gambar")).toBeInTheDocument();

    mocks.state.auth.user = { ...sampleUser, id: 99 };
    mocks.state.posts.selectedPost = { ...samplePost, created_at: "invalid-date" };
    rerender(page());
    expect(screen.queryByText("Cover gagal dimuat, ganti gambar")).not.toBeInTheDocument();
    expect(screen.getByText("Post body")).toBeInTheDocument();

    mocks.state.auth.token = null;
    mocks.state.posts.selectedPost = { ...samplePost, cover: undefined };
    mocks.state.auth.user = sampleUser;
    rerender(page());
    expect(screen.getByText("Tambah Gambar Sampul (Cover)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tambah Gambar Sampul (Cover)" }));
    expect(mocks.dispatch).toHaveBeenCalled();
  });
});

describe("authentication pages", () => {
  it("submits login credentials and displays a login error", async () => {
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Username / Email"), { target: { value: " ari " } });
    fireEvent.change(screen.getByLabelText("Kata Sandi"), { target: { value: "secret" } });
    mocks.dispatch.mockResolvedValueOnce(loginUser.fulfilled(
      { token: "token", user: sampleUser },
      "login-request",
      {}
    ));
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith("/"));

    mocks.dispatch.mockResolvedValueOnce(loginUser.rejected(null, "login-request", {}, "Invalid credentials"));
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials");

    mocks.dispatch.mockResolvedValueOnce(loginUser.rejected(null, "login-request", {}, ""));
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Gagal melakukan login. Periksa kembali kredensial Anda."
    );
  });

  it("validates registration password, submits registration and shows failures", async () => {
    render(<RegisterPage />);
    fireEvent.change(screen.getByLabelText("Nama Lengkap"), { target: { value: " Ari " } });
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: " ari " } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ari@example.test" } });
    fireEvent.change(screen.getByLabelText("Kata Sandi"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Daftar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Kata sandi minimal 8 karakter.");
    expect(mocks.fetchApi).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Kata Sandi"), { target: { value: "long-enough" } });
    fireEvent.click(screen.getByRole("button", { name: "Daftar" }));
    await waitFor(() => expect(mocks.fetchApi).toHaveBeenCalledWith("/auth/register", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"name":"Ari"'),
    })));
    expect(mocks.router.push).toHaveBeenCalledWith("/auth/login");

    mocks.fetchApi.mockRejectedValueOnce(new Error("Registration failed"));
    fireEvent.click(screen.getByRole("button", { name: "Daftar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Registration failed");

    mocks.fetchApi.mockRejectedValueOnce({});
    fireEvent.click(screen.getByRole("button", { name: "Daftar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Gagal melakukan pendaftaran.");
  });
});
