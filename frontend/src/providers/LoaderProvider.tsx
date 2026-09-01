import { useState, type ReactNode } from "react";
import { LoaderContext } from "../contexts/LoaderContext";
import { MataponiLoader } from "../components/feedback/MataponiLoader";

export default function LoaderProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [count, setCount] = useState(0);

  function showLoader() {
    setCount((value) => value + 1);
  }

  function hideLoader() {
    setCount((value) => Math.max(0, value - 1));
  }

  const loading = count > 0;

  return (
    <LoaderContext.Provider value={{ loading, showLoader, hideLoader }}>
      {children}
      {loading && <MataponiLoader />}
    </LoaderContext.Provider>
  );
}
