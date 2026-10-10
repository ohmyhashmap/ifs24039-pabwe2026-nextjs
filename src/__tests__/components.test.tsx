import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import Providers from "@/components/Providers";
import ChangeCoverModal from "@/features/posts/components/ChangeCoverModal";
import CreatePostModal from "@/features/posts/components/CreatePostModal";
import EditPostModal from "@/features/posts/components/EditPostModal";
import PostCard from "@/features/posts/components/PostCard";
import { Post, User } from "@/types";
import { store } from "@/store";

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  router: { replace: vi.fn() },
  state: {
    auth: { token: null as string | null, user: null as User | null, initialized: false },
  },
  updateCover: vi.fn(),
}));

vi.mock("@/hooks/redux", () => ({
  useAppDispatch: () => mocks.dispatch,
  useAppSelector: (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state),
}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/features/posts/api/postApi", () => ({
  postApi: { updateCover: mocks.updateCover },
}));

const author: User = { id: 1, name: "Ari", email: "ari@example.test" };
const post: Post = {
  id: 3,
  title: "Example",
  content: "Post text",
  user_id: 1,
  created_at: "not a date",
  cover: "https://example.test/cover.jpg",
  user: author,
};
const postWithoutTitle = { ...post, title: undefined } as unknown as Post;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.auth = { token: null, user: null, initialized: false };
  mocks.dispatch.mockResolvedValue({});
  mocks.updateCover.mockResolvedValue({});
});

describe("post components", () => {
  it("updates a cover and reports API errors", async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    const { rerender } = render(
      <ChangeCoverModal isOpen onClose={onClose} onSuccess={onSuccess} postId={3} />
    );
    fireEvent.submit(screen.getByRole("button", { name: "Perbarui Cover" }).closest("form")!);
    expect(mocks.updateCover).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("URL Gambar"), {
      target: { value: "https://example.test/new.jpg" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Perbarui Cover" }));
    await waitFor(() => expect(mocks.updateCover).toHaveBeenCalledWith(3, "https://example.test/new.jpg"));
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();

    mocks.updateCover.mockRejectedValueOnce(new Error("Cover failed"));
    rerender(<ChangeCoverModal isOpen onClose={onClose} onSuccess={onSuccess} postId={3} />);
    fireEvent.change(screen.getByLabelText("URL Gambar"), {
      target: { value: "https://example.test/fail.jpg" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Perbarui Cover" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cover failed");

    mocks.updateCover.mockRejectedValueOnce({});
    fireEvent.change(screen.getByLabelText("URL Gambar"), {
      target: { value: "https://example.test/fail-empty.jpg" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Perbarui Cover" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Gagal memperbarui gambar sampul");
  });

  it("creates posts and closes after dispatch", async () => {
    const onClose = vi.fn();
    render(<CreatePostModal isOpen onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Judul"), { target: { value: "New post" } });
    fireEvent.change(screen.getByLabelText("Konten"), { target: { value: "Body" } });
    fireEvent.click(screen.getByRole("button", { name: "Publikasikan" }));
    await waitFor(() => expect(mocks.dispatch).toHaveBeenCalledOnce());
    expect(onClose).toHaveBeenCalledOnce();

    const form = screen.getByRole("button", { name: "Publikasikan" }).closest("form");
    fireEvent.submit(form!);
    expect(mocks.dispatch).toHaveBeenCalledOnce();
  });

  it("edits an existing post and skips dispatch when no post is selected", async () => {
    const onClose = vi.fn();
    const { rerender } = render(<EditPostModal isOpen onClose={onClose} post={null} />);
    fireEvent.change(screen.getByLabelText("Judul"), { target: { value: "Ignored" } });
    fireEvent.change(screen.getByLabelText("Konten"), { target: { value: "Ignored" } });
    fireEvent.submit(screen.getByRole("button", { name: "Simpan Perubahan" }).closest("form")!);
    expect(mocks.dispatch).not.toHaveBeenCalled();

    rerender(<EditPostModal isOpen onClose={onClose} post={post} />);
    fireEvent.change(screen.getByLabelText("Judul"), { target: { value: "Updated" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Perubahan" }));
    await waitFor(() => expect(mocks.dispatch).toHaveBeenCalledOnce());
    expect(onClose).toHaveBeenCalledOnce();

    rerender(<EditPostModal isOpen onClose={onClose} post={{ ...post, title: "", content: "" }} />);
    expect(screen.getByLabelText("Judul")).toHaveValue("");
    expect(screen.getByLabelText("Konten")).toHaveValue("");
    fireEvent.submit(screen.getByRole("button", { name: "Simpan Perubahan" }).closest("form")!);
    expect(mocks.dispatch).toHaveBeenCalledOnce();
    fireEvent.change(screen.getByLabelText("Judul"), { target: { value: "Updated" } });
    fireEvent.submit(screen.getByRole("button", { name: "Simpan Perubahan" }).closest("form")!);
    expect(mocks.dispatch).toHaveBeenCalledOnce();
  });

  it("renders image, date, owner controls and fallback post metadata", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const { rerender } = render(
      <PostCard post={post} currentUserId={1} onEdit={onEdit} onDelete={onDelete} priority />
    );
    expect(screen.getByRole("img", { name: "Example" })).toHaveAttribute("fetchPriority", "high");
    expect(screen.queryByText("not a date")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit postingan Example" }));
    fireEvent.click(screen.getByRole("button", { name: "Hapus postingan Example" }));
    expect(onEdit).toHaveBeenCalledWith(post);
    expect(onDelete).toHaveBeenCalledWith(3);
    fireEvent.error(screen.getByRole("img", { name: "Example" }));
    expect(screen.queryByRole("img", { name: "Example" })).not.toBeInTheDocument();

    rerender(<PostCard key="priority-false" post={post} priority={false} />);
    expect(screen.getByRole("img", { name: "Example" })).toHaveAttribute("loading", "lazy");
    expect(screen.getByRole("img", { name: "Example" })).toHaveAttribute("fetchPriority", "auto");

    rerender(<PostCard post={{ ...post, title: " ", cover: undefined, user: undefined }} />);
    expect(screen.getByText("Postingan #3")).toBeInTheDocument();
    expect(screen.getByText("Oleh: Pengguna Anonim")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Lihat detail postingan Postingan #3/ })).toBeInTheDocument();

    rerender(<PostCard post={postWithoutTitle} currentUserId={1} />);
    expect(screen.getByText("Postingan #3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit postingan/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Hapus postingan/ })).not.toBeInTheDocument();

    rerender(<PostCard post={{ ...post, title: "No actions", cover: undefined, created_at: "" }} currentUserId={2} />);
    expect(screen.getByText("Oleh: Ari")).toBeInTheDocument();
  });
});

describe("application shell components", () => {
  it("renders navbar navigation and dispatches logout", () => {
    mocks.state.auth.user = author;
    render(<Navbar />);
    expect(screen.getByRole("navigation", { name: "Navigasi utama" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Profil Ari" })).toHaveAttribute("href", "/profile");
    fireEvent.click(screen.getByRole("button", { name: "Keluar" }));
    expect(mocks.dispatch).toHaveBeenCalledOnce();

    mocks.state.auth.user = null;
    render(<Navbar />);
    expect(screen.getByRole("link", { name: "Profil" })).toHaveAttribute("href", "/profile");
  });

  it("guards routes based on initialization, token, and user state", () => {
    const { rerender } = render(<AuthGuard><p>Private content</p></AuthGuard>);
    expect(screen.getByText("Private content")).toBeInTheDocument();

    mocks.state.auth.initialized = true;
    rerender(<AuthGuard><p>Private content</p></AuthGuard>);
    expect(screen.getByText("Memuat...")).toBeInTheDocument();
    expect(mocks.router.replace).toHaveBeenCalledWith("/auth/login");

    mocks.state.auth.token = "valid";
    rerender(<AuthGuard><p>Private content</p></AuthGuard>);
    expect(screen.getByText("Private content")).toBeInTheDocument();
    expect(mocks.dispatch).toHaveBeenCalled();

    mocks.state.auth.user = author;
    rerender(<AuthGuard><p>Private content</p></AuthGuard>);
    expect(screen.getByText("Private content")).toBeInTheDocument();
  });

  it("provides the Redux store and hydrates auth after mount", async () => {
    localStorage.setItem("token", "hydrated-token");
    render(<Providers><p>Application</p></Providers>);
    expect(screen.getByText("Application")).toBeInTheDocument();
    await waitFor(() => expect(store.getState().auth.token).toBe("hydrated-token"));
    localStorage.removeItem("token");
  });
});
