import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "quiet" | "accent";

export function buttonClassName(
  variant: ButtonVariant = "primary",
  className?: string
) {
  return ["ui-button", "ui-button-" + variant, className].filter(Boolean).join(" ");
}

/**
 * The shared control language for actions throughout the practice flow. The
 * visual variants stay intentionally small so the problem remains the page's
 * primary object, not its controls.
 */
export default function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button type={type} className={buttonClassName(variant, className)} {...props} />;
}
