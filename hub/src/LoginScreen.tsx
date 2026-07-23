import { useState } from "react";
import patchEmblem from "./assets/1cd-patch.png";
import { login } from "./auth";

interface LoginScreenProps {
  onSuccess: () => void;
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await login(password);
    setSubmitting(false);
    if (result.ok) onSuccess();
    else setError(result.error);
  }

  return (
    <div className="login-screen">
      <form className="login-form" onSubmit={handleSubmit}>
        <img src={patchEmblem} alt="1st Cavalry Division patch" className="login-emblem" />
        <h1>7Cav Apps</h1>
        <p>Enter the access password to continue.</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
        />
        {error && <p className="login-error">{error}</p>}
        <button type="submit" disabled={submitting || !password}>
          {submitting ? "Checking…" : "Enter"}
        </button>
      </form>
    </div>
  );
}
