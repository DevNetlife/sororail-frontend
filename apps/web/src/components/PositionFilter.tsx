"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { POSITION_FILTER_PARAM } from "@/lib/position-filter";

/**
 * The position list filter, kept in the URL (`?q=`) so a filtered list can be
 * reloaded or shared (#427). Read after mount, so the server render and the
 * first client render agree.
 */
export function usePositionFilter(): [string, (value: string) => void] {
  const [query, setQueryState] = useState("");

  useEffect(() => {
    setQueryState(new URLSearchParams(window.location.search).get(POSITION_FILTER_PARAM) ?? "");
  }, []);

  const setQuery = useCallback((value: string) => {
    setQueryState(value);
    const url = new URL(window.location.href);
    if (value.trim()) url.searchParams.set(POSITION_FILTER_PARAM, value);
    else url.searchParams.delete(POSITION_FILTER_PARAM);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  return [query, setQuery];
}

/**
 * `children` renders further filter dimensions (e.g. the status control, #428)
 * inside the same filter block, so a list page has one filter UI, not two.
 */
export function PositionFilter({
  noun,
  query,
  onChange,
  shown,
  total,
  children,
}: {
  noun: string;
  query: string;
  onChange: (value: string) => void;
  shown: number;
  total: number;
  children?: ReactNode;
}) {
  const id = `position-filter-${noun}`;
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        Find a {noun}
      </label>
      <div className="row">
        <input
          id={id}
          type="search"
          value={query}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Name or contract address"
          spellCheck={false}
        />
        {query ? (
          <button type="button" className="button--quiet" onClick={() => onChange("")}>
            Clear
          </button>
        ) : null}
      </div>
      {query ? (
        <p className="small muted m-0" role="status">
          Showing {shown} of {total}
        </p>
      ) : null}
      {children}
    </div>
  );
}
