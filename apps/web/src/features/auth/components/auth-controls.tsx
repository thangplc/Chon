import { auth, signIn, signOut } from "@/auth";

import { AuthIdentitySync } from "./auth-identity-sync";

async function signInWithGoogle() {
  "use server";
  await signIn("google", { redirectTo: "/" });
}

async function signOutFromChon() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export async function AuthControls() {
  const session = await auth();
  const user = session?.user;

  return (
    <div className="border-b border-[#173f33]/10 bg-[#173f33] px-4 py-2 text-[#f8f3e8] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1480px] items-center justify-end gap-3 text-xs">
        {user ? (
          <>
            <AuthIdentitySync />
            <span className="truncate text-[#dce8e1]">
              Xin chào, {user.name ?? user.email ?? "bạn"}
            </span>
            <form action={signOutFromChon}>
              <button
                className="rounded-full border border-white/25 px-3 py-1.5 font-bold transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4c96b]"
                type="submit"
              >
                Đăng xuất
              </button>
            </form>
          </>
        ) : (
          <form action={signInWithGoogle}>
            <button
              className="rounded-full bg-[#f4c96b] px-3 py-1.5 font-bold text-[#173f33] transition hover:bg-[#f8d98e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4c96b]"
              type="submit"
            >
              Đăng nhập bằng Google
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
