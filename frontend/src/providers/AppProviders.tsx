import type { ReactNode } from "react";
import AuthProvider from "./AuthProvider";
import LoaderProvider from "./LoaderProvider";

export function AppProviders({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <LoaderProvider>
      <AuthProvider>{children}</AuthProvider>
    </LoaderProvider>
  );
}
