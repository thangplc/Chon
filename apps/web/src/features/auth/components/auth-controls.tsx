import { auth, signIn, signOut } from "@/auth";

import { AuthIdentitySync } from "./auth-identity-sync";

type AuthControlsProps = Readonly<{
  className?: string;
}>;

async function signInWithGoogle() {
  "use server";
  await signIn("google", { redirectTo: "/" });
}

async function signOutFromChon() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export async function AuthControls({ className = "" }: AuthControlsProps = {}) {
  const session = await auth();
  const user = session?.user;

  return (
    <div className={`flex min-w-0 items-center gap-2 text-xs ${className}`}>
      {user ? (
        <>
          <AuthIdentitySync />
          <span className="hidden max-w-[13rem] truncate font-semibold text-[#756c63] sm:inline">
            Xin chào, {user.name ?? user.email ?? "bạn"}
          </span>
          <form action={signOutFromChon}>
            <button
              className="min-h-9 rounded-full border border-[#ddd2c3] bg-[#fffdf9] px-2.5 font-bold text-[#28231f] transition hover:border-[#c96040] hover:text-[#963f2a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c96040] sm:px-3"
              type="submit"
            >
              Đăng xuất
            </button>
          </form>
        </>
      ) : (
        <form action={signInWithGoogle}>
          <button
            className="min-h-9 rounded-full border border-[#ddd2c3] bg-[#fffdf9] px-2.5 font-bold text-[#28231f] transition hover:border-[#c96040] hover:text-[#963f2a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c96040] sm:px-3"
            type="submit"
          >
            Đăng nhập
          </button>
        </form>
      )}
    </div>
  );
}
