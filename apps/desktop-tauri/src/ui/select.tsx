import type { SelectHTMLAttributes } from "react";
import styles from "./select.module.css";

/**
 * A plain native <select>. The system webview renders the OS picker, which is the right
 * behaviour for desktop chrome and saves the app a popover dependency.
 */
export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={[styles.select, className].filter(Boolean).join(" ")} {...props} />;
}
