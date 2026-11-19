import { useCallback, useEffect, useRef, useState } from "react";

interface AsyncActionState<R> {
  busy: boolean;
  error: unknown;
  result: R | undefined;
}

const IDLE = { busy: false, error: null, result: undefined } as const;

/**
 * Busy, error and success state for a sign-and-submit action, which every
 * page used to repeat by hand.
 *
 * `run` never rejects: a failure is stored in `error` and `run` resolves to
 * `undefined`, so `onClick={() => void run()}` is safe. Only the latest call
 * updates state, so a slow earlier call cannot overwrite a newer result, and
 * nothing is set after the component unmounts mid-flight. `reset` clears the
 * error and result, for when a dialog is dismissed.
 */
export function useAsyncAction<Args extends unknown[], R>(
  action: (...args: Args) => Promise<R>,
) {
  const [state, setState] = useState<AsyncActionState<R>>(IDLE);
  const actionRef = useRef(action);
  const mountedRef = useRef(true);
  const callRef = useRef(0);

  useEffect(() => {
    actionRef.current = action;
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(async (...args: Args): Promise<R | undefined> => {
    const call = ++callRef.current;
    const isCurrent = () => mountedRef.current && call === callRef.current;
    setState({ busy: true, error: null, result: undefined });
    try {
      const result = await actionRef.current(...args);
      if (isCurrent()) setState({ busy: false, error: null, result });
      return result;
    } catch (error) {
      if (isCurrent()) setState({ busy: false, error, result: undefined });
      return undefined;
    }
  }, []);

  const reset = useCallback(() => {
    callRef.current += 1;
    setState(IDLE);
  }, []);

  return { run, reset, ...state };
}
