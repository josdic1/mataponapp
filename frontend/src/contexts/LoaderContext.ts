import { createContext } from "react";

export type LoaderContextValue = {
  loading: boolean;
  showLoader: () => void;
  hideLoader: () => void;
};

export const LoaderContext = createContext<LoaderContextValue | null>(null);
