type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next =
    params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/";
  const hasError = params.error === "1";

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-zinc-100">
      <form
        action="/api/auth/login"
        method="post"
        className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-xl"
      >
        <div className="text-sm text-zinc-400">Private Dashboard</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">로그인</h1>

        <input type="hidden" name="next" value={next} />

        <label className="mt-6 grid gap-2 text-sm">
          <span className="text-zinc-200">관리자 비밀번호</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
            className="rounded-xl border border-zinc-700 bg-black px-3 py-2 text-zinc-100 outline-none focus:border-zinc-400"
          />
        </label>

        {hasError ? (
          <p className="mt-3 text-sm text-rose-400">비밀번호가 올바르지 않습니다.</p>
        ) : null}

        <button
          type="submit"
          className="mt-5 w-full rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-black hover:bg-white"
        >
          들어가기
        </button>
      </form>
    </main>
  );
}
