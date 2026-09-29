"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { zcAuth } from "@zcatalyst/auth/web";
import { Datastore } from "@zcatalyst/datastore";
import styles from "./page.module.css";

type TodoRow = {
  ROWID: string;
  title: string;
  is_completed: string | boolean;
};

function isDone(value: TodoRow["is_completed"]): boolean {
  return value === true || value === "true";
}

function inIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export default function TodoApp() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadTodos = useCallback(async () => {
      const ds = new Datastore();
      const page = await ds.table("Todos").getPagedRows({ maxRows: 200 });
      setTodos((page.data ?? []) as unknown as TodoRow[]);
    }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await zcAuth.init();
        if (cancelled) return;
        setReady(true);

        const user = await zcAuth.isUserAuthenticated();
        if (cancelled) return;

        if (!user) {
          setAuthed(false);
          setLoading(false);
          await zcAuth.signIn("login-container", { redirectUrl: "/" });
          return;
        }

        setAuthed(true);
        await loadTodos();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to start Catalyst session");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadTodos]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    setError(null);
    try {
      const ds = new Datastore();
      await ds.table("Todos").insertRow({
        title: trimmed,
        is_completed: "false",
      });
      setTitle("");
      await loadTodos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add todo");
    } finally {
      setBusy(false);
    }
  }

  async function onToggle(todo: TodoRow) {
    setBusy(true);
    setError(null);
    try {
      const ds = new Datastore();
      await ds.table("Todos").updateRow({
        ROWID: todo.ROWID,
        is_completed: isDone(todo.is_completed) ? "false" : "true",
      });
      await loadTodos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update todo");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(rowId: string) {
    setBusy(true);
    setError(null);
    try {
      const ds = new Datastore();
      await ds.table("Todos").deleteRow(rowId);
      await loadTodos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete todo");
    } finally {
      setBusy(false);
    }
  }

  async function onSignOut() {
    if (inIframe()) {
      await zcAuth.signOutViaPopup("/");
    } else {
      await zcAuth.signOut("/");
    }
  }

  if (!ready || loading) {
    return (
      <main className={styles.shell}>
        <p className={styles.muted}>Starting Catalyst…</p>
      </main>
    );
  }

  if (!authed) {
    return (
      <main className={styles.shell}>
        <header className={styles.header}>
          <p className={styles.brand}>Todo</p>
          <h1 className={styles.headline}>Sign in to continue</h1>
          <p className={styles.muted}>Your list is stored in Catalyst Data Store.</p>
        </header>
        <div id="login-container" className={styles.login} />
        {error ? <p className={styles.error}>{error}</p> : null}
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.topRow}>
          <p className={styles.brand}>Todo</p>
          <button type="button" className={styles.ghost} onClick={onSignOut}>
            Sign out
          </button>
        </div>
        <h1 className={styles.headline}>Today</h1>
        <p className={styles.muted}>Add, complete, or remove items in your list.</p>
      </header>

      <form className={styles.form} onSubmit={onAdd}>
        <input
          className={styles.input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          maxLength={255}
          disabled={busy}
          aria-label="New todo title"
        />
        <button className={styles.primary} type="submit" disabled={busy || !title.trim()}>
          Add
        </button>
      </form>

      {error ? <p className={styles.error}>{error}</p> : null}

      <ul className={styles.list}>
        {todos.length === 0 ? (
          <li className={styles.empty}>No todos yet.</li>
        ) : (
          todos.map((todo) => {
            const done = isDone(todo.is_completed);
            return (
              <li key={todo.ROWID} className={styles.item}>
                <label className={styles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={done}
                    disabled={busy}
                    onChange={() => onToggle(todo)}
                  />
                  <span className={done ? styles.done : undefined}>{todo.title}</span>
                </label>
                <button
                  type="button"
                  className={styles.ghost}
                  disabled={busy}
                  onClick={() => onDelete(todo.ROWID)}
                >
                  Delete
                </button>
              </li>
            );
          })
        )}
      </ul>
    </main>
  );
}
