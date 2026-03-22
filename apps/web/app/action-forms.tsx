"use client";

import { useActionState } from "react";

export type ActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export const initialActionState: ActionState = {
  status: "idle",
  message: null
};

type StatefulAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

type ServerActionFormProps = {
  action: StatefulAction;
  className?: string;
  children: React.ReactNode;
};

export function ServerActionForm({ action, className, children }: ServerActionFormProps) {
  const [state, formAction] = useActionState(action, initialActionState);

  return (
    <form action={formAction} className={className}>
      {children}
      {state.status !== "idle" ? (
        <p className={`actionMessage actionMessage-${state.status}`} role={state.status === "error" ? "alert" : "status"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
