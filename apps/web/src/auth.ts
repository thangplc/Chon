import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { auth, handlers, signIn, signOut } = NextAuth({
  callbacks: {
    async jwt({ account, profile, token }) {
      if (account?.provider === "google") {
        token.provider = "google";
        token.providerSubject = account.providerAccountId;
        token.sub = account.providerAccountId;
      }
      if (profile) {
        token.email =
          typeof profile.email === "string" ? profile.email : token.email;
        token.name =
          typeof profile.name === "string" ? profile.name : token.name;
        token.picture =
          typeof profile.picture === "string" ? profile.picture : token.picture;
      }
      return token;
    },
    async session({ session, token }) {
      const providerSubject =
        typeof token.providerSubject === "string"
          ? token.providerSubject
          : token.sub;
      if (providerSubject) {
        session.user.id = providerSubject;
        session.user.providerSubject = providerSubject;
      }
      session.user.provider =
        token.provider === "google" ? "google" : undefined;
      return session;
    },
  },
  providers: [Google],
  session: { strategy: "jwt" },
  trustHost: process.env.AUTH_TRUST_HOST === "true",
});
