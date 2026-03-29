import type { ChangeEventHandler, CSSProperties, ReactNode } from "react";

type SelectFieldProps = {
  id: string;
  value: string | number;
  onChange: ChangeEventHandler<HTMLSelectElement>;
  children: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
  name?: string;
  shellTestId?: string;
  chevronTestId?: string;
  selectStyle?: CSSProperties;
  shellStyle?: CSSProperties;
  chevronStyle?: CSSProperties;
};

export function SelectField({
  id,
  value,
  onChange,
  children,
  ariaLabel,
  disabled = false,
  name,
  shellTestId,
  chevronTestId,
  selectStyle,
  shellStyle,
  chevronStyle
}: SelectFieldProps) {
  return (
    <div data-testid={shellTestId} style={{ ...selectFieldShellStyle, ...shellStyle }}>
      <select
        id={id}
        name={name}
        aria-label={ariaLabel}
        value={value}
        disabled={disabled}
        onChange={onChange}
        style={{ ...baseSelectStyle, ...selectStyle }}
      >
        {children}
      </select>
      <span data-testid={chevronTestId} aria-hidden="true" style={{ ...selectChevronStyle, ...chevronStyle }}>
        ⌄
      </span>
    </div>
  );
}

export const baseSelectStyle: CSSProperties = {
  width: "100%",
  minHeight: "34px",
  padding: "6px 34px 6px 10px",
  borderRadius: "10px",
  border: "1px solid rgba(15, 23, 42, 0.16)",
  background: "linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.92))",
  color: "#f8fafc",
  fontSize: "0.78rem",
  fontWeight: 600,
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  boxSizing: "border-box"
};

export const selectFieldShellStyle: CSSProperties = {
  position: "relative",
  minWidth: 0
};

export const selectChevronStyle: CSSProperties = {
  position: "absolute",
  right: "10px",
  top: "50%",
  transform: "translateY(-50%)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "18px",
  height: "18px",
  borderRadius: "999px",
  background: "rgba(56, 189, 248, 0.16)",
  color: "#7dd3fc",
  fontSize: "0.72rem",
  pointerEvents: "none"
};
