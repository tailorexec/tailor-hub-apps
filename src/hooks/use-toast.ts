import { toast as sonnerToast } from "sonner";

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

export const toast = ({ title, description, variant }: ToastOptions) => {
  const message = title ?? "";
  if (variant === "destructive") {
    return sonnerToast.error(message, { description });
  }
  return sonnerToast(message, { description });
};
