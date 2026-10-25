import React from "react";
import { ChevronDown } from "lucide-react";

export function Select({ children, ...props }) {
  return <span className="select-control">
    <select {...props}>{children}</select>
    <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true"/>
  </span>;
}
